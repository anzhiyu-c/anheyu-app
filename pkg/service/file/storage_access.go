package file

import (
	"context"
	"errors"
	"fmt"
	"log"
	"path"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
)

// authorizeStorageAccess 在事务外校验 ownerID 能否读写 policy 对应的物理存储，规则见 authorizeStorageMount。
func (s *serviceImpl) authorizeStorageAccess(ctx context.Context, ownerID uint, policy *model.StoragePolicy) error {
	return s.txManager.Do(ctx, func(repos repository.Repositories) error {
		return authorizeStorageMount(ctx, ownerID, policy, repos.User, repos.File)
	})
}

// syncDirectoryIfAuthorized 仅在用户有权访问该策略的物理存储时，才把物理目录同步进用户文件树。
// 无权访问时跳过同步并只返回数据库中的已有记录，避免把共享物理目录里他人的文件同步给当前用户。
func (s *serviceImpl) syncDirectoryIfAuthorized(ctx context.Context, ownerID uint, policy *model.StoragePolicy, virtualPath string) error {
	if err := s.authorizeStorageAccess(ctx, ownerID, policy); err != nil {
		if errors.Is(err, constant.ErrForbidden) {
			log.Printf("【SYNC SKIP】用户 %d 无权访问策略 '%s' 的物理存储，跳过同步路径 '%s': %v", ownerID, policy.Name, virtualPath, err)
			return nil
		}
		return err
	}
	return s.syncSvc.SyncDirectory(ctx, ownerID, policy, virtualPath)
}

// canTouchPhysicalStorage 用于删除流程：无权访问时返回 false，调用方只删除数据库记录，不动物理存储；
// 这样用户仍能清理自己名下的记录，但不会删掉共享物理目录中属于他人的文件。
func canTouchPhysicalStorage(ctx context.Context, ownerID uint, policy *model.StoragePolicy, userRepo repository.UserRepository, fileRepo repository.FileRepository) (bool, error) {
	if err := authorizeStorageMount(ctx, ownerID, policy, userRepo, fileRepo); err != nil {
		if errors.Is(err, constant.ErrForbidden) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// PurgeUnauthorizedStorageRecords 清理历史上被目录同步写进非管理员文件树、但该用户无权访问其物理存储的记录。
// 只删除数据库记录：HardDeleteRecursively 对无权访问的策略会跳过物理删除，因此不会删到共享目录里他人的文件。
// 管理员名下的记录不做处理；用户有权访问的挂载目录整棵保留。返回删除的记录数。
func (s *serviceImpl) PurgeUnauthorizedStorageRecords(ctx context.Context) (int, error) {
	roots, err := s.fileRepo.ListByParentID(ctx, 0)
	if err != nil {
		return 0, fmt.Errorf("列出用户根目录失败: %w", err)
	}
	total := 0
	for _, root := range roots {
		removed := 0
		err := s.txManager.Do(ctx, func(repos repository.Repositories) error {
			user, err := repos.User.FindByID(ctx, root.OwnerID)
			if err != nil {
				if errors.Is(err, constant.ErrNotFound) {
					return nil
				}
				return fmt.Errorf("查找用户 %d 失败: %w", root.OwnerID, err)
			}
			if user.UserGroupID == 1 {
				return nil
			}
			removed, err = s.purgeUnauthorizedChildren(ctx, root.OwnerID, root.ID, "/", repos)
			return err
		})
		if err != nil {
			return total, fmt.Errorf("清理用户 %d 的越权记录失败: %w", root.OwnerID, err)
		}
		if removed > 0 {
			log.Printf("【STORAGE PURGE】已从用户 %d 的文件树中移除 %d 条无权访问物理存储的记录（物理文件未删除）", root.OwnerID, removed)
		}
		total += removed
	}
	return total, nil
}

func (s *serviceImpl) purgeUnauthorizedChildren(ctx context.Context, ownerID, folderID uint, folderPath string, repos repository.Repositories) (int, error) {
	children, err := repos.File.ListByParentIDUnscoped(ctx, folderID)
	if err != nil {
		return 0, fmt.Errorf("列出文件夹 %d 的子项失败: %w", folderID, err)
	}
	removed := 0
	for _, child := range children {
		item := child.File
		itemPath := path.Join(folderPath, item.Name)
		policy, err := s.vfsSvc.FindPolicyForPath(ctx, itemPath)
		if err != nil {
			log.Printf("【STORAGE PURGE】路径 '%s' 没有对应的存储策略，保留记录: %v", itemPath, err)
			continue
		}
		allowed, err := canTouchPhysicalStorage(ctx, ownerID, policy, repos.User, repos.File)
		if err != nil {
			return removed, err
		}
		if allowed {
			continue
		}
		if item.Type == model.FileTypeDir {
			n, err := s.purgeUnauthorizedChildren(ctx, ownerID, item.ID, itemPath, repos)
			removed += n
			if err != nil {
				return removed, err
			}
			remaining, err := repos.File.ListByParentIDUnscoped(ctx, item.ID)
			if err != nil {
				return removed, fmt.Errorf("列出文件夹 %d 的剩余子项失败: %w", item.ID, err)
			}
			if len(remaining) > 0 {
				// 目录下还有用户有权访问的挂载目录，保留这一层。
				continue
			}
		}
		if err := s.HardDeleteRecursively(ctx, ownerID, item.ID, repos.File, repos.Entity, repos.FileEntity, repos.Metadata, repos.StoragePolicy, repos.DirectLink, repos.User); err != nil {
			return removed, err
		}
		removed++
	}
	return removed, nil
}
