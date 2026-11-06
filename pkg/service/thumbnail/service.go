// internal/app/service/thumbnail/service.go

/*
 * @Description: 缩略图生成服务。实现了原生优先、本地降级的策略，并管理缩略图的生命周期状态。
 * @Author: 安知鱼
 * @Date: 2025-07-10 15:06:15
 * @LastEditTime: 2025-07-30 20:17:51
 * @LastEditors: 安知鱼
 */
package thumbnail

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/internal/infra/storage"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/file_info"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/volume"
)

// SettingProvider 定义了 ThumbnailService 对设置服务的依赖接口，以实现解耦。
type SettingProvider interface {
	Get(key string) string
	GetBool(key string) bool
}

// settingAdapter 是一个适配器，让 setting.SettingService 实现 SettingProvider 接口。
type settingAdapter struct {
	settingSvc setting.SettingService
}

func (a *settingAdapter) Get(key string) string { return a.settingSvc.Get(key) }
func (a *settingAdapter) GetBool(key string) bool {
	valueStr := strings.ToLower(a.settingSvc.Get(key))
	b, _ := strconv.ParseBool(valueStr)
	return b
}

// ThumbnailService 负责管理和执行文件的缩略图生成任务。
type ThumbnailService struct {
	metaService      *file_info.MetadataService
	fileRepo         repository.FileRepository
	entityRepo       repository.EntityRepository
	policyService    volume.IStoragePolicyService
	settingSvc       setting.SettingService
	storageProviders map[constant.StoragePolicyType]storage.IStorageProvider
	generators       []Generator
	cachePath        string
}

// NewThumbnailService 是 ThumbnailService 的构造函数。
func NewThumbnailService(
	metaService *file_info.MetadataService,
	fileRepo repository.FileRepository,
	entityRepo repository.EntityRepository,
	policyService volume.IStoragePolicyService,
	settingSvc setting.SettingService,
	storageProviders map[constant.StoragePolicyType]storage.IStorageProvider,
) *ThumbnailService {
	log.Printf("[DEBUG] Go application sees PATH: %s", os.Getenv("PATH"))

	cachePath := "./data/temp/thumbnails"
	if err := os.MkdirAll(cachePath, 0755); err != nil {
		log.Printf("[ThumbnailService] 严重警告: 无法创建缩略图缓存目录 '%s': %v", cachePath, err)
	}

	provider := &settingAdapter{settingSvc: settingSvc}
	var generators []Generator
	var loadedGeneratorNames []string // 用于记录已加载的生成器名称

	log.Println("--- 开始加载缩略图生成器 (Thumbnail Generators) ---")

	// 优先级 1：SVG (直接服务)
	generators = append(generators, NewSVGGenerator())
	loadedGeneratorNames = append(loadedGeneratorNames, "SVG")
	log.Printf("  -> 已加载 [1]: SVG (直接服务)")

	// 优先级 2: 歌曲封面提取
	if provider.GetBool(constant.KeyEnableMusicCoverGenerator.String()) {
		extsStr := provider.Get(constant.KeyMusicCoverSupportedExts.String())
		exts := parseCommaSeparatedString(extsStr)
		maxSizeStr := provider.Get(constant.KeyMusicCoverMaxFileSize.String())
		maxSize := parseSizeString(maxSizeStr, "歌曲封面生成器")
		generators = append(generators, NewMusicCoverGenerator(cachePath, exts, maxSize))
		loadedGeneratorNames = append(loadedGeneratorNames, "Music Cover")
		log.Printf("  -> 已加载 [2]: Music Cover (歌曲封面)")
	}

	// 优先级 3：VIPS (高性能图片处理)
	if provider.GetBool(constant.KeyEnableVipsGenerator.String()) {
		vipsPath := provider.Get(constant.KeyVipsPath.String())
		extsStr := provider.Get(constant.KeyVipsSupportedExts.String())

		log.Printf("[DEBUG] VIPS generator is using these extensions from DB: \"%s\"", extsStr)

		exts := parseCommaSeparatedString(extsStr)
		maxSizeStr := provider.Get(constant.KeyVipsMaxFileSize.String())
		maxSize := parseSizeString(maxSizeStr, "VIPS生成器")
		generators = append(generators, NewVipsCliGenerator(cachePath, vipsPath, exts, maxSize))
		log.Printf("  -> 已加载 [3]: VIPS (高性能图片)")
	}

	// 优先级 4：LibRaw/DCRaw (RAW 格式处理)
	if provider.GetBool(constant.KeyEnableLibrawGenerator.String()) {
		librawPath := provider.Get(constant.KeyLibrawPath.String())
		extsStr := provider.Get(constant.KeyLibrawSupportedExts.String())
		exts := parseCommaSeparatedString(extsStr)
		maxSizeStr := provider.Get(constant.KeyLibrawMaxFileSize.String())
		maxSize := parseSizeString(maxSizeStr, "LibRaw/DCRaw 生成器")
		generators = append(generators, NewLibrawCliGenerator(cachePath, librawPath, exts, maxSize))
		loadedGeneratorNames = append(loadedGeneratorNames, "LibRaw")
		log.Printf("  -> 已加载 [4]: LibRaw (RAW 格式)")
	}

	// 优先级 5：FFMPEG (视频处理)
	if provider.GetBool(constant.KeyEnableFfmpegGenerator.String()) {
		ffmpegPath := provider.Get(constant.KeyFfmpegPath.String())
		extsStr := provider.Get(constant.KeyFfmpegSupportedExts.String())
		exts := parseCommaSeparatedString(extsStr)
		maxSizeStr := provider.Get(constant.KeyFfmpegMaxFileSize.String())
		maxSize := parseSizeString(maxSizeStr, "FFmpeg生成器")
		captureTime := provider.Get(constant.KeyFfmpegCaptureTime.String())
		generators = append(generators, NewFfmpegCliGenerator(cachePath, ffmpegPath, exts, maxSize, captureTime))
		loadedGeneratorNames = append(loadedGeneratorNames, "FFmpeg")
		log.Printf("  -> 已加载 [5]: FFmpeg (视频)")
	}

	// 优先级 6：内置备用 (标准图片转换 + 现代图片直出)
	if provider.GetBool(constant.KeyEnableBuiltinGenerator.String()) {
		maxSizeStr := provider.Get(constant.KeyBuiltinMaxFileSize.String())
		maxSize := parseSizeString(maxSizeStr, "内置生成器")
		directServeExtsStr := provider.Get(constant.KeyBuiltinDirectServeExts.String())
		directServeExts := parseCommaSeparatedString(directServeExtsStr)
		generators = append(generators, NewBuiltinImageGenerator(cachePath, maxSize, directServeExts))
		loadedGeneratorNames = append(loadedGeneratorNames, "Builtin")
		log.Printf("  -> 已加载 [6]: Builtin (内置备用)")
	}

	// --- 最终的加载总结日志 ---
	log.Printf("--- 缩略图生成器加载完成。共启用 %d 个，加载顺序: [%s] ---", len(generators), strings.Join(loadedGeneratorNames, ", "))

	return &ThumbnailService{
		metaService:      metaService,
		fileRepo:         fileRepo,
		entityRepo:       entityRepo,
		policyService:    policyService,
		settingSvc:       settingSvc,
		storageProviders: storageProviders,
		generators:       generators,
		cachePath:        cachePath,
	}
}

// Generate 是后台任务调用的唯一入口，实现了完整的“原生优先，本地降级”处理逻辑。
func (s *ThumbnailService) Generate(ctx context.Context, fileID uint) {
	log.Printf("[ThumbnailService.Generate] 开始为文件ID %d 生成缩略图...", fileID)

	// 1. 更新状态为“处理中”并处理重试逻辑
	maxRetries, _ := strconv.Atoi(s.settingSvc.Get(constant.KeyQueueThumbMaxRetries.String()))
	if maxRetries <= 0 {
		maxRetries = 3
	}

	retryCountStr, _ := s.metaService.Get(ctx, fileID, model.MetaKeyThumbRetryCount)
	retryCount, _ := strconv.Atoi(retryCountStr)

	if retryCount >= maxRetries {
		log.Printf("[ThumbnailService] 文件ID %d 已达到最大重试次数(%d)，任务终止。", fileID, maxRetries)
		s.updateMetaOnFailure(fileID, fmt.Sprintf("已达到最大重试次数(%d)", maxRetries))
		return
	}

	go s.metaService.Set(context.Background(), fileID, model.MetaKeyThumbStatus, model.MetaValueStatusProcessing)
	go s.metaService.Set(context.Background(), fileID, model.MetaKeyThumbRetryCount, strconv.Itoa(retryCount+1))

	// 2. 获取文件核心信息及所有需要的ID和路径
	file, err := s.fileRepo.FindByID(ctx, fileID)
	if err != nil {
		log.Printf("[ThumbnailService] 错误: 找不到文件 %d: %v", fileID, err)
		s.updateMetaOnFailure(fileID, "文件记录在数据库中不存在。")
		return
	}

	ownerPublicID, err := idgen.GeneratePublicID(file.OwnerID, idgen.EntityTypeUser)
	if err != nil {
		log.Printf("[ThumbnailService] 错误: 无法为所有者ID %d 生成公共ID: %v", file.OwnerID, err)
		s.updateMetaOnFailure(fileID, "无法生成所有者公共ID")
		return
	}

	filePublicID, err := idgen.GeneratePublicID(file.ID, idgen.EntityTypeFile)
	if err != nil {
		log.Printf("[ThumbnailService] 错误: 无法为文件ID %d 生成公共ID: %v", file.ID, err)
		s.updateMetaOnFailure(fileID, "无法生成文件公共ID")
		return
	}

	parentPath, err := s.getVirtualParentPath(ctx, file)
	if err != nil {
		log.Printf("[ThumbnailService] 错误: 无法获取文件 %d 的父路径: %v", file.ID, err)
		s.updateMetaOnFailure(fileID, "无法获取父路径")
		return
	}

	// 3. 优先尝试从云存储获取原生缩略图
	policy, provider, err := s.getPolicyAndProviderForFile(ctx, file)
	if err != nil {
		log.Printf("[ThumbnailService] 错误: 获取文件 %d 的策略和驱动失败: %v", fileID, err)
		s.updateMetaOnFailure(fileID, err.Error())
		return
	}

	if policy.Type != constant.PolicyTypeLocal {
		nativeThumb, err := provider.GetThumbnail(ctx, policy, file.PrimaryEntity.Source.String, "medium")
		if err == nil {
			log.Printf("[ThumbnailService] 成功: 从云端获取到文件ID %d 的原生缩略图。", fileID)

			const nativeFormat = "jpeg"
			cacheFileName := GenerateCacheName(ownerPublicID, filePublicID, nativeFormat)
			cacheFilePath, err := GetCachePath(s.cachePath, parentPath, cacheFileName)
			if err != nil {
				log.Printf("[ThumbnailService] 错误: 构建原生缩略图缓存路径失败: %v", err)
				s.updateMetaOnFailure(fileID, "构建缓存路径失败")
				return
			}

			if err := os.WriteFile(cacheFilePath, nativeThumb.Data, 0644); err != nil {
				log.Printf("[ThumbnailService] 错误: 保存原生缩略图到缓存失败: %v", err)
				s.updateMetaOnFailure(fileID, "保存原生缩略图失败")
				return
			}
			s.updateMetaOnSuccess(fileID, "native:"+string(policy.Type), false, nativeFormat)
			return
		} else if !errors.Is(err, storage.ErrFeatureNotSupported) {
			log.Printf("[ThumbnailService] 错误: 尝试获取原生缩略图时发生错误: %v", err)
			s.updateMetaOnFailure(fileID, "获取原生缩略图失败")
			return
		}
		log.Printf("[ThumbnailService] 信息: 存储驱动 '%s' 不支持原生缩略图，将回退到本地生成。", policy.Name)
	}

	// 4. 如果原生缩略图不可用，则回退到本地生成流程
	sourcePath, cleanup, err := s.getOriginalFile(ctx, file, policy, provider)
	if err != nil {
		log.Printf("[ThumbnailService] 错误: 获取文件 %d 的本地副本失败: %v", fileID, err)
		s.updateMetaOnFailure(fileID, err.Error())
		return
	}
	if cleanup != nil {
		defer cleanup()
	}

	for _, g := range s.generators {
		if g.CanHandle(ctx, file) {
			log.Printf("[ThumbnailService] 文件 %s (ID: %d) 将由 %T 处理...", file.Name, file.ID, g)
			result, err := g.Generate(ctx, file, sourcePath, ownerPublicID, filePublicID, parentPath)
			if err != nil {
				log.Printf("[ThumbnailService] 错误: 文件ID %d 生成预览失败: %v", fileID, err)
				s.updateMetaOnFailure(fileID, err.Error())
				return
			}
			log.Printf("[ThumbnailService] 成功: 文件ID %d 预览已生成", fileID)

			s.updateMetaOnSuccess(fileID, "generated:"+result.GeneratorName, result.IsDirectServe, result.Format)
			return
		}
	}

	s.updateMetaOnFailure(fileID, "不支持的文件类型，所有生成器都无法处理。")
}

func (s *ThumbnailService) getVirtualParentPath(ctx context.Context, file *model.File) (string, error) {
	if !file.ParentID.Valid {
		return "/", nil
	}
	var pathSegments []string
	currentFolderID := uint(file.ParentID.Int64)
	for i := 0; i < 100; i++ {
		folder, err := s.fileRepo.FindByIDUnscoped(ctx, currentFolderID)
		if err != nil {
			if errors.Is(err, constant.ErrNotFound) {
				return "", fmt.Errorf("路径构建中断，找不到ID为 %d 的父文件夹", currentFolderID)
			}
			return "", fmt.Errorf("查找路径段时失败, ID: %d, err: %w", currentFolderID, err)
		}
		if !folder.ParentID.Valid && folder.Name == "" {
			break
		}
		pathSegments = append([]string{folder.Name}, pathSegments...)
		if !folder.ParentID.Valid {
			break
		}
		currentFolderID = uint(folder.ParentID.Int64)
	}
	return "/" + strings.Join(pathSegments, "/"), nil
}

func (s *ThumbnailService) getPolicyAndProviderForFile(ctx context.Context, file *model.File) (*model.StoragePolicy, storage.IStorageProvider, error) {
	if !file.PrimaryEntityID.Valid {
		return nil, nil, fmt.Errorf("文件 (ID: %d) 没有关联的物理实体", file.ID)
	}
	entity, err := s.entityRepo.FindByID(ctx, uint(file.PrimaryEntityID.Uint64))
	if err != nil {
		return nil, nil, fmt.Errorf("找不到物理实体 (ID: %d): %w", file.PrimaryEntityID.Uint64, err)
	}
	if !entity.Source.Valid || entity.Source.String == "" {
		return nil, nil, fmt.Errorf("物理实体 (ID: %d) 没有源路径信息", entity.ID)
	}
	policy, err := s.policyService.GetPolicyByDatabaseID(ctx, entity.PolicyID)
	if err != nil {
		return nil, nil, fmt.Errorf("找不到实体(ID: %d)的存储策略(PolicyID: %d): %w", entity.ID, entity.PolicyID, err)
	}
	provider, ok := s.storageProviders[policy.Type]
	if !ok {
		return nil, nil, fmt.Errorf("找不到类型为 '%s' 的存储提供者", policy.Type)
	}
	file.PrimaryEntity = entity
	return policy, provider, nil
}

func (s *ThumbnailService) getOriginalFile(ctx context.Context, file *model.File, policy *model.StoragePolicy, provider storage.IStorageProvider) (path string, cleanup func(), err error) {
	// 本地文件也通过驱动读取并生成私有副本，不能把数据库路径交给生成器重新打开。
	fileStream, err := provider.Get(ctx, policy, file.PrimaryEntity.Source.String)
	if err != nil {
		return "", nil, fmt.Errorf("从存储获取文件流失败: %w", err)
	}
	defer func() {
		if err := fileStream.Close(); err != nil {
			log.Printf("[ThumbnailService] 关闭源文件流失败: %v", err)
		}
	}()
	tempFile, err := os.CreateTemp("", "anheyu-thumb-download-*")
	if err != nil {
		return "", nil, fmt.Errorf("无法创建缩略图源临时文件: %w", err)
	}
	cleanupFunc := func() {
		if err := os.Remove(tempFile.Name()); err != nil && !os.IsNotExist(err) {
			log.Printf("[ThumbnailService] 清理源临时文件失败: %v", err)
		}
	}
	_, copyErr := io.Copy(tempFile, fileStream)
	closeErr := tempFile.Close()
	if err := errors.Join(copyErr, closeErr); err != nil {
		cleanupFunc()
		return "", nil, fmt.Errorf("复制缩略图源文件失败: %w", err)
	}
	return tempFile.Name(), cleanupFunc, nil
}

func (s *ThumbnailService) updateMetaOnSuccess(fileID uint, source string, isDirectServe bool, format string) {
	ctx := context.Background()
	status := model.MetaValueStatusReady
	if isDirectServe {
		status = model.MetaValueStatusReadyDirect
	}
	s.metaService.Set(ctx, fileID, model.MetaKeyThumbStatus, status)
	s.metaService.Set(ctx, fileID, model.MetaKeyThumbSource, source)
	s.metaService.Set(ctx, fileID, model.MetaKeyThumbFormat, format)
	s.metaService.Delete(ctx, fileID, model.MetaKeyThumbRetryCount)
	s.metaService.Delete(ctx, fileID, model.MetaKeyThumbError)
}

func (s *ThumbnailService) updateMetaOnFailure(fileID uint, errorMsg string) {
	ctx := context.Background()
	s.metaService.Set(ctx, fileID, model.MetaKeyThumbStatus, model.MetaValueStatusFailed)
	s.metaService.Set(ctx, fileID, model.MetaKeyThumbError, errorMsg)
}

func parseCommaSeparatedString(s string) []string {
	if s == "" {
		return []string{}
	}
	return strings.Split(strings.ReplaceAll(s, " ", ""), ",")
}

func parseSizeString(s, generatorName string) int64 {
	size, err := strconv.ParseInt(s, 10, 64)
	if err != nil || size < 0 {
		log.Printf("[ThumbnailService] 警告: %s 最大文件尺寸配置 '%s' 无效，将设为不限制。", generatorName, s)
		return 0
	}
	return size
}

// RegenerateThumbnail 只负责重置元数据，为重新生成做准备。
func (s *ThumbnailService) ResetThumbnailMetadata(ctx context.Context, publicFileID string) error {
	fileID, _, err := idgen.DecodePublicID(publicFileID)
	if err != nil {
		return err
	}
	internalFileID := uint(fileID)

	log.Printf("[ThumbnailService] 正在为文件ID %d 重置缩略图元数据...", internalFileID)

	bgCtx := context.Background()
	go s.metaService.Delete(bgCtx, internalFileID, model.MetaKeyThumbError)
	go s.metaService.Delete(bgCtx, internalFileID, model.MetaKeyThumbRetryCount)
	go s.metaService.Delete(bgCtx, internalFileID, model.MetaKeyThumbFormat)
	// 将状态设置回空，让 GetThumbnailSign 逻辑来触发重新生成
	return s.metaService.Set(bgCtx, internalFileID, model.MetaKeyThumbStatus, "")
}

// ResetThumbnailMetadataForFiles 批量重置多个文件的缩略图元数据。
// 这是为 RegenerateThumbnailsForDirectory 处理器提供的性能优化。
func (s *ThumbnailService) ResetThumbnailMetadataForFiles(ctx context.Context, fileIDs []uint) error {
	if len(fileIDs) == 0 {
		return nil
	}

	log.Printf("[ThumbnailService] 正在为 %d 个文件批量重置缩略图元数据...", len(fileIDs))

	err := s.metaService.ResetThumbnailMetadataForFileIDs(ctx, fileIDs)
	if err != nil {
		return fmt.Errorf("批量重置元数据时发生错误: %w", err)
	}

	log.Printf("[ThumbnailService] %d 个文件的缩略图元数据批量重置成功。", len(fileIDs))
	return nil
}
