/*
 * @Description: 图片样式 LRU 磁盘缓存实现
 * @Author: 安知鱼
 *
 * 对应规范：§7（缓存层）。
 *
 * 目录结构：
 *   {root}/{policy_id}/{file_id_prefix_6}/{file_id_padded}_{style_hash}.{ext}
 *
 * 设计要点：
 *   - 索引：内存 map + sync.RWMutex 保护；Phase 1 暂不落盘 .index.json，
 *     进程重启后重新扫描目录恢复。
 *   - 原子写入：先写 *.tmp，再 os.Rename 为正式名，避免半成品文件。
 *   - LRU：每次 Put 后检查 totalSize > max*1.1 则触发同步 evict 到 max*0.8。
 *   - 后台 goroutine：CleanupInterval > 0 时启动，周期性触发 maybeEvict。
 */
package image_style

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// ErrCacheMiss 表示请求的 (policy_id, file_id, style_hash) 组合未命中缓存。
var ErrCacheMiss = errors.New("image style cache miss")

// CacheConfig 描述 DiskCache 的构造参数。
type CacheConfig struct {
	// Root 缓存根目录，若不存在会在 NewDiskCache 中尝试创建。
	Root string
	// MaxSizeBytes 单 DiskCache 实例的总上限；超过 MaxSizeBytes*1.1 触发 evict 到 MaxSizeBytes*0.8。
	// 0 或负值表示不限制（不推荐生产使用）。
	MaxSizeBytes int64
	// CleanupInterval 后台定期 evict 的周期；<=0 表示不启用后台 goroutine。
	CleanupInterval time.Duration
}

// CacheEntry 单条缓存记录。
// 访问时序字段 (LastAccessAt / AccessCount) 以原子方式更新，避免热点路径加写锁。
type CacheEntry struct {
	PolicyID     uint      `json:"policy_id"`
	FileID       uint      `json:"file_id"`
	StyleHash    string    `json:"style_hash"`
	MIME         string    `json:"mime"`
	Ext          string    `json:"ext"`
	Size         int64     `json:"size"`
	CreatedAt    time.Time `json:"created_at"`
	LastAccessAt time.Time `json:"last_access_at"`
	AccessCount  int64     `json:"access_count"`

	// Path 绝对文件路径，仅内部使用。
	Path string `json:"-"`
}

// PurgeOpts 批量清理的过滤器；nil 字段表示"不限定该维度"。
// 组合使用：PolicyID + StyleHash/StyleHashFamily / PolicyID + FileID / 仅 PolicyID / 全部。
type PurgeOpts struct {
	PolicyID *uint
	// StyleHash 精确匹配单个派生图身份。
	StyleHash *string
	// StyleHashFamily 匹配基础样式 hash 及其所有 `hash-sourceVersion` 版本。
	StyleHashFamily *string
	FileID          *uint
}

// Cache 图片样式缓存的抽象接口。
type Cache interface {
	Get(ctx context.Context, policyID, fileID uint, styleHash string) (*CacheEntry, io.ReadCloser, error)
	Put(ctx context.Context, policyID, fileID uint, styleHash, mime, ext string, data []byte) (*CacheEntry, error)
	Purge(ctx context.Context, opts PurgeOpts) (int, error)
	Stats(ctx context.Context, policyID uint) (CacheStats, error)
	// ListAllStats 返回所有出现过缓存的策略的分组统计；
	// 未产生过缓存的策略不会出现在结果中（调用方按需在 handler 层补零）。
	// 结果按 PolicyID 升序返回，方便 UI 稳定呈现。
	ListAllStats(ctx context.Context) ([]CacheStats, error)
	Close() error
}

// DiskCache 基于本地磁盘的 LRU 缓存实现。
type DiskCache struct {
	root    string
	maxSize int64

	mu        sync.RWMutex
	entries   map[string]*CacheEntry // key = cacheKey(policy, file, hash)
	totalSize int64

	// hitCount / missCount 用于 Stats 诊断；原子更新。
	hitCount  int64
	missCount int64

	// 后台 cleanup 控制
	stopCh   chan struct{}
	stopOnce sync.Once
	wg       sync.WaitGroup
}

// NewDiskCache 构造一个 DiskCache。会确保 Root 目录存在并扫描已有文件重建索引。
func NewDiskCache(cfg CacheConfig) (*DiskCache, error) {
	if cfg.Root == "" {
		return nil, errors.New("CacheConfig.Root 不能为空")
	}
	if err := os.MkdirAll(cfg.Root, 0o755); err != nil {
		return nil, fmt.Errorf("创建缓存目录失败: %w", err)
	}

	c := &DiskCache{
		root:    cfg.Root,
		maxSize: cfg.MaxSizeBytes,
		entries: make(map[string]*CacheEntry),
		stopCh:  make(chan struct{}),
	}
	if err := c.scanDirectory(); err != nil {
		// 扫描失败不阻止启动；记录在内部但仍返回 cache 实例
		return c, fmt.Errorf("扫描缓存目录失败: %w", err)
	}

	if cfg.CleanupInterval > 0 {
		c.wg.Add(1)
		go c.cleanupLoop(cfg.CleanupInterval)
	}
	return c, nil
}

// Close 停止后台清理 goroutine；重复调用安全。
func (c *DiskCache) Close() error {
	c.stopOnce.Do(func() {
		close(c.stopCh)
		c.wg.Wait()
	})
	return nil
}

// cacheKey 构造内存索引的 key。
func cacheKey(policyID, fileID uint, styleHash string) string {
	return fmt.Sprintf("%d/%d/%s", policyID, fileID, styleHash)
}

// bucketPrefix 返回 file_id 的 sha256 前 6 位 hex，用于磁盘分桶。
func bucketPrefix(fileID uint) string {
	sum := sha256.Sum256([]byte(strconv.FormatUint(uint64(fileID), 10)))
	return hex.EncodeToString(sum[:3]) // 6 hex chars
}

// entryFilename 生成缓存文件相对路径，不含 root。
func entryFilename(fileID uint, styleHash, ext string) string {
	return fmt.Sprintf("%010d_%s.%s", fileID, styleHash, normExt(ext))
}

// entryPath 生成缓存文件的绝对路径。
func (c *DiskCache) entryPath(policyID, fileID uint, styleHash, ext string) string {
	return filepath.Join(
		c.root,
		strconv.FormatUint(uint64(policyID), 10),
		bucketPrefix(fileID),
		entryFilename(fileID, styleHash, ext),
	)
}

// normExt 规范化扩展名（去点、小写）。
func normExt(ext string) string {
	if len(ext) > 0 && ext[0] == '.' {
		ext = ext[1:]
	}
	// 小写
	buf := make([]byte, len(ext))
	for i := 0; i < len(ext); i++ {
		b := ext[i]
		if b >= 'A' && b <= 'Z' {
			b = b + ('a' - 'A')
		}
		buf[i] = b
	}
	return string(buf)
}

// Get 查找指定 key 的缓存。返回的 ReadCloser 在消费完后必须 Close。
// 命中时原子更新 LastAccessAt / AccessCount。
func (c *DiskCache) Get(ctx context.Context, policyID, fileID uint, styleHash string) (*CacheEntry, io.ReadCloser, error) {
	_ = ctx
	key := cacheKey(policyID, fileID, styleHash)

	c.mu.RLock()
	entry, ok := c.entries[key]
	c.mu.RUnlock()
	if !ok {
		atomic.AddInt64(&c.missCount, 1)
		return nil, nil, ErrCacheMiss
	}

	f, err := os.Open(entry.Path)
	if err != nil {
		// 文件已被外部删除或 Purge 并发清理过，需要同步清理内存索引。
		// 做存在性 + 同一指针校验，避免 Purge 已经减过 totalSize 后再次重复扣减。
		c.mu.Lock()
		if current, stillExists := c.entries[key]; stillExists && current == entry {
			delete(c.entries, key)
			c.totalSize -= entry.Size
		}
		c.mu.Unlock()
		atomic.AddInt64(&c.missCount, 1)
		return nil, nil, ErrCacheMiss
	}

	// 原子更新访问时间与次数（time.Time 不是原子类型，这里直接加写锁，
	// 热点路径下加锁时间很短，可接受）。
	// entryCopy 同样在锁内完成，避免另一 goroutine 同时写入 LastAccessAt/AccessCount
	// 与本次 `*entry` 复制竞争。
	now := time.Now()
	c.mu.Lock()
	entry.LastAccessAt = now
	entry.AccessCount++
	entryCopy := *entry
	c.mu.Unlock()

	atomic.AddInt64(&c.hitCount, 1)

	return &entryCopy, f, nil
}

// Put 将数据写入缓存。同 key 再次 Put 会覆盖旧条目。
// 写入顺序：临时文件 → fsync（隐含）→ rename；避免半成品。
func (c *DiskCache) Put(ctx context.Context, policyID, fileID uint, styleHash, mime, ext string, data []byte) (*CacheEntry, error) {
	_ = ctx
	key := cacheKey(policyID, fileID, styleHash)
	path := c.entryPath(policyID, fileID, styleHash, ext)

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, fmt.Errorf("创建缓存子目录失败: %w", err)
	}

	tmpPath := path + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0o644); err != nil {
		return nil, fmt.Errorf("写入缓存临时文件失败: %w", err)
	}
	if err := os.Rename(tmpPath, path); err != nil {
		_ = os.Remove(tmpPath)
		return nil, fmt.Errorf("原子 rename 失败: %w", err)
	}

	now := time.Now()
	entry := &CacheEntry{
		PolicyID:     policyID,
		FileID:       fileID,
		StyleHash:    styleHash,
		MIME:         mime,
		Ext:          normExt(ext),
		Size:         int64(len(data)),
		CreatedAt:    now,
		LastAccessAt: now,
		AccessCount:  0,
		Path:         path,
	}

	c.mu.Lock()
	if old, ok := c.entries[key]; ok {
		c.totalSize -= old.Size
	}
	c.entries[key] = entry
	c.totalSize += entry.Size
	c.mu.Unlock()

	c.maybeEvict()
	entryCopy := *entry
	return &entryCopy, nil
}

// Purge 按过滤器删除条目，返回删除数量。opts 字段均为 nil 表示清空全部。
func (c *DiskCache) Purge(ctx context.Context, opts PurgeOpts) (int, error) {
	_ = ctx
	c.mu.Lock()
	matched := make([]*CacheEntry, 0)
	for _, e := range c.entries {
		if opts.PolicyID != nil && e.PolicyID != *opts.PolicyID {
			continue
		}
		if opts.FileID != nil && e.FileID != *opts.FileID {
			continue
		}
		if opts.StyleHash != nil && e.StyleHash != *opts.StyleHash {
			continue
		}
		if opts.StyleHashFamily != nil &&
			e.StyleHash != *opts.StyleHashFamily &&
			!strings.HasPrefix(e.StyleHash, *opts.StyleHashFamily+"-") {
			continue
		}
		matched = append(matched, e)
	}

	for _, e := range matched {
		delete(c.entries, cacheKey(e.PolicyID, e.FileID, e.StyleHash))
		c.totalSize -= e.Size
	}
	c.mu.Unlock()

	var firstErr error
	for _, e := range matched {
		if err := os.Remove(e.Path); err != nil && !errors.Is(err, os.ErrNotExist) {
			if firstErr == nil {
				firstErr = err
			}
		}
	}
	return len(matched), firstErr
}

// Stats 返回给定 policyID 的缓存统计。0 表示聚合全部策略。
func (c *DiskCache) Stats(ctx context.Context, policyID uint) (CacheStats, error) {
	_ = ctx
	c.mu.RLock()
	defer c.mu.RUnlock()

	stats := CacheStats{PolicyID: policyID}
	for _, e := range c.entries {
		if policyID != 0 && e.PolicyID != policyID {
			continue
		}
		stats.Count++
		stats.TotalSize += e.Size
	}
	stats.HitCount = atomic.LoadInt64(&c.hitCount)
	stats.MissCount = atomic.LoadInt64(&c.missCount)
	return stats, nil
}

// ListAllStats 按 PolicyID 分组返回所有已缓存策略的统计。
// HitCount / MissCount 为进程级全局累计，因此所有策略共享同一份全局计数；
// 调用方若只想比较策略间的体积 / 条目数，忽略这两个字段即可。
func (c *DiskCache) ListAllStats(ctx context.Context) ([]CacheStats, error) {
	_ = ctx
	c.mu.RLock()
	grouped := make(map[uint]*CacheStats)
	for _, e := range c.entries {
		g, ok := grouped[e.PolicyID]
		if !ok {
			g = &CacheStats{PolicyID: e.PolicyID}
			grouped[e.PolicyID] = g
		}
		g.Count++
		g.TotalSize += e.Size
	}
	c.mu.RUnlock()

	hit := atomic.LoadInt64(&c.hitCount)
	miss := atomic.LoadInt64(&c.missCount)

	out := make([]CacheStats, 0, len(grouped))
	for _, g := range grouped {
		g.HitCount = hit
		g.MissCount = miss
		out = append(out, *g)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].PolicyID < out[j].PolicyID })
	return out, nil
}

// maybeEvict 同步触发一次 evict 判断。
func (c *DiskCache) maybeEvict() {
	if c.maxSize <= 0 {
		return
	}
	c.mu.RLock()
	threshold := int64(float64(c.maxSize) * 1.1)
	cur := c.totalSize
	c.mu.RUnlock()
	if cur <= threshold {
		return
	}
	c.evict()
}

// evict 按 LastAccessAt 升序删除条目直到 totalSize 降到 maxSize*0.8。
func (c *DiskCache) evict() {
	target := int64(float64(c.maxSize) * 0.8)

	c.mu.Lock()
	if c.totalSize <= target {
		c.mu.Unlock()
		return
	}

	entries := make([]*CacheEntry, 0, len(c.entries))
	for _, e := range c.entries {
		entries = append(entries, e)
	}
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].LastAccessAt.Equal(entries[j].LastAccessAt) {
			return entries[i].AccessCount < entries[j].AccessCount
		}
		return entries[i].LastAccessAt.Before(entries[j].LastAccessAt)
	})

	removed := make([]*CacheEntry, 0)
	for _, e := range entries {
		if c.totalSize <= target {
			break
		}
		delete(c.entries, cacheKey(e.PolicyID, e.FileID, e.StyleHash))
		c.totalSize -= e.Size
		removed = append(removed, e)
	}
	c.mu.Unlock()

	for _, e := range removed {
		_ = os.Remove(e.Path)
	}
}

// cleanupLoop 后台周期性触发 evict；通过 stopCh 退出。
func (c *DiskCache) cleanupLoop(interval time.Duration) {
	defer c.wg.Done()
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			c.maybeEvict()
		case <-c.stopCh:
			return
		}
	}
}

// scanDirectory 启动时扫描 Root 重建索引。目录布局异常的文件被忽略。
func (c *DiskCache) scanDirectory() error {
	return filepath.Walk(c.root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // 忽略访问错误
		}
		if info.IsDir() || filepath.Ext(path) == ".tmp" {
			return nil
		}

		// 预期相对路径：{policy_id}/{prefix6}/{file_id_padded}_{hash}.{ext}
		rel, err := filepath.Rel(c.root, path)
		if err != nil {
			return nil
		}
		parts := splitPath(rel)
		if len(parts) != 3 {
			return nil
		}
		policyID, err := strconv.ParseUint(parts[0], 10, 64)
		if err != nil {
			return nil
		}
		filename := parts[2]
		base := filepath.Base(filename)
		ext := filepath.Ext(base)
		if ext == "" {
			return nil
		}
		stem := base[:len(base)-len(ext)]
		// stem 应为 {file_id_padded}_{hash}
		us := -1
		for i := len(stem) - 1; i >= 0; i-- {
			if stem[i] == '_' {
				us = i
				break
			}
		}
		if us <= 0 || us == len(stem)-1 {
			return nil
		}
		fileIDStr := stem[:us]
		styleHash := stem[us+1:]
		fileID, err := strconv.ParseUint(fileIDStr, 10, 64)
		if err != nil {
			return nil
		}

		entry := &CacheEntry{
			PolicyID:     uint(policyID),
			FileID:       uint(fileID),
			StyleHash:    styleHash,
			Ext:          ext[1:],
			Size:         info.Size(),
			CreatedAt:    info.ModTime(),
			LastAccessAt: info.ModTime(),
			AccessCount:  0,
			Path:         path,
			MIME:         mimeFromExt(ext[1:]),
		}
		key := cacheKey(entry.PolicyID, entry.FileID, entry.StyleHash)
		c.entries[key] = entry
		c.totalSize += entry.Size
		return nil
	})
}

// splitPath 把相对路径按系统分隔符拆分为组件。
func splitPath(p string) []string {
	parts := []string{}
	cur := ""
	for i := 0; i < len(p); i++ {
		ch := p[i]
		if ch == filepath.Separator || ch == '/' {
			if cur != "" {
				parts = append(parts, cur)
				cur = ""
			}
			continue
		}
		cur += string(ch)
	}
	if cur != "" {
		parts = append(parts, cur)
	}
	return parts
}

// mimeFromExt 根据扩展名推断 MIME 类型，用于重建索引时的 Stats 展示。
func mimeFromExt(ext string) string {
	switch normExt(ext) {
	case "jpg", "jpeg":
		return "image/jpeg"
	case "png":
		return "image/png"
	case "webp":
		return "image/webp"
	case "avif":
		return "image/avif"
	case "heic", "heif":
		return "image/heic"
	case "gif":
		return "image/gif"
	default:
		return "application/octet-stream"
	}
}

// 静态断言：DiskCache 实现 Cache 接口。
var _ Cache = (*DiskCache)(nil)
