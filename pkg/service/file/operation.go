package file

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"path/filepath"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/types"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/uri"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
)

// UploadFileByPolicyFlag 根据策略标志（如 article_image）上传文件。
func (s *serviceImpl) UploadFileByPolicyFlag(ctx context.Context, viewerID uint, fileReader io.Reader, policyFlag, filename string) (*model.FileItem, error) {
	return s.UploadFileByPolicyFlagWithGroup(ctx, viewerID, 0, fileReader, policyFlag, filename)
}

// UploadFileByPolicyFlagWithGroup 根据策略标志上传文件，并检查用户组权限。
// userGroupID 为 0 表示不检查用户组权限（仅适用于系统内部调用）。
func (s *serviceImpl) UploadFileByPolicyFlagWithGroup(ctx context.Context, viewerID, userGroupID uint, fileReader io.Reader, policyFlag, filename string) (*model.FileItem, error) {
	var createdFileItem *model.FileItem
	var createdFile *model.File // 将 newFile 提升到事务外部作用域
	const systemOwnerID uint = 1

	// 1. 根据 Flag 从数据库查找对应的存储策略
	policy, err := s.storagePolicyRepo.FindByFlag(ctx, policyFlag)
	if err != nil {
		return nil, fmt.Errorf("查找标志为 '%s' 的存储策略时出错: %w", policyFlag, err)
	}
	if policy == nil {
		// 这是一个严重的系统配置问题，说明数据库里没有设置好带flag的策略
		return nil, fmt.Errorf("未找到标志为 '%s' 的存储策略，请检查系统配置", policyFlag)
	}
	if policy.NodeID == nil {
		// 策略存在，但没有和虚拟文件系统中的任何文件夹关联起来
		return nil, fmt.Errorf("标志为 '%s' 的存储策略未关联到任何目录节点", policyFlag)
	}

	// 1.5 检查用户组权限
	// userGroupID == 0 表示系统内部调用，不检查权限
	// userGroupID == 1 表示管理员组，始终允许
	if userGroupID > 0 && userGroupID != 1 {
		// 获取用户组信息，检查其允许使用的存储策略列表
		userGroup, err := s.userGroupRepo.FindByID(ctx, userGroupID)
		if err != nil {
			return nil, fmt.Errorf("获取用户组信息失败: %w", err)
		}
		if userGroup == nil {
			return nil, fmt.Errorf("用户组不存在")
		}

		// 检查用户组是否有权限使用此存储策略
		if len(userGroup.StoragePolicyIDs) > 0 {
			// 检查当前策略ID是否在用户组允许的策略列表中
			allowed := false
			for _, policyID := range userGroup.StoragePolicyIDs {
				if policyID == policy.ID {
					allowed = true
					break
				}
			}
			if !allowed {
				return nil, fmt.Errorf("您所在的用户组无权使用此存储策略上传文件")
			}
		} else {
			// 如果用户组没有配置允许的存储策略，则只有管理员可以使用
			return nil, fmt.Errorf("此存储策略仅管理员可用")
		}
	}

	// 2. 将文件内容完整读入内存，以便在事务中安全使用
	content, err := io.ReadAll(fileReader)
	if err != nil {
		return nil, fmt.Errorf("读取上传文件流失败: %w", err)
	}

	// 检查文件大小是否超过策略限制
	fileSize := int64(len(content))
	if policy.MaxSize > 0 && fileSize > policy.MaxSize {
		return nil, fmt.Errorf("文件大小 (%d 字节) 超出策略限制 (%d 字节)", fileSize, policy.MaxSize)
	}

	// 3. 在单个数据库事务中完成所有文件和实体的创建
	err = s.txManager.Do(ctx, func(repos repository.Repositories) error {
		txFileRepo := repos.File
		txEntityRepo := repos.Entity

		// 4. 通过策略的 NodeID 获取其在虚拟文件系统中的挂载点（即父目录）
		parentFolder, err := txFileRepo.FindByID(ctx, *policy.NodeID)
		if err != nil {
			return fmt.Errorf("根据策略节点ID '%d' 查找父目录失败: %w", *policy.NodeID, err)
		}

		// 5. 获取父目录的完整虚拟路径，用于后续上传
		parentVirtualPath, err := s.GetFolderPathWithRepo(ctx, parentFolder.ID, txFileRepo)
		if err != nil {
			return fmt.Errorf("获取父目录 '%s' 的路径失败: %w", parentFolder.Name, err)
		}

		// 6. 确定存储驱动和上传路径
		provider, err := s.GetProviderForPolicy(policy)
		if err != nil {
			return err
		}

		// 7. 构建完整的虚拟路径并执行物理上传
		// buildObjectKey 需要完整的虚拟路径（如 /s3/article_images/123.jpg）来正确计算对象键
		fullVirtualPath := filepath.ToSlash(filepath.Join(parentVirtualPath, filename))
		uploadResult, err := provider.Upload(ctx, bytes.NewReader(content), policy, fullVirtualPath)
		if err != nil {
			return fmt.Errorf("存储驱动上传失败: %w", err)
		}

		// 8. 创建文件实体记录 (FileStorageEntity)，代表物理文件
		newEntity := &model.FileStorageEntity{
			PolicyID:  policy.ID,
			CreatedBy: types.NullUint64{Uint64: uint64(viewerID), Valid: viewerID > 0}, // 支持游客上传
			Source:    sql.NullString{String: uploadResult.Source, Valid: true},
			Size:      uploadResult.Size,
			MimeType:  sql.NullString{String: uploadResult.MimeType, Valid: true},
		}
		if err := txEntityRepo.Create(ctx, newEntity); err != nil {
			// 如果数据库记录创建失败，尝试删除刚刚上传的物理文件，防止产生孤立文件
			go provider.Delete(context.Background(), policy, []string{uploadResult.Source})
			return fmt.Errorf("创建文件实体记录失败: %w", err)
		}

		// 9. 创建文件逻辑记录 (File)，代表虚拟文件系统中的条目
		newFile := &model.File{
			OwnerID:         systemOwnerID,
			ParentID:        sql.NullInt64{Int64: int64(parentFolder.ID), Valid: true},
			Name:            filename,
			Size:            uploadResult.Size,
			Type:            model.FileTypeFile,
			PrimaryEntityID: types.NullUint64{Uint64: uint64(newEntity.ID), Valid: true},
		}
		if err := txFileRepo.Create(ctx, newFile); err != nil {
			go provider.Delete(context.Background(), policy, []string{uploadResult.Source})
			return fmt.Errorf("创建文件记录失败: %w", err)
		}

		// 将事务内创建的 newFile 赋值给外部变量
		createdFile = newFile

		// 10. 构建用于API响应的 DTO (注意：已移除此处的事件发布)
		createdFileItem = s.BuildFileItemDTO(createdFile, viewerID, parentVirtualPath, "")

		// 11. 为 DTO 生成可立即使用的下载链接
		downloadURL, urlErr := s.GetDownloadURLForFile(ctx, createdFile, createdFileItem.ID)
		if urlErr != nil {
			log.Printf("【WARN】为新上传的图片 %s 生成下载链接失败: %v", createdFile.Name, urlErr)
		} else {
			createdFileItem.URL = downloadURL
		}

		return nil // 事务成功
	})

	// 如果事务执行失败，直接返回错误
	if err != nil {
		return nil, err
	}

	// 12. 在事务成功提交后，再发布事件
	if createdFile != nil && createdFile.Type == model.FileTypeFile {
		s.publishFileCreatedEventIfNeeded(createdFile)
	}

	return createdFileItem, nil
}

// CopyItems 是复制操作的公共入口。
// 它在一个单一的事务中处理所有文件的复制，确保操作的原子性。
func (s *serviceImpl) CopyItems(ctx context.Context, ownerID uint, sourcePublicIDs []string, destPublicFolderID string) error {
	// 1. 预校验目标文件夹 (在事务外进行只读操作，提高性能)
	destFolderID, entityType, err := idgen.DecodePublicID(destPublicFolderID)
	if err != nil || entityType != idgen.EntityTypeFile {
		return errors.New("无效的目标文件夹ID")
	}

	destFolder, err := s.fileRepo.FindByID(ctx, destFolderID)
	if err != nil {
		if errors.Is(err, constant.ErrNotFound) {
			return fmt.Errorf("目标文件夹不存在: %w", constant.ErrNotFound)
		}
		return err
	}
	if destFolder.Type != model.FileTypeDir {
		return fmt.Errorf("复制目标必须是一个文件夹: %w", constant.ErrInvalidOperation)
	}
	if destFolder.OwnerID != ownerID {
		return fmt.Errorf("无权复制到目标文件夹: %w", constant.ErrForbidden)
	}

	// 2. 将所有复制操作包裹在单个事务中，以确保原子性
	return s.txManager.Do(ctx, func(repos repository.Repositories) error {
		// 循环处理每一个要复制的源项目
		for _, srcPublicID := range sourcePublicIDs {
			srcID, srcEntityType, err := idgen.DecodePublicID(srcPublicID)
			if err != nil || srcEntityType != idgen.EntityTypeFile {
				return fmt.Errorf("源ID '%s' 无效", srcPublicID)
			}

			// 在事务中查找源项目，保证数据一致性
			srcItem, err := repos.File.FindByID(ctx, srcID)
			if err != nil {
				return fmt.Errorf("找不到源项目 '%s'", srcPublicID)
			}
			if srcItem.OwnerID != ownerID {
				return fmt.Errorf("无权复制项目 '%s': %w", srcItem.Name, constant.ErrForbidden)
			}

			// 调用递归辅助函数来执行真正的复制，并传入所有需要的事务性 repo
			err = s.CopyRecursively(ctx, ownerID, srcItem, destFolder, repos.File, repos.Entity, repos.Metadata)
			if err != nil {
				// 一旦有任何错误（包括命名冲突），立即返回错误。
				// txManager 会捕获这个错误并回滚整个事务。
				return err
			}
		}
		return nil
	})
}

// MoveItems 将一个或多个源文件/文件夹移动到目标文件夹。
// 整个过程在一个单一的数据库事务中执行，以确保所有操作的原子性。
func (s *serviceImpl) MoveItems(ctx context.Context, ownerID uint, sourcePublicIDs []string, destPublicFolderID string) error {
	// 1. 预校验目标文件夹 (非事务性只读操作)
	destFolderID, entityType, err := idgen.DecodePublicID(destPublicFolderID)
	if err != nil || entityType != idgen.EntityTypeFile {
		return errors.New("无效的目标文件夹ID")
	}

	destFolder, err := s.fileRepo.FindByID(ctx, destFolderID)
	if err != nil {
		if errors.Is(err, constant.ErrNotFound) {
			return fmt.Errorf("目标文件夹不存在: %w", constant.ErrNotFound)
		}
		return err
	}
	if destFolder.Type != model.FileTypeDir {
		return fmt.Errorf("移动目标必须是一个文件夹: %w", constant.ErrInvalidOperation)
	}
	if destFolder.OwnerID != ownerID {
		return fmt.Errorf("无权移动到目标文件夹: %w", constant.ErrForbidden)
	}

	// 2. 将所有移动操作包裹在单个事务中
	return s.txManager.Do(ctx, func(repos repository.Repositories) error {
		for _, srcPublicID := range sourcePublicIDs {
			srcID, srcEntityType, err := idgen.DecodePublicID(srcPublicID)
			if err != nil || srcEntityType != idgen.EntityTypeFile {
				return fmt.Errorf("源ID '%s' 无效", srcPublicID)
			}

			srcItem, err := repos.File.FindByID(ctx, srcID)
			if err != nil {
				if errors.Is(err, constant.ErrNotFound) {
					return fmt.Errorf("找不到源项目 '%s': %w", srcPublicID, constant.ErrNotFound)
				}
				return err
			}

			// --- 3. 核心校验 ---
			if srcItem.OwnerID != ownerID {
				return fmt.Errorf("无权移动项目 '%s': %w", srcItem.Name, constant.ErrForbidden)
			}
			if !srcItem.ParentID.Valid {
				return fmt.Errorf("不能移动根目录: %w", constant.ErrInvalidOperation)
			}
			if srcItem.ID == destFolder.ID {
				return fmt.Errorf("不能将文件夹移动到其自身: %w", constant.ErrInvalidOperation)
			}
			if srcItem.ParentID.Int64 == int64(destFolder.ID) {
				continue // 源项目已在目标文件夹中，静默跳过
			}
			if srcItem.Type == model.FileTypeDir {
				isDescendant, err := repos.File.IsDescendant(ctx, srcItem.ID, destFolder.ID)
				if err != nil {
					return fmt.Errorf("检查循环依赖时出错: %w", err)
				}
				if isDescendant {
					return fmt.Errorf("不能将文件夹 '%s' 移动到其子目录中: %w", srcItem.Name, constant.ErrInvalidOperation)
				}
			}
			if _, err := repos.File.FindByParentIDAndName(ctx, destFolder.ID, srcItem.Name); !errors.Is(err, constant.ErrNotFound) {
				if err == nil {
					return fmt.Errorf("目标文件夹中已存在同名项目 '%s': %w", srcItem.Name, constant.ErrConflict)
				}
				return fmt.Errorf("检查名称冲突时出错: %w", err)
			}

			// --- 4. 物理移动 ---
			oldParentPath, err := s.GetFolderPathWithRepo(ctx, uint(srcItem.ParentID.Int64), repos.File)
			if err != nil {
				return fmt.Errorf("无法获取源项目 '%s' 的旧路径: %w", srcItem.Name, err)
			}
			newParentPath, err := s.GetFolderPathWithRepo(ctx, destFolder.ID, repos.File)
			if err != nil {
				return fmt.Errorf("无法获取目标文件夹的路径: %w", err)
			}
			oldVirtualPath := filepath.ToSlash(filepath.Join(oldParentPath, srcItem.Name))
			newVirtualPath := filepath.ToSlash(filepath.Join(newParentPath, srcItem.Name))

			policy, err := s.vfsSvc.FindPolicyForPath(ctx, oldVirtualPath)
			if err != nil {
				log.Printf("【MOVE WARN】找不到路径 '%s' 的存储策略，将跳过物理移动。", oldVirtualPath)
			} else {
				newPolicy, _ := s.vfsSvc.FindPolicyForPath(ctx, newVirtualPath)
				if newPolicy == nil || policy.ID != newPolicy.ID {
					return fmt.Errorf("不支持跨存储策略移动")
				}
				provider, err := s.GetProviderForPolicy(policy)
				if err != nil {
					return fmt.Errorf("获取存储驱动失败: %w", err)
				}
				oldRelativePath, newRelativePath, err := s.GetRelativePathsForMove(policy, oldVirtualPath, newVirtualPath)
				if err != nil {
					return err
				}
				log.Printf("【MOVE INFO】准备物理移动: 从 '%s' 到 '%s'", oldRelativePath, newRelativePath)
				if err := provider.Rename(ctx, policy, oldRelativePath, newRelativePath); err != nil {
					return fmt.Errorf("物理移动失败: %w", err)
				}
			}

			// --- 5. 逻辑移动 (数据库更新) ---
			log.Printf("【MOVE INFO】更新数据库: 将项目 '%s' (ID: %d) 的 ParentID 设置为 %d", srcItem.Name, srcItem.ID, destFolder.ID)
			srcItem.ParentID = sql.NullInt64{Int64: int64(destFolder.ID), Valid: true}
			if err := repos.File.Update(ctx, srcItem); err != nil {
				return fmt.Errorf("更新项目 '%s' 的父目录失败: %w", srcItem.Name, err)
			}
		}
		return nil
	})
}

// DeleteItems 是删除文件或文件夹的入口，执行永久删除。
func (s *serviceImpl) DeleteItems(ctx context.Context, ownerID uint, publicIDs []string) error {
	return s.txManager.Do(ctx, func(repos repository.Repositories) error {
		for _, publicID := range publicIDs {
			dbID, entityType, err := idgen.DecodePublicID(publicID)
			if err != nil || entityType != idgen.EntityTypeFile {
				log.Printf("【DELETE WARN】无效的公共ID '%s' 或类型不匹配，跳过删除。", publicID)
				continue
			}

			// 调用新的 HardDeleteRecursively，并传入所有需要的 repo
			err = s.HardDeleteRecursively(ctx, ownerID, dbID, repos.File, repos.Entity, repos.FileEntity, repos.Metadata, repos.StoragePolicy, repos.DirectLink)
			if err != nil {
				return fmt.Errorf("删除项目 '%s' (ID: %d) 失败: %w", publicID, dbID, err)
			}
		}
		return nil
	})
}

// RenameItem 重命名一个文件或目录。
func (s *serviceImpl) RenameItem(ctx context.Context, ownerID uint, req *model.RenameItemRequest) (*model.FileInfoResponse, error) {
	sanitizedNewName := strings.TrimSpace(req.NewName)
	if sanitizedNewName == "" || strings.Contains(sanitizedNewName, "/") {
		return nil, errors.New("新名称无效，不能包含'/'或为空")
	}

	var finalErr error

	// 使用事务来保证数据库操作和物理操作的一致性
	finalErr = s.txManager.Do(ctx, func(repos repository.Repositories) error {
		txRepo := repos.File

		itemToRename, err := s.FindAndValidateFile(ctx, req.ID, ownerID)
		if err != nil {
			return err
		}
		// 在事务内重新获取，以锁定记录
		itemToRename, err = txRepo.FindByID(ctx, itemToRename.ID)
		if err != nil {
			return err
		}

		if !itemToRename.ParentID.Valid {
			return errors.New("无法重命名根目录")
		}

		parentPath, err := s.GetFolderPathWithRepo(ctx, uint(itemToRename.ParentID.Int64), txRepo)
		if err != nil {
			return fmt.Errorf("无法确定项目的父路径: %w", err)
		}

		// 如果名称未改变，则无需任何操作，直接返回成功
		if itemToRename.Name == sanitizedNewName {
			return nil // 提前退出事务，表示成功
		}

		// 检查名称冲突
		if _, err := txRepo.FindByParentIDAndName(ctx, uint(itemToRename.ParentID.Int64), sanitizedNewName); !errors.Is(err, constant.ErrNotFound) {
			if err == nil {
				return constant.ErrConflict
			}
			return fmt.Errorf("检查同名冲突时出错: %w", err)
		}

		// 执行物理重命名
		oldVirtualPath := filepath.ToSlash(filepath.Join(parentPath, itemToRename.Name))
		newVirtualPath := filepath.ToSlash(filepath.Join(parentPath, sanitizedNewName))

		policy, err := s.vfsSvc.FindPolicyForPath(ctx, oldVirtualPath)
		if err != nil {
			return fmt.Errorf("为路径 '%s' 定位存储策略失败: %w", oldVirtualPath, err)
		}

		provider, err := s.GetProviderForPolicy(policy)
		if err != nil {
			return err
		}

		oldRelativePath, newRelativePath, err := s.GetRelativePathsForMove(policy, oldVirtualPath, newVirtualPath)
		if err != nil {
			return err
		}

		if err := provider.Rename(ctx, policy, oldRelativePath, newRelativePath); err != nil {
			return fmt.Errorf("物理重命名失败: %w", err)
		}

		// 更新数据库记录
		itemToRename.Name = sanitizedNewName
		if err := txRepo.Update(ctx, itemToRename); err != nil {
			return fmt.Errorf("更新数据库中的名称失败: %w", err)
		}

		return nil
	})

	if finalErr != nil {
		return nil, finalErr
	}

	return s.GetFileInfo(ctx, ownerID, req.ID)
}

// CreateEmptyFile 在指定的虚拟路径下创建一个空文件或目录。
func (s *serviceImpl) CreateEmptyFile(ctx context.Context, ownerID uint, req *model.CreateFileRequest) (*model.FileItem, error) {
	var fileType model.FileType
	if req.Type == int(model.FileTypeFile) {
		fileType = model.FileTypeFile
	} else if req.Type == int(model.FileTypeDir) {
		fileType = model.FileTypeDir
	} else {
		return nil, errors.New("无效的类型，必须是 1 (文件) 或 2 (目录)")
	}
	parsedURI, err := uri.Parse(req.URI)
	if err != nil {
		return nil, fmt.Errorf("无效的文件URI: %w", err)
	}
	parentPath, newItemName := filepath.Dir(parsedURI.Path), filepath.Base(parsedURI.Path)
	if parentPath == "." {
		parentPath = "/"
	}
	if newItemName == "" || newItemName == "/" || strings.Contains(newItemName, "/") {
		return nil, errors.New("文件名或目录名无效")
	}

	var createdFileItem *model.FileItem
	err = s.txManager.Do(ctx, func(repos repository.Repositories) error {
		txRepo := repos.File
		parentFolder, err := txRepo.FindByPath(ctx, ownerID, parentPath)
		if err != nil {
			if errors.Is(err, constant.ErrNotFound) {
				return errors.New("指定的父目录不存在")
			}
			return err
		}
		existing, err := txRepo.FindByParentIDAndName(ctx, parentFolder.ID, newItemName)
		if err != nil && !errors.Is(err, constant.ErrNotFound) {
			return fmt.Errorf("检查同名冲突时出错: %w", err)
		}
		if existing != nil {
			if fileType == model.FileTypeDir || req.ErrOnConflict {
				return constant.ErrConflict
			}
			createdFileItem = s.BuildFileItemDTO(existing, ownerID, parentPath, "")
			return nil
		}

		// 获取存储策略和提供者
		policy, _ := s.vfsSvc.FindPolicyForPath(ctx, parsedURI.Path)
		if policy != nil {
			provider, err := s.GetProviderForPolicy(policy)
			if err != nil {
				log.Printf("警告: 获取provider失败，无法创建物理文件/目录: %v", err)
			} else {
				if fileType == model.FileTypeDir {
					// 创建物理目录
					if err := provider.CreateDirectory(ctx, policy, parsedURI.Path); err != nil {
						log.Printf("创建物理目录 '%s' 失败: %v", parsedURI.Path, err)
					}
				}
				// 对于文件类型，不创建物理文件，只在数据库中创建记录
			}
		}

		newFile := &model.File{
			OwnerID:  ownerID,
			ParentID: sql.NullInt64{Int64: int64(parentFolder.ID), Valid: true},
			Name:     newItemName,
			Size:     0,
			Type:     fileType,
		}

		if err := txRepo.Create(ctx, newFile); err != nil {
			return fmt.Errorf("在数据库中创建记录失败: %w", err)
		}

		if newFile.Type == model.FileTypeFile {
			s.publishFileCreatedEventIfNeeded(newFile)
		}

		createdFileItem = s.BuildFileItemDTO(newFile, ownerID, parentPath, "")
		return nil
	})
	return createdFileItem, err
}

// UpdateFileContentByIDAndURI 通过ID查找并用URI验证，然后更新文件内容。
func (s *serviceImpl) UpdateFileContentByIDAndURI(ctx context.Context, viewerPublicID, filePublicID, uriStr string, contentReader io.Reader) (*model.UpdateResult, error) {
	// 1. 解码ID和解析URI
	viewerID, _, err := idgen.DecodePublicID(viewerPublicID)
	if err != nil {
		return nil, fmt.Errorf("无效的用户ID: %w", constant.ErrForbidden)
	}

	fileID, _, err := idgen.DecodePublicID(filePublicID)
	if err != nil {
		return nil, fmt.Errorf("无效的文件ID: %w", constant.ErrNotFound)
	}

	parsedURI, err := uri.Parse(uriStr)
	if err != nil {
		return nil, fmt.Errorf("无效的URI格式: %w", err)
	}
	virtualPathFromURI := parsedURI.Path

	// 2. 高效查找文件并验证权限
	file, err := s.fileRepo.FindByID(ctx, fileID)
	if err != nil {
		return nil, constant.ErrNotFound
	}
	if file.OwnerID != uint(viewerID) {
		return nil, constant.ErrForbidden
	}
	if file.Type != model.FileTypeFile {
		return nil, errors.New("无法更新目录的内容")
	}

	// 3. 路径验证 (防止状态过时)
	currentVirtualPath, err := s.GetFullVirtualPath(ctx, file)
	if err != nil {
		return nil, fmt.Errorf("无法获取文件的当前路径: %w", err)
	}

	if currentVirtualPath != virtualPathFromURI {
		log.Printf("Conflict: file %d path mismatch. DB path: '%s', URI path: '%s'", file.ID, currentVirtualPath, virtualPathFromURI)
		return nil, constant.ErrConflict
	}

	// 4. 将内容读入内存
	newContent, err := ioutil.ReadAll(contentReader)
	if err != nil {
		return nil, fmt.Errorf("读取内容流失败: %w", err)
	}

	// 5. 确定存储策略和驱动 (使用验证过的路径)
	policy, err := s.vfsSvc.FindPolicyForPath(ctx, currentVirtualPath)
	if err != nil {
		return nil, fmt.Errorf("找不到路径 %s 的存储策略: %w", currentVirtualPath, err)
	}

	provider, err := s.GetProviderForPolicy(policy)
	if err != nil {
		return nil, err
	}

	// 6. 上传新内容
	uploadResult, err := provider.Upload(ctx, bytes.NewReader(newContent), policy, currentVirtualPath)
	if err != nil {
		return nil, fmt.Errorf("存储驱动上传新内容失败: %w", err)
	}

	// 7. 在数据库事务中执行更新 (这部分逻辑与之前完全相同)
	var updatedFile *model.File
	err = s.txManager.Do(ctx, func(repos repository.Repositories) error {
		// ... (创建新实体，更新文件记录) ...
		// (省略重复代码)
		txFileRepo := repos.File
		txEntityRepo := repos.Entity

		newEntity := &model.FileStorageEntity{
			PolicyID:  policy.ID,
			CreatedBy: types.NullUint64{Uint64: uint64(viewerID), Valid: true},
			Source:    sql.NullString{String: uploadResult.Source, Valid: true},
			Size:      uploadResult.Size,
			MimeType:  sql.NullString{String: uploadResult.MimeType, Valid: true},
		}
		if err := txEntityRepo.Create(ctx, newEntity); err != nil {
			return fmt.Errorf("创建新的文件实体失败: %w", err)
		}

		fileToUpdate, err := txFileRepo.FindByID(ctx, fileID)
		if err != nil {
			return err
		}

		fileToUpdate.Size = newEntity.Size
		fileToUpdate.PrimaryEntityID = types.NullUint64{Uint64: uint64(newEntity.ID), Valid: true}
		if err := txFileRepo.Update(ctx, fileToUpdate); err != nil {
			return fmt.Errorf("更新文件记录失败: %w", err)
		}

		updatedFile = fileToUpdate
		return nil
	})

	if err != nil {
		go provider.Delete(context.Background(), policy, []string{uploadResult.Source})
		return nil, err
	}

	// 8. 准备并返回成功的响应DTO
	return &model.UpdateResult{
		PublicID:  filePublicID,
		Size:      updatedFile.Size,
		UpdatedAt: updatedFile.UpdatedAt,
	}, nil
}

// GetFullVirtualPath 是一个根据文件记录重建其完整虚拟路径的辅助函数
func (s *serviceImpl) GetFullVirtualPath(ctx context.Context, file *model.File) (string, error) {
	if !file.ParentID.Valid {
		// 可能是根目录下的文件
		return "/" + file.Name, nil
	}
	parentPath, err := s.GetFolderPath(ctx, uint(file.ParentID.Int64))
	if err != nil {
		return "", err
	}
	return filepath.ToSlash(filepath.Join(parentPath, file.Name)), nil
}
