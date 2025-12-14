/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-10-17 10:35:28
 * @LastEditTime: 2025-11-13 13:36:28
 * @LastEditors: 安知鱼
 */
// anheyu-app/cmd/server/app.go
package server

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/anzhiyu-c/anheyu-app/internal/app/bootstrap"
	"github.com/anzhiyu-c/anheyu-app/internal/app/listener"
	"github.com/anzhiyu-c/anheyu-app/internal/app/middleware"
	"github.com/anzhiyu-c/anheyu-app/internal/app/task"
	"github.com/anzhiyu-c/anheyu-app/internal/infra/persistence/database"
	ent_impl "github.com/anzhiyu-c/anheyu-app/internal/infra/persistence/ent"
	"github.com/anzhiyu-c/anheyu-app/internal/infra/router"
	"github.com/anzhiyu-c/anheyu-app/internal/infra/storage"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/event"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/version"
	"github.com/anzhiyu-c/anheyu-app/pkg/config"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	album_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/album"
	album_category_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/album_category"
	article_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/article"
	auth_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/auth"
	comment_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/comment"
	config_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/config"
	direct_link_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/direct_link"
	file_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/file"
	link_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/link"
	music_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/music"
	notification_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/notification"
	page_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/page"
	post_category_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/post_category"
	post_tag_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/post_tag"
	proxy_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/proxy"
	public_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/public"
	search_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/search"
	setting_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/setting"
	sitemap_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/sitemap"
	statistics_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/statistics"
	storage_policy_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/storage_policy"
	theme_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/theme"
	thumbnail_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/thumbnail"
	user_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/user"
	version_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/version"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/album"
	album_category_service "github.com/anzhiyu-c/anheyu-app/pkg/service/album_category"
	article_service "github.com/anzhiyu-c/anheyu-app/pkg/service/article"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/auth"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/cdn"
	cleanup_service "github.com/anzhiyu-c/anheyu-app/pkg/service/cleanup"
	comment_service "github.com/anzhiyu-c/anheyu-app/pkg/service/comment"
	config_service "github.com/anzhiyu-c/anheyu-app/pkg/service/config"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/direct_link"
	file_service "github.com/anzhiyu-c/anheyu-app/pkg/service/file"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/file_info"
	link_service "github.com/anzhiyu-c/anheyu-app/pkg/service/link"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/music"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/notification"
	page_service "github.com/anzhiyu-c/anheyu-app/pkg/service/page"
	parser_service "github.com/anzhiyu-c/anheyu-app/pkg/service/parser"
	post_category_service "github.com/anzhiyu-c/anheyu-app/pkg/service/post_category"
	post_tag_service "github.com/anzhiyu-c/anheyu-app/pkg/service/post_tag"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/process"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/search"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/sitemap"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/statistics"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/theme"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/thumbnail"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/user"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/volume"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/volume/strategy"

	_ "github.com/anzhiyu-c/anheyu-app/ent/runtime"
)

// App 结构体，用于封装应用的所有核心组件
type App struct {
	cfg                  *config.Config
	engine               *gin.Engine
	taskBroker           *task.Broker
	sqlDB                *sql.DB
	appVersion           string
	articleService       article_service.Service
	directLinkService    direct_link.Service
	storagePolicyRepo    repository.StoragePolicyRepository
	storagePolicyService volume.IStoragePolicyService
	fileService          file_service.FileService
	mw                   *middleware.Middleware
	settingSvc           setting.SettingService
	tokenSvc             auth.TokenService
	userSvc              user.UserService
	fileRepo             repository.FileRepository
	entityRepo           repository.EntityRepository
	cacheSvc             utility.CacheService
	eventBus             *event.EventBus
	postCategorySvc      *post_category_service.Service
}

func (a *App) PrintBanner() {
	banner := `

       █████╗ ███╗   ██╗███████╗██╗  ██╗██╗██╗   ██╗██╗   ██╗
      ██╔══██╗████╗  ██║╚══███╔╝██║  ██║██║╚██╗ ██╔╝██║   ██║
      ███████║██╔██╗ ██║  ███╔╝ ███████║██║ ╚████╔╝ ██║   ██║
      ██╔══██║██║╚██╗██║ ███╔╝  ██╔══██║██║  ╚██╔╝  ██║   ██║
      ██║  ██║██║ ╚████║███████╗██║  ██║██║   ██║   ╚██████╔╝
      ╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝╚═╝   ╚═╝    ╚═════╝

`
	log.Println(banner)
	log.Println("--------------------------------------------------------")

	if os.Getenv("ANHEYU_LICENSE_KEY") != "" {
		// 如果存在，就认为是 PRO 版本
		log.Printf(" Anheyu App - PRO Version: %s", version.GetVersionString())
	} else {
		// 如果不存在，就是社区版
		log.Printf(" Anheyu App - Community Version: %s", version.GetVersionString())
	}

	log.Println("--------------------------------------------------------")
}

// NewApp 是应用的构造函数，它执行所有的初始化和依赖注入工作
func NewApp(content embed.FS) (*App, func(), error) {
	// 在初始化早期获取版本信息
	appVersion := version.GetVersion()

	// --- Phase 1: 加载外部配置 ---
	cfg, err := config.NewConfig()
	if err != nil {
		return nil, nil, fmt.Errorf("加载配置失败: %w", err)
	}

	// --- Phase 2: 初始化基础设施 ---
	sqlDB, err := database.NewSQLDB(cfg)
	if err != nil {
		return nil, nil, fmt.Errorf("创建数据库连接池失败: %w", err)
	}
	entClient, err := database.NewEntClient(sqlDB, cfg)
	if err != nil {
		sqlDB.Close()
		return nil, nil, err
	}

	// 尝试连接 Redis（如果失败，将自动降级到内存缓存）
	redisClient, err := database.NewRedisClient(context.Background(), cfg)
	if err != nil {
		sqlDB.Close()
		return nil, nil, fmt.Errorf("redis 初始化失败: %w", err)
	}

	// 临时cleanup函数，后面会被增强版本替换
	tempCleanup := func() {
		log.Println("执行清理操作：关闭数据库连接...")
		sqlDB.Close()
		if redisClient != nil {
			log.Println("关闭 Redis 连接...")
			redisClient.Close()
		}
	}
	if err := idgen.InitSqidsEncoder(); err != nil {
		return nil, tempCleanup, fmt.Errorf("初始化 ID 编码器失败: %w", err)
	}
	eventBus := event.NewEventBus()
	dbType := cfg.GetString(config.KeyDBType)
	if dbType == "" {
		dbType = "mysql"
	}
	if dbType == "mariadb" {
		dbType = "mysql"
	}

	// --- Phase 3: 初始化数据仓库层 ---
	settingRepo := ent_impl.NewEntSettingRepository(entClient)
	userRepo := ent_impl.NewEntUserRepository(entClient)
	userGroupRepo := ent_impl.NewEntUserGroupRepository(entClient)
	fileRepo := ent_impl.NewEntFileRepository(entClient, sqlDB, dbType)
	entityRepo := ent_impl.NewEntEntityRepository(entClient)
	fileEntityRepo := ent_impl.NewEntFileEntityRepository(entClient)
	tagRepo := ent_impl.NewEntTagRepository(entClient)
	directLinkRepo := ent_impl.NewEntDirectLinkRepository(entClient)
	albumRepo := ent_impl.NewEntAlbumRepository(entClient)
	albumCategoryRepo := ent_impl.NewAlbumCategoryRepo(entClient)
	storagePolicyRepo := ent_impl.NewEntStoragePolicyRepository(entClient)
	metadataRepo := ent_impl.NewEntMetadataRepository(entClient)
	articleRepo := ent_impl.NewArticleRepo(entClient, dbType)
	postTagRepo := ent_impl.NewPostTagRepo(entClient, dbType)
	postCategoryRepo := ent_impl.NewPostCategoryRepo(entClient)
	cleanupRepo := ent_impl.NewCleanupRepo(entClient)
	commentRepo := ent_impl.NewCommentRepo(entClient, dbType)
	linkRepo := ent_impl.NewLinkRepo(entClient, dbType)
	linkCategoryRepo := ent_impl.NewLinkCategoryRepo(entClient)
	linkTagRepo := ent_impl.NewLinkTagRepo(entClient)
	pageRepo := ent_impl.NewEntPageRepository(entClient)
	notificationTypeRepo := ent_impl.NewEntNotificationTypeRepository(entClient)
	userNotificationConfigRepo := ent_impl.NewEntUserNotificationConfigRepository(entClient)

	// --- Phase 4: 初始化应用引导程序 ---
	bootstrapper := bootstrap.NewBootstrapper(entClient)
	if err := bootstrapper.InitializeDatabase(); err != nil {
		return nil, tempCleanup, fmt.Errorf("数据库初始化失败: %w", err)
	}

	// --- Phase 5: 初始化业务逻辑层 ---
	txManager := ent_impl.NewEntTransactionManager(entClient, sqlDB, dbType)
	settingSvc := setting.NewSettingService(settingRepo, eventBus)
	if err := settingSvc.LoadAllSettings(context.Background()); err != nil {
		return nil, tempCleanup, fmt.Errorf("从数据库加载站点配置失败: %w", err)
	}
	strategyManager := strategy.NewManager()
	strategyManager.Register(constant.PolicyTypeLocal, strategy.NewLocalStrategy())
	strategyManager.Register(constant.PolicyTypeOneDrive, strategy.NewOneDriveStrategy())
	strategyManager.Register(constant.PolicyTypeTencentCOS, strategy.NewTencentCOSStrategy())
	strategyManager.Register(constant.PolicyTypeAliOSS, strategy.NewAliyunOSSStrategy())
	strategyManager.Register(constant.PolicyTypeS3, strategy.NewAWSS3Strategy())

	// 使用智能缓存工厂，自动选择 Redis 或内存缓存
	cacheSvc := utility.NewCacheServiceWithFallback(redisClient)

	tokenSvc := auth.NewTokenService(userRepo, settingSvc, cacheSvc)
	geoSvc, err := utility.NewGeoIPService(settingSvc)
	if err != nil {
		log.Printf("警告: GeoIP 服务初始化失败: %v。IP属地将显示为'未知'", err)
	}
	albumSvc := album.NewAlbumService(albumRepo, tagRepo, settingSvc)
	albumCategorySvc := album_category_service.NewService(albumCategoryRepo)
	storageProviders := make(map[constant.StoragePolicyType]storage.IStorageProvider)
	localSigningSecret := settingSvc.Get(constant.KeyLocalFileSigningSecret.String())
	parserSvc := parser_service.NewService(settingSvc, eventBus)
	storageProviders[constant.PolicyTypeLocal] = storage.NewLocalProvider(localSigningSecret)
	storageProviders[constant.PolicyTypeOneDrive] = storage.NewOneDriveProvider(storagePolicyRepo)
	storageProviders[constant.PolicyTypeTencentCOS] = storage.NewTencentCOSProvider()
	storageProviders[constant.PolicyTypeAliOSS] = storage.NewAliOSSProvider()
	storageProviders[constant.PolicyTypeS3] = storage.NewAWSS3Provider()
	metadataSvc := file_info.NewMetadataService(metadataRepo)
	postTagSvc := post_tag_service.NewService(postTagRepo)
	postCategorySvc := post_category_service.NewService(postCategoryRepo, articleRepo)
	cleanupSvc := cleanup_service.NewCleanupService(cleanupRepo)
	userSvc := user.NewUserService(userRepo, userGroupRepo)
	storagePolicySvc := volume.NewStoragePolicyService(storagePolicyRepo, fileRepo, txManager, strategyManager, settingSvc, cacheSvc, storageProviders)
	thumbnailSvc := thumbnail.NewThumbnailService(metadataSvc, fileRepo, entityRepo, storagePolicySvc, settingSvc, storageProviders)
	if err != nil {
		return nil, tempCleanup, fmt.Errorf("初始化缩略图服务失败: %w", err)
	}
	pathLocker := utility.NewPathLocker()
	syncSvc := process.NewSyncService(txManager, fileRepo, entityRepo, fileEntityRepo, storagePolicySvc, eventBus, storageProviders)
	vfsSvc := volume.NewVFSService(storagePolicySvc, cacheSvc, fileRepo, entityRepo, settingSvc, storageProviders)
	extractionSvc := file_info.NewExtractionService(fileRepo, settingSvc, metadataSvc, vfsSvc)
	fileSvc := file_service.NewService(fileRepo, storagePolicyRepo, txManager, entityRepo, fileEntityRepo, userGroupRepo, metadataSvc, extractionSvc, cacheSvc, storagePolicySvc, settingSvc, syncSvc, vfsSvc, storageProviders, eventBus, pathLocker)
	uploadSvc := file_service.NewUploadService(txManager, eventBus, entityRepo, metadataSvc, cacheSvc, storagePolicySvc, settingSvc, storageProviders)
	directLinkSvc := direct_link.NewDirectLinkService(directLinkRepo, fileRepo, userGroupRepo, settingSvc, storagePolicyRepo)
	statService, err := statistics.NewVisitorStatService(
		ent_impl.NewVisitorStatRepository(entClient),
		ent_impl.NewVisitorLogRepository(entClient),
		ent_impl.NewURLStatRepository(entClient),
		cacheSvc,
		geoSvc,
	)
	if err != nil {
		return nil, tempCleanup, fmt.Errorf("初始化统计服务失败: %w", err)
	}

	//将 NotificationService 和 EmailService 移到这里，在 taskBroker 之前初始化
	log.Printf("[DEBUG] 正在初始化 NotificationService...")
	notificationSvc := notification.NewNotificationService(notificationTypeRepo, userNotificationConfigRepo)
	log.Printf("[DEBUG] NotificationService 初始化完成")

	// 初始化默认通知类型
	log.Printf("[DEBUG] 正在初始化默认通知类型...")
	if err := notificationSvc.InitializeDefaultNotificationTypes(context.Background()); err != nil {
		log.Printf("[WARNING] 初始化默认通知类型失败: %v", err)
	} else {
		log.Printf("[DEBUG] 默认通知类型初始化完成")
	}

	// 初始化邮件服务（需要 notificationSvc）
	emailSvc := utility.NewEmailService(settingSvc, notificationSvc)

	taskBroker := task.NewBroker(uploadSvc, thumbnailSvc, cleanupSvc, articleRepo, commentRepo, emailSvc, cacheSvc, linkCategoryRepo, linkTagRepo, linkRepo, settingSvc, statService)
	pageSvc := page_service.NewService(pageRepo)

	// 初始化搜索服务
	if err := search.InitializeSearchEngine(settingSvc); err != nil {
		log.Printf("初始化搜索引擎失败: %v", err)
		// 不返回错误，让应用继续启动
	}

	searchSvc := search.NewSearchService()
	sitemapSvc := sitemap.NewService(articleRepo, pageRepo, linkRepo, settingSvc)

	// 重建所有文章的搜索索引
	go func() {
		log.Println("🔄 开始重建搜索索引...")
		if err := searchSvc.RebuildAllIndexes(context.Background()); err != nil {
			log.Printf("重建搜索索引失败: %v", err)
			return
		}

		// 获取所有文章并建立索引
		articles, _, err := articleRepo.List(context.Background(), &model.ListArticlesOptions{
			WithContent: true,
			Page:        1,
			PageSize:    1000, // 一次性获取所有文章
		})
		if err != nil {
			log.Printf("获取文章列表失败: %v", err)
			return
		}

		log.Printf("📚 找到 %d 篇文章，开始建立搜索索引...", len(articles))

		successCount := 0
		for _, article := range articles {
			if err := searchSvc.IndexArticle(context.Background(), article); err != nil {
				log.Printf("为文章 %s 建立索引失败: %v", article.Title, err)
			} else {
				successCount++
			}
		}

		log.Printf("✅ 搜索索引重建完成！成功为 %d/%d 篇文章建立索引", successCount, len(articles))
	}()

	// 初始化主色调服务
	log.Printf("[DEBUG] 正在初始化 PrimaryColorService...")
	colorSvc := utility.NewColorService()
	httpClient := &http.Client{Timeout: 10 * time.Second}
	primaryColorSvc := utility.NewPrimaryColorService(colorSvc, settingSvc, fileRepo, storagePolicyRepo, httpClient, storageProviders)
	log.Printf("[DEBUG] PrimaryColorService 初始化完成")

	// 初始化CDN服务
	log.Printf("[DEBUG] 正在初始化 CDNService...")
	cdnSvc := cdn.NewService(settingSvc)
	log.Printf("[DEBUG] CDNService 初始化完成")

	articleSvc := article_service.NewService(articleRepo, postTagRepo, postCategoryRepo, commentRepo, txManager, cacheSvc, geoSvc, taskBroker, settingSvc, parserSvc, fileSvc, directLinkSvc, searchSvc, primaryColorSvc, cdnSvc, userRepo)
	log.Printf("[DEBUG] 正在初始化 PushooService...")
	pushooSvc := utility.NewPushooService(settingSvc)
	log.Printf("[DEBUG] PushooService 初始化完成")

	log.Printf("[DEBUG] 正在初始化 LinkService，将注入 PushooService 和 EmailService...")
	linkSvc := link_service.NewService(linkRepo, linkCategoryRepo, linkTagRepo, txManager, taskBroker, settingSvc, pushooSvc, emailSvc)
	log.Printf("[DEBUG] LinkService 初始化完成，PushooService 和 EmailService 已注入")

	authSvc := auth.NewAuthService(userRepo, settingSvc, tokenSvc, emailSvc, txManager, articleSvc)
	log.Printf("[DEBUG] 正在初始化 CommentService，将注入 PushooService 和 NotificationService...")
	commentSvc := comment_service.NewService(commentRepo, userRepo, txManager, geoSvc, settingSvc, cacheSvc, taskBroker, fileSvc, parserSvc, pushooSvc, notificationSvc)
	log.Printf("[DEBUG] CommentService 初始化完成，PushooService 和 NotificationService 已注入")
	themeSvc := theme.NewThemeService(entClient, userRepo)
	_ = listener.NewFilePostProcessingListener(eventBus, taskBroker, extractionSvc)

	// 初始化音乐服务
	log.Printf("[DEBUG] 正在初始化 MusicService...")
	musicSvc := music.NewMusicService(settingSvc)
	log.Printf("[DEBUG] MusicService 初始化完成")

	// 初始化配置备份服务
	log.Printf("[DEBUG] 正在初始化 ConfigBackupService...")
	configBackupSvc := config_service.NewBackupService("data/conf.ini", settingRepo)
	log.Printf("[DEBUG] ConfigBackupService 初始化完成")

	// 初始化配置导入导出服务
	log.Printf("[DEBUG] 正在初始化 ConfigImportExportService...")
	configImportExportSvc := config_service.NewImportExportService(settingRepo, settingSvc)
	log.Printf("[DEBUG] ConfigImportExportService 初始化完成")

	// --- Phase 6: 初始化表现层 (Handlers) ---
	mw := middleware.NewMiddleware(tokenSvc)
	authHandler := auth_handler.NewAuthHandler(authSvc, tokenSvc, settingSvc)
	albumHandler := album_handler.NewAlbumHandler(albumSvc)
	albumCategoryHandler := album_category_handler.NewHandler(albumCategorySvc)
	userHandler := user_handler.NewUserHandler(userSvc, settingSvc, fileSvc, directLinkSvc)
	publicHandler := public_handler.NewPublicHandler(albumSvc, albumCategorySvc)
	settingHandler := setting_handler.NewSettingHandler(settingSvc, emailSvc, cdnSvc, configBackupSvc)
	storagePolicyHandler := storage_policy_handler.NewStoragePolicyHandler(storagePolicySvc)
	fileHandler := file_handler.NewHandler(fileSvc, uploadSvc, settingSvc)
	directLinkHandler := direct_link_handler.NewDirectLinkHandler(directLinkSvc, storageProviders)
	linkHandler := link_handler.NewHandler(linkSvc)
	thumbnailHandler := thumbnail_handler.NewThumbnailHandler(taskBroker, metadataSvc, fileSvc, thumbnailSvc, settingSvc)
	articleHandler := article_handler.NewHandler(articleSvc)
	postTagHandler := post_tag_handler.NewHandler(postTagSvc)
	postCategoryHandler := post_category_handler.NewHandler(postCategorySvc)
	commentHandler := comment_handler.NewHandler(commentSvc)
	pageHandler := page_handler.NewHandler(pageSvc)
	searchHandler := search_handler.NewHandler(searchSvc)
	statisticsHandler := statistics_handler.NewStatisticsHandler(statService)
	themeHandler := theme_handler.NewHandler(themeSvc)
	sitemapHandler := sitemap_handler.NewHandler(sitemapSvc)
	proxyHandler := proxy_handler.NewHandler()
	musicHandler := music_handler.NewMusicHandler(musicSvc)
	versionHandler := version_handler.NewHandler()
	notificationHandler := notification_handler.NewHandler(notificationSvc)
	configBackupHandler := config_handler.NewConfigBackupHandler(configBackupSvc)
	configImportExportHandler := config_handler.NewConfigImportExportHandler(configImportExportSvc)

	// --- Phase 7: 初始化路由 ---
	appRouter := router.NewRouter(
		authHandler,
		albumHandler,
		albumCategoryHandler,
		userHandler,
		publicHandler,
		settingHandler,
		storagePolicyHandler,
		fileHandler,
		directLinkHandler,
		thumbnailHandler,
		articleHandler,
		postTagHandler,
		postCategoryHandler,
		commentHandler,
		linkHandler,
		musicHandler,
		pageHandler,
		statisticsHandler,
		themeHandler,
		mw,
		searchHandler,
		proxyHandler,
		sitemapHandler,
		versionHandler,
		notificationHandler,
		configBackupHandler,
		configImportExportHandler,
	)

	// --- Phase 8: 配置 Gin 引擎 ---

	if cfg.GetBool("System.Debug") {
		gin.SetMode(gin.DebugMode)
		log.Println("运行模式: Debug (Gin 将打印详细路由日志)")
	} else {
		gin.SetMode(gin.ReleaseMode)
		log.Println("运行模式: Release (Gin 启动日志已禁用)")
	}

	engine := gin.Default()
	err = engine.SetTrustedProxies([]string{"127.0.0.1", "::1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"})
	if err != nil {
		return nil, nil, fmt.Errorf("设置信任代理失败: %w", err)
	}
	engine.ForwardedByClientIP = true
	engine.Use(middleware.Cors())
	router.SetupFrontend(engine, settingSvc, articleSvc, cacheSvc, content, cfg)
	appRouter.Setup(engine)

	// 将所有初始化好的组件装配到 App 实例中
	app := &App{
		cfg:                  cfg,
		engine:               engine,
		taskBroker:           taskBroker,
		sqlDB:                sqlDB,
		appVersion:           appVersion,
		articleService:       articleSvc,
		directLinkService:    directLinkSvc,
		storagePolicyRepo:    storagePolicyRepo,
		storagePolicyService: storagePolicySvc,
		fileService:          fileSvc,
		mw:                   mw,
		settingSvc:           settingSvc,
		tokenSvc:             tokenSvc,
		userSvc:              userSvc,
		fileRepo:             fileRepo,
		entityRepo:           entityRepo,
		cacheSvc:             cacheSvc,
		eventBus:             eventBus,
		postCategorySvc:      postCategorySvc,
	}

	// 创建cleanup函数
	cleanup := func() {
		log.Println("执行清理操作：关闭数据库连接...")

		// 关闭数据库连接
		sqlDB.Close()

		// 关闭 Redis 连接（如果存在）
		if redisClient != nil {
			log.Println("关闭 Redis 连接...")
			redisClient.Close()
		}
	}

	return app, cleanup, nil
}

func (a *App) Config() *config.Config {
	return a.cfg
}

func (a *App) Engine() *gin.Engine {
	return a.engine
}

func (a *App) FileRepository() repository.FileRepository {
	return a.fileRepo
}

func (a *App) EntityRepository() repository.EntityRepository {
	return a.entityRepo
}

func (a *App) SettingService() setting.SettingService {
	return a.settingSvc
}

func (a *App) Middleware() *middleware.Middleware {
	return a.mw
}

func (a *App) ArticleService() article_service.Service {
	return a.articleService
}

func (a *App) DirectLinkService() direct_link.Service {
	return a.directLinkService
}

func (a *App) StoragePolicyRepository() repository.StoragePolicyRepository {
	return a.storagePolicyRepo
}

func (a *App) DB() *sql.DB {
	return a.sqlDB
}

func (a *App) StoragePolicyService() volume.IStoragePolicyService {
	return a.storagePolicyService
}

func (a *App) CacheService() utility.CacheService {
	return a.cacheSvc
}

// FileService 返回文件服务实例（暴露给 PRO 版使用）
func (a *App) FileService() file_service.FileService {
	return a.fileService
}

// TokenService 返回 Token 服务（用于 JWT token 生成和验证）
func (a *App) TokenService() auth.TokenService {
	return a.tokenSvc
}

// UserService 返回用户服务（用于用户管理和认证）
func (a *App) UserService() user.UserService {
	return a.userSvc
}

// EventBus 返回事件总线，用于发布和订阅事件
func (a *App) EventBus() *event.EventBus {
	return a.eventBus
}

// Version 返回应用的版本号
func (a *App) Version() string {
	return a.appVersion
}

// PostCategoryService 返回文章分类服务（用于 PRO 版多人共创功能）
func (a *App) PostCategoryService() *post_category_service.Service {
	return a.postCategorySvc
}

func (a *App) Run() error {
	a.taskBroker.RegisterCronJobs()
	a.taskBroker.CheckAndRunMissedAggregation()
	a.taskBroker.Start()
	port := a.cfg.GetString(config.KeyServerPort)
	if port == "" {
		port = "8091"
	}
	fmt.Printf("应用程序启动成功，正在监听端口: %s\n", port)

	return a.engine.Run(":" + port)
}

func (a *App) Stop() {
	if a.taskBroker != nil {
		a.taskBroker.Stop()
		log.Println("任务调度器已停止。")
	}
}
