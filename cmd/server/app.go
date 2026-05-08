/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-10-17 10:35:28
 * @LastEditTime: 2026-01-22 16:15:28
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
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-contrib/gzip"
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
	"github.com/anzhiyu-c/anheyu-app/internal/service/cache"
	"github.com/anzhiyu-c/anheyu-app/pkg/config"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
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
	plugin_admin_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/plugin_admin"
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
	wechat_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/wechat"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/album"
	album_category_service "github.com/anzhiyu-c/anheyu-app/pkg/service/album_category"
	article_service "github.com/anzhiyu-c/anheyu-app/pkg/service/article"
	article_history_service "github.com/anzhiyu-c/anheyu-app/pkg/service/article_history"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/auth"
	captcha_service "github.com/anzhiyu-c/anheyu-app/pkg/service/captcha"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/cdn"
	cleanup_service "github.com/anzhiyu-c/anheyu-app/pkg/service/cleanup"
	comment_service "github.com/anzhiyu-c/anheyu-app/pkg/service/comment"
	config_service "github.com/anzhiyu-c/anheyu-app/pkg/service/config"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/direct_link"
	doc_series_service "github.com/anzhiyu-c/anheyu-app/pkg/service/doc_series"
	file_service "github.com/anzhiyu-c/anheyu-app/pkg/service/file"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/file_info"
	geetest_service "github.com/anzhiyu-c/anheyu-app/pkg/service/geetest"
	imagecaptcha_service "github.com/anzhiyu-c/anheyu-app/pkg/service/imagecaptcha"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/image_style"
	image_style_engine "github.com/anzhiyu-c/anheyu-app/pkg/service/image_style/engine"
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
	rss_service "github.com/anzhiyu-c/anheyu-app/pkg/service/rss"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/statistics"
	subscriber_service "github.com/anzhiyu-c/anheyu-app/pkg/service/subscriber"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/theme"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/thumbnail"
	turnstile_service "github.com/anzhiyu-c/anheyu-app/pkg/service/turnstile"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/user"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/volume"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/volume/strategy"
	wechat_service "github.com/anzhiyu-c/anheyu-app/pkg/service/wechat"
	"github.com/anzhiyu-c/anheyu-app/pkg/ssr"
	"github.com/anzhiyu-c/anheyu-app/pkg/plugin"
	"github.com/anzhiyu-c/anheyu-app/pkg/util"

	_ "github.com/anzhiyu-c/anheyu-app/ent/runtime"
)

// App 结构体，用于封装应用的所有核心组件
type App struct {
	cfg                    *config.Config
	engine                 *gin.Engine
	taskBroker             *task.Broker
	sqlDB                  *sql.DB
	appVersion             string
	articleService         article_service.Service
	directLinkService      direct_link.Service
	storagePolicyRepo      repository.StoragePolicyRepository
	storagePolicyService   volume.IStoragePolicyService
	fileService            file_service.FileService
	mw                     *middleware.Middleware
	settingRepo            repository.SettingRepository
	settingSvc             setting.SettingService
	tokenSvc               auth.TokenService
	userSvc                user.UserService
	fileRepo               repository.FileRepository
	entityRepo             repository.EntityRepository
	cacheSvc               utility.CacheService
	eventBus               *event.EventBus
	postCategorySvc        *post_category_service.Service
	postTagSvc             *post_tag_service.Service
	commentSvc             *comment_service.Service
	themeSvc               theme.ThemeService
	themeHandler           *theme_handler.Handler
	ssrManager             *ssr.Manager
	ssrThemeHandler        *ssrtheme_handler.Handler
	imageStyleService      image_style.ImageStyleService
	imageStyleCache        *image_style.DiskCache
	configExtensionHolder  *configExtensionHolder // Pro 可通过 SetConfigExtension 注入支付配置导出/导入
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

// SetConfigExtension 设置配置导出/导入扩展（如 Pro 版支付配置），在 App 创建后由 Pro 调用
func (a *App) SetConfigExtension(ext config_service.ConfigExportImportExtension) {
	if a.configExtensionHolder != nil {
		a.configExtensionHolder.Ext = ext
	}
}

// configExtensionHolder 持有配置导出/导入扩展，便于在 App 创建后由 Pro 等注入
type configExtensionHolder struct {
	Ext config_service.ConfigExportImportExtension
}

// AppOptions 提供 NewApp 的可选配置项
type AppOptions struct {
	// SkipFrontend 为 true 时跳过内嵌 Vue 前端路由注册，
	// 适用于 Pro 版等使用独立前端服务（如 Next.js）的场景。
	SkipFrontend bool
	// SkipPluginSystem 为 true 时跳过插件扫描、搜索引擎接管与 /api/admin/plugins 路由注册，
	// 适用于 Pro 版在自身 main 中单独调用 plugin.InitManager 并注册管理接口，避免与社区版重复注册。
	SkipPluginSystem bool
	// ConfigExtension 配置导出/导入扩展（如 Pro 版支付配置），为 nil 时仅导出/导入系统设置
	ConfigExtension config_service.ConfigExportImportExtension
}

// NewApp 是应用的构造函数，它执行所有的初始化和依赖注入工作
func NewApp(content embed.FS) (*App, func(), error) {
	return NewAppWithOptions(content, AppOptions{})
}

// NewAppWithOptions 与 NewApp 相同，但接受额外的配置选项
func NewAppWithOptions(content embed.FS, opts AppOptions) (*App, func(), error) {
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

	// 默认密码强校验：生产模式（gin release）下使用默认/空密码直接 fail-fast，
	// 避免运维忽略警告日志默默上线裸奔。本地/调试模式仍仅打 warn 不阻断。
	releaseMode := strings.EqualFold(gin.Mode(), gin.ReleaseMode)
	dbPass := cfg.GetString(config.KeyDBPassword)
	dbPassWeak := dbPass == "" || dbPass == "changeme"
	if dbPassWeak {
		msg := "数据库密码使用默认值或为空，请修改后再启动！设置环境变量 ANHEYU_DATABASE_PASSWORD"
		if releaseMode {
			sqlDB.Close()
			if redisClient != nil {
				redisClient.Close()
			}
			return nil, nil, fmt.Errorf("启动失败: %s", msg)
		}
		log.Printf("⚠️  警告: %s", msg)
	}
	redisPass := cfg.GetString(config.KeyRedisPassword)
	redisPassWeak := redisPass == "" || redisPass == "changeme"
	if redisPassWeak {
		msg := "Redis 密码使用默认值或为空，请修改后再启动！设置环境变量 ANHEYU_REDIS_PASSWORD"
		if releaseMode {
			sqlDB.Close()
			if redisClient != nil {
				redisClient.Close()
			}
			return nil, nil, fmt.Errorf("启动失败: %s", msg)
		}
		log.Printf("⚠️  警告: %s", msg)
	}

	tempCleanup := func() {
		log.Println("执行清理操作：关闭数据库连接...")
		sqlDB.Close()
		if redisClient != nil {
			log.Println("关闭 Redis 连接...")
			redisClient.Close()
		}
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
	articleHistoryRepo := ent_impl.NewArticleHistoryRepo(entClient)
	postTagRepo := ent_impl.NewPostTagRepo(entClient, dbType)
	postCategoryRepo := ent_impl.NewPostCategoryRepo(entClient)
	docSeriesRepo := ent_impl.NewDocSeriesRepo(entClient)
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

	// --- Phase 4.5: 初始化 ID 编码器 ---
	// 从数据库获取或生成 IDSeed（存储在数据库中，不可被外部修改）
	idSeed, err := getOrCreateIDSeed(context.Background(), settingRepo, userRepo)
	if err != nil {
		return nil, tempCleanup, fmt.Errorf("获取 IDSeed 失败: %w", err)
	}
	if err := idgen.InitSqidsEncoderWithSeed(idSeed); err != nil {
		return nil, tempCleanup, fmt.Errorf("初始化 ID 编码器失败: %w", err)
	}
	log.Println("✅ ID 编码器初始化成功")

	// --- Phase 5: 初始化业务逻辑层 ---
	txManager := ent_impl.NewEntTransactionManager(entClient, sqlDB, dbType)
	settingSvc := setting.NewSettingService(settingRepo, eventBus)
	if err := settingSvc.LoadAllSettings(context.Background()); err != nil {
		return nil, tempCleanup, fmt.Errorf("从数据库加载站点配置失败: %w", err)
	}

	// JWT 密钥强度校验：HS256 在密钥短于 32 字节、或全为可预测字符时易被暴力破解。
	// release 模式下直接 fail-fast，dev 模式下打告警，提示运维生成高熵密钥。
	{
		jwtSecret := settingSvc.Get(constant.KeyJWTSecret.String())
		switch {
		case jwtSecret == "":
			msg := "JWT_SECRET 未配置，请在站点设置中生成至少 32 字节的高熵密钥"
			if releaseMode {
				return nil, tempCleanup, fmt.Errorf("启动失败: %s", msg)
			}
			log.Printf("⚠️  警告: %s", msg)
		case len(jwtSecret) < 32:
			msg := fmt.Sprintf("JWT_SECRET 长度仅 %d 字节，低于安全推荐的 32 字节，登录令牌存在被暴力破解风险", len(jwtSecret))
			if releaseMode {
				return nil, tempCleanup, fmt.Errorf("启动失败: %s", msg)
			}
			log.Printf("⚠️  警告: %s", msg)
		}
	}
	strategyManager := strategy.NewManager()
	strategyManager.Register(constant.PolicyTypeLocal, strategy.NewLocalStrategy())
	strategyManager.Register(constant.PolicyTypeOneDrive, strategy.NewOneDriveStrategy())
	strategyManager.Register(constant.PolicyTypeTencentCOS, strategy.NewTencentCOSStrategy())
	strategyManager.Register(constant.PolicyTypeAliOSS, strategy.NewAliyunOSSStrategy())
	strategyManager.Register(constant.PolicyTypeS3, strategy.NewAWSS3Strategy())
	strategyManager.Register(constant.PolicyTypeQiniu, strategy.NewQiniuKodoStrategy())

	// 使用智能缓存工厂，自动选择 Redis 或内存缓存
	cacheSvc := utility.NewCacheServiceWithFallback(redisClient)

	tokenSvc := auth.NewTokenService(userRepo, settingSvc, cacheSvc)
	geoSvc, err := utility.NewGeoIPService(settingSvc)
	if err != nil {
		log.Printf("警告: GeoIP 服务初始化失败: %v。IP属地将显示为'未知'", err)
	}
	albumSvc := album.NewAlbumService(albumRepo, tagRepo, albumCategoryRepo, settingSvc)
	albumCategorySvc := album_category_service.NewService(albumCategoryRepo)
	storageProviders := make(map[constant.StoragePolicyType]storage.IStorageProvider)
	localSigningSecret := settingSvc.Get(constant.KeyLocalFileSigningSecret.String())
	parserSvc := parser_service.NewService(settingSvc, eventBus)
	storageProviders[constant.PolicyTypeLocal] = storage.NewLocalProvider(localSigningSecret)
	storageProviders[constant.PolicyTypeOneDrive] = storage.NewOneDriveProvider(storagePolicyRepo)
	storageProviders[constant.PolicyTypeTencentCOS] = storage.NewTencentCOSProvider()
	storageProviders[constant.PolicyTypeAliOSS] = storage.NewAliOSSProvider()
	storageProviders[constant.PolicyTypeS3] = storage.NewAWSS3Provider()
	storageProviders[constant.PolicyTypeQiniu] = storage.NewQiniuKodoProvider()
	metadataSvc := file_info.NewMetadataService(metadataRepo)
	postTagSvc := post_tag_service.NewService(postTagRepo)
	postCategorySvc := post_category_service.NewService(postCategoryRepo, articleRepo)
	docSeriesSvc := doc_series_service.NewService(docSeriesRepo)
	cleanupSvc := cleanup_service.NewCleanupService(cleanupRepo)
	userSvc := user.NewUserService(userRepo, userGroupRepo)
	storagePolicySvc := volume.NewStoragePolicyService(storagePolicyRepo, fileRepo, txManager, strategyManager, settingSvc, cacheSvc, storageProviders)
	thumbnailSvc := thumbnail.NewThumbnailService(metadataSvc, fileRepo, entityRepo, storagePolicySvc, settingSvc, storageProviders)
	pathLocker := utility.NewPathLocker()
	syncSvc := process.NewSyncService(txManager, fileRepo, entityRepo, fileEntityRepo, storagePolicySvc, eventBus, storageProviders, settingSvc)
	vfsSvc := volume.NewVFSService(storagePolicySvc, cacheSvc, fileRepo, entityRepo, settingSvc, storageProviders)
	extractionSvc := file_info.NewExtractionService(fileRepo, settingSvc, metadataSvc, vfsSvc)
	fileSvc := file_service.NewService(fileRepo, storagePolicyRepo, txManager, entityRepo, fileEntityRepo, userGroupRepo, metadataSvc, extractionSvc, cacheSvc, storagePolicySvc, settingSvc, syncSvc, vfsSvc, storageProviders, eventBus, pathLocker)
	uploadSvc := file_service.NewUploadService(txManager, eventBus, entityRepo, metadataSvc, cacheSvc, storagePolicySvc, settingSvc, storageProviders)
	directLinkSvc := direct_link.NewDirectLinkService(directLinkRepo, fileRepo, userGroupRepo, settingSvc, storagePolicyRepo)

	// 初始化图片样式处理服务（Phase 1：纯 Go 引擎 + 磁盘缓存；Phase 2 会接入 vips）
	imageStyleSvc, imageStyleCache := buildImageStyleService(settingSvc, storageProviders, storagePolicyRepo)

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

	// 初始化邮件服务（需要 notificationSvc 和 parserSvc 用于表情包解析）
	emailSvc := utility.NewEmailService(settingSvc, notificationSvc, parserSvc)

	// 初始化文章历史版本服务（需要在taskBroker之前创建，用于定时清理任务）
	articleHistorySvc := article_history_service.NewService(articleHistoryRepo, articleRepo, userRepo)

	taskBroker := task.NewBroker(uploadSvc, thumbnailSvc, cleanupSvc, articleRepo, commentRepo, emailSvc, cacheSvc, linkCategoryRepo, linkTagRepo, linkRepo, settingSvc, statService, articleHistorySvc, nil)
	pageSvc := page_service.NewService(pageRepo)

	// 初始化搜索服务（稍后在插件初始化后会再次检查插件提供的搜索引擎）
	if err := search.InitializeSearchEngine(settingSvc); err != nil {
		log.Printf("初始化搜索引擎失败: %v", err)
	}

	searchSvc := search.NewSearchService()
	sitemapSvc := sitemap.NewService(articleRepo, pageRepo, linkRepo, settingSvc)

	// 重建所有文章的搜索索引（分页获取全部文章）
	go func() {
		log.Println("🔄 开始重建搜索索引...")
		ctx := context.Background()
		if err := searchSvc.RebuildAllIndexes(ctx); err != nil {
			log.Printf("重建搜索索引失败: %v", err)
			return
		}

		const batchSize = 200
		successCount := 0
		totalCount := 0

		for page := 1; ; page++ {
			articles, _, err := articleRepo.List(ctx, &model.ListArticlesOptions{
				WithContent: true,
				Page:        page,
				PageSize:    batchSize,
			})
			if err != nil {
				log.Printf("获取文章列表失败(page=%d): %v", page, err)
				break
			}
			if len(articles) == 0 {
				break
			}
			totalCount += len(articles)

			for _, article := range articles {
				if err := searchSvc.IndexArticle(ctx, article); err != nil {
					log.Printf("为文章 %s 建立索引失败: %v", article.Title, err)
				} else {
					successCount++
				}
			}

			if len(articles) < batchSize {
				break
			}
		}

		log.Printf("✅ 搜索索引重建完成！成功为 %d/%d 篇文章建立索引", successCount, totalCount)
	}()

	// 初始化主色调服务
	log.Printf("[DEBUG] 正在初始化 PrimaryColorService...")
	colorSvc := utility.NewColorService()
	httpClient := &http.Client{Timeout: 10 * time.Second}
	primaryColorSvc := utility.NewPrimaryColorService(colorSvc, settingSvc, fileRepo, directLinkRepo, storagePolicyRepo, httpClient, storageProviders)
	log.Printf("[DEBUG] PrimaryColorService 初始化完成")

	// 初始化CDN服务
	log.Printf("[DEBUG] 正在初始化 CDNService...")
	cdnSvc := cdn.NewService(settingSvc)
	log.Printf("[DEBUG] CDNService 初始化完成")

	// 初始化订阅服务 (需在 ArticleService 之前初始化，Handler 在 captchaSvc 初始化后创建)
	subscriberSvc := subscriber_service.NewService(entClient, redisClient, emailSvc)

	articleSvc := article_service.NewService(articleRepo, postTagRepo, postCategoryRepo, commentRepo, docSeriesRepo, pageRepo, txManager, cacheSvc, geoSvc, taskBroker, settingSvc, parserSvc, fileSvc, directLinkSvc, searchSvc, primaryColorSvc, cdnSvc, subscriberSvc, userRepo)
	// 注入文章历史版本仓储
	articleSvc.SetHistoryRepo(articleHistoryRepo)
	// 注入事件总线，用于文章 CRUD 时通知前端清缓存
	articleSvc.SetEventBus(eventBus)
	// 注入图片样式服务，使上传响应 URL 自动拼默认样式后缀
	articleSvc.SetImageStyleService(imageStyleSvc)
	// articleHistorySvc 已在 taskBroker 之前创建
	log.Printf("[DEBUG] 正在初始化 PushooService...")
	pushooSvc := utility.NewPushooService(settingSvc)
	log.Printf("[DEBUG] PushooService 初始化完成")

	log.Printf("[DEBUG] 正在初始化 LinkService，将注入 PushooService、EmailService 和 EventBus...")
	linkSvc := link_service.NewService(linkRepo, linkCategoryRepo, linkTagRepo, txManager, taskBroker, settingSvc, pushooSvc, emailSvc, eventBus)
	log.Printf("[DEBUG] LinkService 初始化完成，PushooService、EmailService 和 EventBus 已注入")

	authSvc := auth.NewAuthService(userRepo, settingSvc, tokenSvc, emailSvc, txManager, articleSvc)
	log.Printf("[DEBUG] 正在初始化 CommentService，将注入 PushooService 和 NotificationService...")
	commentSvc := comment_service.NewService(commentRepo, userRepo, txManager, geoSvc, settingSvc, cacheSvc, taskBroker, fileSvc, parserSvc, pushooSvc, notificationSvc)
	// 注入图片样式服务，使评论内嵌图片 URL 自动拼默认样式后缀（Plan B Phase 1 Task 1.13.2）
	commentSvc.SetImageStyleService(imageStyleSvc)
	log.Printf("[DEBUG] CommentService 初始化完成，PushooService 和 NotificationService 已注入")
	themeSvc := theme.NewThemeService(entClient, userRepo)
	_ = listener.NewFilePostProcessingListener(eventBus, taskBroker, extractionSvc)

	// 初始化缓存清理服务（SSR 模式下启用）
	revalidateSvc := cache.NewRevalidateService()
	cacheRevalidateListener := listener.NewCacheRevalidateListener(revalidateSvc)
	cacheRevalidateListener.RegisterHandlers(eventBus)

	// 初始化音乐服务
	log.Printf("[DEBUG] 正在初始化 MusicService...")
	musicSvc := music.NewMusicService(settingSvc)
	log.Printf("[DEBUG] MusicService 初始化完成")

	// 初始化配置导入导出服务（备份服务依赖此服务导出/导入系统设置）
	log.Printf("[DEBUG] 正在初始化 ConfigImportExportService...")
	configExtensionHolder := &configExtensionHolder{Ext: opts.ConfigExtension}
	configImportExportSvc := config_service.NewImportExportService(settingRepo, settingSvc, &configExtensionHolder.Ext)
	log.Printf("[DEBUG] ConfigImportExportService 初始化完成")

	// 初始化配置备份服务（备份的是系统设置/数据库配置，与「导出配置」一致）
	log.Printf("[DEBUG] 正在初始化 ConfigBackupService...")
	configBackupSvc := config_service.NewBackupService("data/backup", configImportExportSvc)
	taskBroker.SetBackupService(configBackupSvc)
	log.Printf("[DEBUG] ConfigBackupService 初始化完成")

	// 初始化 Turnstile 人机验证服务
	log.Printf("[DEBUG] 正在初始化 TurnstileService...")
	turnstileSvc := turnstile_service.NewTurnstileService(settingSvc)
	log.Printf("[DEBUG] TurnstileService 初始化完成")

	// 初始化极验人机验证服务
	log.Printf("[DEBUG] 正在初始化 GeetestService...")
	geetestSvc := geetest_service.NewGeetestService(settingSvc)
	log.Printf("[DEBUG] GeetestService 初始化完成")

	// 初始化图形验证码服务
	log.Printf("[DEBUG] 正在初始化 ImageCaptchaService...")
	imageCaptchaSvc := imagecaptcha_service.NewImageCaptchaService(settingSvc, cacheSvc)
	log.Printf("[DEBUG] ImageCaptchaService 初始化完成")

	// 初始化统一验证服务
	log.Printf("[DEBUG] 正在初始化 CaptchaService...")
	captchaSvc := captcha_service.NewCaptchaService(settingSvc, turnstileSvc, geetestSvc, imageCaptchaSvc)
	log.Printf("[DEBUG] CaptchaService 初始化完成")

	// --- Phase 5.5: 初始化 SSR 主题管理器 ---
	ssrManager := ssr.NewManager("./themes")
	ssrThemeHandler := ssrtheme_handler.NewHandler(ssrManager, themeSvc)
	log.Println("✅ SSR 主题管理器初始化成功")

	// 同步 SSR 主题状态到数据库，并自动启动当前 SSR 主题
	go func() {
		ctx := context.Background()

		// 先同步主题状态
		if err := themeSvc.SyncSSRThemesFromFileSystem(ctx, 1, "./themes"); err != nil {
			log.Printf("⚠️ SSR 主题同步失败: %v", err)
			// 同步失败不影响启动流程，继续尝试启动已知的主题
		}

		// 自动启动当前激活的 SSR 主题
		themeName, shouldStart := themeSvc.GetCurrentSSRThemeName(ctx, 1)
		if !shouldStart || themeName == "" {
			log.Println("📝 未检测到需要自动启动的 SSR 主题")
			return
		}

		log.Printf("🚀 检测到当前 SSR 主题: %s，正在自动启动...", themeName)

		// 使用默认端口 3000，带重试机制
		const maxRetries = 3
		const ssrPort = 3000

		for attempt := 1; attempt <= maxRetries; attempt++ {
			if err := ssrManager.Start(themeName, ssrPort); err != nil {
				log.Printf("❌ 自动启动 SSR 主题失败 (尝试 %d/%d): %v", attempt, maxRetries, err)

				// 如果是"已在运行"错误，不需要重试
				if err.Error() == "theme already running" {
					log.Printf("✅ SSR 主题 %s 已在运行", themeName)
					return
				}

				if attempt < maxRetries {
					log.Printf("⏳ 等待 3 秒后重试...")
					time.Sleep(3 * time.Second)
				}
			} else {
				log.Printf("✅ SSR 主题 %s 自动启动成功", themeName)
				return
			}
		}

		log.Printf("❌ SSR 主题 %s 自动启动失败，已达到最大重试次数", themeName)
	}()

	// --- Phase 6: 初始化表现层 (Handlers) ---
	mw := middleware.NewMiddleware(tokenSvc)
	authHandler := auth_handler.NewAuthHandler(authSvc, tokenSvc, settingSvc, captchaSvc)
	albumHandler := album_handler.NewAlbumHandler(albumSvc)
	albumCategoryHandler := album_category_handler.NewHandler(albumCategorySvc)
	userHandler := user_handler.NewUserHandler(userSvc, settingSvc, fileSvc, directLinkSvc)
	// 注入图片样式服务，使头像上传响应 URL 自动拼默认样式后缀
	userHandler.SetImageStyleService(imageStyleSvc)
	publicHandler := public_handler.NewPublicHandler(albumSvc, albumCategorySvc)
	settingHandler := setting_handler.NewSettingHandler(settingSvc, emailSvc, cdnSvc, configBackupSvc)
	storagePolicyHandler := storage_policy_handler.NewStoragePolicyHandler(storagePolicySvc)
	fileHandler := file_handler.NewHandler(fileSvc, uploadSvc, settingSvc)
	directLinkHandler := direct_link_handler.NewDirectLinkHandler(directLinkSvc, storageProviders)
	// 注入图片样式服务，使 `/api/f/:pubID/filename!style` 的本地策略直链下载能走
	// ImageStyleService 的缓存 + 处理流程（Plan B Phase 1 Task 1.13 的客户端落地配套）。
	directLinkHandler.SetImageStyleService(imageStyleSvc)
	linkHandler := link_handler.NewHandler(linkSvc)
	thumbnailHandler := thumbnail_handler.NewThumbnailHandler(taskBroker, metadataSvc, fileSvc, thumbnailSvc, settingSvc)
	articleHandler := article_handler.NewHandler(articleSvc)
	articleHistoryHandler := article_history_handler.NewHandler(articleHistorySvc)
	postTagHandler := post_tag_handler.NewHandler(postTagSvc)
	postCategoryHandler := post_category_handler.NewHandler(postCategorySvc)
	docSeriesHandler := doc_series_handler.NewHandler(docSeriesSvc)
	commentHandler := comment_handler.NewHandler(commentSvc, settingSvc)
	pageHandler := page_handler.NewHandler(pageSvc)
	searchHandler := search_handler.NewHandler(searchSvc)
	statisticsHandler := statistics_handler.NewStatisticsHandler(statService)
	themeHandler := theme_handler.NewHandler(themeSvc, ssrManager)
	sitemapHandler := sitemap_handler.NewHandler(sitemapSvc)
	rssSvc := rss_service.NewService(articleSvc, settingSvc, cacheSvc)
	rssHandler := rss_handler.NewHandler(rssSvc, settingSvc)
	proxyHandler := proxy_handler.NewHandler()
	musicHandler := music_handler.NewMusicHandler(musicSvc)
	versionHandler := version_handler.NewHandler()
	notificationHandler := notification_handler.NewHandler(notificationSvc)
	configBackupHandler := config_handler.NewConfigBackupHandler(configBackupSvc)
	configImportExportHandler := config_handler.NewConfigImportExportHandler(configImportExportSvc)
	subscriberHandler := subscriber_handler.NewHandler(subscriberSvc, captchaSvc)
	captchaHandler := captcha_handler.NewHandler(captchaSvc)
	imageHandler := image_handler.NewHandler(imageStyleSvc, fileRepo, storagePolicyRepo, directLinkSvc)

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
		articleHistoryHandler,
		postTagHandler,
		postCategoryHandler,
		docSeriesHandler,
		commentHandler,
		linkHandler,
		musicHandler,
		pageHandler,
		statisticsHandler,
		themeHandler,
		ssrThemeHandler,
		mw,
		searchHandler,
		proxyHandler,
		sitemapHandler,
		rssHandler,
		versionHandler,
		notificationHandler,
		configBackupHandler,
		configImportExportHandler,
		subscriberHandler,
		captchaHandler,
		imageHandler,
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
	err = engine.SetTrustedProxies(util.TrustedProxyCIDRs)
	if err != nil {
		return nil, nil, fmt.Errorf("设置信任代理失败: %w", err)
	}
	engine.ForwardedByClientIP = true

	// 全局 gzip 压缩：默认压缩等级，跳过已经压缩好的二进制资源（图片/视频/已压缩归档）。
	// 对 JSON/HTML/JS/CSS/Sitemap 等文本响应能显著降低带宽与首屏 TTFB。
	engine.Use(gzip.Gzip(
		gzip.DefaultCompression,
		gzip.WithExcludedExtensions([]string{
			".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif",
			".mp4", ".webm", ".mp3", ".ogg", ".flac",
			".zip", ".gz", ".br", ".7z", ".rar", ".woff", ".woff2",
		}),
	))

	siteURL := settingSvc.Get(constant.KeySiteURL.String())
	if siteURL != "" {
		middleware.SetCORSAllowedOrigins([]string{siteURL})
	} else {
		log.Println("⚠️  警告: 站点URL(SiteURL)未配置，跨域请求将被拒绝。请在后台设置中配置站点URL。")
	}
	engine.Use(middleware.Cors())

	// 设置 SSR 主题检查器（基于数据库状态判断是否应该代理）
	// 这样即使 SSR 进程还在运行，切换到普通主题后也不会代理
	middleware.SetSSRThemeChecker(func() (string, bool) {
		// 使用固定的 userID=1（管理员）检查当前 SSR 主题状态
		ctx := context.Background()
		return themeSvc.GetCurrentSSRThemeName(ctx, 1)
	})

	// 注册 SSR 代理中间件（在路由之前）
	// 当有 SSR 主题运行且数据库标记为当前主题时，前台请求会被代理到 SSR 主题
	engine.Use(middleware.SSRProxyMiddleware(ssrManager))
	log.Println("✅ SSR 代理中间件已注册（基于数据库状态判断）")

	if opts.SkipFrontend {
		log.Println("⏭️  SkipFrontend=true，跳过内嵌前端路由注册（由外部前端服务处理）")
	} else {
		router.SetupFrontend(engine, settingSvc, articleSvc, cacheSvc, content, cfg, pageRepo)
	}
	appRouter.Setup(engine)

	// 插件系统：社区版在此初始化；Pro 版在 main 中自行 InitManager 并注册 /api/admin/plugins，须设 SkipPluginSystem 避免重复
	var pluginMgr *plugin.Manager
	if opts.SkipPluginSystem {
		log.Println("⏭️  SkipPluginSystem=true，跳过社区版插件初始化与 /api/admin/plugins（由宿主进程负责）")
	} else {
		// 初始化插件系统：扫描 data/plugins/ 目录，加载运行时插件
		pluginDir := filepath.Join("data", "plugins")
		var pluginErr error
		pluginMgr, pluginErr = plugin.InitManager(pluginDir)
		if pluginErr != nil {
			log.Printf("插件发现失败: %v", pluginErr)
		}

		// 插件提供的搜索引擎优先级最高
		if pluginMgr != nil {
			if pluginSearcher := pluginMgr.BestSearcher(); pluginSearcher != nil {
				search.AppSearcher = pluginSearcher
				log.Println("✅ 搜索引擎已切换为插件提供的实现")
			}
		}

		// 注册插件管理 API 路由
		pluginAdminHandler := plugin_admin_handler.NewHandler(pluginMgr)
		adminPluginGroup := engine.Group("/api/admin/plugins", mw.AdminAuth())
		{
			adminPluginGroup.GET("", pluginAdminHandler.List)
			adminPluginGroup.POST("/:id/reload", pluginAdminHandler.Reload)
			adminPluginGroup.POST("/:id/disable", pluginAdminHandler.Disable)
			adminPluginGroup.POST("/:id/enable", pluginAdminHandler.Enable)
		}

		// 设置搜索引擎切换回调（插件热加载时自动切换搜索引擎）
		if pluginMgr != nil {
			pluginMgr.SetSearcherChangeCallback(func(searcher model.Searcher) {
				if searcher != nil {
					search.AppSearcher = searcher
					log.Println("✅ 搜索引擎已由插件热更新")
				}
			})
		}
	}

	// --- 微信分享路由 ---
	setupWechatShareRoutes(engine, settingSvc)

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
		settingRepo:          settingRepo,
		settingSvc:           settingSvc,
		tokenSvc:             tokenSvc,
		userSvc:              userSvc,
		fileRepo:             fileRepo,
		entityRepo:           entityRepo,
		cacheSvc:             cacheSvc,
		eventBus:             eventBus,
		postCategorySvc:      postCategorySvc,
		postTagSvc:           postTagSvc,
		commentSvc:           commentSvc,
		themeSvc:             themeSvc,
		themeHandler:         themeHandler,
		ssrManager:            ssrManager,
		ssrThemeHandler:       ssrThemeHandler,
		imageStyleService:     imageStyleSvc,
		imageStyleCache:       imageStyleCache,
		configExtensionHolder: configExtensionHolder,
	}

	// 创建cleanup函数
	cleanup := func() {
		log.Println("执行清理操作...")

		// 关闭插件进程
		if pluginMgr != nil {
			pluginMgr.Shutdown()
		}

		// 停止所有 SSR 主题
		log.Println("停止所有 SSR 主题...")
		ssrManager.StopAll()

		// 关闭图片样式缓存的后台 goroutine
		if imageStyleCache != nil {
			_ = imageStyleCache.Close()
		}

		// 关闭数据库连接
		log.Println("关闭数据库连接...")
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

func (a *App) SettingRepository() repository.SettingRepository {
	return a.settingRepo
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

// PostTagService 返回文章标签服务（用于 PRO 版多人共创功能）
func (a *App) PostTagService() *post_tag_service.Service {
	return a.postTagSvc
}

// CommentService 返回评论服务（用于 PRO 版注入站内通知回调）
func (a *App) CommentService() *comment_service.Service {
	return a.commentSvc
}

// ThemeService 返回主题服务（用于 PRO 版获取主题商城列表）
func (a *App) ThemeService() theme.ThemeService {
	return a.themeSvc
}

// SSRManager 返回 SSR 主题管理器（用于 PRO 版继承 SSR 功能）
func (a *App) SSRManager() *ssr.Manager {
	return a.ssrManager
}

// SSRThemeHandler 返回 SSR 主题处理器（用于 PRO 版继承 SSR 功能）
func (a *App) SSRThemeHandler() *ssrtheme_handler.Handler {
	return a.ssrThemeHandler
}

// ThemeHandler 返回主题处理器（用于 PRO 版配置为 PRO 模式）
func (a *App) ThemeHandler() *theme_handler.Handler {
	return a.themeHandler
}

// ImageStyleService 返回图片样式处理服务（供 PRO 版图片 handler / 上传流程复用）。
// 若启动时缓存初始化失败，此处可能返回 nil；调用方需做 nil-check。
func (a *App) ImageStyleService() image_style.ImageStyleService {
	return a.imageStyleService
}

// ConfigureImageStyleWarmLister 允许 PRO 启动时注入 WarmFileLister，
// 开启 `/api/pro/admin/image-styles/cache/warm` 的异步预热能力。
// 若 ImageStyleService 尚未就绪（如缓存初始化失败），本方法是 no-op。
func (a *App) ConfigureImageStyleWarmLister(l image_style.WarmFileLister) {
	if a.imageStyleService == nil {
		return
	}
	if svc, ok := a.imageStyleService.(*image_style.Service); ok {
		svc.SetWarmFileLister(l)
	}
}

// buildImageStyleService 从 settingSvc 读取缓存配置并装配图片样式服务。
// Phase 1 primary/fallback 都是 NativeGoEngine；Phase 2 Task 2.3 会在 Probe 可用时改用 VipsEngine。
// 若磁盘缓存创建失败，会记录警告并返回 (nil, nil)，服务功能对应降级。
func buildImageStyleService(
	settingSvc setting.SettingService,
	providers map[constant.StoragePolicyType]storage.IStorageProvider,
	policyRepo repository.StoragePolicyRepository,
) (image_style.ImageStyleService, *image_style.DiskCache) {
	cacheRoot := settingSvc.Get(constant.KeyImageStyleCachePath.String())
	if cacheRoot == "" {
		cacheRoot = "./data/cache/image_styles"
	}
	maxMB, err := strconv.Atoi(settingSvc.Get(constant.KeyImageStyleCacheMaxMB.String()))
	if err != nil || maxMB < 0 {
		maxMB = 1024
	}
	cleanupSec, err := strconv.Atoi(settingSvc.Get(constant.KeyImageStyleCacheCleanupInterval.String()))
	if err != nil || cleanupSec < 0 {
		cleanupSec = 600
	}

	cache, err := image_style.NewDiskCache(image_style.CacheConfig{
		Root:            cacheRoot,
		MaxSizeBytes:    int64(maxMB) * 1024 * 1024,
		CleanupInterval: time.Duration(cleanupSec) * time.Second,
	})
	if err != nil {
		log.Printf("⚠️  图片样式缓存初始化失败（功能暂不可用）: %v", err)
		return nil, nil
	}

	capability := image_style_engine.Probe()
	// Phase 3 Task 3.4：装配纯 Go 水印实现，并让引擎内部调用。
	watermarker := image_style.NewNativeWatermarker()
	eng := image_style_engine.NewAutoEngine(capability,
		image_style_engine.WithAutoWatermarker(watermarker),
	)
	svc := image_style.NewService(eng, cache, providers, policyRepo, watermarker)
	if capability.Available {
		log.Printf("✅ 图片样式引擎：vips %s @ %s", capability.Version, capability.BinaryPath)
	} else {
		log.Println("ℹ️  图片样式引擎：纯 Go（未检测到 vips，支持 jpg/png 输入输出）")
	}
	log.Printf("   缓存目录：%s；上限 %d MB；清理周期 %d 秒", cacheRoot, maxMB, cleanupSec)
	return svc, cache
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

// getOrCreateIDSeed 从数据库获取或创建 IDSeed
// IDSeed 用于生成唯一的公共ID，存储在数据库中以防止被外部修改
// 重要：对于已有数据的老用户，使用空字符串（默认字母表）保持兼容
func getOrCreateIDSeed(ctx context.Context, settingRepo repository.SettingRepository, userRepo repository.UserRepository) (string, error) {
	const idSeedKey = "id_seed"

	// 尝试从数据库获取现有的 IDSeed
	setting, err := settingRepo.FindByKey(ctx, idSeedKey)
	if err == nil && setting != nil {
		// 已存在配置（包括空字符串的情况，表示老用户兼容模式）
		if setting.Value != "" {
			log.Println("📦 已从数据库加载 IDSeed")
		} else {
			log.Println("📦 使用兼容模式（默认字母表）")
		}
		return setting.Value, nil
	}

	// id_seed 不存在，需要判断是全新安装还是老用户升级
	// 通过检查用户表是否有数据来判断（有用户 = 老用户升级，无用户 = 全新安装）
	userCount, err := userRepo.Count(ctx)
	if err != nil {
		log.Printf("警告: 无法查询用户数量: %v，假设为老用户升级", err)
		userCount = 1 // 保守处理，假设有用户
	}

	var newSeed string
	var comment string

	if userCount > 0 {
		// 已有用户数据，说明是老用户升级，使用空字符串保持兼容
		newSeed = ""
		comment = "兼容模式：老用户升级，使用默认字母表"
		log.Println("⚠️  检测到老用户升级，使用兼容模式（默认字母表）以保持已有ID正常解码")
	} else {
		// 用户表为空，说明是全新安装，生成新的随机种子
		newSeed, err = idgen.GenerateRandomSeed()
		if err != nil {
			return "", fmt.Errorf("生成随机 IDSeed 失败: %w", err)
		}
		comment = "系统自动生成的ID种子，用于生成唯一的公共ID，请勿修改"
		log.Println("✅ 全新安装，已生成随机 IDSeed")
	}

	// 保存到数据库（无论是空字符串还是新种子，都要保存，避免重复判断）
	newSetting := &model.Setting{
		ConfigKey: idSeedKey,
		Value:     newSeed,
		Comment:   comment,
	}
	if err := settingRepo.Save(ctx, newSetting); err != nil {
		return "", fmt.Errorf("保存 IDSeed 到数据库失败: %w", err)
	}

	return newSeed, nil
}

// setupWechatShareRoutes 设置微信分享相关路由
func setupWechatShareRoutes(engine *gin.Engine, settingSvc setting.SettingService) {
	// 获取微信分享配置
	wechatEnable := settingSvc.Get(constant.KeyWechatShareEnable.String())
	wechatAppID := settingSvc.Get(constant.KeyWechatShareAppID.String())
	wechatAppSecret := settingSvc.Get(constant.KeyWechatShareAppSecret.String())

	// 如果未启用或配置不完整，跳过初始化
	if wechatEnable != "true" || wechatAppID == "" || wechatAppSecret == "" {
		log.Println("⚠️ 微信分享功能未启用或配置不完整，跳过初始化")
		return
	}

	log.Println("🔧 初始化微信JS-SDK分享服务...")

	// 创建微信分享服务
	jssdkService := wechat_service.NewJSSDKService(wechatAppID, wechatAppSecret)
	wechatShareHandler := wechat_handler.NewHandler(jssdkService)

	// 注册路由
	wechatGroup := engine.Group("/api/wechat/jssdk")
	{
		wechatGroup.GET("/config", wechatShareHandler.GetJSSDKConfig)    // 获取JS-SDK配置
		wechatGroup.GET("/status", wechatShareHandler.CheckShareEnabled) // 检查分享功能状态
	}

	log.Println("✅ 微信JS-SDK分享服务已启动")
}
