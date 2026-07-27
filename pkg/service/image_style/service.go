/*
 * @Description: ImageStyleService 对外实现
 * @Author: 安知鱼
 *
 * 承担 Spec §6.1 的四个对外职责：
 *   Process                    按需处理并缓存
 *   ResolveUploadURLSuffix     上传返回时拼默认样式后缀
 *   PurgeCache                 按策略 / 样式名 / 文件过滤清理缓存
 *   Stats                      查询缓存统计
 *
 * 流程（Process）：
 *   1. Matcher.Match → ResolvedStyle (或 ErrStyleNotApplicable / NotFound)
 *   2. ResolvedStyle.Hash() + 原图物理版本 → styleHash
 *   3. cache.Get 命中 → 返回 StyleResult{FromCache: true}
 *   4. singleflight.DoChan(cacheKey)：
 *      - double-check cache
 *      - provider.Get 读原图字节 → engine.Process → cache.Put
 *   5. cache.Get 二次读取（拿独立 ReadCloser）→ 返回 StyleResult
 *
 * 并发保障：singleflight 合并相同 key 的并发请求，确保 engine.Process 仅执行一次。
 */
package image_style

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"

	"github.com/anzhiyu-c/anheyu-app/internal/infra/storage"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/image_style/engine"
)

// ImageStyleService 是图片样式处理服务的对外接口。
type ImageStyleService interface {
	Process(ctx context.Context, req *StyleRequest) (*StyleResult, error)
	ResolveUploadURLSuffix(policy *model.StoragePolicy, filename string) string
	PurgeCache(ctx context.Context, policyID uint, styleName string, fileID uint) (int, error)
	Stats(ctx context.Context, policyID uint) (*CacheStats, error)

	// Phase 4 Task 4.1 新增的管理面能力：

	// ListAllStats 返回各策略的缓存统计。0 长度列表表示当前无任何缓存条目。
	ListAllStats(ctx context.Context) ([]CacheStats, error)

	// Preview 不走磁盘缓存地处理一张原图，供管理员预览样式效果。
	// 传入完整样式配置（未经 matcher 合并）与原图字节，返回处理后字节 + MIME。
	Preview(ctx context.Context, style model.ImageStyleConfig, src []byte) (*PreviewResult, error)

	// WarmCache 异步预热指定策略 + 样式的缓存。
	// 同策略 + 同样式若已有进行中任务，返回其 taskID 且 started=false；
	// 否则启动新任务并返回 started=true。
	// 预热需要调用方注入 WarmFileLister，否则立即返回错误 ErrWarmNotAvailable。
	WarmCache(ctx context.Context, policyID uint, styleName string) (taskID string, started bool, err error)

	// GetWarmProgress 查询预热任务的当前进度快照。
	GetWarmProgress(taskID string) (*WarmProgress, error)

	// CancelWarm 请求取消指定的预热任务。
	// 返回 true 表示找到了该任务并发出了取消信号；false 表示任务不存在。
	// 取消信号通过 context 传递给后台 goroutine；当前共享生成可能继续到内部超时，
	// 但预热任务会立即停止等待且不再调度后续图片。
	CancelWarm(taskID string) bool
}

// ErrWarmNotAvailable 表示调用方未注入 WarmFileLister，无法启动预热任务。
var ErrWarmNotAvailable = errors.New("image style warm cache not available: WarmFileLister not configured")

// sharedProcessTimeout 限制与单个 HTTP 请求生命周期解耦后的共享生成任务。
// 首个请求取消时仍允许同一实例内的健康等待者拿到结果，同时避免底层 provider
// 或处理引擎异常时让 singleflight key 永久占用。
const (
	sharedProcessTimeout     = time.Minute
	sharedProcessConcurrency = 4
)

// WarmFileLister 为预热任务抽象出文件枚举能力。
// 社区版单独使用时可以传 nil 禁用；anheyu-pro 启动时会基于 EntityRepository
// 与 FileRepository 适配一个实现注入进来。
type WarmFileLister interface {
	// ListFilesByPolicy 返回给定存储策略下全部逻辑文件（不含目录 / 已软删除记录）。
	// 调用方（Service.WarmCache）会按策略配置的 apply_to_extensions 再次过滤。
	ListFilesByPolicy(ctx context.Context, policyID uint) ([]*model.File, error)
}

// ServiceOption 构造 Service 的可选项，便于扩展而不破坏现有调用点。
type ServiceOption func(*Service)

// WithWarmFileLister 注入预热任务所需的文件枚举器。
func WithWarmFileLister(l WarmFileLister) ServiceOption {
	return func(s *Service) {
		s.warmLister = l
	}
}

// SetWarmFileLister 允许在构造之后注入或替换 WarmFileLister；并发安全。
// 典型场景：社区版 App 先构造 Service，pro 启动后再把自己的 lister 设进去。
func (s *Service) SetWarmFileLister(l WarmFileLister) {
	s.warmMu.Lock()
	s.warmLister = l
	s.warmMu.Unlock()
}

// currentWarmLister 原子读取当前 lister。
func (s *Service) currentWarmLister() WarmFileLister {
	s.warmMu.RLock()
	defer s.warmMu.RUnlock()
	return s.warmLister
}

// Service 是 ImageStyleService 的唯一实现。
// Phase 2 接入 vips 后，engine 字段会被替换为 AutoEngine(VipsEngine/NativeGoEngine)；
// 其他字段保持不变。
type Service struct {
	engine     engine.Engine
	cache      Cache
	providers  map[constant.StoragePolicyType]storage.IStorageProvider
	policyRepo repository.StoragePolicyRepository
	// watermarker：Phase 3 Task 3.4 后水印调用链已下沉到 engine 内部（见
	// engine.WithNativeWatermarker / WithVipsWatermarker），Service 层不再直接调用。
	// 这里保留字段仅为构造器签名兼容与未来"跨引擎共享水印能力"的语义锚点。
	// 调用方仍应通过 DI 同时把同一个 watermarker 实例传给 engine 和此字段，保证 vips
	// 降级为 native 时两路使用同一实现，避免行为漂移。
	watermarker Watermarker

	sfGroup singleflight.Group
	// processSlots 对不同 cache key 的后台生成做硬上限；达到上限时请求回退原图，
	// 不排队创建无界 goroutine。
	processSlots chan struct{}

	// Phase 4 Task 4.5：预热子系统（可选）。
	warmMu     sync.RWMutex
	warmLister WarmFileLister
	warmMgr    *warmTaskManager
}

// NewService 构造 ImageStyleService。watermarker == nil 时自动使用 NoopWatermarker。
// 注意：自 Phase 3.4 起水印逻辑在 engine 内部完成，但签名保持兼容。
// 推荐做法：在 DI 层创建一个 NativeWatermarker 同时注入 engine（通过 WithAutoWatermarker）
// 和本构造器，确保两端语义一致。
// 支持可选 ServiceOption；当前可注入 WithWarmFileLister 开启 Phase 4 预热能力。
func NewService(
	eng engine.Engine,
	cache Cache,
	providers map[constant.StoragePolicyType]storage.IStorageProvider,
	policyRepo repository.StoragePolicyRepository,
	watermarker Watermarker,
	opts ...ServiceOption,
) *Service {
	if watermarker == nil {
		watermarker = NewNoopWatermarker()
	}
	s := &Service{
		engine:       eng,
		cache:        cache,
		providers:    providers,
		policyRepo:   policyRepo,
		watermarker:  watermarker,
		warmMgr:      newWarmTaskManager(nil),
		processSlots: make(chan struct{}, sharedProcessConcurrency),
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// 静态断言 Service 满足 ImageStyleService 接口。
var _ ImageStyleService = (*Service)(nil)

// Process 对齐 Spec §6.1。
func (s *Service) Process(ctx context.Context, req *StyleRequest) (*StyleResult, error) {
	if req == nil || req.Policy == nil || req.File == nil {
		return nil, ErrStyleProcessFailed
	}

	// 1. Matcher 决策
	resolved, err := Match(req.Policy, req.Filename, req.StyleName, req.DynamicOpts)
	if err != nil {
		return nil, err
	}
	styleHash := versionedStyleHash(resolved.Hash(), req.File)
	policyID := req.Policy.ID
	fileID := req.File.ID

	// 2. 快速路径：直接查 cache
	if entry, rc, err := s.cache.Get(ctx, policyID, fileID, styleHash); err == nil {
		return &StyleResult{
			ContentType:     entry.MIME,
			Reader:          rc,
			Size:            entry.Size,
			FromCache:       true,
			StyleHash:       styleHash,
			LastModified:    entry.CreatedAt,
			RequestedFormat: resolved.Format,
		}, nil
	}

	// 3. 进入 singleflight，合并并发请求
	key := cacheKey(policyID, fileID, styleHash)
	resultCh := s.sfGroup.DoChan(key, func() (any, error) {
		// 不等待空闲槽：公开图片路由可构造大量不同 cache key，若排队会在客户端
		// 断开后积累无界后台 goroutine。繁忙时让 handler 按既有契约回退原图。
		select {
		case s.processSlots <- struct{}{}:
			defer func() { <-s.processSlots }()
		default:
			return nil, fmt.Errorf("%w: 图片处理并发已达上限", ErrStyleProcessFailed)
		}

		// 共享生成不能绑定首个 HTTP 请求的取消信号，否则首请求断开会让同批健康
		// 等待者一起失败。保留请求 Context 的 values，但用独立超时约束实际工作。
		processCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), sharedProcessTimeout)
		defer cancel()

		// double-check：其他并发 goroutine 可能已填好 cache
		if _, rc, err := s.cache.Get(processCtx, policyID, fileID, styleHash); err == nil {
			_ = rc.Close()
			return nil, nil
		}
		return nil, s.processAndPut(processCtx, req, resolved, styleHash)
	})

	select {
	case result := <-resultCh:
		if result.Err != nil {
			return nil, result.Err
		}
	case <-ctx.Done():
		// 当前调用者可以停止等待；独立的共享生成仍会服务其他健康等待者并填充缓存。
		return nil, ctx.Err()
	}

	// 4. 拿独立的 ReadCloser
	entry, rc, err := s.cache.Get(ctx, policyID, fileID, styleHash)
	if err != nil {
		return nil, fmt.Errorf("%w: 处理完成但缓存查询失败: %v", ErrStyleProcessFailed, err)
	}
	return &StyleResult{
		ContentType:     entry.MIME,
		Reader:          rc,
		Size:            entry.Size,
		FromCache:       false,
		StyleHash:       styleHash,
		LastModified:    entry.CreatedAt,
		RequestedFormat: resolved.Format,
	}, nil
}

// processAndPut 读原图、走引擎、写缓存；失败返回包装后的 ErrStyleProcessFailed。
func (s *Service) processAndPut(ctx context.Context, req *StyleRequest, resolved *ResolvedStyle, styleHash string) error {
	rawBytes, err := s.readOriginalBytes(ctx, req.Policy, req.File)
	if err != nil {
		return fmt.Errorf("%w: 读取原图失败: %v", ErrStyleProcessFailed, err)
	}
	if err := ctx.Err(); err != nil {
		return fmt.Errorf("%w: 读取原图后任务已取消: %v", ErrStyleProcessFailed, err)
	}

	styleCfg := model.ImageStyleConfig{
		Format:     resolved.Format,
		Quality:    resolved.Quality,
		AutoRotate: resolved.AutoRotate,
		Resize:     resolved.Resize,
		Watermark:  resolved.Watermark,
	}

	var buf bytes.Buffer
	mime, err := s.engine.Process(ctx, bytes.NewReader(rawBytes), styleCfg, &buf)
	if err != nil {
		return fmt.Errorf("%w: 引擎处理失败: %v", ErrStyleProcessFailed, err)
	}
	if err := ctx.Err(); err != nil {
		return fmt.Errorf("%w: 引擎处理后任务已取消: %v", ErrStyleProcessFailed, err)
	}

	ext := extFromMIME(mime)
	if _, err := s.cache.Put(ctx, req.Policy.ID, req.File.ID, styleHash, mime, ext, buf.Bytes()); err != nil {
		return fmt.Errorf("%w: 写入缓存失败: %v", ErrStyleProcessFailed, err)
	}
	return nil
}

// readOriginalBytes 通过 storage provider 读取原图完整字节。
// 注意：Phase 1 为简化，直接读到内存。Phase 3 若要引入大图分块需再做改造。
func (s *Service) readOriginalBytes(ctx context.Context, policy *model.StoragePolicy, file *model.File) ([]byte, error) {
	if file.PrimaryEntity == nil || !file.PrimaryEntity.Source.Valid {
		return nil, errors.New("文件缺少物理存储实体")
	}
	provider, ok := s.providers[policy.Type]
	if !ok {
		return nil, fmt.Errorf("未注册的存储类型: %s", policy.Type)
	}
	// 保留 source 的原始形态：LocalProvider 看前导 "/" 判定绝对路径 / 相对路径；
	// 云端 provider（OSS/COS 等）也期望原始 key，不要剥 "/"。
	rc, err := provider.Get(ctx, policy, file.PrimaryEntity.Source.String)
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	data, err := io.ReadAll(rc)
	if err != nil {
		return nil, err
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return data, nil
}

// ResolveUploadURLSuffix 实现 Spec §8.4，薄壳代理到纯函数。
func (s *Service) ResolveUploadURLSuffix(policy *model.StoragePolicy, filename string) string {
	return resolveUploadURLSuffix(policy, filename)
}

// PurgeCache 按过滤器清理缓存条目；
//
//   - policyID == 0 → 不按策略过滤（代表"全部策略"）
//   - fileID   == 0 → 不按文件过滤
//   - styleName != "" → 查策略找到该样式，按 StyleHashFamily 清理所有原图版本
//     Phase 1 的 styleName 支持依赖 policyRepo；未注入时若传了非空 styleName 会返回错误。
func (s *Service) PurgeCache(ctx context.Context, policyID uint, styleName string, fileID uint) (int, error) {
	opts := PurgeOpts{}
	if policyID != 0 {
		p := policyID
		opts.PolicyID = &p
	}
	if fileID != 0 {
		f := fileID
		opts.FileID = &f
	}
	if styleName != "" {
		if s.policyRepo == nil {
			return 0, errors.New("PurgeCache: 按 style_name 过滤需要 policyRepo 注入")
		}
		if policyID == 0 {
			return 0, errors.New("PurgeCache: 按 style_name 过滤必须同时指定 policyID")
		}
		policy, err := s.policyRepo.FindByID(ctx, policyID)
		if err != nil {
			return 0, fmt.Errorf("PurgeCache: 查询策略失败: %w", err)
		}
		styleCfg, ok := findStyleByName(policy, styleName)
		if !ok {
			return 0, nil // 样式不存在 → 无可清理
		}
		resolved := styleToResolved(styleCfg)
		hashFamily := resolved.Hash()
		opts.StyleHashFamily = &hashFamily
	}
	return s.cache.Purge(ctx, opts)
}

// Stats 返回指定策略的缓存统计。policyID == 0 表示跨策略聚合。
func (s *Service) Stats(ctx context.Context, policyID uint) (*CacheStats, error) {
	stats, err := s.cache.Stats(ctx, policyID)
	if err != nil {
		return nil, err
	}
	return &stats, nil
}

// ListAllStats 返回所有已缓存策略的统计；未产生过缓存的策略不会出现。
// 调用方（admin handler）可以合并 StoragePolicy 元信息补零未命中策略。
func (s *Service) ListAllStats(ctx context.Context) ([]CacheStats, error) {
	return s.cache.ListAllStats(ctx)
}

// Preview 走引擎即时处理，不读数据库、不写磁盘缓存，专用于管理员"样式试看"。
// 输入必须是完整的 ImageStyleConfig（包含 Resize / Watermark 等），并已在
// 调用方（handler）做过与持久化相同的 schema 校验。
func (s *Service) Preview(ctx context.Context, style model.ImageStyleConfig, src []byte) (*PreviewResult, error) {
	if len(src) == 0 {
		return nil, fmt.Errorf("%w: 输入字节为空", ErrStyleProcessFailed)
	}

	var buf bytes.Buffer
	mime, err := s.engine.Process(ctx, bytes.NewReader(src), style, &buf)
	if err != nil {
		return nil, fmt.Errorf("%w: Preview 引擎处理失败: %v", ErrStyleProcessFailed, err)
	}

	return &PreviewResult{
		ContentType: mime,
		Data:        buf.Bytes(),
	}, nil
}

// WarmCache 异步预热指定策略 + 样式。详细契约见接口注释。
//
// 处理流程：
//  1. 校验 policyRepo / warmLister 已注入
//  2. 查策略、校验样式存在、扩展名过滤器非空
//  3. 注册任务（同 key 去重）
//  4. 启动独立 goroutine：
//     a) 调 warmLister.ListFilesByPolicy 拿所有文件
//     b) 按 apply_to_extensions 过滤
//     c) 每个文件调 Process，记进度
//     d) 全部完成 → finish(done)
//
// 注意：这里不捕获 ctx 用于后台任务——调用方的 ctx 可能在 HTTP 响应返回后被取消。
// 后台任务使用全新 context.Background()，并由管理器自身维护生命周期。
func (s *Service) WarmCache(ctx context.Context, policyID uint, styleName string) (string, bool, error) {
	lister := s.currentWarmLister()
	if lister == nil {
		return "", false, ErrWarmNotAvailable
	}
	if s.policyRepo == nil {
		return "", false, fmt.Errorf("WarmCache: 缺少 policyRepo 依赖")
	}
	if styleName == "" {
		return "", false, errors.New("WarmCache: styleName 不能为空")
	}

	policy, err := s.policyRepo.FindByID(ctx, policyID)
	if err != nil {
		return "", false, fmt.Errorf("WarmCache: 查询策略失败: %w", err)
	}
	cfg := parseImageProcess(policy)
	if !cfg.Enabled {
		return "", false, fmt.Errorf("WarmCache: 策略 %d 未开启 image_process", policyID)
	}
	styleCfg, ok := findStyleByName(policy, styleName)
	if !ok {
		return "", false, fmt.Errorf("%w: %s", ErrStyleNotFound, styleName)
	}

	taskID, taskCtx, started := s.warmMgr.register(policyID, styleName)
	if !started {
		return taskID, false, nil
	}

	// 拷贝必要状态到 goroutine 作用域，避免闭包捕获可能过期的指针。
	applyExt := make(map[string]struct{}, len(cfg.ApplyToExtensions))
	for _, e := range cfg.ApplyToExtensions {
		applyExt[e] = struct{}{}
	}
	policyCopy := *policy
	styleCopyName := styleCfg.Name

	go s.runWarmTask(taskCtx, taskID, lister, &policyCopy, styleCopyName, applyExt)
	return taskID, true, nil
}

// runWarmTask 执行预热实际工作；仅由 WarmCache 启动，独占 taskID。
// lister 参数显式传入，避免 goroutine 期间 warmLister 被替换造成竞争。
// 任务使用管理器分配的 ctx：CancelWarm 触发 ctx Done 时，goroutine 在下一次检查点退出。
func (s *Service) runWarmTask(ctx context.Context, taskID string, lister WarmFileLister, policy *model.StoragePolicy, styleName string, applyExt map[string]struct{}) {
	if ctx == nil {
		ctx = context.Background()
	}
	// 若调用方在 register 后立刻 Cancel，这里应该立刻识别并退出。
	if err := ctx.Err(); err != nil {
		s.warmMgr.finish(taskID, "cancelled", "任务启动前已被取消")
		return
	}

	files, err := lister.ListFilesByPolicy(ctx, policy.ID)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			s.warmMgr.finish(taskID, "cancelled", "列文件期间被取消")
			return
		}
		s.warmMgr.finish(taskID, "failed", fmt.Sprintf("列出文件失败: %v", err))
		return
	}

	// 按扩展名过滤
	candidates := make([]*model.File, 0, len(files))
	for _, f := range files {
		ext := lowerExt(f.Name)
		if _, ok := applyExt[ext]; ok {
			candidates = append(candidates, f)
		}
	}
	s.warmMgr.setTotal(taskID, len(candidates))

	for _, f := range candidates {
		// 每处理一张图前检查一次 ctx，让取消信号能及时响应。
		if err := ctx.Err(); err != nil {
			s.warmMgr.finish(taskID, "cancelled", "")
			return
		}
		req := &StyleRequest{
			Policy:    policy,
			File:      f,
			Filename:  f.Name,
			StyleName: styleName,
		}
		result, procErr := s.Process(ctx, req)
		if procErr != nil {
			if errors.Is(procErr, context.Canceled) {
				s.warmMgr.finish(taskID, "cancelled", "")
				return
			}
			s.warmMgr.inc(taskID, "failed", procErr.Error())
			continue
		}
		// 读完并关闭，以便 cache.Put 的条目完整生效
		_, _ = io.Copy(io.Discard, result.Reader)
		_ = result.Reader.Close()
		s.warmMgr.inc(taskID, "processed", "")
	}
	s.warmMgr.finish(taskID, "done", "")
}

// GetWarmProgress 查询任务进度；未知 taskID 返回 ErrWarmTaskNotFound。
func (s *Service) GetWarmProgress(taskID string) (*WarmProgress, error) {
	return s.warmMgr.get(taskID)
}

// CancelWarm 请求取消指定预热任务；详见接口注释。
func (s *Service) CancelWarm(taskID string) bool {
	return s.warmMgr.cancel(taskID)
}

// lowerExt 返回文件名扩展名（不含点、小写）。空名或无扩展返回空串。
func lowerExt(name string) string {
	for i := len(name) - 1; i >= 0; i-- {
		if name[i] == '.' {
			ext := name[i+1:]
			buf := make([]byte, len(ext))
			for j := 0; j < len(ext); j++ {
				b := ext[j]
				if b >= 'A' && b <= 'Z' {
					b = b + ('a' - 'A')
				}
				buf[j] = b
			}
			return string(buf)
		}
		if name[i] == '/' || name[i] == '\\' {
			break
		}
	}
	return ""
}

// extFromMIME 将 engine 返回的 MIME 映射回文件扩展名（用于缓存文件命名）。
func extFromMIME(mime string) string {
	switch mime {
	case "image/jpeg":
		return "jpg"
	case "image/png":
		return "png"
	case "image/webp":
		return "webp"
	case "image/avif":
		return "avif"
	case "image/heic", "image/heif":
		return "heic"
	case "image/gif":
		return "gif"
	default:
		log.Printf("[image_style] 未识别的 MIME=%s，缓存扩展名退化为 bin", mime)
		return "bin"
	}
}
