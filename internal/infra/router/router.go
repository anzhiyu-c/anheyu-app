/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-15 11:30:55
 * @LastEditTime: 2026-02-27 18:26:36
 * @LastEditors: 安知鱼
 */
// anheyu-app/pkg/router/router.go
package router

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/anzhiyu-c/anheyu-app/internal/app/middleware"
	album_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/album"
	album_category_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/album_category"
	article_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/article"
	article_history_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/article_history"
	auth_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/auth"
	captcha_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/captcha"
	comment_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/comment"
	config_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/config"
	direct_link_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/direct_link"
	doc_series_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/doc_series"
	file_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/file"
	image_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/image"
	link_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/link"
	music_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/music"
	notification_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/notification"
	page_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/page"
	post_category_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/post_category"
	post_tag_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/post_tag"
	proxy_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/proxy"
	public_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/public"
	rss_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/rss"
	search_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/search"
	setting_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/setting"
	sitemap_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/sitemap"
	ssrtheme_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/ssrtheme"
	statistics_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/statistics"
	storage_policy_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/storage_policy"
	subscriber_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/subscriber"
	theme_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/theme"
	thumbnail_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/thumbnail"
	user_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/user"
	version_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/version"
)

// NoCacheMiddleware 默认 API 防缓存中间件。
// 注意：该中间件给所有 /api/* 加 no-store，但部分公开 GET（文章列表、站点配置、
// 友链等）原本是可以让 CDN 与浏览器短期缓存的；此处保留默认 no-store 以保证
// 老接口的回滚安全，公开可缓存接口请用 PublicCacheMiddleware 在子路由组覆盖。
func NoCacheMiddleware() gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		c.Header("Cache-Control", "no-cache, no-store, must-revalidate, private, max-age=0")
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "0")
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Next()
	})
}

// PublicCacheMiddleware 把上游 NoCacheMiddleware 设置的 no-store 覆盖为公开短缓存。
//
//	maxAge: 浏览器/CDN 缓存秒数；handler 仍可在内部用 c.Header("Cache-Control", ...) 进一步覆盖。
//
// 仅对 GET/HEAD 生效；非幂等方法保持 no-store 防止误缓存写操作。
// 同时清理 Pragma/Expires 防止与 Cache-Control 冲突；并补 Vary: Accept-Encoding,Authorization
// 让带认证的请求与匿名请求落到不同 CDN entry。
func PublicCacheMiddleware(maxAge int) gin.HandlerFunc {
	cacheValue := fmt.Sprintf("public, max-age=%d, stale-while-revalidate=10", maxAge)
	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodGet, http.MethodHead:
			c.Header("Cache-Control", cacheValue)
			c.Header("Vary", "Accept-Encoding, Authorization")
			c.Writer.Header().Del("Pragma")
			c.Writer.Header().Del("Expires")
		}
		c.Next()
	}
}

// Router 封装了应用的所有路由和其依赖的处理器。
type Router struct {
	authHandler               *auth_handler.AuthHandler
	albumHandler              *album_handler.AlbumHandler
	albumCategoryHandler      *album_category_handler.Handler
	userHandler               *user_handler.UserHandler
	publicHandler             *public_handler.PublicHandler
	settingHandler            *setting_handler.SettingHandler
	storagePolicyHandler      *storage_policy_handler.StoragePolicyHandler
	fileHandler               *file_handler.FileHandler
	directLinkHandler         *direct_link_handler.DirectLinkHandler
	thumbnailHandler          *thumbnail_handler.ThumbnailHandler
	articleHandler            *article_handler.Handler
	articleHistoryHandler     *article_history_handler.Handler
	postTagHandler            *post_tag_handler.Handler
	postCategoryHandler       *post_category_handler.Handler
	docSeriesHandler          *doc_series_handler.Handler
	commentHandler            *comment_handler.Handler
	linkHandler               *link_handler.Handler
	musicHandler              *music_handler.MusicHandler
	pageHandler               *page_handler.Handler
	statisticsHandler         *statistics_handler.StatisticsHandler
	themeHandler              *theme_handler.Handler
	ssrThemeHandler           *ssrtheme_handler.Handler
	mw                        *middleware.Middleware
	searchHandler             *search_handler.Handler
	proxyHandler              *proxy_handler.ProxyHandler
	sitemapHandler            *sitemap_handler.Handler
	rssHandler                *rss_handler.Handler
	versionHandler            *version_handler.Handler
	notificationHandler       *notification_handler.Handler
	configBackupHandler       *config_handler.ConfigBackupHandler
	configImportExportHandler *config_handler.ConfigImportExportHandler
	subscriberHandler         *subscriber_handler.Handler
	captchaHandler            *captcha_handler.Handler
	imageHandler              *image_handler.Handler
}

// NewRouter 是 Router 的构造函数，通过依赖注入接收所有处理器。
func NewRouter(
	authHandler *auth_handler.AuthHandler,
	albumHandler *album_handler.AlbumHandler,
	albumCategoryHandler *album_category_handler.Handler,
	userHandler *user_handler.UserHandler,
	publicHandler *public_handler.PublicHandler,
	settingHandler *setting_handler.SettingHandler,
	storagePolicyHandler *storage_policy_handler.StoragePolicyHandler,
	fileHandler *file_handler.FileHandler,
	directLinkHandler *direct_link_handler.DirectLinkHandler,
	thumbnailHandler *thumbnail_handler.ThumbnailHandler,
	articleHandler *article_handler.Handler,
	articleHistoryHandler *article_history_handler.Handler,
	postTagHandler *post_tag_handler.Handler,
	postCategoryHandler *post_category_handler.Handler,
	docSeriesHandler *doc_series_handler.Handler,
	commentHandler *comment_handler.Handler,
	linkHandler *link_handler.Handler,
	musicHandler *music_handler.MusicHandler,
	pageHandler *page_handler.Handler,
	statisticsHandler *statistics_handler.StatisticsHandler,
	themeHandler *theme_handler.Handler,
	ssrThemeHandler *ssrtheme_handler.Handler,
	mw *middleware.Middleware,
	searchHandler *search_handler.Handler,
	proxyHandler *proxy_handler.ProxyHandler,
	sitemapHandler *sitemap_handler.Handler,
	rssHandler *rss_handler.Handler,
	versionHandler *version_handler.Handler,
	notificationHandler *notification_handler.Handler,
	configBackupHandler *config_handler.ConfigBackupHandler,
	configImportExportHandler *config_handler.ConfigImportExportHandler,
	subscriberHandler *subscriber_handler.Handler,
	captchaHandler *captcha_handler.Handler,
	imageHandler *image_handler.Handler,
) *Router {
	return &Router{
		authHandler:               authHandler,
		albumHandler:              albumHandler,
		albumCategoryHandler:      albumCategoryHandler,
		userHandler:               userHandler,
		publicHandler:             publicHandler,
		settingHandler:            settingHandler,
		storagePolicyHandler:      storagePolicyHandler,
		fileHandler:               fileHandler,
		directLinkHandler:         directLinkHandler,
		thumbnailHandler:          thumbnailHandler,
		articleHandler:            articleHandler,
		articleHistoryHandler:     articleHistoryHandler,
		postTagHandler:            postTagHandler,
		postCategoryHandler:       postCategoryHandler,
		docSeriesHandler:          docSeriesHandler,
		commentHandler:            commentHandler,
		linkHandler:               linkHandler,
		musicHandler:              musicHandler,
		pageHandler:               pageHandler,
		statisticsHandler:         statisticsHandler,
		themeHandler:              themeHandler,
		ssrThemeHandler:           ssrThemeHandler,
		mw:                        mw,
		searchHandler:             searchHandler,
		proxyHandler:              proxyHandler,
		sitemapHandler:            sitemapHandler,
		rssHandler:                rssHandler,
		versionHandler:            versionHandler,
		notificationHandler:       notificationHandler,
		configBackupHandler:       configBackupHandler,
		configImportExportHandler: configImportExportHandler,
		subscriberHandler:         subscriberHandler,
		captchaHandler:            captchaHandler,
		imageHandler:              imageHandler,
	}
}

// Setup 将所有路由注册到 Gin 引擎。
// 这是在 main.go 中将被调用的唯一入口点。
func (r *Router) Setup(engine *gin.Engine) {
	// 创建 /api 分组
	apiGroup := engine.Group("/api")
	// 应用全局反缓存中间件
	apiGroup.Use(NoCacheMiddleware())

	// 文件下载
	apiGroup.GET("/f/:publicID/*filename", r.directLinkHandler.HandleDirectDownload)

	// 获取缩略图
	apiGroup.GET("/t/:signedToken", r.thumbnailHandler.HandleThumbnailContent)

	// 需要被缓存的路由不在/api 下
	downloadGroup := engine.Group("/needcache")
	{
		downloadGroup.GET("/download/:public_id", r.fileHandler.HandleUniversalSignedDownload)
	}

	// 代理路由（每个IP每分钟30次请求，突发允许10次）
	apiGroup.GET("/proxy/download", middleware.CustomRateLimit(30, 10), r.proxyHandler.HandleDownload)

	// 注册各个模块的路由
	r.registerAuthRoutes(apiGroup)
	r.registerAlbumRoutes(apiGroup)
	r.registerAlbumCategoryRoutes(apiGroup)
	r.registerUserRoutes(apiGroup)
	r.registerPublicRoutes(apiGroup)
	r.registerSettingRoutes(apiGroup)
	r.registerStoragePolicyRoutes(apiGroup)
	r.registerFileRoutes(apiGroup)
	r.registerDirectLinkRoutes(apiGroup)
	r.registerThumbnailRoutes(apiGroup)
	r.registerArticleRoutes(apiGroup)
	r.registerPostTagRoutes(apiGroup)
	r.registerPostCategoryRoutes(apiGroup)
	r.registerDocSeriesRoutes(apiGroup)
	r.registerCommentRoutes(apiGroup)
	r.registerPageRoutes(apiGroup)
	r.registerSearchRoutes(apiGroup)
	r.registerLinkRoutes(apiGroup)
	r.registerMusicRoutes(apiGroup)
	r.registerStatisticsRoutes(apiGroup)
	r.registerThemeRoutes(apiGroup)
	r.registerVersionRoutes(apiGroup)
	r.registerNotificationRoutes(apiGroup)
	r.registerConfigBackupRoutes(apiGroup)
	r.registerSitemapRoutes(engine)     // 直接注册到engine，不使用/api前缀
	r.registerRSSRoutes(engine)         // RSS/atom/feed 始终注册，与 SkipFrontend 无关
	r.registerSSRThemeRoutes(apiGroup)  // 注册 SSR 主题管理路由
	r.registerImageStyleRoutes(apiGroup)
}

// registerImageStyleRoutes 注册图片样式处理入口：
//
//	GET /api/image/*pathWithStyle
//	例如 /api/image/{publicID}!thumbnail 或 /api/image/{publicID}?w=400&h=300
//
// imageHandler == nil 时跳过，不对外暴露该路由。
func (r *Router) registerImageStyleRoutes(api *gin.RouterGroup) {
	if r.imageHandler == nil {
		return
	}
	api.GET("/image/*pathWithStyle", r.imageHandler.ServeStyled)
	log.Println("✅ 图片样式路由已注册: GET /api/image/*pathWithStyle")
}

func (r *Router) registerCommentRoutes(api *gin.RouterGroup) {
	// 公开的评论接口
	commentsPublic := api.Group("/public/comments")
	{
		commentsPublic.GET("", r.commentHandler.ListByPath)

		commentsPublic.GET("/latest", r.commentHandler.ListLatest)

		commentsPublic.GET("/:id/children", r.commentHandler.ListChildren)

		commentsPublic.GET("/qq-info", r.commentHandler.GetQQInfo)         // 获取QQ昵称和头像
		commentsPublic.GET("/ip-location", r.commentHandler.GetIPLocation) // 获取IP定位信息（用于天气组件）

		commentsPublic.POST("", r.mw.JWTAuthOptional(), r.commentHandler.Create)
		commentsPublic.POST("/upload", r.mw.JWTAuthOptional(), r.commentHandler.UploadCommentImage)
		commentsPublic.POST("/:id/like", r.commentHandler.LikeComment)
		commentsPublic.POST("/:id/unlike", r.commentHandler.UnlikeComment)
	}

	// 天气组件专用路径（与评论 IP 定位共用实现，前端请求 /api/public/weather/ip-location）
	api.Group("/public/weather").GET("/ip-location", r.commentHandler.GetIPLocation)

	// 管理员专属的评论接口
	commentsAdmin := api.Group("/comments").Use(r.mw.JWTAuth(), r.mw.AdminAuth())
	{
		commentsAdmin.GET("", r.commentHandler.AdminList)
		commentsAdmin.DELETE("", r.commentHandler.Delete)
		commentsAdmin.PUT("/:id", r.commentHandler.UpdateContent)
		commentsAdmin.PUT("/:id/info", r.commentHandler.UpdateCommentInfo)
		commentsAdmin.PUT("/:id/status", r.commentHandler.UpdateStatus)
		commentsAdmin.PUT("/:id/pin", r.commentHandler.SetPin)
		commentsAdmin.POST("/export", r.commentHandler.ExportComments)
		commentsAdmin.POST("/import", r.commentHandler.ImportComments)
	}
}

func (r *Router) registerPostTagRoutes(api *gin.RouterGroup) {
	// 列表公开访问；携带管理员 Token 时返回全部标签（含引用数为 0），供后台管理
	postTagsPublic := api.Group("/post-tags").Use(r.mw.JWTAuthOptional())
	{
		postTagsPublic.GET("", r.postTagHandler.List)
		// postTagsPublic.GET("/:id", r.postTagHandler.Get)
	}

	// 创建、更新、删除通常需要管理员权限
	postTagsAdmin := api.Group("/post-tags").Use(r.mw.JWTAuth(), r.mw.AdminAuth())
	{
		postTagsAdmin.POST("", r.postTagHandler.Create)
		postTagsAdmin.PUT("/:id", r.postTagHandler.Update)
		postTagsAdmin.DELETE("/:id", r.postTagHandler.Delete)
	}
}

func (r *Router) registerPostCategoryRoutes(api *gin.RouterGroup) {
	postCategoriesPublic := api.Group("/post-categories")
	{
		postCategoriesPublic.GET("", r.postCategoryHandler.List)
		// postCategoriesPublic.GET("/:id", r.postCategoryHandler.Get)
	}

	postCategoriesAdmin := api.Group("/post-categories").Use(r.mw.JWTAuth(), r.mw.AdminAuth())
	{
		postCategoriesAdmin.POST("", r.postCategoryHandler.Create)
		postCategoriesAdmin.PUT("/:id", r.postCategoryHandler.Update)
		postCategoriesAdmin.DELETE("/:id", r.postCategoryHandler.Delete)
	}
}

func (r *Router) registerDocSeriesRoutes(api *gin.RouterGroup) {
	// 公开接口：获取文档系列列表和详情
	docSeriesPublic := api.Group("/public/doc-series")
	{
		docSeriesPublic.GET("", r.docSeriesHandler.List)
		docSeriesPublic.GET("/:id", r.docSeriesHandler.Get)
		docSeriesPublic.GET("/:id/articles", r.docSeriesHandler.GetWithArticles)
	}

	// 管理员接口：创建、更新、删除文档系列
	docSeriesAdmin := api.Group("/doc-series").Use(r.mw.JWTAuth(), r.mw.AdminAuth())
	{
		docSeriesAdmin.GET("", r.docSeriesHandler.List)
		docSeriesAdmin.GET("/:id", r.docSeriesHandler.Get)
		docSeriesAdmin.POST("", r.docSeriesHandler.Create)
		docSeriesAdmin.PUT("/:id", r.docSeriesHandler.Update)
		docSeriesAdmin.DELETE("/:id", r.docSeriesHandler.Delete)
	}
}

func (r *Router) registerArticleRoutes(api *gin.RouterGroup) {
	// 文章列表和创建接口：支持多人共创功能，普通用户也可以访问
	articlesUser := api.Group("/articles").Use(r.mw.JWTAuth())
	{
		// 文章列表（普通用户只能查看自己的文章）
		articlesUser.GET("", r.articleHandler.List)
		// 创建文章（支持普通用户，需要检查多人共创配置，权限在handler层校验）
		articlesUser.POST("", r.articleHandler.Create)
		// 上传文章图片（支持普通用户，用于多人共创场景）
		articlesUser.POST("/upload", r.articleHandler.UploadImage)
		// 更新文章（普通用户只能更新自己的文章，权限在handler层校验）
		articlesUser.PUT("/:id", r.articleHandler.Update)
		// 删除文章（普通用户只能删除自己的文章，权限在handler层校验）
		articlesUser.DELETE("/:id", r.articleHandler.Delete)
		// 获取文章（普通用户只能获取自己的文章，权限在handler层校验）
		articlesUser.GET("/:id", r.articleHandler.Get)

		// 文章历史版本相关路由（需要登录）
		if r.articleHistoryHandler != nil {
			articlesUser.GET("/:id/history", r.articleHistoryHandler.ListHistory)
			articlesUser.GET("/:id/history/count", r.articleHistoryHandler.GetHistoryCount)
			articlesUser.GET("/:id/history/compare", r.articleHistoryHandler.CompareVersions)
			articlesUser.GET("/:id/history/:version", r.articleHistoryHandler.GetVersion)
			articlesUser.POST("/:id/history/:version/restore", r.articleHistoryHandler.RestoreVersion)
		}
	}

	// 后台管理接口，需要认证和管理员权限（保留用于向后兼容）
	articlesAdmin := api.Group("/articles").Use(r.mw.JWTAuth(), r.mw.AdminAuth())
	{
		articlesAdmin.POST("/primary-color", r.articleHandler.GetPrimaryColor)
		// 文章导入导出功能（仅管理员可用）
		articlesAdmin.POST("/export", r.articleHandler.ExportArticles)
		articlesAdmin.POST("/import", r.articleHandler.ImportArticles)
		// 批量删除文章（仅管理员可用）
		articlesAdmin.DELETE("/batch", r.articleHandler.BatchDelete)
	}

	// 公开文章接口启用 60s 公共短缓存：CDN/浏览器可命中，减轻 DB 压力。
	// admin 写入会通过事件总线刷新前端 ISR/重新拉取，60s 误差可接受。
	articlesPublic := api.Group("/public/articles").Use(PublicCacheMiddleware(60))
	{
		articlesPublic.GET("", r.articleHandler.ListPublic)
		articlesPublic.GET("/home", r.articleHandler.ListHome)
		articlesPublic.GET("/random", r.articleHandler.GetRandom)
		articlesPublic.GET("/archives", r.articleHandler.ListArchives)
		articlesPublic.GET("/statistics", r.articleHandler.GetArticleStatistics)
		articlesPublic.GET("/by-url", r.articleHandler.GetByURL)
		// 注意：把带参数的路由放在最后，避免路由冲突
		articlesPublic.GET("/:id", r.articleHandler.GetPublic)
	}
}

func (r *Router) registerThumbnailRoutes(api *gin.RouterGroup) {
	// 预览/缩略图的获取需要登录，以保护私有文件
	thumbnail := api.Group("/thumbnail").Use(r.mw.JWTAuth())
	{

		// 手动重新生成缩略图的接口
		// POST /api/thumbnail/regenerate
		thumbnail.POST("/regenerate", r.thumbnailHandler.RegenerateThumbnail)

		// POST /api/thumbnail/regenerate/directory
		thumbnail.POST("/regenerate/directory", r.thumbnailHandler.RegenerateThumbnailsForDirectory)

		thumbnail.GET("/:publicID", r.thumbnailHandler.GetThumbnailSign)
	}
}

// registerAuthRoutes 注册认证相关的路由
func (r *Router) registerAuthRoutes(api *gin.RouterGroup) {
	auth := api.Group("/auth")
	{
		auth.POST("/login", middleware.CustomRateLimit(10, 5), r.authHandler.Login)
		auth.POST("/register", middleware.CustomRateLimit(5, 3), r.authHandler.Register)
		auth.POST("/refresh-token", r.authHandler.RefreshToken)
		auth.POST("/activate", r.authHandler.ActivateUser)
		auth.POST("/forgot-password", middleware.CustomRateLimit(5, 3), r.authHandler.ForgotPasswordRequest)
		auth.POST("/reset-password", middleware.CustomRateLimit(5, 3), r.authHandler.ResetPassword)
		auth.GET("/check-email", middleware.CustomRateLimit(10, 5), r.authHandler.CheckEmail)
	}
}

// registerAlbumRoutes 注册相册相关的路由 (后台管理)
func (r *Router) registerAlbumRoutes(api *gin.RouterGroup) {
	albums := api.Group("/albums").Use(r.mw.JWTAuth(), r.mw.AdminAuth())
	{
		albums.GET("/get", r.albumHandler.GetAlbums)
		albums.POST("/add", r.albumHandler.AddAlbum)
		albums.POST("/batch-import", r.albumHandler.BatchImportAlbums)
		albums.PUT("/update/:id", r.albumHandler.UpdateAlbum)
		albums.DELETE("/delete/:id", r.albumHandler.DeleteAlbum)
		albums.DELETE("/batch-delete", r.albumHandler.BatchDeleteAlbums)
		// 相册导入导出功能
		albums.POST("/export", r.albumHandler.ExportAlbums)
		albums.POST("/import", r.albumHandler.ImportAlbums)
	}
}

// registerAlbumCategoryRoutes 注册相册分类相关的路由
func (r *Router) registerAlbumCategoryRoutes(api *gin.RouterGroup) {
	albumCategories := api.Group("/album-categories").Use(r.mw.JWTAuth(), r.mw.AdminAuth())
	{
		albumCategories.POST("", r.albumCategoryHandler.CreateCategory)       // POST /api/album-categories
		albumCategories.GET("", r.albumCategoryHandler.ListCategories)        // GET /api/album-categories
		albumCategories.GET("/:id", r.albumCategoryHandler.GetCategory)       // GET /api/album-categories/:id
		albumCategories.PUT("/:id", r.albumCategoryHandler.UpdateCategory)    // PUT /api/album-categories/:id
		albumCategories.DELETE("/:id", r.albumCategoryHandler.DeleteCategory) // DELETE /api/album-categories/:id
	}
}

// registerSettingRoutes 注册站点配置相关的路由
func (r *Router) registerSettingRoutes(api *gin.RouterGroup) {
	// 获取配置接口允许普通用户访问（但只返回公开配置）
	settings := api.Group("/settings").Use(r.mw.JWTAuth())
	{
		settings.POST("/get-by-keys", r.settingHandler.GetSettingsByKeys)
	}
	// 更新配置和测试邮件需要管理员权限
	settingsAdmin := api.Group("/settings").Use(r.mw.JWTAuth(), r.mw.AdminAuth())
	{
		settingsAdmin.POST("/update", r.settingHandler.UpdateSettings)
		settingsAdmin.POST("/test-email", r.settingHandler.TestEmail)
	}
}

// registerUserRoutes 注册用户相关的路由
func (r *Router) registerUserRoutes(api *gin.RouterGroup) {
	// 普通用户路由（需要登录）
	user := api.Group("/user").Use(r.mw.JWTAuth())
	{
		user.GET("/info", r.userHandler.GetUserInfo)
		user.POST("/update-password", r.userHandler.UpdateUserPassword)
		user.PUT("/profile", r.userHandler.UpdateUserProfile)
		user.POST("/avatar", r.userHandler.UploadAvatar)
	}

	// 管理员用户管理路由（需要登录且为管理员）
	adminUsers := api.Group("/admin/users").Use(r.mw.JWTAuth(), r.mw.AdminAuth())
	{
		// 用户列表
		adminUsers.GET("", r.userHandler.AdminListUsers)
		// 创建用户
		adminUsers.POST("", r.userHandler.AdminCreateUser)
		// 更新用户
		adminUsers.PUT("/:id", r.userHandler.AdminUpdateUser)
		// 删除用户
		adminUsers.DELETE("/:id", r.userHandler.AdminDeleteUser)
		// 重置密码
		adminUsers.POST("/:id/reset-password", r.userHandler.AdminResetPassword)
		// 更新用户状态
		adminUsers.PUT("/:id/status", r.userHandler.AdminUpdateUserStatus)
	}

	// 用户组管理路由（需要登录且为管理员）
	adminUserGroups := api.Group("/admin/user-groups").Use(r.mw.JWTAuth(), r.mw.AdminAuth())
	{
		// 获取用户组列表
		adminUserGroups.GET("", r.userHandler.GetUserGroups)
	}
}

// registerPublicRoutes 注册公开的、无需认证的路由
func (r *Router) registerPublicRoutes(api *gin.RouterGroup) {
	// 公开 GET 启用 60s 公共短缓存；写入路径（PUT/POST 等）由中间件按方法跳过，不会被错误缓存。
	public := api.Group("/public").Use(PublicCacheMiddleware(60))
	{
		public.GET("/albums", r.publicHandler.GetPublicAlbums)
		public.GET("/album-categories", r.publicHandler.GetPublicAlbumCategories)
		public.PUT("/stat/:id", r.publicHandler.UpdateAlbumStat)
		public.GET("/site-config", r.settingHandler.GetSiteConfig)
		public.GET("/site-config/version", r.settingHandler.GetConfigVersion)

		// 验证码相关路由
		public.GET("/captcha/config", r.captchaHandler.GetConfig)
		public.GET("/captcha/image", middleware.CustomRateLimit(10, 10), r.captchaHandler.GenerateImage)

		// 订阅相关路由
		public.POST("/subscribe", middleware.CustomRateLimit(3, 3), r.subscriberHandler.Subscribe)
		public.POST("/subscribe/code", middleware.CustomRateLimit(3, 3), r.subscriberHandler.SendVerificationCode)
		public.POST("/unsubscribe", r.subscriberHandler.Unsubscribe)
		public.GET("/unsubscribe/:token", r.subscriberHandler.UnsubscribeByToken)
	}
}

// registerStoragePolicyRoutes 注册存储策略相关的路由
func (r *Router) registerStoragePolicyRoutes(api *gin.RouterGroup) {
	policies := api.Group("/policies").Use(r.mw.JWTAuth(), r.mw.AdminAuth())
	{
		policies.POST("", r.storagePolicyHandler.Create)
		policies.GET("", r.storagePolicyHandler.List)
		policies.GET("/connect/onedrive/:id", r.storagePolicyHandler.ConnectOneDrive)
		policies.POST("/authorize/onedrive", r.storagePolicyHandler.AuthorizeOneDrive)
		policies.GET("/:id", r.storagePolicyHandler.Get)
		policies.PUT("/:id", r.storagePolicyHandler.Update)
		policies.DELETE("/:id", r.storagePolicyHandler.Delete)
	}
}

// registerFileRoutes 注册文件相关的路由
func (r *Router) registerFileRoutes(api *gin.RouterGroup) {
	// --- 文件浏览路由 ---
	// GET /api/files?uri=...
	// 注意：这里只应用JWTAuth()。因为GetFilesByPath处理器内部已经包含了区分
	filesGroup := api.Group("/file")

	// 获取文件内容
	filesGroup.GET("/content", r.fileHandler.ServeSignedContent)

	filesGroup.Use(r.mw.JWTAuth())
	{
		// 获取文件列表
		filesGroup.GET("", r.fileHandler.GetFilesByPath)
		filesGroup.GET("/:id", r.fileHandler.GetFileInfo)
		filesGroup.GET("/download/:id", r.fileHandler.DownloadFile)
		filesGroup.GET("/download-info/:id", r.fileHandler.GetDownloadInfo)

		// POST /api/file/create
		filesGroup.POST("/create", r.fileHandler.CreateEmptyFile)
		filesGroup.PUT("/content/:publicID", r.fileHandler.UpdateFileContentByID)
		// Delete /api/file/?ids=...
		filesGroup.DELETE("", r.fileHandler.DeleteItems)
		// PUT /api/file/rename
		filesGroup.PUT("/rename", r.fileHandler.RenameItem)

		// 获取文件夹的预览图像URL
		// 这个接口用于获取文件夹内所有图片的预览图像URL
		filesGroup.GET("/preview-urls", r.fileHandler.GetPreviewURLs)
	}

	// --- 文件上传路由 ---
	// 上传相关操作也只需要JWT认证，具体权限由Handler处理
	uploadGroup := filesGroup.Group("/upload")
	uploadGroup.Use(r.mw.JWTAuth())
	{
		// 创建上传会话
		// PUT /api/file/upload
		uploadGroup.PUT("", r.fileHandler.CreateUploadSession)

		// 获取上传会话状态
		// GET /api/file/upload/session/{sessionId}
		uploadGroup.GET("/session/:sessionId", r.fileHandler.GetUploadSessionStatus)

		// 上传文件块，:sessionId 和 :index 是路径参数
		// POST /api/file/upload/some-uuid-string/0
		uploadGroup.POST("/:sessionId/:index", r.fileHandler.UploadChunk)

		// 客户端直传完成回调
		// POST /api/file/upload/finalize
		uploadGroup.POST("/finalize", r.fileHandler.FinalizeClientUpload)

		// 删除上传会话
		// DELETE /api/file/upload
		uploadGroup.DELETE("", r.fileHandler.DeleteUploadSession)
	}

	// --- 文件夹专属路由组 ---
	folderGroup := api.Group("/folder")
	folderGroup.Use(r.mw.JWTAuth())
	{
		folderGroup.PUT("/view", r.fileHandler.UpdateFolderView)
		folderGroup.GET("/tree/:id", r.fileHandler.GetFolderTree)
		folderGroup.GET("/size/:id", r.fileHandler.GetFolderSize)
		folderGroup.POST("/move", r.fileHandler.MoveItems)
		folderGroup.POST("/copy", r.fileHandler.CopyItems)
	}
}

func (r *Router) registerDirectLinkRoutes(api *gin.RouterGroup) {
	// 这些操作需要用户登录，所以使用JWTAuth中间件
	directLinks := api.Group("/direct-links").Use(r.mw.JWTAuth())
	{
		// 注册创建直链的接口： POST /api/direct-links
		directLinks.POST("", r.directLinkHandler.GetOrCreateDirectLinks)

		// directLinks.GET("", r.directLinkHandler.ListMyDirectLinks)
		// directLinks.DELETE("/:id", r.directLinkHandler.DeleteDirectLink)
	}
}

func (r *Router) registerLinkRoutes(api *gin.RouterGroup) {
	// --- 前台公开接口 ---
	linksPublic := api.Group("/public/links")
	{
		// 申请友链: POST /api/public/links (带频率限制)
		linksPublic.POST("", middleware.LinkApplyRateLimit(), r.linkHandler.ApplyLink)

		// 获取公开友链列表: GET /api/public/links
		linksPublic.GET("", r.linkHandler.ListPublicLinks)

		// 获取随机友链: GET /api/public/links/random
		linksPublic.GET("/random", r.linkHandler.GetRandomLinks)

		// 获取所有友链申请列表: GET /api/public/links/applications
		linksPublic.GET("/applications", r.linkHandler.ListAllApplications)

		// 检查友链URL是否存在: GET /api/public/links/check-exists
		linksPublic.GET("/check-exists", r.linkHandler.CheckLinkExists)
	}

	linkCategoriesPublic := api.Group("/public/link-categories")
	{
		// 获取有已审核通过友链的分类列表: GET /api/public/link-categories
		linkCategoriesPublic.GET("", r.linkHandler.ListPublicCategories)
	}

	// --- 后台管理接口 ---
	linksAdmin := api.Group("/links").Use(r.mw.JWTAuth(), r.mw.AdminAuth())
	{
		// 友链管理
		linksAdmin.POST("", r.linkHandler.AdminCreateLink)                         // POST /api/links
		linksAdmin.GET("", r.linkHandler.ListLinks)                                // GET /api/links
		linksAdmin.PUT("/:id", r.linkHandler.AdminUpdateLink)                      // PUT /api/links/:id
		linksAdmin.DELETE("/:id", r.linkHandler.AdminDeleteLink)                   // DELETE /api/links/:id
		linksAdmin.PUT("/:id/review", r.linkHandler.ReviewLink)                    // PUT /api/links/:id/review
		linksAdmin.POST("/import", r.linkHandler.ImportLinks)                      // POST /api/links/import
		linksAdmin.GET("/export", r.linkHandler.ExportLinks)                       // GET /api/links/export
		linksAdmin.POST("/health-check", r.linkHandler.CheckLinksHealth)           // POST /api/links/health-check
		linksAdmin.GET("/health-check/status", r.linkHandler.GetHealthCheckStatus) // GET /api/links/health-check/status
		linksAdmin.PUT("/sort", r.linkHandler.BatchUpdateLinkSort)                 // PUT /api/links/sort

		// 分类管理
		linksAdmin.GET("/categories", r.linkHandler.ListCategories)        // GET /api/links/categories
		linksAdmin.POST("/categories", r.linkHandler.CreateCategory)       // POST /api/links/categories
		linksAdmin.PUT("/categories/:id", r.linkHandler.UpdateCategory)    // PUT /api/links/categories/:id
		linksAdmin.DELETE("/categories/:id", r.linkHandler.DeleteCategory) // DELETE /api/links/categories/:id
		// 标签管理
		linksAdmin.GET("/tags", r.linkHandler.ListAllTags)      // GET /api/links/tags
		linksAdmin.POST("/tags", r.linkHandler.CreateTag)       // POST /api/links/tags
		linksAdmin.PUT("/tags/:id", r.linkHandler.UpdateTag)    // PUT /api/links/tags/:id
		linksAdmin.DELETE("/tags/:id", r.linkHandler.DeleteTag) // DELETE /api/links/tags/:id
	}
}

// registerStatisticsRoutes 注册统计相关的路由
func (r *Router) registerStatisticsRoutes(api *gin.RouterGroup) {
	// --- 前台公开接口 ---
	statisticsPublic := api.Group("/public/statistics")
	{
		// 获取基础统计数据: GET /api/public/statistics/basic
		statisticsPublic.GET("/basic", r.statisticsHandler.GetBasicStatistics)

		// 记录访问: POST /api/public/statistics/visit
		statisticsPublic.POST("/visit", r.statisticsHandler.RecordVisit)
	}

	// --- 后台管理接口 ---
	statisticsAdmin := api.Group("/statistics").Use(r.mw.JWTAuth(), r.mw.AdminAuth())
	{
		// 获取访客分析数据: GET /api/statistics/analytics
		statisticsAdmin.GET("/analytics", r.statisticsHandler.GetVisitorAnalytics)

		// 获取热门页面: GET /api/statistics/top-pages
		statisticsAdmin.GET("/top-pages", r.statisticsHandler.GetTopPages)

		// 获取访客趋势数据: GET /api/statistics/trend
		statisticsAdmin.GET("/trend", r.statisticsHandler.GetVisitorTrend)

		// 获取统计概览: GET /api/statistics/summary
		statisticsAdmin.GET("/summary", r.statisticsHandler.GetStatisticsSummary)

		// 获取访客访问日志: GET /api/statistics/visitor-logs
		statisticsAdmin.GET("/visitor-logs", r.statisticsHandler.GetVisitorLogs)
	}
}

// registerSearchRoutes 注册搜索相关的路由
func (r *Router) registerSearchRoutes(api *gin.RouterGroup) {
	// 搜索接口是公开的，不需要认证
	searchGroup := api.Group("/search")
	{
		// 搜索文章: GET /api/search?q=关键词&page=1&size=10
		searchGroup.GET("", r.searchHandler.Search)
	}
}

// registerPageRoutes 注册页面相关的路由
func (r *Router) registerPageRoutes(api *gin.RouterGroup) {
	// --- 前台公开接口 ---
	pagesPublic := api.Group("/public/pages")
	{
		// 根据路径获取页面: GET /api/public/pages/*path（支持多级路径如 /docs/guide）
		pagesPublic.GET("/*path", r.pageHandler.GetByPath)
	}

	// --- 后台管理接口 ---
	pagesAdmin := api.Group("/pages").Use(r.mw.JWTAuth(), r.mw.AdminAuth())
	{
		// 页面管理
		pagesAdmin.POST("", r.pageHandler.Create)                            // POST /api/pages
		pagesAdmin.GET("", r.pageHandler.List)                               // GET /api/pages
		pagesAdmin.GET("/:id", r.pageHandler.GetByID)                        // GET /api/pages/:id
		pagesAdmin.PUT("/:id", r.pageHandler.Update)                         // PUT /api/pages/:id
		pagesAdmin.DELETE("/:id", r.pageHandler.Delete)                      // DELETE /api/pages/:id
		pagesAdmin.POST("/initialize", r.pageHandler.InitializeDefaultPages) // POST /api/pages/initialize
	}
}

// registerThemeRoutes 注册主题管理相关的路由
func (r *Router) registerThemeRoutes(api *gin.RouterGroup) {
	// 公开的主题商城接口
	themePublic := api.Group("/public/theme")
	{
		// 获取主题商城列表: GET /api/public/theme/market
		themePublic.GET("/market", r.themeHandler.GetThemeMarket)

		// 检查静态模式状态: GET /api/public/theme/static-mode
		themePublic.GET("/static-mode", r.themeHandler.CheckStaticMode)

		// 获取当前主题配置（公开接口，供前端主题使用）: GET /api/public/theme/config
		themePublic.GET("/config", r.themeHandler.GetPublicThemeConfig)
	}

	// 需要登录的主题管理接口
	themeAuth := api.Group("/theme").Use(r.mw.JWTAuth())
	{
		// 获取当前主题: GET /api/theme/current
		themeAuth.GET("/current", r.themeHandler.GetCurrentTheme)

		// 获取已安装主题列表: GET /api/theme/installed
		themeAuth.GET("/installed", r.themeHandler.GetInstalledThemes)

		// 安装主题: POST /api/theme/install
		themeAuth.POST("/install", r.themeHandler.InstallTheme)

		// 上传主题: POST /api/theme/upload
		themeAuth.POST("/upload", r.themeHandler.UploadTheme)

		// 验证主题: POST /api/theme/validate
		themeAuth.POST("/validate", r.themeHandler.ValidateTheme)

		// 切换主题: POST /api/theme/switch
		themeAuth.POST("/switch", r.themeHandler.SwitchTheme)

		// 切换到官方主题: POST /api/theme/official
		themeAuth.POST("/official", r.themeHandler.SwitchToOfficial)

		// 卸载主题: POST /api/theme/uninstall
		themeAuth.POST("/uninstall", r.themeHandler.UninstallTheme)

		// ===== 主题配置相关 =====

		// 获取主题配置定义: GET /api/theme/settings?theme_name=xxx
		themeAuth.GET("/settings", r.themeHandler.GetThemeSettings)

		// 获取用户主题配置: GET /api/theme/config?theme_name=xxx
		themeAuth.GET("/config", r.themeHandler.GetUserThemeConfig)

		// 保存用户主题配置: POST /api/theme/config
		themeAuth.POST("/config", r.themeHandler.SaveUserThemeConfig)

		// 获取当前主题的完整配置（定义+值）: GET /api/theme/current-config
		themeAuth.GET("/current-config", r.themeHandler.GetCurrentThemeConfig)
	}
}

// registerMusicRoutes 注册音乐相关的路由
// 后端提供播放列表获取（包含封面颜色提取）和歌曲资源获取功能
func (r *Router) registerMusicRoutes(api *gin.RouterGroup) {
	// 检查 musicHandler 是否为 nil
	if r.musicHandler == nil {
		return
	}

	// --- 前台公开音乐接口 ---
	musicPublic := api.Group("/public/music")
	{
		// 获取播放列表: GET /api/public/music/playlist
		musicPublic.GET("/playlist", r.musicHandler.GetPlaylist)

		// 获取歌曲资源: POST /api/public/music/song-resources
		musicPublic.POST("/song-resources", r.musicHandler.GetSongResources)
	}
}

// registerSitemapRoutes 注册站点地图相关路由
func (r *Router) registerSitemapRoutes(engine *gin.Engine) {
	// 站点地图路由 - 直接注册到根路径，不使用/api前缀
	// 这些路由主要供搜索引擎使用，需要符合SEO标准

	// GET /sitemap.xml - 站点地图
	engine.GET("/sitemap.xml", r.sitemapHandler.GetSitemap)

	// GET /robots.txt - 搜索引擎抓取规则
	engine.GET("/robots.txt", r.sitemapHandler.GetRobots)
}

// registerRSSRoutes 注册 RSS/Atom/Feed 路由，与 SkipFrontend 无关，保证 anheyu-pro 等场景下也可用
func (r *Router) registerRSSRoutes(engine *gin.Engine) {
	if r.rssHandler == nil {
		return
	}
	engine.GET("/rss.xml", r.rssHandler.GetRSSFeed)
	engine.GET("/feed.xml", r.rssHandler.GetRSSFeed)
	engine.GET("/atom.xml", r.rssHandler.GetRSSFeed)
}

// registerVersionRoutes 注册版本信息相关路由
func (r *Router) registerVersionRoutes(api *gin.RouterGroup) {
	// 版本信息路由 - 公开接口，不需要认证
	versionGroup := api.Group("/version")
	{
		// GET /api/version - 获取版本信息 (JSON格式)
		versionGroup.GET("", r.versionHandler.GetVersion)

		// GET /api/version/string - 获取版本字符串 (简单字符串格式)
		versionGroup.GET("/string", r.versionHandler.GetVersionString)
	}
}

// registerNotificationRoutes 注册通知相关路由
func (r *Router) registerNotificationRoutes(api *gin.RouterGroup) {
	// 用户通知设置路由 - 需要登录
	userNotificationGroup := api.Group("/user").Use(r.mw.JWTAuth())
	{
		// 简化版接口（给前端用户中心用）
		userNotificationGroup.GET("/notification-settings", r.notificationHandler.GetUserNotificationSettings)
		userNotificationGroup.PUT("/notification-settings", r.notificationHandler.UpdateUserNotificationSettings)

		// 完整版接口（可选，供高级功能使用）
		userNotificationGroup.GET("/notification-configs", r.notificationHandler.GetUserNotificationConfigs)
	}

	// 通知类型管理路由 - 管理员专用
	notificationAdminGroup := api.Group("/notification").Use(r.mw.JWTAuth(), r.mw.AdminAuth())
	{
		notificationAdminGroup.GET("/types", r.notificationHandler.ListNotificationTypes)
	}
}

// registerConfigBackupRoutes 注册配置备份相关路由
func (r *Router) registerConfigBackupRoutes(api *gin.RouterGroup) {
	// 配置备份管理路由 - 需要管理员权限
	configBackupGroup := api.Group("/config/backup").Use(r.mw.JWTAuth(), r.mw.AdminAuth())
	{
		// 创建备份
		configBackupGroup.POST("/create", r.configBackupHandler.CreateBackup)

		// 获取备份列表
		configBackupGroup.GET("/list", r.configBackupHandler.ListBackups)

		// 恢复备份
		configBackupGroup.POST("/restore", r.configBackupHandler.RestoreBackup)

		// 删除备份
		configBackupGroup.POST("/delete", r.configBackupHandler.DeleteBackup)

		// 清理旧备份
		configBackupGroup.POST("/clean", r.configBackupHandler.CleanOldBackups)
	}

	// 配置导入导出路由 - 需要管理员权限
	configGroup := api.Group("/config").Use(r.mw.JWTAuth(), r.mw.AdminAuth())
	{
		// 导出配置
		configGroup.GET("/export", r.configImportExportHandler.ExportConfig)

		// 导入配置
		configGroup.POST("/import", r.configImportExportHandler.ImportConfig)
	}
}

// registerSSRThemeRoutes 注册 SSR 主题管理相关路由
func (r *Router) registerSSRThemeRoutes(api *gin.RouterGroup) {
	// 如果 SSR 主题处理器未初始化，跳过注册
	if r.ssrThemeHandler == nil {
		log.Println("⚠️ SSR 主题处理器未初始化，跳过路由注册")
		return
	}
	log.Println("📍 正在注册 SSR 主题管理路由...")

	// SSR 主题管理路由 - 需要管理员权限
	ssrThemeAdmin := api.Group("/admin/ssr-theme").Use(NoCacheMiddleware()).Use(r.mw.JWTAuth(), r.mw.AdminAuth())
	{
		// 安装 SSR 主题: POST /api/admin/ssr-theme/install
		ssrThemeAdmin.POST("/install", r.ssrThemeHandler.InstallTheme)

		// 列出已安装的 SSR 主题: GET /api/admin/ssr-theme/list
		ssrThemeAdmin.GET("/list", r.ssrThemeHandler.ListInstalledThemes)

		// 卸载 SSR 主题: DELETE /api/admin/ssr-theme/:name
		ssrThemeAdmin.DELETE("/:name", r.ssrThemeHandler.UninstallTheme)

		// 启动 SSR 主题: POST /api/admin/ssr-theme/:name/start
		ssrThemeAdmin.POST("/:name/start", r.ssrThemeHandler.StartTheme)

		// 停止 SSR 主题: POST /api/admin/ssr-theme/:name/stop
		ssrThemeAdmin.POST("/:name/stop", r.ssrThemeHandler.StopTheme)

		// 获取 SSR 主题状态: GET /api/admin/ssr-theme/:name/status
		ssrThemeAdmin.GET("/:name/status", r.ssrThemeHandler.GetThemeStatus)
	}
}
