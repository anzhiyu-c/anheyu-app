package file

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
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
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
)

// CopyRecursively 以递归方式复制文件或目录。
// 在两表模型下，它会正确地复制描述性元数据，并为新文件触发事件。
func (s *serviceImpl) CopyRecursively(
	ctx context.Context,
	ownerID uint,
	itemToCopy *model.File,
	newParentFolder *model.File,
	txFileRepo repository.FileRepository,
	txEntityRepo repository.EntityRepository,
	txMetadataRepo repository.MetadataRepository,
) error {
	// 1. 检查名称冲突
	if _, err := txFileRepo.FindByParentIDAndName(ctx, newParentFolder.ID, itemToCopy.Name); !errors.Is(err, constant.ErrNotFound) {
		if err == nil {
			return fmt.Errorf("目标文件夹中已存在同名项目 '%s': %w", itemToCopy.Name, constant.ErrConflict)
		}
		return fmt.Errorf("检查名称冲突时出错: %w", err)
	}

	// 2. 准备新的文件/目录记录
	newItem := &model.File{
		OwnerID:    ownerID,
		ParentID:   sql.NullInt64{Int64: int64(newParentFolder.ID), Valid: true},
		Name:       itemToCopy.Name,
		Size:       itemToCopy.Size,
		Type:       itemToCopy.Type,
		ViewConfig: itemToCopy.ViewConfig,
	}

	// 3. 如果是文件，则复制物理文件实体
	if itemToCopy.Type == model.FileTypeFile && itemToCopy.PrimaryEntityID.Valid {
		log.Printf("【COPY INFO】正在为文件 '%s' 创建物理副本...", itemToCopy.Name)
		sourceEntity, err := txEntityRepo.FindByID(ctx, uint(itemToCopy.PrimaryEntityID.Uint64))
		if err != nil || sourceEntity == nil {
			return fmt.Errorf("找不到源文件的物理实体 %d: %w", itemToCopy.PrimaryEntityID.Uint64, err)
		}

		policy, err := s.policySvc.GetPolicyByDatabaseID(ctx, sourceEntity.PolicyID)
		if err != nil {
			return fmt.Errorf("找不到源实体的存储策略 %d: %w", sourceEntity.PolicyID, err)
		}
		provider, err := s.GetProviderForPolicy(policy)
		if err != nil {
			return fmt.Errorf("获取存储驱动失败: %w", err)
		}

		sourceFileReader, err := provider.Get(ctx, policy, sourceEntity.Source.String)
		if err != nil {
			return fmt.Errorf("无法获取源物理文件流 '%s': %w", sourceEntity.Source.String, err)
		}
		defer sourceFileReader.Close()

		newParentPath, err := s.GetFolderPathWithRepo(ctx, newParentFolder.ID, txFileRepo)
		if err != nil {
			return fmt.Errorf("获取新父目录路径失败: %w", err)
		}
		newLogicalPath := filepath.ToSlash(filepath.Join(newParentPath, itemToCopy.Name))
		uploadResult, err := provider.Upload(ctx, sourceFileReader, policy, newLogicalPath)
		if err != nil {
			return fmt.Errorf("创建物理文件副本失败: %w", err)
		}

		newEntity := &model.FileStorageEntity{
			PolicyID:  policy.ID,
			CreatedBy: types.NullUint64{Uint64: uint64(ownerID), Valid: true},
			Type:      model.EntityTypeFileContentModel,
			Source:    sql.NullString{String: uploadResult.Source, Valid: true},
			Size:      uploadResult.Size,
			MimeType:  sql.NullString{String: uploadResult.MimeType, Valid: true},
			Dimension: sql.NullString{String: uploadResult.Dimension, Valid: uploadResult.Dimension != ""},
		}
		if err := txEntityRepo.Create(ctx, newEntity); err != nil {
			return fmt.Errorf("为文件副本创建新的实体记录失败: %w", err)
		}
		newItem.PrimaryEntityID = types.NullUint64{Uint64: uint64(newEntity.ID), Valid: true}
		log.Printf("【COPY INFO】物理副本创建成功，新的实体ID为 %d", newEntity.ID)
	}

	// 4. 在数据库中创建新的 file 记录
	if err := txFileRepo.Create(ctx, newItem); err != nil {
		return fmt.Errorf("创建复制记录 '%s' 失败: %w", newItem.Name, err)
	}

	// 5. 复制描述性元数据，过滤掉状态性元数据
	sourceMetas, err := txMetadataRepo.GetAll(ctx, itemToCopy.ID)
	if err != nil {
		log.Printf("警告：复制文件 '%s' 时未能获取其元数据: %v", itemToCopy.Name, err)
	} else {
		for _, meta := range sourceMetas {
			if strings.HasPrefix(meta.Name, "thumb_") {
				continue
			}
			newMeta := &model.Metadata{
				FileID: newItem.ID,
				Name:   meta.Name,
				Value:  meta.Value,
			}
			if err := txMetadataRepo.Set(ctx, newMeta); err != nil {
				log.Printf("警告: 复制元数据 '%s' 到新文件 %d 失败: %v", meta.Name, newItem.ID, err)
			}
		}
	}

	// 6. 为新副本发布事件
	if newItem.Type == model.FileTypeFile {
		s.publishFileCreatedEventIfNeeded(newItem)
	}

	// 7. 递归复制子目录
	if newItem.Type == model.FileTypeDir {
		log.Printf("【COPY INFO】递归复制文件夹 '%s' 的内容", itemToCopy.Name)
		children, err := txFileRepo.ListByParentID(ctx, itemToCopy.ID)
		if err != nil {
			return fmt.Errorf("获取源文件夹 '%s' 的子项失败: %w", itemToCopy.Name, err)
		}
		for _, child := range children {
			if err := s.CopyRecursively(ctx, ownerID, child, newItem, txFileRepo, txEntityRepo, txMetadataRepo); err != nil {
				return err
			}
		}
	}
	return nil
}

// GetFullVirtualPathWithRepo 是一个根据文件记录在事务中重建其完整虚拟路径的辅助函数
func (s *serviceImpl) GetFullVirtualPathWithRepo(ctx context.Context, file *model.File, repo repository.FileRepository) (string, error) {
	if !file.ParentID.Valid {
		// 根目录下的文件或特殊根节点
		return "/" + file.Name, nil
	}
	parentPath, err := s.GetFolderPathWithRepo(ctx, uint(file.ParentID.Int64), repo)
	if err != nil {
		return "", err
	}
	return filepath.ToSlash(filepath.Join(parentPath, file.Name)), nil
}

// HardDeleteRecursively 以递归方式永久删除文件或文件夹及其关联的所有数据库记录和物理资源。
// 它会先删除所有关联的元数据，然后再删除文件记录本身。
//
// 此函数必须在数据库事务中运行。
//
// 参数:
//   - ctx: 上下文
//   - ownerID: 操作发起者的用户ID，用于权限校验
//   - fileID: 要删除的文件或目录的数据库ID
//   - txFileRepo: 事务性的 FileRepository
//   - txEntityRepo: 事务性的 EntityRepository
//   - txFileEntityRepo: 事务性的 FileEntityRepository
//   - txMetadataRepo: 事务性的 MetadataRepository
//   - txPolicyRepo: 事务性的 StoragePolicyRepository
//   - txDirectLinkRepo: 事务性的 DirectLinkRepository
//   - txUserRepo: 事务性的 UserRepository，用于校验是否有权删除物理存储；无权时只删除记录
//
// 返回: error - 如果操作过程中出现任何错误，则返回错误
func (s *serviceImpl) HardDeleteRecursively(
	ctx context.Context,
	ownerID uint,
	fileID uint,
	txFileRepo repository.FileRepository,
	txEntityRepo repository.EntityRepository,
	txFileEntityRepo repository.FileEntityRepository,
	txMetadataRepo repository.MetadataRepository,
	txPolicyRepo repository.StoragePolicyRepository,
	txDirectLinkRepo repository.DirectLinkRepository,
	txUserRepo repository.UserRepository,
) error {
	// 1. 查找要删除的项目
	item, err := txFileRepo.FindByIDUnscoped(ctx, fileID)
	if err != nil {
		if errors.Is(err, constant.ErrNotFound) {
			log.Printf("【DELETE INFO】项目 ID %d 已不存在，跳过删除。", fileID)
			return nil // 如果记录不存在，视为成功
		}
		return fmt.Errorf("查找待删除项 %d 失败: %w", fileID, err)
	}

	// 2. 权限验证
	if item.OwnerID != ownerID {
		return fmt.Errorf("无权删除项目 '%s' (ID: %d): %w", item.Name, item.ID, constant.ErrForbidden)
	}

	// 2.1. 检查文件夹是否为系统策略的挂载点
	if item.Type == model.FileTypeDir {
		linkedPolicy, err := txPolicyRepo.FindByNodeID(ctx, item.ID)
		if err != nil {
			// 如果在关键检查环节出错，应中止操作
			return fmt.Errorf("检查文件夹 '%s' (ID: %d) 的策略关联失败，中止操作: %w", item.Name, item.ID, err)
		}
		// 如果找到了一个策略，并且这个策略带有系统Flag，则禁止删除
		if linkedPolicy != nil && linkedPolicy.Flag != "" {
			return fmt.Errorf("不允许删除系统策略 '%s' 的挂载点文件夹 '%s'", linkedPolicy.Name, item.Name)
		}
	}

	// 3. 根据类型执行不同的物理删除逻辑
	if item.Type == model.FileTypeDir {
		// 如果是目录，先递归删除所有子项
		children, err := txFileRepo.ListByParentIDUnscoped(ctx, item.ID)
		if err != nil {
			return fmt.Errorf("列出子目录 '%s' (ID: %d) 内容失败: %w", item.Name, item.ID, err)
		}
		for _, child := range children {
			// 递归调用，并传入 txPolicyRepo
			if err := s.HardDeleteRecursively(ctx, ownerID, child.File.ID, txFileRepo, txEntityRepo, txFileEntityRepo, txMetadataRepo, txPolicyRepo, txDirectLinkRepo, txUserRepo); err != nil {
				return err // 如果任何子项删除失败，则中止并回滚
			}
		}

		// 在删除所有子项后，删除物理空目录
		fullVirtualPath, pathErr := s.GetFullVirtualPathWithRepo(ctx, item, txFileRepo)
		if pathErr != nil {
			log.Printf("【DELETE WARN】无法获取文件夹 %d 的路径，将跳过物理目录删除: %v", item.ID, pathErr)
		} else {
			policy, policyErr := s.vfsSvc.FindPolicyForPath(ctx, fullVirtualPath)
			if policyErr != nil {
				log.Printf("【DELETE WARN】找不到文件夹 '%s' 的存储策略，将跳过物理目录删除: %v", fullVirtualPath, policyErr)
			} else if allowed, authErr := canTouchPhysicalStorage(ctx, ownerID, policy, txUserRepo, txFileRepo); authErr != nil {
				return authErr
			} else if !allowed {
				log.Printf("【DELETE SKIP】用户 %d 无权访问策略 '%s' 的物理存储，仅删除记录，保留物理目录 '%s'", ownerID, policy.Name, fullVirtualPath)
			} else {
				provider, providerErr := s.GetProviderForPolicy(policy)
				if providerErr != nil {
					log.Printf("【DELETE WARN】获取文件夹 '%s' 的存储驱动失败: %v", fullVirtualPath, providerErr)
				} else {
					var sourceToDelete string
					// 根据存储类型确定传递给 Delete 方法的路径
					if policy.Type == constant.PolicyTypeLocal {
						// 本地存储需要物理路径
						relativePath := strings.TrimPrefix(fullVirtualPath, policy.VirtualPath)
						physicalPath := filepath.Join(policy.BasePath, relativePath)
						sourceToDelete = physicalPath
						log.Printf("【DELETE INFO】正在删除本地物理目录: %s", sourceToDelete)
					} else {
						// 云存储需要虚拟路径
						sourceToDelete = fullVirtualPath
						log.Printf("【DELETE INFO】正在删除云端目录: %s", sourceToDelete)
					}

					// 调用 provider.Delete
					if delErr := provider.Delete(ctx, policy, []string{sourceToDelete}); delErr != nil {
						// 物理删除失败只记录日志，不中止整个数据库事务
						log.Printf("【DELETE ERROR】删除物理目录 '%s' 失败: %v", sourceToDelete, delErr)
					}
				}
			}
		}
	} else { // 如果是文件，删除其关联的实体和物理文件
		log.Printf("【DELETE INFO】删除 file_entities 记录 for file_id: %d", item.ID)
		if err := txFileEntityRepo.DeleteByFileID(ctx, item.ID); err != nil {
			return fmt.Errorf("删除文件版本关联记录失败 for file_id %d: %w", item.ID, err)
		}
		if item.PrimaryEntityID.Valid {
			entityID := uint(item.PrimaryEntityID.Uint64)
			entity, findErr := txEntityRepo.FindByID(ctx, entityID)
			if findErr != nil && !errors.Is(findErr, constant.ErrNotFound) {
				return fmt.Errorf("检查实体 %d 状态失败: %w", entityID, findErr)
			}
			if entity != nil {
				policy, policyErr := s.policySvc.GetPolicyByDatabaseID(ctx, entity.PolicyID)
				if policyErr != nil {
					log.Printf("【DELETE WARN】找不到实体 %d 的存储策略，无法删除物理文件: %v", entityID, policyErr)
				} else if allowed, authErr := canTouchPhysicalStorage(ctx, ownerID, policy, txUserRepo, txFileRepo); authErr != nil {
					return authErr
				} else if !allowed {
					log.Printf("【DELETE SKIP】用户 %d 无权访问策略 '%s' 的物理存储，仅删除记录，保留实体 %d 的物理文件", ownerID, policy.Name, entityID)
				} else {
					provider, providerErr := s.GetProviderForPolicy(policy)
					if providerErr != nil {
						log.Printf("【DELETE WARN】获取实体 %d 的存储驱动失败: %v", entityID, providerErr)
					} else {
						// 对于文件，entity.Source.String 已经是正确的路径（本地物理路径或云端虚拟路径）
						sourceToDelete := entity.Source.String
						log.Printf("【DELETE INFO】正在删除物理文件: %s", sourceToDelete)
						if delErr := provider.Delete(ctx, policy, []string{sourceToDelete}); delErr != nil {
							log.Printf("【DELETE ERROR】删除物理文件 '%s' 失败: %v", sourceToDelete, delErr)
						}
					}
				}
				log.Printf("【DELETE INFO】永久删除 entities 记录: ID %d", entityID)
				if err := txEntityRepo.HardDelete(ctx, entityID); err != nil {
					return fmt.Errorf("永久删除实体记录 %d 失败: %w", entityID, err)
				}
			}
		}
	}

	// 4. 删除项目本身的所有元数据
	log.Printf("【DELETE INFO】正在删除文件/目录 (ID: %d) 的所有元数据...", item.ID)
	if err := txMetadataRepo.DeleteByFileID(ctx, item.ID); err != nil {
		return fmt.Errorf("删除项目 %d 的元数据失败: %w", item.ID, err)
	}

	// 4.5. 删除相关的直链记录（如果有的话）
	if item.Type == model.FileTypeFile {
		log.Printf("【DELETE INFO】正在删除文件 (ID: %d) 的直链记录...", item.ID)
		if err := txDirectLinkRepo.DeleteByFileID(ctx, item.ID); err != nil {
			log.Printf("【DELETE WARN】删除直链记录失败: %v", err)
			// 不返回错误，继续删除文件记录
		}
	}

	// 5. 最后，从 `files` 表中删除项目本身的记录
	log.Printf("【DELETE INFO】永久删除 files 记录: '%s' (ID: %d)", item.Name, item.ID)
	if err := txFileRepo.HardDelete(ctx, item.ID); err != nil {
		return fmt.Errorf("永久删除文件/目录记录 %d 失败: %w", item.ID, err)
	}

	return nil
}

// BuildFolderTreeRecursively 递归地构建文件夹内容树。
func (s *serviceImpl) BuildFolderTreeRecursively(ctx context.Context, ownerID uint, parentFolder *model.File, basePath, currentRelativePath string, fileNodes *[]*model.FileTreeNode, expiresAt time.Time) error {
	fullVirtualPath := filepath.ToSlash(filepath.Join(basePath, currentRelativePath))
	policy, err := s.vfsSvc.FindPolicyForPath(ctx, fullVirtualPath)
	if err != nil {
		fmt.Printf("警告(buildFolderTree): 无法为路径 '%s' 定位存储策略: %v\n", fullVirtualPath, err)
	} else if policy.Type == constant.PolicyTypeLocal {
		err := s.syncDirectoryIfAuthorized(ctx, ownerID, policy, fullVirtualPath)
		if err != nil {
			fmt.Printf("错误(buildFolderTree): 同步物理目录 '%s' 失败: %v\n", fullVirtualPath, err)
		}
	}
	children, err := s.fileRepo.ListByParentID(ctx, parentFolder.ID)
	if err != nil {
		return fmt.Errorf("列取文件夹 %d 的子项失败: %w", parentFolder.ID, err)
	}
	for _, child := range children {
		childRelativePath := filepath.Join(currentRelativePath, child.Name)
		if child.Type == model.FileTypeFile {
			publicID, _ := idgen.GeneratePublicID(child.ID, idgen.EntityTypeFile)
			url, urlErr := s.GetDownloadURLForFileWithExpiration(ctx, child, publicID, expiresAt)
			if urlErr != nil {
				fmt.Printf("!!! URL生成失败 !!! 文件: '%s', 错误: %v\n", child.Name, urlErr)
			}
			node := &model.FileTreeNode{
				URL:          url,
				RelativePath: filepath.ToSlash(childRelativePath),
				Size:         child.Size,
			}
			*fileNodes = append(*fileNodes, node)
		} else if child.Type == model.FileTypeDir {
			if err := s.BuildFolderTreeRecursively(ctx, ownerID, child, basePath, childRelativePath, fileNodes, expiresAt); err != nil {
				return err
			}
		}
	}
	return nil
}

// GetDownloadURLForFile 生成一个带签名的临时下载链接 (默认1小时过期)。
func (s *serviceImpl) GetDownloadURLForFile(ctx context.Context, file *model.File, publicFileID string) (string, error) {
	return s.GetDownloadURLForFileWithExpiration(ctx, file, publicFileID, time.Now().Add(1*time.Hour))
}

// GetDownloadURLForFileWithExpiration 生成一个具有指定过期时间的带签名临时下载链接。
func (s *serviceImpl) GetDownloadURLForFileWithExpiration(ctx context.Context, file *model.File, publicFileID string, expiresAt time.Time) (string, error) {
	secret := s.settingSvc.Get(constant.KeyLocalFileSigningSecret.String())
	if secret == "" {
		return "", errors.New("签名密钥为空或未从设置服务中成功加载")
	}
	expires := expiresAt.Unix()
	stringToSign := fmt.Sprintf("%s:%d", publicFileID, expires)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(stringToSign))
	signature := base64.URLEncoding.EncodeToString(mac.Sum(nil))
	downloadURL := fmt.Sprintf(
		"/needcache/download/%s?expires=%d&sign=%s",
		publicFileID,
		expires,
		signature,
	)
	return downloadURL, nil
}

// GetFolderPathWithRepo 在事务上下文中递归地获取文件夹的完整路径。
func (s *serviceImpl) GetFolderPathWithRepo(ctx context.Context, folderID uint, repo repository.FileRepository) (string, error) {
	var pathSegments []string
	currentFolderID := folderID
	for i := 0; i < 100; i++ {
		folder, err := repo.FindByIDUnscoped(ctx, currentFolderID)
		if err != nil {
			if errors.Is(err, constant.ErrNotFound) {
				return "", fmt.Errorf("路径构建中断，找不到ID为 %d 的父文件夹", currentFolderID)
			}
			return "", fmt.Errorf("查找路径段时失败, ID: %d, err: %w", currentFolderID, err)
		}
		if !folder.ParentID.Valid && folder.Name == "" { // 到达根目录
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

// GetProviderForPolicy 根据存储策略获取对应的存储提供者实例。
// 公开方法，可以被 PRO 版等外部调用。
func (s *serviceImpl) GetProviderForPolicy(policy *model.StoragePolicy) (storage.IStorageProvider, error) {
	if policy == nil {
		return nil, errors.New("storage policy cannot be nil")
	}
	provider, ok := s.storageProviders[policy.Type]
	if !ok {
		return nil, fmt.Errorf("未实现的存储驱动类型: %s", policy.Type)
	}
	return provider, nil
}

// GetPolicyByFlag 根据策略标志（如 article_image）获取存储策略。
func (s *serviceImpl) GetPolicyByFlag(ctx context.Context, policyFlag string) (*model.StoragePolicy, error) {
	return s.storagePolicyRepo.FindByFlag(ctx, policyFlag)
}

// FindAndValidateFile 查找文件并验证所有权。
func (s *serviceImpl) FindAndValidateFile(ctx context.Context, publicID string, ownerID uint) (*model.File, error) {
	dbID, entityType, err := idgen.DecodePublicID(publicID)
	if err != nil || entityType != idgen.EntityTypeFile {
		return nil, errors.New("无效或格式不正确的文件ID")
	}
	item, err := s.fileRepo.FindByID(ctx, dbID)
	if err != nil {
		if errors.Is(err, constant.ErrNotFound) {
			return nil, constant.ErrNotFound
		}
		return nil, fmt.Errorf("查找项目时发生内部错误")
	}
	if item.OwnerID != ownerID {
		return nil, constant.ErrForbidden
	}
	return item, nil
}

// GetFolderPath 递归地获取文件夹的完整路径。
func (s *serviceImpl) GetFolderPath(ctx context.Context, folderID uint) (string, error) {
	return s.GetFolderPathWithRepo(ctx, folderID, s.fileRepo)
}

// BuildFileItemDTO 根据文件模型构建用于API响应的DTO。
func (s *serviceImpl) BuildFileItemDTO(file *model.File, viewerID uint, parentPath string, url string) *model.FileItem {
	if file == nil {
		return nil
	}
	publicFileID, _ := idgen.GeneratePublicID(file.ID, idgen.EntityTypeFile)
	var primaryEntityPublicID string
	if file.PrimaryEntityID.Valid {
		primaryEntityPublicID, _ = idgen.GeneratePublicID(uint(file.PrimaryEntityID.Uint64), idgen.EntityTypeStorageEntity)
	}
	fullPath := filepath.ToSlash(filepath.Join(parentPath, file.Name))
	if !file.ParentID.Valid && file.Name == "" {
		fullPath = "/"
	}
	logicalPath := fmt.Sprintf("anzhiyu://my%s", fullPath)
	var thumbnailUrl string
	if file.Type == model.FileTypeFile && !strings.HasSuffix(strings.ToLower(file.Name), ".svg") {
		thumbnailUrl = fmt.Sprintf("/api/v1/thumbnail/%s", publicFileID)
	}
	return &model.FileItem{
		ID:                    publicFileID,
		Name:                  file.Name,
		Type:                  int(file.Type),
		Size:                  file.Size,
		CreatedAt:             file.CreatedAt,
		UpdatedAt:             file.UpdatedAt,
		Path:                  logicalPath,
		Owned:                 file.OwnerID == viewerID,
		Metadata:              file.Metas,
		PrimaryEntityPublicID: primaryEntityPublicID,
		URL:                   url,
		ThumbnailURL:          thumbnailUrl,
	}
}

// GetViewConfig 获取文件夹的视图配置。
func GetViewConfig(folder *model.File) *model.View {
	defaultView := &model.View{
		View: "list", Order: "updated_at", PageSize: 100, OrderDirection: "desc",
		Columns: []model.ViewColumn{{Type: model.ColumnTypeName}, {Type: model.ColumnTypeSize}, {Type: model.ColumnTypeUpdatedAt}},
	}
	if folder == nil || folder.Type != model.FileTypeDir {
		return defaultView
	}
	if folder.ViewConfig.Valid && folder.ViewConfig.String != "" {
		var viewConfig model.View
		if json.Unmarshal([]byte(folder.ViewConfig.String), &viewConfig) == nil {
			if viewConfig.View == "" {
				viewConfig.View = defaultView.View
			}
			if viewConfig.Order == "" {
				viewConfig.Order = defaultView.Order
			}
			if viewConfig.PageSize == 0 {
				viewConfig.PageSize = defaultView.PageSize
			}
			if viewConfig.OrderDirection == "" {
				viewConfig.OrderDirection = defaultView.OrderDirection
			}
			return &viewConfig
		}
	}
	return defaultView
}

// GetInheritedViewConfig 动态地、智能地向上回溯查找视图配置。
func (s *serviceImpl) GetInheritedViewConfig(ctx context.Context, folder *model.File) *model.View {
	defaultView := &model.View{
		View: "list", Order: "updated_at", PageSize: 100, OrderDirection: "desc",
		Columns: []model.ViewColumn{{Type: model.ColumnTypeName}, {Type: model.ColumnTypeSize}, {Type: model.ColumnTypeUpdatedAt}},
	}
	if folder == nil {
		return defaultView
	}

	ancestors, err := s.fileRepo.FindAncestors(ctx, folder.ID)
	if err != nil {
		log.Printf("【WARN】getInheritedViewConfig: 无法获取文件夹 %d 的祖先, 将使用默认配置: %v", folder.ID, err)
		return defaultView
	}

	for _, ancestor := range ancestors {
		if ancestor.ViewConfig.Valid && ancestor.ViewConfig.String != "" {
			var viewConfig model.View
			if json.Unmarshal([]byte(ancestor.ViewConfig.String), &viewConfig) == nil {
				log.Printf("【INFO】getInheritedViewConfig: 在祖先节点 %d 处找到配置，应用此配置。", ancestor.ID)
				if viewConfig.View == "" {
					viewConfig.View = defaultView.View
				}
				if viewConfig.Order == "" {
					viewConfig.Order = defaultView.Order
				}
				if viewConfig.PageSize == 0 {
					viewConfig.PageSize = defaultView.PageSize
				}
				if viewConfig.OrderDirection == "" {
					viewConfig.OrderDirection = defaultView.OrderDirection
				}
				if len(viewConfig.Columns) == 0 {
					viewConfig.Columns = defaultView.Columns
				}
				return &viewConfig
			}
		}
	}
	log.Printf("【INFO】getInheritedViewConfig: 在文件夹 %d 的整个继承链上未找到配置，使用默认配置。", folder.ID)
	return defaultView
}

// GetPolicyInfo 从存储策略模型构建用于API响应的DTO。
func GetPolicyInfo(policy *model.StoragePolicy) (*model.StoragePolicyInfo, error) {
	if policy == nil {
		return nil, errors.New("policy不能为nil")
	}
	publicID, err := idgen.GeneratePublicID(policy.ID, idgen.EntityTypeStoragePolicy)
	if err != nil {
		return nil, err
	}
	return &model.StoragePolicyInfo{ID: publicID, Name: policy.Name, Type: string(policy.Type), MaxSize: policy.MaxSize}, nil
}

// GetRelativePathsForMove 是一个用于移动和重命名操作的辅助函数。
func (s *serviceImpl) GetRelativePathsForMove(policy *model.StoragePolicy, oldVirtualPath, newVirtualPath string) (string, string, error) {
	if !strings.HasPrefix(oldVirtualPath, policy.VirtualPath) {
		return "", "", fmt.Errorf("源路径 '%s' 不在策略 '%s' 的虚拟路径 '%s' 下", oldVirtualPath, policy.Name, policy.VirtualPath)
	}
	oldRelativePath := strings.TrimPrefix(oldVirtualPath, policy.VirtualPath)
	newRelativePath := strings.TrimPrefix(newVirtualPath, policy.VirtualPath)
	return oldRelativePath, newRelativePath, nil
}

// publishFileCreatedEventIfNeeded 是一个辅助函数，用于在发布事件前进行过滤。
func (s *serviceImpl) publishFileCreatedEventIfNeeded(file *model.File) {
	if s.isThumbnailable(file) {
		s.eventBus.Publish(event.FileCreated, file.ID)
	} else {
		log.Printf("文件 '%s' (类型: %s) 不支持生成缩略图，跳过 FileCreated 事件发布。", file.Name, filepath.Ext(file.Name))
	}
}

// isThumbnailable 是一个辅助函数，用于快速判断一个文件类型是否可能生成缩略图。
func (s *serviceImpl) isThumbnailable(file *model.File) bool {
	if file.Type == model.FileTypeDir || file.Size == 0 {
		return false
	}
	ext := strings.ToLower(filepath.Ext(file.Name))
	// 这个白名单应该包含所有 Generator 可能支持的后缀名，与 syncService 中保持一致
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

// GetFolderTree 获取一个文件夹下所有子文件（不包括子目录）的树状结构列表，主要用于打包下载。
// 它会递归地遍历所有子目录，收集文件信息，并为每个文件生成一个有时效性的下载链接。
func (s *serviceImpl) GetFolderTree(ctx context.Context, viewerID uint, publicFolderID string) (*model.FolderTreeResponse, error) {
	// 1. 验证文件夹ID和权限
	folderID, entityType, err := idgen.DecodePublicID(publicFolderID)
	if err != nil || entityType != idgen.EntityTypeFile {
		return nil, errors.New("无效的文件夹ID")
	}

	folder, err := s.fileRepo.FindByID(ctx, folderID)
	if err != nil {
		if errors.Is(err, constant.ErrNotFound) {
			return nil, constant.ErrNotFound
		}
		return nil, fmt.Errorf("查找文件夹失败: %w", err)
	}

	if folder.Type != model.FileTypeDir {
		return nil, errors.New("目标不是一个文件夹")
	}
	if folder.OwnerID != viewerID {
		return nil, constant.ErrForbidden
	}

	// 2. 定义链接的过期时长并计算最终的过期时间点
	const linkDuration = 1 * time.Hour // 所有链接统一为1小时有效
	expiresAt := time.Now().Add(linkDuration)

	// 3. 准备递归所需的数据结构
	var fileNodes []*model.FileTreeNode
	basePath, err := s.GetFolderPath(ctx, folder.ID)
	if err != nil {
		return nil, fmt.Errorf("获取文件夹根路径失败: %w", err)
	}

	// 4. 调用递归辅助函数来构建文件树
	err = s.BuildFolderTreeRecursively(ctx, viewerID, folder, basePath, "", &fileNodes, expiresAt)
	if err != nil {
		return nil, fmt.Errorf("构建文件夹树时发生错误: %w", err)
	}

	// 5. 构建并返回最终的响应
	return &model.FolderTreeResponse{
		FolderName: folder.Name,
		Files:      fileNodes,
		Expires:    expiresAt,
	}, nil
}

// ListAllDescendantFiles 递归获取一个文件夹下的所有后代文件（不包括文件夹本身）。
// fileRepo 应该是事务性的，如果在一个事务中调用的话。
func (s *serviceImpl) ListAllDescendantFiles(ctx context.Context, folderID uint) ([]*model.File, error) {
	// 为了兼容事务，直接使用 service 中持有的 fileRepo
	fileRepo := s.fileRepo

	var allFiles []*model.File

	// 获取直接子项
	children, err := fileRepo.ListByParentID(ctx, folderID)
	if err != nil {
		return nil, fmt.Errorf("获取文件夹 %d 的子项失败: %w", folderID, err)
	}

	for _, child := range children {
		if child.Type == model.FileTypeFile {
			// 如果是文件，直接添加到结果列表
			allFiles = append(allFiles, child)
		} else if child.Type == model.FileTypeDir {
			// 如果是目录，递归调用并合并结果
			descendants, err := s.ListAllDescendantFiles(ctx, child.ID)
			if err != nil {
				return nil, err // 如果任何子目录失败，则中止
			}
			allFiles = append(allFiles, descendants...)
		}
	}

	return allFiles, nil
}

// FindFileByPublicID 只根据公共ID查找文件，不进行所有权验证。
func (s *serviceImpl) FindFileByPublicID(ctx context.Context, publicID string) (*model.File, error) {
	dbID, entityType, err := idgen.DecodePublicID(publicID)
	if err != nil || entityType != idgen.EntityTypeFile {
		return nil, errors.New("无效或格式不正确的文件ID")
	}
	item, err := s.fileRepo.FindByID(ctx, dbID)
	if err != nil {
		if errors.Is(err, constant.ErrNotFound) {
			return nil, constant.ErrNotFound
		}
		return nil, fmt.Errorf("查找项目时发生内部错误")
	}
	// 没有所有权检查！
	return item, nil
}
