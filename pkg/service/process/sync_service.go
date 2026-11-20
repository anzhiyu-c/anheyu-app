package process

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"path/filepath"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/infra/storage"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/event"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/types"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/volume"
)

const (
	minSyncBatchSize = 50
	maxSyncBatchSize = 500
)

// ISyncService 定义了目录同步服务的接口。
type ISyncService interface {
	SyncDirectory(ctx context.Context, ownerID uint, policy *model.StoragePolicy, virtualPath string) error
}

// syncService 是 ISyncService 的实现。
type syncService struct {
	txManager        repository.TransactionManager
	fileRepo         repository.FileRepository
	entityRepo       repository.EntityRepository
	fileEntityRepo   repository.FileEntityRepository
	storagePolicySvc volume.IStoragePolicyService
	eventBus         *event.EventBus
	storageProviders map[constant.StoragePolicyType]storage.IStorageProvider
	settingSvc       setting.SettingService
}

// NewSyncService 是 syncService 的构造函数。
func NewSyncService(
	txManager repository.TransactionManager,
	fileRepo repository.FileRepository,
	entityRepo repository.EntityRepository,
	fileEntityRepo repository.FileEntityRepository,
	storagePolicySvc volume.IStoragePolicyService,
	eventBus *event.EventBus,
	storageProviders map[constant.StoragePolicyType]storage.IStorageProvider,
	settingSvc setting.SettingService,
) ISyncService {
	return &syncService{
		txManager:        txManager,
		fileRepo:         fileRepo,
		entityRepo:       entityRepo,
		fileEntityRepo:   fileEntityRepo,
		storagePolicySvc: storagePolicySvc,
		eventBus:         eventBus,
		storageProviders: storageProviders,
		settingSvc:       settingSvc,
	}
}

// calculateBatchSize 根据待处理的总项目数，动态计算出合理的批次大小。
func calculateBatchSize(totalItems int) int {
	if totalItems <= minSyncBatchSize {
		return totalItems
	}
	switch {
	case totalItems <= 200:
		return 50
	case totalItems <= 1000:
		return 100
	case totalItems <= 5000:
		return 250
	default:
		return maxSyncBatchSize
	}
}

// getProviderForPolicy 是一个辅助函数，用于根据存储策略获取对应的存储驱动实例。
func (s *syncService) getProviderForPolicy(policy *model.StoragePolicy) (storage.IStorageProvider, error) {
	if policy == nil {
		return nil, errors.New("policy is nil")
	}
	// 对于本地存储，动态读取配置以确保使用最新的签名密钥
	if policy.Type == constant.PolicyTypeLocal {
		// 动态创建 LocalProvider 以使用最新的签名密钥
		secret := s.settingSvc.Get(constant.KeyLocalFileSigningSecret.String())
		if secret == "" {
			return nil, fmt.Errorf("本地文件签名密钥未配置")
		}
		return storage.NewLocalProvider(secret), nil
	}
	provider, ok := s.storageProviders[policy.Type]
	if !ok {
		return nil, fmt.Errorf("找不到类型为 '%s' 的存储提供者", policy.Type)
	}
	return provider, nil
}

// SyncDirectory 负责将存储提供者（本地或云端）的内容与数据库进行高性能的双向同步。
func (s *syncService) SyncDirectory(ctx context.Context, ownerID uint, policy *model.StoragePolicy, virtualPath string) error {
	log.Printf("【SYNC START】 Policy: '%s', virtualPath: '%s'", policy.Name, virtualPath)

	provider, err := s.getProviderForPolicy(policy)
	if err != nil {
		return err
	}

	storageItems, err := provider.List(ctx, policy, virtualPath)
	if err != nil {
		// 后续页失败不代表根目录不存在，不能自动创建后用重试结果进行对账。
		if errors.Is(err, storage.ErrIncompleteListing) {
			log.Printf("警告: 存储目录 '%s' 的清单不完整，跳过本次同步: %v", virtualPath, err)
			return nil
		}
		isRootPath := virtualPath == policy.VirtualPath
		isNotFoundError := strings.Contains(err.Error(), "404") && strings.Contains(strings.ToLower(err.Error()), "item does not exist")
		if isRootPath && isNotFoundError {
			log.Printf("【SYNC INFO】策略 '%s' 的根路径 '%s' (BasePath: %s) 在云端不存在，正在尝试自动创建...", policy.Name, virtualPath, policy.BasePath)
			createErr := provider.CreateDirectory(ctx, policy, virtualPath)
			if createErr != nil {
				return fmt.Errorf("自动创建策略根目录 '%s' 失败，请检查配置或权限: %w", policy.BasePath, createErr)
			}
			log.Printf("【SYNC INFO】策略根目录创建/确认成功，正在重试列出内容...")
			storageItems, err = provider.List(ctx, policy, virtualPath)
			if err != nil {
				return fmt.Errorf("重试列出新创建的策略根目录失败: %w", err)
			}
		} else {
			log.Printf("警告: 从存储驱动列出 '%s' 失败，跳过本次同步: %v", virtualPath, err)
			return nil
		}
	}

	physicalItems := make(map[string]storage.FileInfo, len(storageItems))
	for _, item := range storageItems {
		if strings.HasPrefix(item.Name, ".") {
			continue
		}
		physicalItems[item.Name] = item
	}

	parentFolder, err := s.findOrCreateParentFolder(ctx, ownerID, virtualPath)
	if err != nil {
		return err
	}

	dbSyncItems, err := s.fileRepo.ListByParentIDUnscoped(ctx, parentFolder.ID)
	if err != nil {
		return fmt.Errorf("同步时列出数据库子项失败: %w", err)
	}

	allPolicies, err := s.storagePolicySvc.ListAll(ctx)
	if err != nil {
		return fmt.Errorf("无法获取所有存储策略以构建排除列表: %w", err)
	}
	mountPointExclusions := make(map[string]bool)
	normalizedVirtualPath := strings.Trim(virtualPath, "/")
	if virtualPath == "/" {
		normalizedVirtualPath = ""
	}

	// 确保所有子挂载点文件夹都存在于数据库中
	for _, p := range allPolicies {
		// 检查策略 p 是否是当前同步目录的直接子目录
		if strings.HasPrefix(p.VirtualPath, "/") && len(p.VirtualPath) > 1 {
			// 获取子策略挂载点的父路径
			// 例如, p.VirtualPath = "/abc/aaa/bbb", 则 policyParentPath = "abc/aaa"
			policyParentPath := filepath.ToSlash(filepath.Dir(strings.TrimPrefix(p.VirtualPath, "/")))
			if policyParentPath == "." { // 如果是根目录下的挂载点
				policyParentPath = ""
			}

			// 如果子策略的父路径就是当前正在同步的路径
			if policyParentPath == normalizedVirtualPath {
				mountPointName := filepath.Base(p.VirtualPath)
				mountPointExclusions[mountPointName] = true
				log.Printf("【SYNC PRE-CHECK】检测到子挂载点 '%s' (路径: %s)，正在确保其文件夹记录存在...", mountPointName, p.VirtualPath)

				// 确保这个挂载点对应的文件夹记录在数据库中存在，如果不存在则创建。
				// 这是为了防止它被意外删除。
				_, err := s.findOrCreateParentFolder(ctx, ownerID, p.VirtualPath)
				if err != nil {
					log.Printf("【SYNC WARNING】无法为子挂载点 '%s' 创建或查找数据库文件夹记录，但仍会继续同步: %v", p.VirtualPath, err)
				} else {
					log.Printf("【SYNC PRE-CHECK】子挂载点 '%s' 的文件夹记录已确认存在。", mountPointName)
				}
			}
		}
	}

	for _, dbItem := range dbSyncItems {
		if dbItem.IsDeleted {
			continue
		}
		if _, existsInStorage := physicalItems[dbItem.File.Name]; !existsInStorage {
			if mountPointExclusions[dbItem.File.Name] {
				log.Printf("【SYNC SKIP】跳过删除虚拟挂载点: '%s'", dbItem.File.Name)
				continue
			}

			// 保护空文件：如果文件没有PrimaryEntityID，说明是有效的空文件，不应该被删除
			if dbItem.File.Type == model.FileTypeFile && !dbItem.File.PrimaryEntityID.Valid {
				log.Printf("【SYNC SKIP】跳过删除空文件: '%s' (没有实体记录，是有效的空文件)", dbItem.File.Name)
				continue
			}

			log.Printf("【SYNC DELETE】检测到存储中不存在 '%s'，将从数据库删除。", dbItem.File.Name)
			err := s.txManager.Do(ctx, func(repos repository.Repositories) error {
				return s.hardDeleteRecursively(ctx, ownerID, dbItem.File.ID, repos.File, repos.Entity, repos.FileEntity, repos.Metadata, repos.StoragePolicy, repos.DirectLink)
			})
			if err != nil {
				log.Printf("警告: 同步删除项 '%s' (ID: %d) 失败: %v", dbItem.File.Name, dbItem.File.ID, err)
			}
		}
	}

	dbSyncItemsAfterDelete, _ := s.fileRepo.ListByParentIDUnscoped(ctx, parentFolder.ID)
	dbItemsMap := make(map[string]repository.SyncItem, len(dbSyncItemsAfterDelete))
	for _, item := range dbSyncItemsAfterDelete {
		dbItemsMap[item.File.Name] = item
	}
	var itemsToCreate []storage.FileInfo
	for itemName, itemInfo := range physicalItems {
		if _, existsInDb := dbItemsMap[itemName]; !existsInDb {
			itemsToCreate = append(itemsToCreate, itemInfo)
		}
	}
	totalToCreate := len(itemsToCreate)
	if totalToCreate == 0 {
		log.Println("【SYNC END】没有新文件需要同步。")
		return nil
	}

	batchSize := calculateBatchSize(totalToCreate)
	log.Printf("【SYNC INFO】检测到 %d 个新项，将以批次大小 %d 进行处理。", totalToCreate, batchSize)
	for i := 0; i < totalToCreate; i += batchSize {
		end := i + batchSize
		if end > totalToCreate {
			end = totalToCreate
		}
		currentBatch := itemsToCreate[i:end]
		log.Printf("【SYNC BATCH】正在处理批次: %d 到 %d...", i+1, end)
		err := s.txManager.Do(ctx, func(repos repository.Repositories) error {
			var newFilesInBatch []*model.File
			for _, item := range currentBatch {
				newFile := &model.File{
					OwnerID:  ownerID,
					ParentID: sql.NullInt64{Int64: int64(parentFolder.ID), Valid: true},
					Name:     item.Name,
					Size:     item.Size,
				}
				if item.IsDir {
					newFile.Type = model.FileTypeDir
				} else {
					newFile.Type = model.FileTypeFile
					var sourceValue string

					// 根据策略类型决定 Source 字段的内容
					if policy.Type == constant.PolicyTypeLocal {
						// 与 LocalProvider.Upload 一致：用统一 helper 解析虚拟路径，避免前导 / 导致 Join 丢 BasePath，并尽量写入绝对路径
						fullVirtual := filepath.ToSlash(filepath.Join(virtualPath, item.Name))
						p, pathErr := storage.LocalEntitySourcePath(policy, fullVirtual)
						if pathErr != nil {
							return fmt.Errorf("同步构建本地物理路径失败 (%s): %w", item.Name, pathErr)
						}
						sourceValue = p
					} else {
						// 对于云存储策略，Source 是对象存储的键（与Upload方法保持一致）
						// 计算相对路径
						relativePath := strings.TrimPrefix(virtualPath, policy.VirtualPath)
						relativePath = strings.TrimPrefix(relativePath, "/")

						basePath := strings.TrimPrefix(strings.TrimSuffix(policy.BasePath, "/"), "/")

						if basePath == "" {
							if relativePath == "" {
								sourceValue = item.Name
							} else {
								sourceValue = relativePath + "/" + item.Name
							}
						} else {
							if relativePath == "" {
								sourceValue = basePath + "/" + item.Name
							} else {
								sourceValue = basePath + "/" + relativePath + "/" + item.Name
							}
						}
					}

					newEntity := &model.FileStorageEntity{
						PolicyID:  policy.ID,
						CreatedBy: types.NullUint64{Uint64: uint64(ownerID), Valid: true},
						Type:      model.EntityTypeFileContentModel,
						Source:    sql.NullString{String: sourceValue, Valid: true},
						Size:      item.Size,
					}
					if err := repos.Entity.Create(ctx, newEntity); err != nil {
						return fmt.Errorf("批处理中创建实体记录失败 for '%s': %w", item.Name, err)
					}
					newFile.PrimaryEntityID = types.NullUint64{Uint64: uint64(newEntity.ID), Valid: true}
				}
				if err := repos.File.Create(ctx, newFile); err != nil {
					if _, findErr := repos.File.FindByParentIDAndName(ctx, parentFolder.ID, newFile.Name); findErr == nil {
						continue
					}
					return fmt.Errorf("批处理中创建 files 记录 '%s' 失败: %w", newFile.Name, err)
				}
				if !item.IsDir {
					newFilesInBatch = append(newFilesInBatch, newFile)
					if newFile.PrimaryEntityID.Valid {
						newVersion := &model.FileStorageVersion{
							FileID:    newFile.ID,
							EntityID:  uint(newFile.PrimaryEntityID.Uint64),
							IsCurrent: true,
						}
						if err := repos.FileEntity.Create(ctx, newVersion); err != nil {
							return fmt.Errorf("批处理中创建文件版本关联失败 for FileID %d: %w", newFile.ID, err)
						}
					}
				}
			}

			if len(newFilesInBatch) > 0 {
				var finalFileIDsToPublish []uint
				for _, file := range newFilesInBatch {
					if s.isThumbnailable(file) {
						finalFileIDsToPublish = append(finalFileIDsToPublish, file.ID)
					} else {
						log.Printf("【SYNC FILTER】文件 '%s' 不支持缩略图，跳过后台任务派发。", file.Name)
					}
				}
				if len(finalFileIDsToPublish) > 0 {
					go s.publishFileCreatedEvents(finalFileIDsToPublish)
				}
			}
			return nil
		})
		if err != nil {
			log.Printf("错误: 处理批次 %d 到 %d 时发生错误，此批次已回滚: %v", i+1, end, err)
			continue
		}
		log.Printf("【SYNC BATCH】批次 %d 到 %d 处理成功。", i+1, end)
	}

	log.Println("【SYNC END】所有批次处理完成。")
	return nil
}

// publishFileCreatedEvents 在一个独立的goroutine中，安排一个延迟执行的事件发布任务。
func (s *syncService) publishFileCreatedEvents(fileIDs []uint) {
	if len(fileIDs) == 0 {
		return
	}
	delay := 2 * time.Second
	log.Printf("【后台任务-SyncSvc】已为 %d 个新文件安排了一个在 %v 后执行的 'FileCreated' 事件发布任务。", len(fileIDs), delay)
	time.AfterFunc(delay, func() {
		log.Printf("【后台任务-SyncSvc】[延迟执行] 开始为 %d 个新文件发布 'FileCreated' 事件...", len(fileIDs))
		for _, id := range fileIDs {
			s.eventBus.Publish(event.FileCreated, id)
		}
		log.Printf("【后台任务-SyncSvc】[延迟执行] 所有 'FileCreated' 事件发布完毕。")
	})
}

// hardDeleteRecursively 递归地硬删除文件/目录及其所有关联数据。
func (s *syncService) hardDeleteRecursively(
	ctx context.Context, ownerID uint, fileID uint,
	txFileRepo repository.FileRepository, txEntityRepo repository.EntityRepository,
	txFileEntityRepo repository.FileEntityRepository, txMetadataRepo repository.MetadataRepository,
	txPolicyRepo repository.StoragePolicyRepository, txDirectLinkRepo repository.DirectLinkRepository,
) error {
	item, err := txFileRepo.FindByIDUnscoped(ctx, fileID)
	if err != nil {
		if errors.Is(err, constant.ErrNotFound) {
			return nil
		}
		return fmt.Errorf("查找待删除项 %d 失败: %w", fileID, err)
	}
	if item.OwnerID != ownerID {
		return fmt.Errorf("同步删除时权限不匹配 for item '%s'", item.Name)
	}

	if item.Type == model.FileTypeDir {
		linkedPolicy, err := txPolicyRepo.FindByNodeID(ctx, item.ID)
		if err != nil {
			return fmt.Errorf("检查文件夹 '%s' (ID: %d) 的策略关联失败，中止操作: %w", item.Name, item.ID, err)
		}
		if linkedPolicy != nil && linkedPolicy.Flag != "" {
			// 如果是带flag的策略挂载点，则不是返回错误，而是静默跳过，因为同步时这被认为是正常情况
			log.Printf("【SYNC SKIP】跳过删除系统策略 '%s' 的挂载点文件夹 '%s'。", linkedPolicy.Name, item.Name)
			return nil
		}
	}

	if item.Type == model.FileTypeDir {
		children, err := txFileRepo.ListByParentIDUnscoped(ctx, item.ID)
		if err != nil {
			return fmt.Errorf("列出子目录 '%s' 失败: %w", item.Name, err)
		}
		for _, childItem := range children {
			// 递归调用时传入 txPolicyRepo
			if err := s.hardDeleteRecursively(ctx, ownerID, childItem.File.ID, txFileRepo, txEntityRepo, txFileEntityRepo, txMetadataRepo, txPolicyRepo, txDirectLinkRepo); err != nil {
				return err
			}
		}
	}

	if item.Type == model.FileTypeFile && item.PrimaryEntityID.Valid {
		entityID := uint(item.PrimaryEntityID.Uint64)
		log.Printf("【SYNC CLEANUP】正在删除文件 '%s' (ID: %d) 及其关联数据...", item.Name, item.ID)
		if err := txFileEntityRepo.DeleteByFileID(ctx, item.ID); err != nil {
			return fmt.Errorf("删除文件版本关联 %d 失败: %w", item.ID, err)
		}
		log.Printf("【SYNC CLEANUP】...删除物理实体 (ID: %d)", entityID)
		if err := txEntityRepo.HardDelete(ctx, entityID); err != nil {
			log.Printf("警告: 硬删除实体 %d 失败 (可能已被删除): %v", entityID, err)
		}
	}
	log.Printf("【SYNC CLEANUP】正在删除文件/目录 (ID: %d) 的元数据...", item.ID)
	if err := txMetadataRepo.DeleteByFileID(ctx, item.ID); err != nil {
		return fmt.Errorf("删除文件 %d 的元数据失败: %w", item.ID, err)
	}

	// 删除相关的直链记录（如果有的话）
	if item.Type == model.FileTypeFile {
		log.Printf("【SYNC CLEANUP】正在删除文件 (ID: %d) 的直链记录...", item.ID)
		if err := txDirectLinkRepo.DeleteByFileID(ctx, item.ID); err != nil {
			log.Printf("【SYNC WARN】删除直链记录失败: %v", err)
			// 不返回错误，继续删除文件记录
		}
	}

	log.Printf("【SYNC CLEANUP】正在删除文件/目录记录 (ID: %d)...", item.ID)
	if err := txFileRepo.HardDelete(ctx, item.ID); err != nil {
		return fmt.Errorf("硬删除文件/目录记录 %d 失败: %w", item.ID, err)
	}
	return nil
}

// findOrCreateParentFolder 递归地查找或创建父目录。
func (s *syncService) findOrCreateParentFolder(ctx context.Context, ownerID uint, path string) (*model.File, error) {
	folder, err := s.fileRepo.FindByPath(ctx, ownerID, path)
	if err == nil {
		return folder, nil
	}
	if !errors.Is(err, constant.ErrNotFound) {
		return nil, err
	}
	if path == "/" || path == "" {
		return s.createRootFolderIfNotExist(ctx, ownerID)
	}
	parentDirPath := filepath.Dir(path)
	if parentDirPath == "." {
		parentDirPath = "/"
	}
	parentDir, err := s.findOrCreateParentFolder(ctx, ownerID, parentDirPath)
	if err != nil {
		return nil, err
	}
	currentDirName := filepath.Base(path)
	newDir := &model.File{
		OwnerID:  ownerID,
		ParentID: sql.NullInt64{Int64: int64(parentDir.ID), Valid: true},
		Name:     currentDirName,
		Size:     0,
		Type:     model.FileTypeDir,
	}
	if err := s.fileRepo.Create(ctx, newDir); err != nil {
		if folder, findErr := s.fileRepo.FindByParentIDAndName(ctx, parentDir.ID, currentDirName); findErr == nil {
			return folder, nil
		}
		return nil, fmt.Errorf("创建子目录 '%s' 失败: %w", currentDirName, err)
	}
	return newDir, nil
}

// createRootFolderIfNotExist 确保根目录("/")在数据库中存在。
func (s *syncService) createRootFolderIfNotExist(ctx context.Context, ownerID uint) (*model.File, error) {
	root, err := s.fileRepo.FindByPath(ctx, ownerID, "/")
	if err == nil {
		return root, nil
	}
	if !errors.Is(err, constant.ErrNotFound) {
		return nil, err
	}
	rootFolder := &model.File{
		OwnerID:  ownerID,
		ParentID: sql.NullInt64{Valid: false},
		Name:     "",
		Size:     0,
		Type:     model.FileTypeDir,
	}
	if err := s.fileRepo.Create(ctx, rootFolder); err != nil {
		return nil, err
	}
	return rootFolder, nil
}

// isThumbnailable 是一个辅助函数，用于快速判断一个文件类型是否可能生成缩略图。
// 这是一个白名单过滤，避免为不可能处理的文件（如.zip, .txt）创建后台任务。
func (s *syncService) isThumbnailable(file *model.File) bool {
	if file.Type == model.FileTypeDir || file.Size == 0 {
		return false
	}
	ext := strings.ToLower(filepath.Ext(file.Name))
	// 这个白名单应该包含所有 Generator 可能支持的后缀名
	supportedExts := map[string]bool{
		// 图片 (来自 Builtin & VIPS)
		".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true, ".bmp": true, ".svg": true, ".avif": true, ".heic": true, ".heif": true, ".tiff": true, ".tif": true,

		// 视频 (来自 ffmpeg)
		".mp4": true, ".mov": true, ".avi": true, ".mkv": true, ".webm": true, ".wmv": true, ".flv": true, ".m4v": true, ".mts": true, ".mpg": true,

		// 音频 (来自 music cover)
		".mp3": true, ".flac": true, ".wav": true, ".m4a": true, ".ogg": true,

		// 文档 (来自 VIPS)
		".pdf": true,

		// RAW 格式 (来自 LibRaw/DCRaw)
		".3fr": true, ".ari": true, ".arw": true, ".bay": true, ".braw": true, ".crw": true, ".cr2": true, ".cr3": true, ".cap": true, ".data": true, ".dcs": true, ".dcr": true, ".dng": true, ".drf": true, ".eip": true, ".erf": true, ".fff": true, ".gpr": true, ".iiq": true, ".k25": true, ".kdc": true, ".mdc": true, ".mef": true, ".mos": true, ".mrw": true, ".nef": true, ".nrw": true, ".obm": true, ".orf": true, ".pef": true, ".ptx": true, ".pxn": true, ".r3d": true, ".raf": true, ".raw": true, ".rwl": true, ".rw2": true, ".rwz": true, ".sr2": true, ".srf": true, ".srw": true, ".x3f": true,
	}
	return supportedExts[ext]
}
