package ent

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/article"
	"github.com/anzhiyu-c/anheyu-app/ent/postcategory"
	"github.com/anzhiyu-c/anheyu-app/ent/posttag"
	"github.com/anzhiyu-c/anheyu-app/ent/predicate"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"

	"entgo.io/ent/dialect/sql"
)

type articleRepo struct {
	db     *ent.Client
	dbType string
}

// NewArticleRepo 是 articleRepo 的构造函数。
func NewArticleRepo(db *ent.Client, dbType string) repository.ArticleRepository {
	return &articleRepo{db: db, dbType: dbType}
}

// === 私有辅助函数 (Private Helpers) ===

// toModel 负责将 ent.Article 实体转换为 model.Article 领域模型。
func (r *articleRepo) toModel(a *ent.Article) *model.Article {
	if a == nil {
		return nil
	}
	publicID, err := idgen.GeneratePublicID(a.ID, idgen.EntityTypeArticle)
	if err != nil {
		log.Printf("[严重错误] 生成文章公共ID失败: dbID=%d, error=%v", a.ID, err)
		// 这是一个严重错误，应该panic或返回nil
		panic(fmt.Sprintf("生成文章公共ID失败: dbID=%d, error=%v", a.ID, err))
	}
	if publicID == "" {
		log.Printf("[严重错误] 生成的文章公共ID为空: dbID=%d", a.ID)
		panic(fmt.Sprintf("生成的文章公共ID为空: dbID=%d", a.ID))
	}
	// log.Printf("[toModel] 成功生成公共ID: dbID=%d -> publicID=%s", a.ID, publicID)
	var tags []*model.PostTag
	if a.Edges.PostTags != nil {
		tags = make([]*model.PostTag, len(a.Edges.PostTags))
		for i, t := range a.Edges.PostTags {
			tagPublicID, _ := idgen.GeneratePublicID(t.ID, idgen.EntityTypePostTag)
			tags[i] = &model.PostTag{ID: tagPublicID, CreatedAt: t.CreatedAt, UpdatedAt: t.UpdatedAt, Name: t.Name, Count: t.Count}
		}
	}
	var categories []*model.PostCategory
	if a.Edges.PostCategories != nil {
		categories = make([]*model.PostCategory, len(a.Edges.PostCategories))
		for i, c := range a.Edges.PostCategories {
			categoryPublicID, _ := idgen.GeneratePublicID(c.ID, idgen.EntityTypePostCategory)
			categories[i] = &model.PostCategory{ID: categoryPublicID, CreatedAt: c.CreatedAt, UpdatedAt: c.UpdatedAt, Name: c.Name, Description: c.Description, Count: c.Count, IsSeries: c.IsSeries}
		}
	}

	var abbrlinkStr string
	if a.Abbrlink != nil {
		abbrlinkStr = *a.Abbrlink
	}

	return &model.Article{
		ID:                   publicID,
		OwnerID:              a.OwnerID,
		CreatedAt:            a.CreatedAt,
		UpdatedAt:            a.UpdatedAt,
		Title:                a.Title,
		ContentMd:            a.ContentMd,
		ContentHTML:          a.ContentHTML,
		CoverURL:             a.CoverURL,
		Status:               string(a.Status),
		ViewCount:            a.ViewCount,
		WordCount:            a.WordCount,
		ReadingTime:          a.ReadingTime,
		IPLocation:           a.IPLocation,
		PrimaryColor:         a.PrimaryColor,
		IsPrimaryColorManual: a.IsPrimaryColorManual,
		ShowOnHome:           a.ShowOnHome,
		PostTags:             tags,
		PostCategories:       categories,
		HomeSort:             a.HomeSort,
		PinSort:              a.PinSort,
		TopImgURL:            a.TopImgURL,
		Summaries:            a.Summaries,
		Abbrlink:             abbrlinkStr,
		Copyright:            a.Copyright,
		CopyrightAuthor:      a.CopyrightAuthor,
		CopyrightAuthorHref:  a.CopyrightAuthorHref,
		CopyrightURL:         a.CopyrightURL,
		Keywords:             a.Keywords,
		// 审核相关字段
		ReviewStatus:  string(a.ReviewStatus),
		ReviewComment: a.ReviewComment,
		ReviewedAt:    a.ReviewedAt,
		ReviewedBy:    a.ReviewedBy,
		// 下架相关字段
		IsTakedown:     a.IsTakedown,
		TakedownReason: a.TakedownReason,
		TakedownAt:     a.TakedownAt,
		TakedownBy:     a.TakedownBy,
	}
}

// toModelSlice 将 ent.Article 切片转换为 model.Article 切片，减少代码重复。
func (r *articleRepo) toModelSlice(entities []*ent.Article) []*model.Article {
	models := make([]*model.Article, len(entities))
	for i, entity := range entities {
		models[i] = r.toModel(entity)
	}
	return models
}

// CountByCategoryWithMultipleCategories 计算有多少文章既属于目标分类，又同时属于其他分类。
// 此方法使用 JOIN 和 HAVING 子句，是处理此类聚合过滤的高效方案。
func (r *articleRepo) CountByCategoryWithMultipleCategories(ctx context.Context, categoryID uint) (int, error) {
	// 步骤 1: 同样，先找出所有隶属于目标分类的文章 ID。
	// 这一步是必要的，因为我们只关心那些“包含目标分类”并且“还包含其他分类”的文章。
	articleIDs, err := r.db.Article.Query().
		Where(article.HasPostCategoriesWith(postcategory.ID(categoryID))).
		IDs(ctx)
	if err != nil {
		return 0, err
	}
	if len(articleIDs) == 0 {
		return 0, nil // 如果没有任何文章属于该分类，直接返回 0
	}

	// 步骤 2: 在这些文章中，找出关联的分类数量大于1的文章。
	q := r.db.Article.Query().
		Where(article.IDIn(articleIDs...))

	q.Modify(func(s *sql.Selector) {
		// t 指向文章与分类的中间表 (article_post_categories)
		t := sql.Table(article.PostCategoriesTable)

		// 使用 JOIN 将文章表与中间表连接起来
		// 连接条件是文章表的主键 (s.C(article.FieldID)) 与中间表的外键 (t.C(article.PostCategoriesPrimaryKey[0])) 相等
		// **注意：这里是修正点**
		s.Join(t).On(s.C(article.FieldID), t.C(article.PostCategoriesPrimaryKey[0]))

		// 按文章 ID 进行分组，以便我们可以对每个文章的分类进行计数
		s.GroupBy(s.C(article.FieldID))

		// 使用 HAVING 子句来过滤出那些分类数量大于 1 的文章
		// 我们对中间表中的另一个外键列（分类ID）进行计数
		// **注意：这里是另一个修正点，使用主键切片的第二个元素**
		s.Having(sql.GT(sql.Count(t.C(article.PostCategoriesPrimaryKey[1])), 1))
	})

	// 步骤 3: 获取匹配文章的 ID 列表并计算其数量。
	ids, err := q.IDs(ctx)
	if err != nil {
		return 0, err
	}

	return len(ids), nil
}

// getAdjacentArticle 是一个通用的辅助函数，用于获取上一篇或下一篇文章。
func (r *articleRepo) getAdjacentArticle(ctx context.Context, currentArticleID uint, createdAt time.Time, isPrev bool) (*model.Article, error) {
	query := r.db.Article.Query().
		Where(
			article.IDNEQ(currentArticleID),
			article.StatusEQ(article.StatusPUBLISHED),
			article.DeletedAtIsNil(),
		)

	if isPrev {
		query = query.Where(article.CreatedAtLT(createdAt)).
			Order(ent.Desc(article.FieldCreatedAt), ent.Desc(article.FieldID))
	} else {
		query = query.Where(article.CreatedAtGT(createdAt)).
			Order(ent.Asc(article.FieldCreatedAt), ent.Asc(article.FieldID))
	}

	entity, err := query.WithPostTags().WithPostCategories().First(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil // 未找到是正常情况
		}
		return nil, err
	}
	return r.toModel(entity), nil
}

// === 公开方法实现 (Public Methods Implementation) ===

// FindByID 实现了通过数据库 uint ID 查找文章的方法。
func (r *articleRepo) FindByID(ctx context.Context, id uint) (*model.Article, error) {
	entArticle, err := r.db.Article.Query().
		Where(article.ID(id)).
		WithPostTags().
		WithPostCategories().
		Only(ctx)
	if err != nil {
		return nil, err
	}
	return r.toModel(entArticle), nil
}

// GetArchiveSummary 获取文章归档摘要
func (r *articleRepo) GetArchiveSummary(ctx context.Context) ([]*model.ArchiveItem, error) {
	var items []*model.ArchiveItem
	err := r.db.Article.Query().
		Where(
			article.StatusEQ(article.StatusPUBLISHED),
			article.DeletedAtIsNil(),
		).
		Modify(func(s *sql.Selector) {
			var yearExprStr, monthExprStr string

			switch r.dbType {
			case "sqlite", "sqlite3":
				// SQLite 使用 strftime 函数
				yearExprStr = fmt.Sprintf("CAST(strftime('%%Y', %s) AS INTEGER)", s.C(article.FieldCreatedAt))
				monthExprStr = fmt.Sprintf("CAST(strftime('%%m', %s) AS INTEGER)", s.C(article.FieldCreatedAt))
			case "mysql":
				// MySQL 使用 YEAR 和 MONTH 函数
				yearExprStr = fmt.Sprintf("YEAR(%s)", s.C(article.FieldCreatedAt))
				monthExprStr = fmt.Sprintf("MONTH(%s)", s.C(article.FieldCreatedAt))
			default:
				// PostgreSQL 使用 EXTRACT 函数
				yearExprStr = fmt.Sprintf("EXTRACT(YEAR FROM %s)", s.C(article.FieldCreatedAt))
				monthExprStr = fmt.Sprintf("EXTRACT(MONTH FROM %s)", s.C(article.FieldCreatedAt))
			}

			s.Select(
				sql.As(yearExprStr, "year"),
				sql.As(monthExprStr, "month"),
				sql.As(sql.Count(s.C(article.FieldID)), "count"),
			)
			s.GroupBy(yearExprStr, monthExprStr)
			s.OrderBy(sql.Desc("year"), sql.Desc("month"))
		}).
		Scan(ctx, &items)

	if err != nil {
		return nil, fmt.Errorf("查询归档摘要失败: %w", err)
	}
	return items, nil
}

// GetPrevArticle 获取上一篇文章
func (r *articleRepo) GetPrevArticle(ctx context.Context, currentArticleID uint, createdAt time.Time) (*model.Article, error) {
	return r.getAdjacentArticle(ctx, currentArticleID, createdAt, true)
}

// GetNextArticle 获取下一篇文章
func (r *articleRepo) GetNextArticle(ctx context.Context, currentArticleID uint, createdAt time.Time) (*model.Article, error) {
	return r.getAdjacentArticle(ctx, currentArticleID, createdAt, false)
}

// FindRelatedArticles 查找与当前文章相关的文章
func (r *articleRepo) FindRelatedArticles(ctx context.Context, articleModel *model.Article, limit int) ([]*model.Article, error) {
	if len(articleModel.PostTags) == 0 && len(articleModel.PostCategories) == 0 {
		return nil, nil
	}

	currentArticleDbID, _, _ := idgen.DecodePublicID(articleModel.ID)
	tagIDs := make([]uint, len(articleModel.PostTags))
	for i, t := range articleModel.PostTags {
		tagIDs[i], _, _ = idgen.DecodePublicID(t.ID)
	}
	categoryIDs := make([]uint, len(articleModel.PostCategories))
	for i, c := range articleModel.PostCategories {
		categoryIDs[i], _, _ = idgen.DecodePublicID(c.ID)
	}

	var relationPredicate predicate.Article
	if len(tagIDs) > 0 {
		relationPredicate = article.HasPostTagsWith(posttag.IDIn(tagIDs...))
	}
	if len(categoryIDs) > 0 {
		catPredicate := article.HasPostCategoriesWith(postcategory.IDIn(categoryIDs...))
		if relationPredicate != nil {
			relationPredicate = article.Or(relationPredicate, catPredicate)
		} else {
			relationPredicate = catPredicate
		}
	}

	entities, err := r.db.Article.Query().
		Where(
			article.IDNEQ(currentArticleDbID),
			article.StatusEQ(article.StatusPUBLISHED),
			article.DeletedAtIsNil(),
			relationPredicate,
		).
		WithPostTags().
		WithPostCategories().
		Order(ent.Desc(article.FieldCreatedAt)).
		Limit(limit).
		All(ctx)
	if err != nil {
		return nil, err
	}
	return r.toModelSlice(entities), nil
}

// GetBySlugOrID 通过 abbrlink 或公共 ID 获取一篇文章
func (r *articleRepo) GetBySlugOrID(ctx context.Context, slugOrID string) (*model.Article, error) {
	log.Printf("[GetBySlugOrID] 开始查询文章: slugOrID=%s", slugOrID)

	// 尝试将 slugOrID 解码为数据库 ID
	dbID, _, err := idgen.DecodePublicID(slugOrID)

	var wherePredicate predicate.Article
	if err == nil {
		// 如果解码成功，则查询条件为 ID 或 abbrlink 匹配
		log.Printf("[GetBySlugOrID] 解码成功，使用ID或abbrlink查询: dbID=%d", dbID)
		wherePredicate = article.Or(article.ID(dbID), article.AbbrlinkEQ(slugOrID))
	} else {
		// 如果解码失败，则查询条件仅为 abbrlink 匹配
		log.Printf("[GetBySlugOrID] 解码失败，仅使用abbrlink查询: %v", err)
		wherePredicate = article.AbbrlinkEQ(slugOrID)
	}

	entity, err := r.db.Article.Query().
		Where(
			wherePredicate,
			article.DeletedAtIsNil(),
			article.StatusEQ(article.StatusPUBLISHED),
			article.IsTakedownEQ(false), // 过滤下架文章
			// 只显示审核通过或无需审核的文章
			article.Or(
				article.ReviewStatusEQ(article.ReviewStatusAPPROVED),
				article.ReviewStatusEQ(article.ReviewStatusNONE),
			),
		).
		WithPostTags().
		WithPostCategories().
		Only(ctx)

	if err != nil {
		log.Printf("[GetBySlugOrID] 查询失败: %v", err)
		return nil, err
	}

	log.Printf("[GetBySlugOrID] 查询成功: 数据库ID=%d, Title=%s", entity.ID, entity.Title)
	result := r.toModel(entity)
	log.Printf("[GetBySlugOrID] 转换后的公共ID: %s", result.ID)
	return result, nil
}

// GetBySlugOrIDForPreview 通过 abbrlink 或公共 ID 获取一篇文章，不过滤状态，用于预览功能
func (r *articleRepo) GetBySlugOrIDForPreview(ctx context.Context, slugOrID string) (*model.Article, error) {
	log.Printf("[GetBySlugOrIDForPreview] 开始查询文章(预览模式): slugOrID=%s", slugOrID)

	// 尝试将 slugOrID 解码为数据库 ID
	dbID, _, err := idgen.DecodePublicID(slugOrID)

	var wherePredicate predicate.Article
	if err == nil {
		// 如果解码成功，则查询条件为 ID 或 abbrlink 匹配
		log.Printf("[GetBySlugOrIDForPreview] 解码成功，使用ID或abbrlink查询: dbID=%d", dbID)
		wherePredicate = article.Or(article.ID(dbID), article.AbbrlinkEQ(slugOrID))
	} else {
		// 如果解码失败，则查询条件仅为 abbrlink 匹配
		log.Printf("[GetBySlugOrIDForPreview] 解码失败，仅使用abbrlink查询: %v", err)
		wherePredicate = article.AbbrlinkEQ(slugOrID)
	}

	// 预览模式：不过滤文章状态，只过滤已删除的文章
	entity, err := r.db.Article.Query().
		Where(
			wherePredicate,
			article.DeletedAtIsNil(),
		).
		WithPostTags().
		WithPostCategories().
		Only(ctx)

	if err != nil {
		log.Printf("[GetBySlugOrIDForPreview] 查询失败: %v", err)
		return nil, err
	}

	log.Printf("[GetBySlugOrIDForPreview] 查询成功: 数据库ID=%d, Title=%s, Status=%s, ReviewStatus=%s",
		entity.ID, entity.Title, entity.Status, entity.ReviewStatus)
	result := r.toModel(entity)
	log.Printf("[GetBySlugOrIDForPreview] 转换后的公共ID: %s", result.ID)
	return result, nil
}

// GetSiteStats 高效地获取站点范围内的统计数据
func (r *articleRepo) GetSiteStats(ctx context.Context) (*model.SiteStats, error) {
	publishedAndNotDeleted := []predicate.Article{
		article.StatusEQ(article.StatusPUBLISHED),
		article.DeletedAtIsNil(),
	}

	totalPosts, err := r.db.Article.Query().Where(publishedAndNotDeleted...).Count(ctx)
	if err != nil {
		return nil, err
	}

	// 使用 Scan 来更健壮地处理 SUM，即使没有文章也不会报错
	var v []struct {
		Sum int `json:"sum"`
	}
	err = r.db.Article.Query().
		Where(publishedAndNotDeleted...).
		Aggregate(ent.Sum(article.FieldWordCount)).
		Scan(ctx, &v)

	totalWords := 0
	if err == nil && len(v) > 0 {
		totalWords = v[0].Sum
	} else if err != nil {
		return nil, err // 如果 Scan 真的出错了，还是需要返回错误
	}

	return &model.SiteStats{TotalPosts: totalPosts, TotalWords: totalWords}, nil
}

// UpdateViewCounts 批量更新文章的浏览量
func (r *articleRepo) UpdateViewCounts(ctx context.Context, updates map[uint]int) error {
	if len(updates) == 0 {
		return nil
	}
	tx, err := r.db.Tx(ctx)
	if err != nil {
		return fmt.Errorf("开启事务失败: %w", err)
	}
	defer func() {
		if v := recover(); v != nil {
			tx.Rollback()
			panic(v)
		}
	}()
	for id, increment := range updates {
		if err := tx.Article.UpdateOneID(id).AddViewCount(increment).Exec(ctx); err != nil {
			if rberr := tx.Rollback(); rberr != nil {
				return fmt.Errorf("更新文章ID %d 失败后，回滚事务也失败: update_err=%v, rollback_err=%v", id, err, rberr)
			}
			return fmt.Errorf("更新文章ID %d 的浏览量失败: %w", id, err)
		}
	}
	return tx.Commit()
}

// IncrementViewCount 原子地为给定文章的浏览次数加一
func (r *articleRepo) IncrementViewCount(ctx context.Context, publicID string) error {
	dbID, _, err := idgen.DecodePublicID(publicID)
	if err != nil {
		return err
	}
	_, err = r.db.Article.UpdateOneID(dbID).AddViewCount(1).Save(ctx)
	if err != nil {
		log.Printf("[ERROR] IncrementViewCount: 未能更新文章 (DB ID %d) 的浏览次数: %v", dbID, err)
	}
	return err
}

// Create 创建新文章
func (r *articleRepo) Create(ctx context.Context, params *model.CreateArticleParams) (*model.Article, error) {
	log.Printf("[Repository.Create] ========== 开始创建文章 ==========")
	log.Printf("[Repository.Create] 标题: %s", params.Title)
	log.Printf("[Repository.Create] 自定义发布时间 CustomPublishedAt: %v", params.CustomPublishedAt)
	log.Printf("[Repository.Create] 自定义更新时间 CustomUpdatedAt: %v", params.CustomUpdatedAt)

	topImgURL := params.TopImgURL
	if topImgURL == "" {
		topImgURL = params.CoverURL
	}

	// 确保 OwnerID 有默认值
	ownerID := params.OwnerID
	if ownerID == 0 {
		ownerID = 1 // 默认为管理员
	}

	creator := r.db.Article.Create().
		SetTitle(params.Title).
		SetOwnerID(ownerID). // 保存文章作者ID
		SetContentMd(params.ContentMd).
		SetContentHTML(params.ContentHTML).
		SetCoverURL(params.CoverURL).
		AddPostTagIDs(params.PostTagIDs...).
		AddPostCategoryIDs(params.PostCategoryIDs...).
		SetWordCount(params.WordCount).
		SetReadingTime(params.ReadingTime).
		SetIPLocation(params.IPLocation).
		SetPrimaryColor(params.PrimaryColor).
		SetIsPrimaryColorManual(params.IsPrimaryColorManual).
		SetShowOnHome(params.ShowOnHome).
		SetHomeSort(params.HomeSort).
		SetPinSort(params.PinSort).
		SetTopImgURL(topImgURL).
		SetSummaries(params.Summaries).
		SetCopyright(params.Copyright).
		SetCopyrightAuthor(params.CopyrightAuthor).
		SetCopyrightAuthorHref(params.CopyrightAuthorHref).
		SetCopyrightURL(params.CopyrightURL).
		SetKeywords(params.Keywords)

	if params.Abbrlink != "" {
		creator.SetAbbrlink(params.Abbrlink)
	}

	if params.Status != "" {
		creator.SetStatus(article.Status(params.Status))
	} else {
		creator.SetStatus(article.StatusDRAFT)
	}

	// 设置审核状态（多人共创功能）
	if params.ReviewStatus != "" {
		creator.SetReviewStatus(article.ReviewStatus(params.ReviewStatus))
	}
	// 如果没有设置 ReviewStatus，默认值为 NONE（由 schema 定义）

	// 支持自定义发布时间
	if params.CustomPublishedAt != nil {
		log.Printf("[Repository.Create]设置自定义发布时间: %v", *params.CustomPublishedAt)
		creator.SetCreatedAt(*params.CustomPublishedAt)
	} else {
		log.Printf("[Repository.Create] ⚠️ 未提供自定义发布时间，将使用默认值")
	}

	// 支持自定义更新时间
	if params.CustomUpdatedAt != nil {
		log.Printf("[Repository.Create]设置自定义更新时间: %v", *params.CustomUpdatedAt)
		creator.SetUpdatedAt(*params.CustomUpdatedAt)
	} else {
		log.Printf("[Repository.Create] ⚠️ 未提供自定义更新时间，将使用默认值")
	}

	log.Printf("[Repository.Create] 准备调用 Save() 保存到数据库...")
	newEntity, err := creator.Save(ctx)
	if err != nil {
		log.Printf("[Repository.Create] ❌ 保存失败: %v", err)
		return nil, err
	}

	log.Printf("[Repository.Create]保存成功，数据库ID: %d", newEntity.ID)
	log.Printf("[Repository.Create] 数据库中的 CreatedAt: %v", newEntity.CreatedAt)
	log.Printf("[Repository.Create] 数据库中的 UpdatedAt: %v", newEntity.UpdatedAt)

	publicID, _ := idgen.GeneratePublicID(newEntity.ID, idgen.EntityTypeArticle)
	return r.GetByID(ctx, publicID)
}

// Update 更新文章
func (r *articleRepo) Update(ctx context.Context, publicID string, req *model.UpdateArticleRequest, computed *model.UpdateArticleComputedParams) (*model.Article, error) {
	log.Printf("[Repository.Update] ========== 开始更新文章 ==========")
	log.Printf("[Repository.Update] 公共ID: %s", publicID)
	log.Printf("[Repository.Update] 自定义发布时间 CustomPublishedAt: %v", req.CustomPublishedAt)
	if req.CustomPublishedAt != nil {
		log.Printf("[Repository.Update] 自定义发布时间的值: %s", *req.CustomPublishedAt)
	}
	log.Printf("[Repository.Update] 自定义更新时间 CustomUpdatedAt: %v", req.CustomUpdatedAt)
	if req.CustomUpdatedAt != nil {
		log.Printf("[Repository.Update] 自定义更新时间的值: %s", *req.CustomUpdatedAt)
	}

	dbID, _, err := idgen.DecodePublicID(publicID)
	if err != nil {
		return nil, err
	}
	log.Printf("[Repository.Update] 数据库ID: %d", dbID)
	updater := r.db.Article.UpdateOneID(dbID)
	if req.Title != nil {
		updater.SetTitle(*req.Title)
	}
	if req.ContentMd != nil {
		updater.SetContentMd(*req.ContentMd)
	}
	if req.CoverURL != nil {
		updater.SetCoverURL(*req.CoverURL)
	}
	if req.Status != nil {
		updater.SetStatus(article.Status(*req.Status))
	}
	if req.PostTagIDs != nil {
		tagDBIDs, err := idgen.DecodePublicIDBatch(req.PostTagIDs)
		if err != nil {
			return nil, err
		}
		updater.ClearPostTags().AddPostTagIDs(tagDBIDs...)
	}
	if req.PostCategoryIDs != nil {
		categoryDBIDs, err := idgen.DecodePublicIDBatch(req.PostCategoryIDs)
		if err != nil {
			return nil, err
		}
		updater.ClearPostCategories().AddPostCategoryIDs(categoryDBIDs...)
	}
	if req.IPLocation != nil {
		updater.SetIPLocation(*req.IPLocation)
	}
	if req.ShowOnHome != nil {
		updater.SetShowOnHome(*req.ShowOnHome)
	}
	if req.HomeSort != nil {
		updater.SetHomeSort(*req.HomeSort)
	}
	if req.PinSort != nil {
		updater.SetPinSort(*req.PinSort)
	}
	if req.Summaries != nil {
		updater.SetSummaries(req.Summaries)
	}
	if req.TopImgURL != nil {
		updater.SetTopImgURL(*req.TopImgURL)
	} else if req.CoverURL != nil {
		// fallback to cover_url if top_img_url is explicitly set to nil but cover_url is provided
		updater.SetTopImgURL(*req.CoverURL)
	}
	if req.Abbrlink != nil {
		if *req.Abbrlink == "" {
			updater.ClearAbbrlink()
		} else {
			updater.SetAbbrlink(*req.Abbrlink)
		}
	}
	if req.Copyright != nil {
		updater.SetCopyright(*req.Copyright)
	}
	if req.CopyrightAuthor != nil {
		updater.SetCopyrightAuthor(*req.CopyrightAuthor)
	}
	if req.CopyrightAuthorHref != nil {
		updater.SetCopyrightAuthorHref(*req.CopyrightAuthorHref)
	}
	if req.CopyrightURL != nil {
		updater.SetCopyrightURL(*req.CopyrightURL)
	}
	if req.Keywords != nil {
		updater.SetKeywords(*req.Keywords)
	}
	if req.ReviewStatus != nil {
		updater.SetReviewStatus(article.ReviewStatus(*req.ReviewStatus))
	}
	if computed != nil {
		if computed.WordCount > 0 || (req.ContentMd != nil && *req.ContentMd == "") {
			updater.SetWordCount(computed.WordCount)
			updater.SetReadingTime(computed.ReadingTime)
			updater.SetContentHTML(computed.ContentHTML)
		}
		if computed.PrimaryColor != nil {
			updater.SetPrimaryColor(*computed.PrimaryColor)
		}
		if computed.IsPrimaryColorManual != nil {
			updater.SetIsPrimaryColorManual(*computed.IsPrimaryColorManual)
		}
	}
	// 处理发布时间（创建时间）：优先使用自定义时间
	log.Printf("[Repository.Update] 开始处理发布时间...")
	if req.CustomPublishedAt != nil && *req.CustomPublishedAt != "" {
		log.Printf("[Repository.Update] 收到自定义发布时间字符串: %s", *req.CustomPublishedAt)
		if customTime, parseErr := time.Parse(time.RFC3339, *req.CustomPublishedAt); parseErr == nil {
			log.Printf("[Repository.Update]解析成功，设置自定义发布时间: %v", customTime)
			updater.SetCreatedAt(customTime)
		} else {
			log.Printf("[Repository.Update] ❌ 解析自定义发布时间失败: %v", parseErr)
		}
	} else {
		log.Printf("[Repository.Update] ⚠️ 未提供自定义发布时间，保持原值")
	}

	// 处理更新时间：优先使用自定义时间，否则使用当前时间
	log.Printf("[Repository.Update] 开始处理更新时间...")
	if req.CustomUpdatedAt != nil && *req.CustomUpdatedAt != "" {
		log.Printf("[Repository.Update] 收到自定义更新时间字符串: %s", *req.CustomUpdatedAt)
		if customTime, parseErr := time.Parse(time.RFC3339, *req.CustomUpdatedAt); parseErr == nil {
			log.Printf("[Repository.Update]解析成功，设置自定义更新时间: %v", customTime)
			updater.SetUpdatedAt(customTime)
		} else {
			log.Printf("[Repository.Update] ❌ 解析失败，使用当前时间。错误: %v", parseErr)
			updater.SetUpdatedAt(time.Now())
		}
	} else {
		log.Printf("[Repository.Update] ⚠️ 未提供自定义更新时间，使用当前时间")
		updater.SetUpdatedAt(time.Now())
	}

	log.Printf("[Repository.Update] 准备调用 Save() 保存到数据库...")
	updatedEntity, err := updater.Save(ctx)
	if err != nil {
		log.Printf("[Repository.Update] ❌ 保存失败: %v", err)
		return nil, err
	}

	log.Printf("[Repository.Update]保存成功")
	log.Printf("[Repository.Update] 数据库中的 CreatedAt: %v", updatedEntity.CreatedAt)
	log.Printf("[Repository.Update] 数据库中的 UpdatedAt: %v", updatedEntity.UpdatedAt)

	return r.GetByID(ctx, publicID)
}

// ListPublic 获取公开的文章列表
func (r *articleRepo) ListPublic(ctx context.Context, options *model.ListPublicArticlesOptions) ([]*model.Article, int, error) {
	// 基础查询条件：已发布、未删除、未下架、且审核通过（或无需审核）
	baseQuery := r.db.Article.Query().Where(
		article.StatusEQ(article.StatusPUBLISHED),
		article.DeletedAtIsNil(),
		article.IsTakedownEQ(false), // 过滤下架文章
		// 只显示审核通过或无需审核的文章
		article.Or(
			article.ReviewStatusEQ(article.ReviewStatusAPPROVED),
			article.ReviewStatusEQ(article.ReviewStatusNONE),
		),
	)

	// 只在普通列表（没有指定分类、标签、年份、月份）时应用 show_on_home 过滤
	// 分类页、标签页、归档页应该显示所有文章
	isFilteredView := options.CategoryName != "" || options.TagName != "" || options.Year > 0 || options.Month > 0
	if !isFilteredView {
		baseQuery = baseQuery.Where(article.ShowOnHomeEQ(true))
	}

	if options.CategoryName != "" {
		baseQuery = baseQuery.Where(article.HasPostCategoriesWith(postcategory.NameEQ(options.CategoryName)))
	}
	if options.TagName != "" {
		baseQuery = baseQuery.Where(article.HasPostTagsWith(posttag.NameEQ(options.TagName)))
	}

	applyDateFilter := func(s *sql.Selector) {
		if options.Year > 0 {
			s.Where(sql.ExprP(fmt.Sprintf("EXTRACT(YEAR FROM %s) = %d", s.C(article.FieldCreatedAt), options.Year)))
		}
		if options.Month > 0 {
			s.Where(sql.ExprP(fmt.Sprintf("EXTRACT(MONTH FROM %s) = %d", s.C(article.FieldCreatedAt), options.Month)))
		}
	}

	countQuery := baseQuery.Clone().Modify(applyDateFilter)
	total, err := countQuery.Count(ctx)
	if err != nil {
		return nil, 0, err
	}

	mainQuery := baseQuery.Clone().Modify(applyDateFilter)

	q := mainQuery.
		Order(
			ent.Desc(article.FieldPinSort),
			ent.Desc(article.FieldCreatedAt),
		).
		WithPostTags().
		WithPostCategories()

	if options.Page > 0 && options.PageSize > 0 {
		q = q.Offset((options.Page - 1) * options.PageSize).Limit(options.PageSize)
	}

	entities, err := q.Select(
		article.FieldID, article.FieldCreatedAt, article.FieldUpdatedAt,
		article.FieldTitle, article.FieldCoverURL, article.FieldStatus,
		article.FieldViewCount, article.FieldWordCount, article.FieldReadingTime,
		article.FieldIPLocation, article.FieldPrimaryColor, article.FieldIsPrimaryColorManual,
		article.FieldShowOnHome, article.FieldHomeSort, article.FieldPinSort, article.FieldTopImgURL,
		article.FieldSummaries, article.FieldAbbrlink, article.FieldCopyright,
		article.FieldCopyrightAuthor, article.FieldCopyrightAuthorHref, article.FieldCopyrightURL,
	).All(ctx)

	if err != nil {
		return nil, 0, err
	}
	return r.toModelSlice(entities), total, nil
}

// List 获取后台管理文章列表
func (r *articleRepo) List(ctx context.Context, options *model.ListArticlesOptions) ([]*model.Article, int, error) {
	query := r.db.Article.Query().Where(article.DeletedAtIsNil())
	if options.Query != "" {
		query = query.Where(article.TitleContains(options.Query))
	}
	if options.Status != "" {
		query = query.Where(article.StatusEQ(article.Status(options.Status)))
	}
	// 按作者ID过滤（多人共创功能：普通用户只能查看自己的文章）
	if options.AuthorID != nil {
		query = query.Where(article.OwnerIDEQ(*options.AuthorID))
	}
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, err
	}

	q := query.Order(ent.Desc(article.FieldCreatedAt)).
		WithPostTags().
		WithPostCategories()

	if options.Page > 0 && options.PageSize > 0 {
		q = q.Offset((options.Page - 1) * options.PageSize).Limit(options.PageSize)
	}

	var entities []*ent.Article
	if !options.WithContent {
		entities, err = q.Select(
			article.FieldID, article.FieldCreatedAt, article.FieldUpdatedAt,
			article.FieldTitle, article.FieldCoverURL, article.FieldStatus,
			article.FieldViewCount, article.FieldWordCount, article.FieldReadingTime,
			article.FieldIPLocation, article.FieldPrimaryColor, article.FieldIsPrimaryColorManual,
			article.FieldShowOnHome, article.FieldHomeSort, article.FieldPinSort, article.FieldTopImgURL,
			article.FieldSummaries, article.FieldAbbrlink, article.FieldCopyright,
			article.FieldCopyrightAuthor, article.FieldCopyrightAuthorHref, article.FieldCopyrightURL,
			article.FieldReviewStatus,   // 审核状态（多人共创功能）
			article.FieldOwnerID,        // 发布者ID（多人共创功能）
			article.FieldIsTakedown,     // 下架状态（PRO版管理员功能）
			article.FieldTakedownReason, // 下架原因
			article.FieldTakedownAt,     // 下架时间
			article.FieldTakedownBy,     // 下架操作人
		).All(ctx)
	} else {
		entities, err = q.All(ctx)
	}

	if err != nil {
		return nil, 0, err
	}
	return r.toModelSlice(entities), total, nil
}

// ListHome 获取首页推荐文章
func (r *articleRepo) ListHome(ctx context.Context) ([]*model.Article, error) {
	entities, err := r.db.Article.Query().
		Where(
			article.ShowOnHomeEQ(true),
			article.HomeSortGT(0),
			article.StatusEQ(article.StatusPUBLISHED),
			article.DeletedAtIsNil(),
			article.IsTakedownEQ(false), // 过滤下架文章
			// 只显示审核通过或无需审核的文章
			article.Or(
				article.ReviewStatusEQ(article.ReviewStatusAPPROVED),
				article.ReviewStatusEQ(article.ReviewStatusNONE),
			),
		).
		Order(ent.Asc(article.FieldHomeSort)).
		Limit(6).
		WithPostTags().
		WithPostCategories().
		All(ctx)
	if err != nil {
		return nil, err
	}
	return r.toModelSlice(entities), nil
}

// GetByID 根据公共ID获取单个文章
func (r *articleRepo) GetByID(ctx context.Context, publicID string) (*model.Article, error) {
	dbID, _, err := idgen.DecodePublicID(publicID)
	if err != nil {
		return nil, err
	}
	entity, err := r.db.Article.Query().
		Where(article.ID(dbID), article.DeletedAtIsNil()).
		WithPostTags().
		WithPostCategories().
		Only(ctx)
	if err != nil {
		return nil, err
	}
	return r.toModel(entity), nil
}

// GetRandom 获取一篇随机文章
func (r *articleRepo) GetRandom(ctx context.Context) (*model.Article, error) {
	ids, err := r.db.Article.Query().
		Where(
			article.StatusEQ(article.StatusPUBLISHED),
			article.DeletedAtIsNil(),
			article.IsTakedownEQ(false), // 过滤下架文章
		).
		IDs(ctx)
	if err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return nil, constant.ErrNotFound
	}
	source := rand.NewSource(time.Now().UnixNano())
	random := rand.New(source)
	randomID := ids[random.Intn(len(ids))]

	fullArticle, err := r.db.Article.Query().
		Where(article.ID(randomID)).
		WithPostTags().
		WithPostCategories().
		Only(ctx)
	if err != nil {
		return nil, err
	}
	return r.toModel(fullArticle), nil
}

// Delete 软删除文章
func (r *articleRepo) Delete(ctx context.Context, publicID string) error {
	dbID, _, err := idgen.DecodePublicID(publicID)
	if err != nil {
		return err
	}
	return r.db.Article.DeleteOneID(dbID).Exec(ctx)
}
