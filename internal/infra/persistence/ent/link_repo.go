package ent

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/link"
	"github.com/anzhiyu-c/anheyu-app/ent/linkcategory"
	"github.com/anzhiyu-c/anheyu-app/ent/linktag"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"

	"entgo.io/ent/dialect/sql"
)

type linkRepo struct {
	client *ent.Client
	dbType string
}

func NewLinkRepo(client *ent.Client, dbType string) repository.LinkRepository {
	return &linkRepo{
		client: client,
		dbType: dbType,
	}
}

func (r *linkRepo) Create(ctx context.Context, req *model.ApplyLinkRequest, categoryID int) (*model.LinkDTO, error) {
	create := r.client.Link.Create().
		SetName(req.Name).
		SetURL(req.URL).
		SetStatus(link.StatusPENDING).
		SetCategoryID(categoryID)

	if req.Logo != "" {
		create.SetLogo(req.Logo)
	}
	if req.Description != "" {
		create.SetDescription(req.Description)
	}
	if req.Siteshot != "" {
		create.SetSiteshot(req.Siteshot)
	}
	if req.Email != "" {
		create.SetEmail(req.Email)
	}
	if req.Type != "" {
		create.SetType(link.Type(req.Type))
	}
	if req.OriginalURL != "" {
		create.SetOriginalURL(req.OriginalURL)
	}
	if req.UpdateReason != "" {
		create.SetUpdateReason(req.UpdateReason)
	}

	savedLink, err := create.Save(ctx)
	if err != nil {
		return nil, err
	}
	return mapEntLinkToDTO(savedLink), nil
}

func (r *linkRepo) List(ctx context.Context, req *model.ListLinksRequest) ([]*model.LinkDTO, int, error) {
	query := r.client.Link.Query().WithCategory().WithTags()
	if req.Name != nil && *req.Name != "" {
		query = query.Where(link.NameContains(*req.Name))
	}
	if req.URL != nil && *req.URL != "" {
		query = query.Where(link.URLContains(*req.URL))
	}
	if req.Description != nil && *req.Description != "" {
		query = query.Where(link.DescriptionContains(*req.Description))
	}
	if req.Status != nil && *req.Status != "" {
		query = query.Where(link.StatusEQ(link.Status(*req.Status)))
	}
	if req.CategoryID != nil {
		query = query.Where(link.HasCategoryWith(linkcategory.ID(*req.CategoryID)))
	}
	if req.TagID != nil {
		query = query.Where(link.HasTagsWith(linktag.ID(*req.TagID)))
	}

	total, err := query.Count(ctx)
	if err != nil {
		return nil, 0, err
	}

	entLinks, err := query.
		Offset((req.GetPage()-1)*req.GetPageSize()).
		Limit(req.GetPageSize()).
		Order(ent.Desc(link.FieldSortOrder), ent.Desc(link.FieldID)).
		All(ctx)
	if err != nil {
		return nil, 0, err
	}

	return mapEntLinksToDTOs(entLinks), total, nil
}

func (r *linkRepo) GetByID(ctx context.Context, id int) (*model.LinkDTO, error) {
	entLink, err := r.client.Link.Query().
		Where(link.ID(id)).
		WithCategory().
		WithTags().
		Only(ctx)
	if err != nil {
		return nil, err
	}
	return mapEntLinkToDTO(entLink), nil
}

func (r *linkRepo) AdminCreate(ctx context.Context, req *model.AdminCreateLinkRequest) (*model.LinkDTO, error) {
	create := r.client.Link.Create().
		SetName(req.Name).
		SetURL(req.URL).
		SetStatus(link.Status(req.Status)).
		SetSiteshot(req.Siteshot).
		SetCategoryID(req.CategoryID).
		SetSortOrder(req.SortOrder).
		SetSkipHealthCheck(req.SkipHealthCheck)

	// 处理单个标签，验证标签是否存在
	if req.TagID != nil {
		exists, err := r.client.LinkTag.Query().Where(linktag.ID(*req.TagID)).Exist(ctx)
		if err != nil {
			return nil, err
		}
		if exists {
			create.AddTagIDs(*req.TagID)
		}
		// 如果标签不存在，静默忽略（不添加标签）
	}

	if req.Logo != "" {
		create.SetLogo(req.Logo)
	}

	if req.Description != "" {
		create.SetDescription(req.Description)
	}

	if req.Email != "" {
		create.SetEmail(req.Email)
	}

	if req.Type != "" {
		create.SetType(link.Type(req.Type))
	}

	if req.OriginalURL != "" {
		create.SetOriginalURL(req.OriginalURL)
	}

	if req.UpdateReason != "" {
		create.SetUpdateReason(req.UpdateReason)
	}

	savedLink, err := create.Save(ctx)
	if err != nil {
		return nil, err
	}

	// 重新查询以加载关联数据
	refetchedLink, err := r.client.Link.Query().
		Where(link.ID(savedLink.ID)).
		WithCategory().
		WithTags().
		Only(ctx)
	if err != nil {
		return nil, err
	}

	return mapEntLinkToDTO(refetchedLink), nil
}

func (r *linkRepo) Update(ctx context.Context, id int, req *model.AdminUpdateLinkRequest) (*model.LinkDTO, error) {
	// 1. 执行更新操作，使用 _ 忽略用不到的返回值
	updater := r.client.Link.UpdateOneID(id).
		SetName(req.Name).
		SetURL(req.URL).
		SetLogo(req.Logo).
		SetSiteshot(req.Siteshot).
		SetDescription(req.Description).
		SetEmail(req.Email).
		SetStatus(link.Status(req.Status)).
		SetCategoryID(req.CategoryID).
		SetSortOrder(req.SortOrder).
		SetSkipHealthCheck(req.SkipHealthCheck).
		ClearTags()

	// 设置申请类型相关字段
	if req.Type != "" {
		updater.SetType(link.Type(req.Type))
	}
	if req.OriginalURL != "" {
		updater.SetOriginalURL(req.OriginalURL)
	}
	if req.UpdateReason != "" {
		updater.SetUpdateReason(req.UpdateReason)
	}

	// 处理单个标签，验证标签是否存在
	if req.TagID != nil {
		exists, err := r.client.LinkTag.Query().Where(linktag.ID(*req.TagID)).Exist(ctx)
		if err != nil {
			return nil, err
		}
		if exists {
			updater.AddTagIDs(*req.TagID)
		}
		// 如果标签不存在，静默忽略（不添加标签）
	}

	_, err := updater.Save(ctx)

	if err != nil {
		return nil, err
	}

	// 2. 查询更新后的完整数据并返回
	refetchedLink, err := r.client.Link.Query().
		Where(link.ID(id)).
		WithCategory().
		WithTags().
		Only(ctx)
	if err != nil {
		return nil, err
	}

	return mapEntLinkToDTO(refetchedLink), nil
}

func (r *linkRepo) Delete(ctx context.Context, id int) error {
	return r.client.Link.DeleteOneID(id).Exec(ctx)
}

func (r *linkRepo) ListPublic(ctx context.Context, req *model.ListPublicLinksRequest) ([]*model.LinkDTO, int, error) {
	query := r.client.Link.Query().
		WithCategory().
		WithTags().
		Where(link.StatusEQ(link.StatusAPPROVED))

	if req.CategoryID != nil {
		query = query.Where(link.HasCategoryWith(linkcategory.ID(*req.CategoryID)))
	}

	total, err := query.Count(ctx)
	if err != nil {
		return nil, 0, err
	}

	results, err := query.
		Offset((req.GetPage()-1)*req.GetPageSize()).
		Limit(req.GetPageSize()).
		Order(ent.Desc(link.FieldSortOrder), ent.Asc(link.FieldID)).
		All(ctx)
	if err != nil {
		return nil, 0, err
	}

	return mapEntLinksToDTOs(results), total, nil
}

func (r *linkRepo) UpdateStatus(ctx context.Context, id int, status string, siteshot *string) error {
	update := r.client.Link.UpdateOneID(id).
		SetStatus(link.Status(status))

	// 如果 siteshot 不是 nil，则更新它（允许更新为空字符串以清空）
	if siteshot != nil {
		update.SetSiteshot(*siteshot)
	}

	_, err := update.Save(ctx)
	return err
}

// ListAllApplications 获取所有友链申请（公开接口，按创建时间倒序，显示所有状态）
func (r *linkRepo) ListAllApplications(ctx context.Context, req *model.ListPublicLinksRequest) ([]*model.LinkDTO, int, error) {
	query := r.client.Link.Query().
		WithCategory().
		WithTags()

	if req.CategoryID != nil {
		query = query.Where(link.HasCategoryWith(linkcategory.ID(*req.CategoryID)))
	}

	// 状态筛选
	if req.Status != nil {
		query = query.Where(link.StatusEQ(link.Status(*req.Status)))
	}

	// 名称搜索
	if req.Name != nil && *req.Name != "" {
		query = query.Where(link.NameContains(*req.Name))
	}

	total, err := query.Count(ctx)
	if err != nil {
		return nil, 0, err
	}

	// 按ID倒序排列，显示最新的申请（ID越大，创建时间越晚）
	results, err := query.
		Offset((req.GetPage() - 1) * req.GetPageSize()).
		Limit(req.GetPageSize()).
		Order(ent.Desc(link.FieldID)).
		All(ctx)
	if err != nil {
		return nil, 0, err
	}

	return mapEntLinksToDTOs(results), total, nil
}

// --- 辅助函数 ---

func mapEntLinkToDTO(entLink *ent.Link) *model.LinkDTO {
	if entLink == nil {
		return nil
	}
	dto := &model.LinkDTO{
		ID:              entLink.ID,
		Name:            entLink.Name,
		URL:             entLink.URL,
		Logo:            entLink.Logo,
		Description:     entLink.Description,
		Status:          string(entLink.Status),
		Siteshot:        entLink.Siteshot,
		Email:           entLink.Email,
		Type:            string(entLink.Type),
		OriginalURL:     entLink.OriginalURL,
		UpdateReason:    entLink.UpdateReason,
		SortOrder:       entLink.SortOrder,
		SkipHealthCheck: entLink.SkipHealthCheck,
	}
	if entLink.Edges.Category != nil {
		dto.Category = &model.LinkCategoryDTO{
			ID:          entLink.Edges.Category.ID,
			Name:        entLink.Edges.Category.Name,
			Style:       string(entLink.Edges.Category.Style),
			Description: entLink.Edges.Category.Description,
		}
	}
	// 处理单个标签
	if len(entLink.Edges.Tags) > 0 {
		// 只取第一个标签
		entTag := entLink.Edges.Tags[0]
		dto.Tag = &model.LinkTagDTO{
			ID:    entTag.ID,
			Name:  entTag.Name,
			Color: entTag.Color,
		}
	}
	return dto
}

func (r *linkRepo) GetRandomPublic(ctx context.Context, num int) ([]*model.LinkDTO, error) {
	randomFunc := "RAND()"
	// PostgreSQL 和 SQLite 使用 RANDOM() 函数
	if r.dbType == "postgres" || r.dbType == "sqlite" || r.dbType == "sqlite3" {
		randomFunc = "RANDOM()"
	}

	// 第一步：只查询 ID，使用随机排序
	ids, err := r.client.Link.Query().
		Where(link.StatusEQ(link.StatusAPPROVED)).
		Modify(func(s *sql.Selector) {
			// 使用原始 SQL ORDER BY
			s.OrderExpr(sql.Expr(randomFunc))
		}).
		Limit(num).
		IDs(ctx)

	if err != nil {
		return nil, err
	}

	if len(ids) == 0 {
		return []*model.LinkDTO{}, nil
	}

	// 第二步：根据 ID 查询完整的数据（包括关联数据）
	entLinks, err := r.client.Link.Query().
		Where(link.IDIn(ids...)).
		WithCategory().
		WithTags().
		All(ctx)

	if err != nil {
		return nil, err
	}

	return mapEntLinksToDTOs(entLinks), nil
}

func mapEntLinksToDTOs(entLinks []*ent.Link) []*model.LinkDTO {
	dtos := make([]*model.LinkDTO, len(entLinks))
	for i, entLink := range entLinks {
		dtos[i] = mapEntLinkToDTO(entLink)
	}
	return dtos
}

// ExistsByURL 检查指定URL的友链是否已存在
func (r *linkRepo) ExistsByURL(ctx context.Context, url string) (bool, error) {
	exists, err := r.client.Link.Query().
		Where(link.URLEQ(url)).
		Exist(ctx)
	return exists, err
}

// GetByURL 根据 URL 获取友链信息
func (r *linkRepo) GetByURL(ctx context.Context, url string) (*model.LinkDTO, error) {
	entLink, err := r.client.Link.Query().
		WithCategory().
		WithTags().
		Where(link.URLEQ(url)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	return mapEntLinkToDTO(entLink), nil
}

// GetAllApprovedLinks 获取所有已审核通过的友链
func (r *linkRepo) GetAllApprovedLinks(ctx context.Context) ([]*model.LinkDTO, error) {
	entLinks, err := r.client.Link.Query().
		WithCategory().
		WithTags().
		Where(
			link.StatusEQ(link.StatusAPPROVED),
			link.SkipHealthCheckEQ(false), // 排除跳过健康检查的友链
		).
		All(ctx)
	if err != nil {
		return nil, err
	}
	return mapEntLinksToDTOs(entLinks), nil
}

// GetAllInvalidLinks 获取所有失联状态的友链
func (r *linkRepo) GetAllInvalidLinks(ctx context.Context) ([]*model.LinkDTO, error) {
	entLinks, err := r.client.Link.Query().
		WithCategory().
		WithTags().
		Where(
			link.StatusEQ(link.StatusINVALID),
			link.SkipHealthCheckEQ(false), // 排除跳过健康检查的友链
		).
		All(ctx)
	if err != nil {
		return nil, err
	}
	return mapEntLinksToDTOs(entLinks), nil
}

// BatchUpdateSortOrder 批量更新友链的排序权重
func (r *linkRepo) BatchUpdateSortOrder(ctx context.Context, items []model.LinkSortItem) error {
	// 使用事务确保原子性
	tx, err := r.client.Tx(ctx)
	if err != nil {
		return err
	}

	for _, item := range items {
		err := tx.Link.UpdateOneID(item.ID).
			SetSortOrder(item.SortOrder).
			Exec(ctx)
		if err != nil {
			// 回滚事务
			_ = tx.Rollback()
			return err
		}
	}

	// 提交事务
	return tx.Commit()
}

// BatchUpdateStatus 批量更新友链状态
func (r *linkRepo) BatchUpdateStatus(ctx context.Context, linkIDs []int, status string) error {
	if len(linkIDs) == 0 {
		return nil
	}
	_, err := r.client.Link.Update().
		Where(link.IDIn(linkIDs...)).
		SetStatus(link.Status(status)).
		Save(ctx)
	return err
}
