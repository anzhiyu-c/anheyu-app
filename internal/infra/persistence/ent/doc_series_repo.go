/*
 * @Description: 文档系列仓库实现
 * @Author: 安知鱼
 * @Date: 2025-12-30 10:00:00
 * @LastEditTime: 2025-12-30 10:00:00
 * @LastEditors: 安知鱼
 */
package ent

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/article"
	"github.com/anzhiyu-c/anheyu-app/ent/docseries"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
)

type docSeriesRepo struct {
	db *ent.Client
}

// NewDocSeriesRepo 是 docSeriesRepo 的构造函数。
func NewDocSeriesRepo(db *ent.Client) repository.DocSeriesRepository {
	return &docSeriesRepo{db: db}
}

// toModel 将 ent 实体转换为领域模型。
func (r *docSeriesRepo) toModel(ds *ent.DocSeries) *model.DocSeries {
	if ds == nil {
		return nil
	}
	publicID, _ := idgen.GeneratePublicID(ds.ID, idgen.EntityTypeDocSeries)
	return &model.DocSeries{
		ID:          publicID,
		CreatedAt:   ds.CreatedAt,
		UpdatedAt:   ds.UpdatedAt,
		Name:        ds.Name,
		Description: ds.Description,
		CoverURL:    ds.CoverURL,
		Sort:        ds.Sort,
		DocCount:    ds.DocCount,
	}
}

// Create 创建一个新的文档系列
func (r *docSeriesRepo) Create(ctx context.Context, req *model.CreateDocSeriesRequest) (*model.DocSeries, error) {
	newSeries, err := r.db.DocSeries.Create().
		SetName(req.Name).
		SetNillableDescription(&req.Description).
		SetNillableCoverURL(&req.CoverURL).
		SetSort(req.Sort).
		Save(ctx)
	if err != nil {
		return nil, err
	}
	return r.toModel(newSeries), nil
}

// Update 更新文档系列
func (r *docSeriesRepo) Update(ctx context.Context, publicID string, req *model.UpdateDocSeriesRequest) (*model.DocSeries, error) {
	dbID, _, err := idgen.DecodePublicID(publicID)
	if err != nil {
		return nil, err
	}
	updater := r.db.DocSeries.UpdateOneID(dbID)
	if req.Name != nil {
		updater.SetName(*req.Name)
	}
	if req.Description != nil {
		updater.SetDescription(*req.Description)
	}
	if req.CoverURL != nil {
		updater.SetCoverURL(*req.CoverURL)
	}
	if req.Sort != nil {
		updater.SetSort(*req.Sort)
	}
	updatedSeries, err := updater.Save(ctx)
	if err != nil {
		return nil, err
	}
	return r.toModel(updatedSeries), nil
}

// Delete 删除文档系列
func (r *docSeriesRepo) Delete(ctx context.Context, publicID string) error {
	dbID, _, err := idgen.DecodePublicID(publicID)
	if err != nil {
		return err
	}
	return r.db.DocSeries.DeleteOneID(dbID).Exec(ctx)
}

// List 获取文档系列列表
func (r *docSeriesRepo) List(ctx context.Context, opts *model.ListDocSeriesOptions) ([]*model.DocSeries, int64, error) {
	query := r.db.DocSeries.Query().
		Order(ent.Asc(docseries.FieldSort), ent.Desc(docseries.FieldCreatedAt))

	// 计算总数
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, err
	}

	// 分页
	if opts != nil && opts.PageSize > 0 {
		offset := (opts.Page - 1) * opts.PageSize
		if offset < 0 {
			offset = 0
		}
		query = query.Offset(offset).Limit(opts.PageSize)
	}

	entities, err := query.All(ctx)
	if err != nil {
		return nil, 0, err
	}

	models := make([]*model.DocSeries, len(entities))
	for i, entity := range entities {
		models[i] = r.toModel(entity)
	}
	return models, int64(total), nil
}

// GetByID 根据ID获取文档系列
func (r *docSeriesRepo) GetByID(ctx context.Context, publicID string) (*model.DocSeries, error) {
	dbID, _, err := idgen.DecodePublicID(publicID)
	if err != nil {
		return nil, err
	}
	entity, err := r.db.DocSeries.Query().
		Where(docseries.ID(dbID)).
		Only(ctx)
	if err != nil {
		return nil, err
	}
	return r.toModel(entity), nil
}

// GetByIDWithArticles 根据ID获取文档系列及其包含的文章列表
func (r *docSeriesRepo) GetByIDWithArticles(ctx context.Context, publicID string) (*model.DocSeriesWithArticles, error) {
	dbID, _, err := idgen.DecodePublicID(publicID)
	if err != nil {
		return nil, err
	}

	entity, err := r.db.DocSeries.Query().
		Where(docseries.ID(dbID)).
		Only(ctx)
	if err != nil {
		return nil, err
	}

	// 获取该系列下的所有文档文章
	articles, err := r.db.Article.Query().
		Where(publicArticlePredicates()...).
		Where(
			article.DocSeriesID(dbID),
			article.IsDoc(true),
		).
		Order(ent.Asc(article.FieldDocSort), ent.Asc(article.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		return nil, err
	}

	// 转换文章列表
	articleItems := make([]model.DocArticleItem, len(articles))
	for i, a := range articles {
		articlePublicID, _ := idgen.GeneratePublicID(a.ID, idgen.EntityTypeArticle)
		abbrlink := ""
		if a.Abbrlink != nil {
			abbrlink = *a.Abbrlink
		}
		articleItems[i] = model.DocArticleItem{
			ID:        articlePublicID,
			Title:     a.Title,
			Abbrlink:  abbrlink,
			DocSort:   a.DocSort,
			CreatedAt: a.CreatedAt,
		}
	}

	seriesPublicID, _ := idgen.GeneratePublicID(entity.ID, idgen.EntityTypeDocSeries)
	return &model.DocSeriesWithArticles{
		DocSeriesResponse: model.DocSeriesResponse{
			ID:          seriesPublicID,
			CreatedAt:   entity.CreatedAt,
			UpdatedAt:   entity.UpdatedAt,
			Name:        entity.Name,
			Description: entity.Description,
			CoverURL:    entity.CoverURL,
			Sort:        entity.Sort,
			DocCount:    entity.DocCount,
		},
		Articles: articleItems,
	}, nil
}

// UpdateDocCount 更新文档系列的文档数量
func (r *docSeriesRepo) UpdateDocCount(ctx context.Context, id uint, delta int) error {
	_, err := r.db.DocSeries.UpdateOneID(id).AddDocCount(delta).Save(ctx)
	return err
}

// ExistsByName 检查指定名称的系列是否已存在
func (r *docSeriesRepo) ExistsByName(ctx context.Context, name string) (bool, error) {
	count, err := r.db.DocSeries.Query().
		Where(docseries.Name(name)).
		Count(ctx)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
