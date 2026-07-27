/*
 * @Description: 缓存预热异步任务管理器（内存版）
 * @Author: 安知鱼
 *
 * 对应 Plan Phase 4 Task 4.5。功能职责：
 *   - 为 ImageStyleService.WarmCache 维护任务生命周期
 *   - 用 (policyID, styleName) 去重同一任务的并发触发
 *   - 对外暴露进度查询与取消能力
 *
 * 设计要点：
 *   - 纯内存实现，无外部依赖（Plan §4.5 允许 Redis 或内存，MVP 选内存）
 *   - 任务完成后进度保留一段时间供前端轮询，超过保留期通过 Reap 手动回收
 *   - 任务 ID 使用 sha256(policyID|styleName|nowNS) 前 12 位 hex，避免对外泄露 PID
 *   - 每个任务持有一个 ctx + cancel，允许管理员通过 Cancel(taskID) 中止运行中的任务，
 *     避免上万张图的水印叠加任务在线上长时间占用资源无法回收（Major 可改进点修复）
 */
package image_style

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"sync"
	"time"
)

// ErrWarmTaskNotFound 查询不存在的预热任务时返回。
var ErrWarmTaskNotFound = errors.New("warm task not found")

// warmTaskEntry 是 warmTaskManager 内部持有的任务元数据。
// 除了前端可见的 WarmProgress 之外，还绑定一个 ctx/cancel，
// 供 Cancel(taskID) 打断运行中的 goroutine。
type warmTaskEntry struct {
	progress *WarmProgress
	ctx      context.Context
	cancel   context.CancelFunc
}

// warmTaskManager 负责 WarmCache 任务的注册、更新与查询。
// 所有外部访问均加锁，内部状态通过 copy-on-read 避免调用方修改快照。
type warmTaskManager struct {
	mu        sync.RWMutex
	byTask    map[string]*warmTaskEntry
	activeKey map[string]string // key => taskID（用于去重）
	now       func() time.Time  // 可注入便于测试
}

// newWarmTaskManager 构造管理器。now 可传 nil，默认使用 time.Now。
func newWarmTaskManager(now func() time.Time) *warmTaskManager {
	if now == nil {
		now = time.Now
	}
	return &warmTaskManager{
		byTask:    make(map[string]*warmTaskEntry),
		activeKey: make(map[string]string),
		now:       now,
	}
}

// warmTaskKey 构造 (policyID, styleName) 的去重键。
func warmTaskKey(policyID uint, styleName string) string {
	return strconv.FormatUint(uint64(policyID), 10) + ":" + styleName
}

// genTaskID 生成 sha256(policyID|styleName|unixNano|seq) 前 12 hex。
// 必须在 m.mu 已持锁（读写皆可）时调用，seq 由调用方传入以避免重入加锁。
func genTaskID(policyID uint, styleName string, nowNS int64, seq int) string {
	h := sha256.New()
	fmt.Fprintf(h, "%d|%s|%d|%d", policyID, styleName, nowNS, seq)
	return hex.EncodeToString(h.Sum(nil))[:12]
}

// register 尝试登记新任务；若相同 (policyID, styleName) 已存在 running/pending
// 任务，则直接返回现有 taskID、ok=false、nil ctx，调用方应放弃启动新任务。
//
// 成功登记时返回 ctx 供后台 goroutine 消费；Cancel(taskID) 会触发该 ctx Done，
// goroutine 应该在每次文件处理前检查 ctx.Err() 以尽快退出。
func (m *warmTaskManager) register(policyID uint, styleName string) (taskID string, ctx context.Context, ok bool) {
	key := warmTaskKey(policyID, styleName)

	m.mu.Lock()
	defer m.mu.Unlock()

	if existing, exists := m.activeKey[key]; exists {
		if entry, still := m.byTask[existing]; still &&
			(entry.progress.Status == "pending" || entry.progress.Status == "running") {
			return existing, nil, false
		}
	}

	taskID = genTaskID(policyID, styleName, m.now().UnixNano(), len(m.byTask))
	taskCtx, cancel := context.WithCancel(context.Background())
	m.byTask[taskID] = &warmTaskEntry{
		progress: &WarmProgress{
			TaskID:    taskID,
			PolicyID:  policyID,
			StyleName: styleName,
			Status:    "pending",
			StartedAt: m.now(),
		},
		ctx:    taskCtx,
		cancel: cancel,
	}
	m.activeKey[key] = taskID
	return taskID, taskCtx, true
}

// setTotal 写入任务的 Total；一旦已知总数就立即调用，UI 能即时显示进度条。
// 同步把状态从 pending 切到 running。
func (m *warmTaskManager) setTotal(taskID string, total int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if e, ok := m.byTask[taskID]; ok {
		e.progress.Total = total
		e.progress.Status = "running"
	}
}

// inc 累计 processed / failed 其中之一。lastErr 非空时覆盖 LastError。
func (m *warmTaskManager) inc(taskID string, kind string, lastErr string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	e, ok := m.byTask[taskID]
	if !ok {
		return
	}
	switch kind {
	case "processed":
		e.progress.Processed++
	case "failed":
		e.progress.Failed++
		if lastErr != "" {
			e.progress.LastError = lastErr
		}
	}
}

// finish 结束任务并从 activeKey 中移除，保留 byTask 中的终态供查询。
// status 预期取值 "done" / "failed" / "cancelled"。
// 无论如何都会调用 cancel，保证 goroutine / ctx 不泄漏。
func (m *warmTaskManager) finish(taskID, status string, lastErr string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	e, ok := m.byTask[taskID]
	if !ok {
		return
	}
	e.progress.Status = status
	e.progress.FinishedAt = m.now()
	if lastErr != "" {
		e.progress.LastError = lastErr
	}
	if e.cancel != nil {
		e.cancel()
	}
	// 从 activeKey 删除，允许同策略+样式再次发起新任务
	for k, v := range m.activeKey {
		if v == taskID {
			delete(m.activeKey, k)
			break
		}
	}
}

// cancel 请求取消运行中/pending 的任务；已结束的任务无副作用。
// 返回 true 表示找到了任务并触发了取消。
func (m *warmTaskManager) cancel(taskID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	e, ok := m.byTask[taskID]
	if !ok {
		return false
	}
	if e.progress.Status == "pending" || e.progress.Status == "running" {
		if e.cancel != nil {
			e.cancel()
		}
	}
	return true
}

// get 返回任务进度的拷贝；调用方可安全修改返回值而不影响内部状态。
func (m *warmTaskManager) get(taskID string) (*WarmProgress, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	e, ok := m.byTask[taskID]
	if !ok {
		return nil, ErrWarmTaskNotFound
	}
	snapshot := *e.progress
	return &snapshot, nil
}

// reap 丢弃早于 cutoff 的已结束任务；由调用方决定何时调用。
// 管理器本身不启动后台 goroutine，避免与 Service 生命周期耦合。
func (m *warmTaskManager) reap(cutoff time.Time) int {
	m.mu.Lock()
	defer m.mu.Unlock()
	removed := 0
	for id, e := range m.byTask {
		if e.progress.Status == "pending" || e.progress.Status == "running" {
			continue
		}
		if !e.progress.FinishedAt.IsZero() && e.progress.FinishedAt.Before(cutoff) {
			if e.cancel != nil {
				e.cancel()
			}
			delete(m.byTask, id)
			removed++
		}
	}
	return removed
}
