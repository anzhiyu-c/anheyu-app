package server

import (
	"context"
	"fmt"
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/app/middleware"
	"github.com/anzhiyu-c/anheyu-app/internal/frontend"
	cache_service "github.com/anzhiyu-c/anheyu-app/internal/service/cache"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	cache_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/cache"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/image_style"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/search"
	"github.com/gin-gonic/gin"
)

// CacheIndexProjection lets a host remove protected fields before a manual rebuild.
// Every projection runs before the existing index is cleared; errors abort the operation.
type CacheIndexProjection func(context.Context, *model.Article) (*model.Article, error)

func registerCacheManagementRoutes(engine *gin.Engine, mw *middleware.Middleware, handler *cache_handler.Handler) {
	admin := engine.Group("/api/admin/cache", mw.JWTAuth(), mw.AdminAuth())
	admin.GET("/status", handler.GetStatus)
	admin.POST("/revalidate", handler.Revalidate)
	admin.POST("/manage", handler.Manage)
}

func newCacheManagement(revalidate *cache_service.RevalidateService, images *image_style.DiskCache, articles repository.ArticleRepository, project CacheIndexProjection) *cache_handler.Handler {
	handler := cache_handler.NewHandler(revalidate)
	handler.Configure(func(ctx context.Context) map[string]any {
		pageEnabled, pageCount := frontend.PageCacheStatus()
		indexEnabled := search.AppSearcher != nil
		indexHealthy := false
		if indexEnabled {
			checkCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
			indexHealthy = search.AppSearcher.HealthCheck(checkCtx) == nil
			cancel()
		}
		imageState := map[string]any{"available": images != nil}
		if images != nil {
			if stats, err := images.Stats(ctx, 0); err == nil {
				imageState["stats"] = stats
			} else {
				imageState["error"] = "无法读取缓存统计"
			}
		}
		return map[string]any{
			"page":             map[string]any{"available": pageEnabled, "entries": pageCount},
			"index":            map[string]any{"available": indexEnabled, "healthy": indexHealthy},
			"image":            imageState,
			"ssr":              map[string]any{"available": revalidate.IsEnabled()},
			"runtime_settings": []string{},
		}
	}, map[string]func(context.Context) error{
		"page": func(ctx context.Context) error {
			if enabled, _ := frontend.PageCacheStatus(); !enabled {
				return fmt.Errorf("当前未使用页面内存缓存")
			}
			frontend.ClearPageCache()
			return nil
		},
		"image": func(ctx context.Context) error {
			if images == nil {
				return fmt.Errorf("图片派生缓存不可用")
			}
			_, err := images.Purge(ctx, image_style.PurgeOpts{})
			return err
		},
		"index": func(ctx context.Context) error {
			indexer := search.AppSearcher
			if indexer == nil {
				return fmt.Errorf("搜索索引不可用")
			}
			// Read all source batches before clearing the derived index. Database failures
			// must not erase an otherwise usable index.
			var source []*model.Article
			for page := 1; ; page++ {
				batch, _, err := articles.List(ctx, &model.ListArticlesOptions{Status: "PUBLISHED", WithContent: true, Page: page, PageSize: 200})
				if err != nil {
					return err
				}
				for _, article := range batch {
					// Match the repository's publicArticlePredicates without the homepage
					// visibility filter: public documents also belong in search.
					if article != nil && article.Status == "PUBLISHED" && !article.IsTakedown &&
						(article.ReviewStatus == "NONE" || article.ReviewStatus == "APPROVED") {
						projected := article
						if project != nil {
							projected, err = project(ctx, article)
							if err != nil {
								return fmt.Errorf("校验文章搜索权限失败: %w", err)
							}
						}
						if projected != nil {
							source = append(source, projected)
						}
					}
				}
				if len(batch) < 200 {
					break
				}
			}
			if err := ctx.Err(); err != nil {
				return err
			}
			if err := indexer.ClearAllDocuments(ctx); err != nil {
				return err
			}
			for _, article := range source {
				if err := indexer.IndexArticle(ctx, article); err != nil {
					return err
				}
			}
			return nil
		},
	})
	return handler
}
