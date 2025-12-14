package ent

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/usergroup"
)

// entUserGroupRepository 是 UserGroupRepository 接口的 Ent 实现
type entUserGroupRepository struct {
	client *ent.Client
}

// NewEntUserGroupRepository 是 entUserGroupRepository 的构造函数
func NewEntUserGroupRepository(client *ent.Client) repository.UserGroupRepository {
	return &entUserGroupRepository{client: client}
}

// FindByID 根据 ID 查找用户组
func (r *entUserGroupRepository) FindByID(ctx context.Context, id uint) (*model.UserGroup, error) {
	entGroup, err := r.client.UserGroup.
		Query().
		Where(
			usergroup.ID(id),
			usergroup.DeletedAtIsNil(),
		).
		Only(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil // 未找到，不返回错误
		}
		return nil, err
	}
	return toDomainUserGroup(entGroup), nil
}

// FindAll 获取所有用户组
func (r *entUserGroupRepository) FindAll(ctx context.Context) ([]*model.UserGroup, error) {
	entGroups, err := r.client.UserGroup.
		Query().
		Where(usergroup.DeletedAtIsNil()).
		All(ctx)
	if err != nil {
		return nil, err
	}

	domainGroups := make([]*model.UserGroup, len(entGroups))
	for i, g := range entGroups {
		domainGroups[i] = toDomainUserGroup(g)
	}
	return domainGroups, nil
}

// Save 创建或更新用户组
func (r *entUserGroupRepository) Save(ctx context.Context, group *model.UserGroup) error {
	// 如果 ID 为 0，执行创建操作
	if group.ID == 0 {
		created, err := r.client.UserGroup.
			Create().
			SetName(group.Name).
			SetDescription(group.Description).
			SetPermissions(group.Permissions).
			SetMaxStorage(group.MaxStorage).
			SetSpeedLimit(group.SpeedLimit).
			SetSettings(&group.Settings).
			SetStoragePolicyIds(group.StoragePolicyIDs).
			Save(ctx)
		if err != nil {
			return err
		}
		// 将数据库生成的值同步回领域模型
		group.ID = created.ID
		group.CreatedAt = created.CreatedAt
		group.UpdatedAt = created.UpdatedAt
		return nil
	}

	// 如果 ID 不为 0，执行更新操作
	updated, err := r.client.UserGroup.
		UpdateOneID(group.ID).
		SetName(group.Name).
		SetDescription(group.Description).
		SetPermissions(group.Permissions).
		SetMaxStorage(group.MaxStorage).
		SetSpeedLimit(group.SpeedLimit).
		SetSettings(&group.Settings).
		SetStoragePolicyIds(group.StoragePolicyIDs).
		Save(ctx)
	if err != nil {
		return err
	}
	// 更新成功后，同步更新时间
	group.UpdatedAt = updated.UpdatedAt
	return nil
}

// Delete 软删除用户组
func (r *entUserGroupRepository) Delete(ctx context.Context, id uint) error {
	// Ent 的 SoftDelete Mixin 会自动处理删除逻辑
	_, err := r.client.UserGroup.Delete().Where(usergroup.ID(id)).Exec(ctx)
	return err
}

// --- 数据转换辅助函数 ---

func toDomainUserGroup(g *ent.UserGroup) *model.UserGroup {
	if g == nil {
		return nil
	}
	return &model.UserGroup{
		ID:               g.ID,
		CreatedAt:        g.CreatedAt,
		UpdatedAt:        g.UpdatedAt,
		Name:             g.Name,
		Description:      g.Description,
		Permissions:      g.Permissions,
		MaxStorage:       g.MaxStorage,
		SpeedLimit:       g.SpeedLimit,
		Settings:         *g.Settings,
		StoragePolicyIDs: g.StoragePolicyIds,
	}
}
