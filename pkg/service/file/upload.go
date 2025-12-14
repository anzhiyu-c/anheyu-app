package file

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/infra/storage"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/event"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/types"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/uri"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/file_info"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/volume"

	"github.com/google/uuid"
)

// 定义常量以提高代码可维护性
const (
	uploadSessionCachePrefix = "upload:session:"
	defaultUploadChunkSize   = 5 * 1024 * 1024 // 5MB
	uploadSessionExpiration  = 24 * time.Hour
	defaultUploadTempDir     = "./data/temp/uploads"
)

// IUploadService 定义了所有与文件上传相关的业务逻辑接口。
type IUploadService interface {
	// CreateUploadSession 创建一个新的文件上传会话。
	CreateUploadSession(ctx context.Context, ownerID uint, req *model.CreateUploadRequest) (*model.UploadSessionData, error)
	// UploadChunk 上传文件的一个分片。
	UploadChunk(ctx context.Context, sessionID string, index int, chunkStream io.Reader) error
	// DeleteUploadSession 删除一个正在进行的上传会话。
	DeleteUploadSession(ctx context.Context, ownerID uint, req *model.DeleteUploadRequest) error
	// GetUploadSessionStatus 获取指定上传会话的状态。
	GetUploadSessionStatus(ctx context.Context, ownerID uint, sessionID string) (*model.UploadSessionStatusResponse, error)
	// CleanupAbandonedUploads 清理所有被遗弃的、超时的上传任务。
	CleanupAbandonedUploads(ctx context.Context) (int, error)
	// FinalizeClientUpload 处理客户端直传完成后的回调，在数据库中创建文件记录。
	FinalizeClientUpload(ctx context.Context, ownerID uint, req *model.FinalizeUploadRequest) (*model.File, error)
}

// uploadService 是 IUploadService 接口的实现。
type uploadService struct {
	txManager        repository.TransactionManager                           // 事务管理器，用于保证数据库操作的原子性
	eventBus         *event.EventBus                                         // 事件总线，用于发布文件创建等事件
	entityRepo       repository.EntityRepository                             // 物理实体仓库
	metadataSvc      *file_info.MetadataService                              // 元数据服务
	cacheSvc         utility.CacheService                                    // 缓存服务，用于存储上传会话
	policySvc        volume.IStoragePolicyService                            // 存储策略服务
	settingSvc       setting.SettingService                                  // 系统设置服务
	storageProviders map[constant.StoragePolicyType]storage.IStorageProvider // 存储驱动提供者集合
	uploadTempDir    string                                                  // 临时上传目录
}

// NewUploadService 是 uploadService 的构造函数
func NewUploadService(
	txManager repository.TransactionManager,
	eventBus *event.EventBus,
	entityRepo repository.EntityRepository,
	metadataSvc *file_info.MetadataService,
	cacheSvc utility.CacheService,
	policySvc volume.IStoragePolicyService,
	settingSvc setting.SettingService,
	providers map[constant.StoragePolicyType]storage.IStorageProvider,
) IUploadService {

	tempDir := defaultUploadTempDir
	if err := os.MkdirAll(tempDir, os.ModePerm); err != nil {
		fmt.Printf("警告: 无法创建临时上传目录 %s: %v\n", tempDir, err)
	}

	return &uploadService{
		txManager:        txManager,
		eventBus:         eventBus,
		entityRepo:       entityRepo,
		metadataSvc:      metadataSvc,
		cacheSvc:         cacheSvc,
		policySvc:        policySvc,
		settingSvc:       settingSvc,
		storageProviders: providers,
		uploadTempDir:    tempDir,
	}
}

// CleanupAbandonedUploads 清理所有被遗弃的上传会话及其相关资源。
// 这是一个后台垃圾回收任务，用于删除那些已开始但长时间未完成的上传所产生的临时数据。
func (s *uploadService) CleanupAbandonedUploads(ctx context.Context) (int, error) {
	abandonedThreshold := time.Now().Add(-24 * time.Hour)
	orphanedEntities, err := s.entityRepo.FindOrphaned(ctx, abandonedThreshold)
	if err != nil {
		return 0, fmt.Errorf("查找孤儿实体时发生数据库错误: %w", err)
	}

	if len(orphanedEntities) == 0 {
		return 0, nil
	}

	cleanedCount := 0
	for _, entity := range orphanedEntities {
		sessionID := entity.UploadSessionID.String
		if sessionID == "" {
			continue
		}
		log.Printf("[GC-JOB] 正在清理孤儿实体 ID: %d, Session ID: %s", entity.ID, sessionID)
		// 删除磁盘上的临时分片文件
		sessionTempDir := filepath.Join(s.uploadTempDir, sessionID)
		if err := os.RemoveAll(sessionTempDir); err != nil {
			log.Printf("[GC-WARN] 清理磁盘目录 %s 失败: %v", sessionTempDir, err)
		}
		// 删除数据库中的临时实体记录
		if err := s.entityRepo.HardDelete(ctx, entity.ID); err != nil {
			log.Printf("[GC-ERROR] 删除数据库中的孤儿实体记录 %d 失败: %v", entity.ID, err)
			continue
		}
		// 删除缓存中的会话信息
		sessionKey := uploadSessionCachePrefix + sessionID
		_ = s.cacheSvc.Delete(ctx, sessionKey)
		cleanedCount++
		log.Printf("[GC-JOB] 成功清理孤儿实体 ID: %d", entity.ID)
	}

	return cleanedCount, nil
}

// CreateUploadSession 在上传流程开始时，负责进行前置校验、确保目标目录存在，并创建一个临时的物理实体记录。
func (s *uploadService) CreateUploadSession(ctx context.Context, ownerID uint, req *model.CreateUploadRequest) (*model.UploadSessionData, error) {
	// 步骤 1: 基本校验
	if strings.HasSuffix(req.URI, "/") {
		return nil, errors.New("无法为目录创建上传会话，请提供完整的文件路径")
	}

	fileName := filepath.Base(req.URI)
	fileExt := strings.ToLower(strings.TrimPrefix(filepath.Ext(fileName), "."))

	// 步骤 2: 从全局设置服务获取允许的扩展名并校验
	allowedExtStr := s.settingSvc.Get(constant.KeyUploadAllowedExtensions.String())
	if allowedExtStr != "" {
		allowedList := strings.Split(allowedExtStr, ",")
		isAllowed := false
		for _, allowed := range allowedList {
			if strings.TrimSpace(allowed) == fileExt {
				isAllowed = true
				break
			}
		}
		if !isAllowed {
			return nil, fmt.Errorf("不支持的文件类型: .%s", fileExt)
		}
	}

	// 步骤 3: 根据请求中的 PolicyID 获取策略并校验文件大小
	policy, err := s.policySvc.GetPolicyByID(ctx, req.PolicyID)
	if err != nil {
		if errors.Is(err, constant.ErrNotFound) {
			return nil, errors.New("指定的存储策略不存在")
		}
		return nil, fmt.Errorf("获取存储策略失败: %w", err)
	}
	if policy.MaxSize > 0 && req.Size > policy.MaxSize {
		return nil, fmt.Errorf("文件大小超出策略限制")
	}

	// 步骤 4: 路径解析
	parsedURI, err := uri.Parse(req.URI)
	if err != nil {
		return nil, fmt.Errorf("解析目标URI失败: %w", err)
	}

	// 步骤 5: 根据策略决定上传方式并执行相应逻辑
	uploadMethod := policy.Settings.GetString(constant.UploadMethodSettingKey, constant.UploadMethodServer)

	// 支持客户端直传的存储类型列表
	clientUploadSupportedTypes := map[constant.StoragePolicyType]bool{
		constant.PolicyTypeOneDrive:   true,
		constant.PolicyTypeTencentCOS: true,
		constant.PolicyTypeAliOSS:     true,
		constant.PolicyTypeS3:         true,
	}

	// --- 客户端直传逻辑 (OneDrive, 腾讯云COS, 阿里云OSS, AWS S3) ---
	if uploadMethod == constant.UploadMethodClient && clientUploadSupportedTypes[policy.Type] {
		// 在获取直传链接前，同样需要检查路径和冲突，确保这是一个合法的上传位置
		err = s.txManager.Do(ctx, func(repos repository.Repositories) error {
			parentPath := filepath.Dir(parsedURI.Path)
			parentFolder, err := s.findOrCreatePath(ctx, ownerID, parentPath, repos.File)
			if err != nil {
				return fmt.Errorf("创建或查找父目录'%s'失败: %w", parentPath, err)
			}
			if !req.Overwrite {
				_, err := repos.File.FindByParentIDAndName(ctx, parentFolder.ID, fileName)
				if err == nil {
					return fmt.Errorf("%w: 文件 '%s' 已存在", constant.ErrConflict, fileName)
				}
				if !errors.Is(err, constant.ErrNotFound) {
					return err
				}
			}
			return nil
		})
		if err != nil {
			return nil, err
		}

		// 执行获取直传链接的逻辑
		provider, err := s.getProviderForPolicy(policy)
		if err != nil {
			return nil, err
		}
		presignedProvider, ok := provider.(interface {
			CreatePresignedUploadURL(context.Context, *model.StoragePolicy, string) (*storage.PresignedUploadResult, error)
		})
		if !ok {
			return nil, fmt.Errorf("存储驱动 '%s' 不支持客户端直传", policy.Type)
		}

		presignedResult, err := presignedProvider.CreatePresignedUploadURL(ctx, policy, parsedURI.Path)
		if err != nil {
			return nil, fmt.Errorf("创建客户端直传链接失败: %w", err)
		}

		return &model.UploadSessionData{
			Expires:      presignedResult.ExpirationDateTime.Unix(),
			UploadMethod: constant.UploadMethodClient,
			UploadURL:    presignedResult.UploadURL,
			ContentType:  presignedResult.ContentType,
			StoragePolicy: &model.StoragePolicyInfo{
				ID:      req.PolicyID,
				Name:    policy.Name,
				Type:    string(policy.Type),
				MaxSize: policy.MaxSize,
			},
		}, nil
	}

	// --- 服务端上传逻辑 (默认) ---
	var sessionID string
	var tempEntityID uint
	err = s.txManager.Do(ctx, func(repos repository.Repositories) error {
		parentPath := filepath.Dir(parsedURI.Path)
		parentFolder, err := s.findOrCreatePath(ctx, ownerID, parentPath, repos.File)
		if err != nil {
			return fmt.Errorf("创建或查找父目录'%s'失败: %w", parentPath, err)
		}
		if !req.Overwrite {
			_, err := repos.File.FindByParentIDAndName(ctx, parentFolder.ID, fileName)
			if err == nil {
				return fmt.Errorf("%w: 文件 '%s' 已存在", constant.ErrConflict, fileName)
			}
			if !errors.Is(err, constant.ErrNotFound) {
				return err
			}
		}

		genSessionID := uuid.NewString()
		tempEntity := &model.FileStorageEntity{
			Size:            req.Size,
			PolicyID:        policy.ID,
			CreatedBy:       types.NullUint64{Uint64: uint64(ownerID), Valid: true},
			UploadSessionID: sql.NullString{String: genSessionID, Valid: true},
			Type:            model.EntityTypeFileContentModel,
		}
		if err := repos.Entity.Create(ctx, tempEntity); err != nil {
			return fmt.Errorf("在事务中创建临时实体记录失败: %w", err)
		}
		sessionID = genSessionID
		tempEntityID = tempEntity.ID
		return nil
	})
	if err != nil {
		return nil, err
	}

	// 获取策略定义的分片大小
	chunkSize := policy.Settings.GetInt("chunk_size", defaultUploadChunkSize)
	if chunkSize <= 0 {
		chunkSize = defaultUploadChunkSize
	}
	// 创建会话对象并存入缓存
	session := &model.UploadSession{
		SessionID:      sessionID,
		OwnerID:        ownerID,
		PolicyID:       req.PolicyID,
		URI:            req.URI,
		ChunkSize:      chunkSize,
		FileSize:       req.Size,
		TempEntityID:   tempEntityID,
		UploadedChunks: make(map[int]bool),
		ExpireAt:       time.Now().Add(uploadSessionExpiration),
	}
	sessionKey := uploadSessionCachePrefix + sessionID
	sessionBytes, err := json.Marshal(session)
	if err != nil {
		// 如果序列化失败，清理掉之前创建的临时实体
		_ = s.entityRepo.HardDelete(context.Background(), tempEntityID)
		return nil, fmt.Errorf("无法序列化上传会话: %w", err)
	}
	if err := s.cacheSvc.Set(ctx, sessionKey, string(sessionBytes), uploadSessionExpiration); err != nil {
		s.entityRepo.HardDelete(context.Background(), tempEntityID)
		return nil, fmt.Errorf("无法创建上传会话缓存: %w", err)
	}

	return &model.UploadSessionData{
		Expires:      session.ExpireAt.Unix(),
		UploadMethod: constant.UploadMethodServer,
		SessionID:    sessionID,
		ChunkSize:    chunkSize,
		StoragePolicy: &model.StoragePolicyInfo{
			ID:      req.PolicyID,
			Name:    policy.Name,
			Type:    string(policy.Type),
			MaxSize: policy.MaxSize,
		},
	}, nil
}

// getProviderForPolicy 是一个辅助函数，用于根据存储策略获取对应的存储驱动实例。
func (s *uploadService) getProviderForPolicy(policy *model.StoragePolicy) (storage.IStorageProvider, error) {
	if policy == nil {
		return nil, errors.New("policy cannot be nil")
	}
	provider, ok := s.storageProviders[policy.Type]
	if !ok {
		return nil, fmt.Errorf("找不到类型为 '%s' 的存储提供者", policy.Type)
	}
	return provider, nil
}

// generateSessionID 生成一个唯一的会话 ID
func (s *uploadService) generateSessionID() string {
	return uuid.New().String()
}

// findOrCreatePath 确保上传路径中的所有目录都存在，并返回最终的目标父目录。
func (s *uploadService) findOrCreatePath(ctx context.Context, ownerID uint, path string, txRepo repository.FileRepository) (*model.File, error) {
	normalizedPath := strings.Trim(path, "/")
	if normalizedPath == "" || normalizedPath == "." {
		normalizedPath = "/"
	}

	parentFolder, err := txRepo.FindOrCreateRootDirectory(ctx, ownerID)
	if err != nil {
		return nil, fmt.Errorf("处理根目录失败: %w", err)
	}

	if normalizedPath == "/" {
		return parentFolder, nil
	}

	pathSegments := strings.Split(normalizedPath, "/")
	for _, segment := range pathSegments {
		nextFolder, findErr := txRepo.FindOrCreateDirectory(ctx, parentFolder.ID, segment, ownerID)
		if findErr != nil {
			return nil, fmt.Errorf("处理目录段 '%s' 失败: %w", segment, findErr)
		}
		parentFolder = nextFolder
	}

	return parentFolder, nil
}

// UploadChunk 处理单个分片的上传，并在所有分片完成后触发最终的合并与定稿流程。
func (s *uploadService) UploadChunk(ctx context.Context, sessionID string, index int, chunkStream io.Reader) error {
	// 从缓存中获取会话信息
	sessionKey := uploadSessionCachePrefix + sessionID
	sessionJSON, err := s.cacheSvc.Get(ctx, sessionKey)
	if err != nil {
		return errors.New("上传会话不存在或已过期")
	}
	var session model.UploadSession
	if err := json.Unmarshal([]byte(sessionJSON), &session); err != nil {
		return fmt.Errorf("解析上传会话失败: %w", err)
	}

	totalChunks := (int(session.FileSize) + session.ChunkSize - 1) / session.ChunkSize
	if index < 0 || index >= totalChunks {
		return errors.New("无效的分块索引")
	}

	// 将分片数据写入临时文件
	sessionTempDir := filepath.Join(s.uploadTempDir, sessionID)
	if err := os.MkdirAll(sessionTempDir, os.ModePerm); err != nil {
		return fmt.Errorf("无法创建会话临时目录: %w", err)
	}

	chunkFilePath := filepath.Join(sessionTempDir, strconv.Itoa(index))
	chunkFile, err := os.Create(chunkFilePath)
	if err != nil {
		return fmt.Errorf("无法创建分块文件: %w", err)
	}
	defer chunkFile.Close()

	if _, err = io.Copy(chunkFile, chunkStream); err != nil {
		return fmt.Errorf("写入分块数据失败: %w", err)
	}

	// 更新会话状态，标记此分片已上传
	session.UploadedChunks[index] = true
	sessionBytes, err := json.Marshal(session)
	if err != nil {
		return fmt.Errorf("更新上传会话失败: %w", err)
	}
	if err := s.cacheSvc.Set(ctx, sessionKey, string(sessionBytes), time.Until(session.ExpireAt)); err != nil {
		return fmt.Errorf("更新上传会话缓存失败: %w", err)
	}

	// 检查是否所有分片都已上传完毕
	allChunksUploaded := true
	for i := 0; i < totalChunks; i++ {
		if !session.UploadedChunks[i] {
			allChunksUploaded = false
			break
		}
	}

	// 如果所有分片都已上传，则触发文件定稿流程
	if allChunksUploaded {
		if err := s.completeFileUpload(ctx, &session); err != nil {
			s.cleanupTempFiles(sessionID)
			return fmt.Errorf("文件上传完成处理失败: %w", err)
		}
		// 定稿成功后，删除会话缓存
		if err := s.cacheSvc.Delete(ctx, sessionKey); err != nil {
			log.Printf("[UploadChunk] 警告: 删除上传会话缓存失败: %v\n", err)
		}
	}

	return nil
}

// completeFileUpload 在所有文件分片上传成功后，执行文件的最终定稿操作。
func (s *uploadService) completeFileUpload(ctx context.Context, session *model.UploadSession) error {
	// 1. 合并分片文件
	sessionTempDir := filepath.Join(s.uploadTempDir, session.SessionID)
	mergedFilePath := filepath.Join(sessionTempDir, "merged_file")
	mergedFile, err := os.Create(mergedFilePath)
	if err != nil {
		return fmt.Errorf("无法创建用于合并的临时文件: %w", err)
	}
	totalChunks := (int(session.FileSize) + session.ChunkSize - 1) / session.ChunkSize
	for i := 0; i < totalChunks; i++ {
		chunkPath := filepath.Join(sessionTempDir, strconv.Itoa(i))
		chunkFile, err := os.Open(chunkPath)
		if err != nil {
			_ = mergedFile.Close()
			return fmt.Errorf("无法打开分块文件 %d: %w", i, err)
		}
		_, err = io.Copy(mergedFile, chunkFile)
		_ = chunkFile.Close()
		if err != nil {
			_ = mergedFile.Close()
			return fmt.Errorf("合并分块文件 %d 失败: %w", i, err)
		}
	}
	_ = mergedFile.Close()
	defer s.cleanupTempFiles(session.SessionID)

	// 2. 上传到最终存储
	policy, err := s.policySvc.GetPolicyByID(ctx, session.PolicyID)
	if err != nil {
		return fmt.Errorf("无法在完成阶段获取存储策略: %w", err)
	}
	provider, ok := s.storageProviders[policy.Type]
	if !ok {
		return fmt.Errorf("找不到类型为 '%s' 的存储提供者", policy.Type)
	}

	fileToUpload, err := os.Open(mergedFilePath)
	if err != nil {
		return fmt.Errorf("无法重新打开合并后的文件: %w", err)
	}
	defer fileToUpload.Close()

	parsedURI, _ := uri.Parse(session.URI)
	uploadResult, err := provider.Upload(ctx, fileToUpload, policy, parsedURI.Path)
	if err != nil {
		return fmt.Errorf("存储提供者上传失败: %w", err)
	}

	var fileToPublishEvent *model.File // **修改点：用于存储需要发布事件的文件对象**

	// 3. 在数据库事务中完成记录创建
	err = s.txManager.Do(ctx, func(repos repository.Repositories) error {
		entityToUpdate, err := repos.Entity.FindByID(ctx, session.TempEntityID)
		if err != nil {
			return fmt.Errorf("找不到上传会话关联的临时实体: %w", err)
		}

		entityToUpdate.Source = sql.NullString{String: uploadResult.Source, Valid: true}
		entityToUpdate.MimeType = sql.NullString{String: uploadResult.MimeType, Valid: true}
		entityToUpdate.Dimension = sql.NullString{String: uploadResult.Dimension, Valid: uploadResult.Dimension != ""}
		entityToUpdate.Size = uploadResult.Size
		entityToUpdate.UploadSessionID = sql.NullString{Valid: false}
		if err := repos.Entity.Update(ctx, entityToUpdate); err != nil {
			return fmt.Errorf("更新物理实体失败: %w", err)
		}

		parentPath := filepath.Dir(parsedURI.Path)
		fileName := filepath.Base(parsedURI.Path)
		parentFolder, err := repos.File.FindByPath(ctx, session.OwnerID, parentPath)
		if err != nil {
			return fmt.Errorf("找不到目标父目录 '%s': %w", parentPath, err)
		}

		fileToUpsert := &model.File{
			OwnerID:         session.OwnerID,
			ParentID:        sql.NullInt64{Int64: int64(parentFolder.ID), Valid: true},
			Name:            fileName,
			Size:            entityToUpdate.Size,
			Type:            model.FileTypeFile,
			PrimaryEntityID: types.NullUint64{Uint64: uint64(entityToUpdate.ID), Valid: true},
		}
		targetFile, _, err := repos.File.CreateOrUpdate(ctx, fileToUpsert)
		if err != nil {
			return fmt.Errorf("创建或更新逻辑文件记录失败: %w", err)
		}

		if targetFile.Type == model.FileTypeFile {
			fileToPublishEvent = targetFile
		}

		go s.metadataSvc.Set(context.Background(), targetFile.ID, model.MetaKeyPhysicalName, filepath.Base(uploadResult.Source))

		newVersion := &model.FileStorageVersion{
			FileID:           targetFile.ID,
			EntityID:         entityToUpdate.ID,
			IsCurrent:        true,
			UploadedByUserID: types.NullUint64{Uint64: uint64(session.OwnerID), Valid: true},
		}
		if err := repos.FileEntity.Create(ctx, newVersion); err != nil {
			return fmt.Errorf("创建文件版本关联记录失败: %w", err)
		}

		return s.cacheSvc.Delete(ctx, uploadSessionCachePrefix+session.SessionID)
	})

	if err != nil {
		return err
	}

	// 4. 在事务成功后，进行过滤并发布事件
	if fileToPublishEvent != nil {
		if s.isThumbnailable(fileToPublishEvent) {
			log.Printf("[UploadService] 文件上传完成，发布 FileCreated 事件，FileID: %d", fileToPublishEvent.ID)
			s.eventBus.Publish(event.FileCreated, fileToPublishEvent.ID)
		} else {
			log.Printf("[UploadService] 文件 '%s' 不支持缩略图，跳过 FileCreated 事件发布。", fileToPublishEvent.Name)
		}
	}

	return nil
}

// DeleteUploadSession 用于客户端主动取消一个正在进行的上传会话。
func (s *uploadService) DeleteUploadSession(ctx context.Context, ownerID uint, req *model.DeleteUploadRequest) error {
	sessionKey := uploadSessionCachePrefix + req.ID
	sessionJSON, err := s.cacheSvc.Get(ctx, sessionKey)
	if err != nil {
		return nil // 会话不存在或已过期，直接认为成功
	}
	var session model.UploadSession
	if err := json.Unmarshal([]byte(sessionJSON), &session); err != nil {
		_ = s.cacheSvc.Delete(ctx, sessionKey)
		return fmt.Errorf("解析上传会话失败，但已尝试清理缓存: %w", err)
	}

	if session.OwnerID != ownerID {
		return constant.ErrForbidden
	}

	// 清理磁盘上的临时文件
	s.cleanupTempFiles(req.ID)

	// 清理数据库中的临时实体
	if session.TempEntityID > 0 {
		if err := s.entityRepo.HardDelete(ctx, session.TempEntityID); err != nil {
			fmt.Printf(
				"严重警告: 删除临时实体记录 %d (会话ID: %s) 失败: %v。请手动检查数据库。\n",
				session.TempEntityID,
				req.ID,
				err,
			)
		}
	}

	// 清理缓存中的会话
	_ = s.cacheSvc.Delete(ctx, sessionKey)

	return nil
}

// cleanupTempFiles 是一个用于清理临时分片文件的辅助函数。
func (s *uploadService) cleanupTempFiles(sessionID string) {
	sessionTempDir := filepath.Join(s.uploadTempDir, sessionID)
	if err := os.RemoveAll(sessionTempDir); err != nil {
		fmt.Printf("警告: 清理临时上传目录 %s 失败: %v\n", sessionTempDir, err)
	}
}

// isThumbnailable 是一个辅助函数，用于快速判断一个文件类型是否可能生成缩略图。
func (s *uploadService) isThumbnailable(file *model.File) bool {
	if file.Type == model.FileTypeDir || file.Size == 0 {
		return false
	}
	ext := strings.ToLower(filepath.Ext(file.Name))
	supportedExts := map[string]bool{
		// 图片
		".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true, ".bmp": true, ".svg": true,
		// 视频 (来自ffmpeg)
		".mp4": true, ".mov": true, ".avi": true, ".mkv": true, ".webm": true,
		// 音频 (来自music cover)
		".mp3": true, ".flac": true, ".wav": true, ".m4a": true, ".ogg": true,
		// 其他 (如 VIPS 可能支持的 PDF)
		".pdf": true,
	}
	return supportedExts[ext]
}

// GetUploadSessionStatus 实现了根据 sessionID 获取上传状态的逻辑。
func (s *uploadService) GetUploadSessionStatus(ctx context.Context, ownerID uint, sessionID string) (*model.UploadSessionStatusResponse, error) {
	sessionKey := uploadSessionCachePrefix + sessionID
	sessionJSON, err := s.cacheSvc.Get(ctx, sessionKey)
	if err != nil {
		return nil, fmt.Errorf("从缓存服务获取会话失败: %w", err)
	}

	var session model.UploadSession
	if err := json.Unmarshal([]byte(sessionJSON), &session); err != nil {
		return nil, fmt.Errorf("解析上传会话JSON失败: %w", err)
	}

	if session.OwnerID != ownerID {
		return nil, constant.ErrForbidden
	}

	uploadedChunksSlice := make([]int, 0, len(session.UploadedChunks))
	for chunkIndex := range session.UploadedChunks {
		uploadedChunksSlice = append(uploadedChunksSlice, chunkIndex)
	}

	totalChunks := 0
	if session.ChunkSize > 0 {
		totalChunks = (int(session.FileSize) + session.ChunkSize - 1) / session.ChunkSize
	}

	return &model.UploadSessionStatusResponse{
		SessionID:      session.SessionID,
		IsValid:        true,
		ChunkSize:      int64(session.ChunkSize),
		TotalChunks:    totalChunks,
		UploadedChunks: uploadedChunksSlice,
		ExpiresAt:      session.ExpireAt,
	}, nil
}

// FinalizeClientUpload 处理客户端直传完成后的回调。
// 在云端文件已上传成功后，此方法负责在数据库中创建对应的文件记录。
func (s *uploadService) FinalizeClientUpload(ctx context.Context, ownerID uint, req *model.FinalizeUploadRequest) (*model.File, error) {
	log.Printf("[FinalizeClientUpload] 开始处理 - URI: %s, PolicyID: %s, Size: %d", req.URI, req.PolicyID, req.Size)

	// 步骤 1: 解析路径
	parsedURI, err := uri.Parse(req.URI)
	if err != nil {
		return nil, fmt.Errorf("解析目标URI失败: %w", err)
	}
	fileName := filepath.Base(parsedURI.Path)

	// 步骤 2: 获取存储策略
	policy, err := s.policySvc.GetPolicyByID(ctx, req.PolicyID)
	if err != nil {
		if errors.Is(err, constant.ErrNotFound) {
			return nil, errors.New("指定的存储策略不存在")
		}
		return nil, fmt.Errorf("获取存储策略失败: %w", err)
	}

	// 步骤 3: 获取存储驱动并验证文件是否存在
	provider, err := s.getProviderForPolicy(policy)
	if err != nil {
		return nil, err
	}

	// 构建云端对象键
	objectKey := buildObjectKey(policy, parsedURI.Path)

	// 检查文件是否存在于云存储中
	exists, err := provider.IsExist(ctx, policy, objectKey)
	if err != nil {
		log.Printf("[FinalizeClientUpload] 检查文件是否存在失败: %v", err)
		return nil, fmt.Errorf("验证云端文件失败: %w", err)
	}
	if !exists {
		return nil, errors.New("云端文件不存在，请确保文件已成功上传")
	}

	// 步骤 4: 在数据库事务中创建记录
	var createdFile *model.File
	err = s.txManager.Do(ctx, func(repos repository.Repositories) error {
		// 确保父目录存在
		parentPath := filepath.Dir(parsedURI.Path)
		parentFolder, err := s.findOrCreatePath(ctx, ownerID, parentPath, repos.File)
		if err != nil {
			return fmt.Errorf("创建或查找父目录'%s'失败: %w", parentPath, err)
		}

		// 创建物理实体记录
		newEntity := &model.FileStorageEntity{
			Source:   sql.NullString{String: objectKey, Valid: true},
			Size:     req.Size,
			PolicyID: policy.ID,
			CreatedBy: types.NullUint64{
				Uint64: uint64(ownerID),
				Valid:  true,
			},
			Type: model.EntityTypeFileContentModel,
		}
		if err := repos.Entity.Create(ctx, newEntity); err != nil {
			return fmt.Errorf("创建物理实体记录失败: %w", err)
		}

		// 创建逻辑文件记录
		fileToCreate := &model.File{
			OwnerID:  ownerID,
			ParentID: sql.NullInt64{Int64: int64(parentFolder.ID), Valid: true},
			Name:     fileName,
			Size:     req.Size,
			Type:     model.FileTypeFile,
			PrimaryEntityID: types.NullUint64{
				Uint64: uint64(newEntity.ID),
				Valid:  true,
			},
		}
		targetFile, _, err := repos.File.CreateOrUpdate(ctx, fileToCreate)
		if err != nil {
			return fmt.Errorf("创建逻辑文件记录失败: %w", err)
		}

		// 创建文件版本关联
		newVersion := &model.FileStorageVersion{
			FileID:    targetFile.ID,
			EntityID:  newEntity.ID,
			IsCurrent: true,
			UploadedByUserID: types.NullUint64{
				Uint64: uint64(ownerID),
				Valid:  true,
			},
		}
		if err := repos.FileEntity.Create(ctx, newVersion); err != nil {
			return fmt.Errorf("创建文件版本关联记录失败: %w", err)
		}

		// 保存物理文件名元数据
		go s.metadataSvc.Set(context.Background(), targetFile.ID, model.MetaKeyPhysicalName, filepath.Base(objectKey))

		createdFile = targetFile
		return nil
	})

	if err != nil {
		return nil, err
	}

	// 步骤 5: 发布文件创建事件（用于缩略图生成等）
	if createdFile != nil && s.isThumbnailable(createdFile) {
		log.Printf("[FinalizeClientUpload] 发布 FileCreated 事件，FileID: %d", createdFile.ID)
		s.eventBus.Publish(event.FileCreated, createdFile.ID)
	}

	log.Printf("[FinalizeClientUpload] 处理完成 - FileID: %d, FileName: %s", createdFile.ID, createdFile.Name)
	return createdFile, nil
}

// buildObjectKey 是一个辅助函数，用于构建云存储对象键
//
// 【路径转换规则】
// virtualPath 是完整的虚拟路径，格式为: /挂载点/子目录/文件名
// 例如: virtualPath = "/oss/aaa/123.jpg"
//
// 转换步骤:
//  1. 从 virtualPath 中减去 policy.VirtualPath（挂载点），得到相对路径
//     相对路径 = "/oss/aaa/123.jpg" - "/oss" = "/aaa/123.jpg"
//  2. 将相对路径与 policy.BasePath（云存储基础路径）拼接
//     对象键 = "test" + "/aaa/123.jpg" = "test/aaa/123.jpg"
//
// 【警告】此函数的逻辑必须与存储提供者（如 aliyun_oss.go）中的 buildObjectKey 保持一致！
func buildObjectKey(policy *model.StoragePolicy, virtualPath string) string {
	// 计算相对于策略挂载点的相对路径
	// 例如: virtualPath="/oss/aaa/123.jpg", policy.VirtualPath="/oss" -> relativePath="/aaa/123.jpg"
	relativePath := strings.TrimPrefix(virtualPath, policy.VirtualPath)
	relativePath = strings.TrimPrefix(relativePath, "/")

	// 基础前缀路径处理（从策略的 BasePath 获取）
	basePath := strings.TrimPrefix(strings.TrimSuffix(policy.BasePath, "/"), "/")

	var objectKey string
	if basePath == "" {
		objectKey = relativePath
	} else {
		if relativePath == "" {
			objectKey = basePath
		} else {
			objectKey = basePath + "/" + relativePath
		}
	}

	// 确保不以斜杠开头
	objectKey = strings.TrimPrefix(objectKey, "/")

	return objectKey
}
