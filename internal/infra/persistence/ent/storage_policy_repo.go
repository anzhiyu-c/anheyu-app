/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-23 15:08:11
 * @LastEditTime: 2025-12-13 11:10:55
 * @LastEditors: 安知鱼
 */
package ent

import (
	"context"
	"fmt"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/storagepolicy"
)

type entStoragePolicyRepo struct {
	client *ent.Client
}

// NewEntStoragePolicyRepository 是 entStoragePolicyRepo 的构造函数
func NewEntStoragePolicyRepository(client *ent.Client) repository.StoragePolicyRepository {
	return &entStoragePolicyRepo{client: client}
}

func (r *entStoragePolicyRepo) Create(ctx context.Context, policy *model.StoragePolicy) error {
	create := r.client.StoragePolicy.
		Create().
		SetName(policy.Name).
		SetType(string(policy.Type)).
		SetServer(policy.Server).
		SetBucketName(policy.BucketName).
		SetIsPrivate(policy.IsPrivate).
		SetAccessKey(policy.AccessKey).
		SetSecretKey(policy.SecretKey).
		SetMaxSize(policy.MaxSize).
		SetBasePath(policy.BasePath).
		SetVirtualPath(policy.VirtualPath).
		SetSettings(policy.Settings).
		SetNillableNodeID(policy.NodeID)

	// 正确处理flag字段：空字符串设置为NULL，非空字符串正常设置
	if policy.Flag != "" {
		create.SetFlag(policy.Flag)
	}
	// 如果flag为空字符串，则不设置该字段，让数据库使用NULL值

	created, err := create.Save(ctx)
	if err != nil {
		return err
	}
	policy.ID = created.ID
	return nil
}

func (r *entStoragePolicyRepo) FindByVirtualPath(ctx context.Context, path string) (*model.StoragePolicy, error) {
	po, err := r.client.StoragePolicy.Query().
		Where(storagepolicy.VirtualPath(path)).
		Only(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}

	return toDomainStoragePolicy(po), nil
}

func (r *entStoragePolicyRepo) FindByID(ctx context.Context, id uint) (*model.StoragePolicy, error) {
	po, err := r.client.StoragePolicy.Get(ctx, id)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	return toDomainStoragePolicy(po), nil
}

func (r *entStoragePolicyRepo) Update(ctx context.Context, policy *model.StoragePolicy) error {
	update := r.client.StoragePolicy.
		UpdateOneID(policy.ID).
		SetName(policy.Name).
		SetType(string(policy.Type)).
		SetServer(policy.Server).
		SetBucketName(policy.BucketName).
		SetIsPrivate(policy.IsPrivate).
		SetAccessKey(policy.AccessKey).
		SetSecretKey(policy.SecretKey).
		SetMaxSize(policy.MaxSize).
		SetBasePath(policy.BasePath).
		SetVirtualPath(policy.VirtualPath).
		SetSettings(policy.Settings).
		SetNillableNodeID(policy.NodeID)

	// 正确处理flag字段：空字符串设置为NULL，非空字符串正常设置
	if policy.Flag != "" {
		update.SetFlag(policy.Flag)
	} else {
		// 明确清除flag字段，设置为NULL
		update.ClearFlag()
	}

	_, err := update.Save(ctx)
	return err
}

func (r *entStoragePolicyRepo) Delete(ctx context.Context, id uint) error {
	return r.client.StoragePolicy.DeleteOneID(id).Exec(ctx)
}

func (r *entStoragePolicyRepo) FindByName(ctx context.Context, name string) (*model.StoragePolicy, error) {
	po, err := r.client.StoragePolicy.Query().
		Where(
			storagepolicy.Name(name),
			storagepolicy.DeletedAtIsNil(),
		).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	return toDomainStoragePolicy(po), nil
}

// FindByNameUnscoped 查找指定名称的策略，包括已软删除的记录
func (r *entStoragePolicyRepo) FindByNameUnscoped(ctx context.Context, name string) (*model.StoragePolicy, error) {
	po, err := r.client.StoragePolicy.Query().
		Where(storagepolicy.Name(name)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	return toDomainStoragePolicy(po), nil
}

// HardDelete 硬删除策略（永久删除，包括软删除的记录）
func (r *entStoragePolicyRepo) HardDelete(ctx context.Context, id uint) error {
	return r.client.StoragePolicy.DeleteOneID(id).Exec(ctx)
}

func (r *entStoragePolicyRepo) List(ctx context.Context, page, pageSize int) ([]*model.StoragePolicy, int64, error) {
	query := r.client.StoragePolicy.Query()

	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("计算总数失败: %w", err)
	}
	if total == 0 {
		return []*model.StoragePolicy{}, 0, nil
	}

	offset := (page - 1) * pageSize
	// 按创建时间倒序排列，最新创建的在前面
	pos, err := query.Order(ent.Desc(storagepolicy.FieldCreatedAt)).Limit(pageSize).Offset(offset).All(ctx)
	if err != nil {
		return nil, 0, err
	}

	domainPolicies := make([]*model.StoragePolicy, len(pos))
	for i, p := range pos {
		domainPolicies[i] = toDomainStoragePolicy(p)
	}

	return domainPolicies, int64(total), nil
}

func (r *entStoragePolicyRepo) ListAll(ctx context.Context) ([]*model.StoragePolicy, error) {
	// 按创建时间倒序排列，最新创建的在前面
	pos, err := r.client.StoragePolicy.Query().Order(ent.Desc(storagepolicy.FieldCreatedAt)).All(ctx)
	if err != nil {
		return nil, err
	}
	domainPolicies := make([]*model.StoragePolicy, len(pos))
	for i, p := range pos {
		domainPolicies[i] = toDomainStoragePolicy(p)
	}
	return domainPolicies, nil
}

// toDomainStoragePolicy 将 *ent.StoragePolicy 转换为 *model.StoragePolicy.
func toDomainStoragePolicy(p *ent.StoragePolicy) *model.StoragePolicy {
	if p == nil {
		return nil
	}
	domain := &model.StoragePolicy{
		ID:          p.ID,
		CreatedAt:   p.CreatedAt,
		UpdatedAt:   p.UpdatedAt,
		Name:        p.Name,
		Type:        constant.StoragePolicyType(p.Type),
		Flag:        p.Flag,
		Server:      p.Server,
		BucketName:  p.BucketName,
		IsPrivate:   p.IsPrivate,
		AccessKey:   p.AccessKey,
		SecretKey:   p.SecretKey,
		MaxSize:     p.MaxSize,
		BasePath:    p.BasePath,
		VirtualPath: p.VirtualPath,
		NodeID:      p.NodeID,
	}
	if p.DeletedAt != nil {
		domain.DeletedAt = p.DeletedAt
	}
	if p.Settings != nil {
		domain.Settings = p.Settings
	} else {
		domain.Settings = make(model.StoragePolicySettings)
	}
	return domain
}

// FindByNodeID 根据关联的目录节点 ID 查找存储策略
func (r *entStoragePolicyRepo) FindByNodeID(ctx context.Context, nodeID uint) (*model.StoragePolicy, error) {
	po, err := r.client.StoragePolicy.Query().
		Where(storagepolicy.NodeID(nodeID)).
		Only(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			// 没有找到是正常情况
			return nil, nil
		}
		return nil, err
	}

	return toDomainStoragePolicy(po), nil
}

// FindByFlag 根据 Flag 查找存储策略
func (r *entStoragePolicyRepo) FindByFlag(ctx context.Context, flag string) (*model.StoragePolicy, error) {
	po, err := r.client.StoragePolicy.Query().
		Where(storagepolicy.Flag(flag)).
		Only(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			// 没有找到是正常情况
			return nil, nil
		}
		// 其他数据库错误
		return nil, err
	}

	return toDomainStoragePolicy(po), nil
}

// ClearFlag 清除指定策略的 Flag 标志
func (r *entStoragePolicyRepo) ClearFlag(ctx context.Context, policyID uint) error {
	return r.client.StoragePolicy.UpdateOneID(policyID).
		ClearFlag().
		Exec(ctx)
}
