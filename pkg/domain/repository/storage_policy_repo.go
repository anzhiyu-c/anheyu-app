/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-23 15:08:11
 * @LastEditTime: 2025-09-28 16:45:44
 * @LastEditors: 安知鱼
 */
package repository

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// StoragePolicyRepository 定义了存储策略的持久化操作接口
type StoragePolicyRepository interface {
	Create(ctx context.Context, policy *model.StoragePolicy) error
	FindByID(ctx context.Context, id uint) (*model.StoragePolicy, error)
	Update(ctx context.Context, policy *model.StoragePolicy) error
	Delete(ctx context.Context, id uint) error
	FindByName(ctx context.Context, name string) (*model.StoragePolicy, error)
	FindByNameUnscoped(ctx context.Context, name string) (*model.StoragePolicy, error) // 查找包括软删除的记录
	HardDelete(ctx context.Context, id uint) error                                     // 硬删除策略
	List(ctx context.Context, page, pageSize int) ([]*model.StoragePolicy, int64, error)
	ListAll(ctx context.Context) ([]*model.StoragePolicy, error)
	FindByVirtualPath(ctx context.Context, path string) (*model.StoragePolicy, error)
	FindByFlag(ctx context.Context, flag string) (*model.StoragePolicy, error)
	FindByNodeID(ctx context.Context, nodeID uint) (*model.StoragePolicy, error)
	ClearFlag(ctx context.Context, policyID uint) error
}
