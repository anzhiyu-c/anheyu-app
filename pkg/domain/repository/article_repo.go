/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-25 10:48:41
 * @LastEditTime: 2025-08-28 13:34:08
 * @LastEditors: 安知鱼
 */
package repository

import (
	"context"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// ArticleRepository 定义了文章数据仓库的接口。
// 它是数据持久化层的抽象，所有方法都使用领域模型和自定义参数，与具体的 ORM (Ent) 解耦。
type ArticleRepository interface {
	// FindByID 根据数据库的 uint ID 获取单个文章。
	FindByID(ctx context.Context, id uint) (*model.Article, error)

	// Create 方法接收一个包含所有必需数据的参数对象，返回创建后的文章领域模型。
	Create(ctx context.Context, params *model.CreateArticleParams) (*model.Article, error)

	// GetByID 根据公共ID获取单个文章的完整信息（包括关联数据）。
	GetByID(ctx context.Context, publicID string) (*model.Article, error)

	// Update 方法接收文章的公共ID、用于更新的DTO，以及可选的重新计算的衍生数据。
	Update(
		ctx context.Context,
		publicID string,
		req *model.UpdateArticleRequest,
		computed *model.UpdateArticleComputedParams,
	) (*model.Article, error)

	// Delete 方法根据公共ID软删除一篇文章。
	Delete(ctx context.Context, publicID string) error

	// List 方法根据提供的选项，分页查询文章列表。
	List(ctx context.Context, options *model.ListArticlesOptions) ([]*model.Article, int, error)

	// GetRandom 获取一篇随机文章 (用于“随便逛逛”功能)。
	GetRandom(ctx context.Context) (*model.Article, error)

	// ListHome 获取首页推荐文章列表。
	ListHome(ctx context.Context) ([]*model.Article, error)

	// ListPublic 根据选项获取公开的文章列表，通常用于前端展示。
	ListPublic(ctx context.Context, options *model.ListPublicArticlesOptions) ([]*model.Article, int, error)

	// GetSiteStats 获取站点统计信息，如文章总数、总字数等。
	GetSiteStats(ctx context.Context) (*model.SiteStats, error)

	// IncrementViewCount 增加文章的查看次数。
	IncrementViewCount(ctx context.Context, publicID string) error

	// UpdateViewCounts 批量更新文章的浏览量。
	UpdateViewCounts(ctx context.Context, updates map[uint]int) error

	// GetBySlugOrID 根据文章的 slug 或 ID 获取文章详情。
	GetBySlugOrID(ctx context.Context, slugOrID string) (*model.Article, error)

	// GetBySlugOrIDForPreview 根据文章的 slug 或 ID 获取文章详情，不过滤文章状态，用于预览功能。
	GetBySlugOrIDForPreview(ctx context.Context, slugOrID string) (*model.Article, error)

	// GetPrevArticle 获取上一篇文章，基于当前文章的ID和创建时间。
	GetPrevArticle(ctx context.Context, currentArticleID uint, createdAt time.Time) (*model.Article, error)

	// GetNextArticle 获取下一篇文章，基于当前文章的ID和创建时间。
	GetNextArticle(ctx context.Context, currentArticleID uint, createdAt time.Time) (*model.Article, error)

	// FindRelatedArticles 查找与当前文章相关的文章，基于标签/分类。
	FindRelatedArticles(ctx context.Context, article *model.Article, limit int) ([]*model.Article, error)

	// GetArchiveSummary 获取文章归档摘要
	GetArchiveSummary(ctx context.Context) ([]*model.ArchiveItem, error)

	// CountByCategoryWithMultipleCategories 计算有多少文章既属于目标分类，又同时属于其他分类。
	CountByCategoryWithMultipleCategories(ctx context.Context, categoryID uint) (int, error)
}
