// anheyu-app/pkg/service/article/service.go
package article

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"path"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/anzhiyu-c/anheyu-app/internal/app/task"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/cdn"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/direct_link"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/file"
	appParser "github.com/anzhiyu-c/anheyu-app/pkg/service/parser"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/search"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"
)

type Service interface {
	UploadArticleImage(ctx context.Context, ownerID uint, fileReader io.Reader, originalFilename string) (fileURL string, publicFileID string, err error)
	// UploadArticleImageWithGroup 上传文章图片，并检查用户组权限
	UploadArticleImageWithGroup(ctx context.Context, ownerID, userGroupID uint, fileReader io.Reader, originalFilename string) (fileURL string, publicFileID string, err error)
	Create(ctx context.Context, req *model.CreateArticleRequest, ip string) (*model.ArticleResponse, error)
	Get(ctx context.Context, publicID string) (*model.ArticleResponse, error)
	Update(ctx context.Context, publicID string, req *model.UpdateArticleRequest, ip string) (*model.ArticleResponse, error)
	Delete(ctx context.Context, publicID string) error
	List(ctx context.Context, options *model.ListArticlesOptions) (*model.ArticleListResponse, error)
	GetPublicBySlugOrID(ctx context.Context, slugOrID string) (*model.ArticleDetailResponse, error)
	GetBySlugOrIDForPreview(ctx context.Context, slugOrID string) (*model.ArticleDetailResponse, error)
	ListPublic(ctx context.Context, options *model.ListPublicArticlesOptions) (*model.ArticleListResponse, error)
	ListHome(ctx context.Context) ([]model.ArticleResponse, error)
	ListArchives(ctx context.Context) (*model.ArchiveSummaryResponse, error)
	GetRandom(ctx context.Context) (*model.ArticleResponse, error)
	ToAPIResponse(a *model.Article, useAbbrlinkAsID bool, includeHTML bool) *model.ArticleResponse
	GetPrimaryColorFromURL(ctx context.Context, imageURL string) (string, error)

	// 多人共创功能：获取文章作者ID
	GetArticleOwnerID(ctx context.Context, publicID string) (uint, error)

	// 导入导出功能
	ExportArticles(ctx context.Context, articleIDs []string) (*ExportArticleData, error)
	ExportArticlesToZip(ctx context.Context, articleIDs []string) ([]byte, error)
	ImportArticles(ctx context.Context, req *ImportArticleRequest) (*ImportResult, error)
	ImportArticlesFromJSON(ctx context.Context, jsonData []byte, req *ImportArticleRequest) (*ImportResult, error)
	ImportArticlesFromZip(ctx context.Context, zipData []byte, req *ImportArticleRequest) (*ImportResult, error)
}

type serviceImpl struct {
	repo             repository.ArticleRepository
	postTagRepo      repository.PostTagRepository
	postCategoryRepo repository.PostCategoryRepository
	commentRepo      repository.CommentRepository
	txManager        repository.TransactionManager
	cacheSvc         utility.CacheService
	geoService       utility.GeoIPService
	broker           *task.Broker
	settingSvc       setting.SettingService
	httpClient       *http.Client
	parserSvc        *appParser.Service
	fileSvc          file.FileService
	directLinkSvc    direct_link.Service
	searchSvc        *search.SearchService
	primaryColorSvc  *utility.PrimaryColorService
	cdnSvc           cdn.CDNService

	userRepo repository.UserRepository
}

func NewService(
	repo repository.ArticleRepository,
	postTagRepo repository.PostTagRepository,
	postCategoryRepo repository.PostCategoryRepository,
	commentRepo repository.CommentRepository,
	txManager repository.TransactionManager,
	cacheSvc utility.CacheService,
	geoService utility.GeoIPService,
	broker *task.Broker,
	settingSvc setting.SettingService,
	parserSvc *appParser.Service,
	fileSvc file.FileService,
	directLinkSvc direct_link.Service,
	searchSvc *search.SearchService,
	primaryColorSvc *utility.PrimaryColorService,
	cdnSvc cdn.CDNService,
	userRepo repository.UserRepository,
) Service {
	return &serviceImpl{
		repo:             repo,
		postTagRepo:      postTagRepo,
		postCategoryRepo: postCategoryRepo,
		commentRepo:      commentRepo,
		txManager:        txManager,
		cacheSvc:         cacheSvc,
		geoService:       geoService,
		broker:           broker,
		settingSvc:       settingSvc,
		httpClient:       &http.Client{Timeout: 10 * time.Second},
		parserSvc:        parserSvc,
		fileSvc:          fileSvc,
		directLinkSvc:    directLinkSvc,
		searchSvc:        searchSvc,
		primaryColorSvc:  primaryColorSvc,
		cdnSvc:           cdnSvc,
		userRepo:         userRepo,
	}
}

// UploadArticleImage 处理文章图片的上传，并为其创建直链。
// 此方法不检查用户组权限，仅供系统内部调用。
func (s *serviceImpl) UploadArticleImage(ctx context.Context, ownerID uint, fileReader io.Reader, originalFilename string) (string, string, error) {
	return s.UploadArticleImageWithGroup(ctx, ownerID, 0, fileReader, originalFilename)
}

// UploadArticleImageWithGroup 处理文章图片的上传，并检查用户组权限。
func (s *serviceImpl) UploadArticleImageWithGroup(ctx context.Context, ownerID, userGroupID uint, fileReader io.Reader, originalFilename string) (string, string, error) {
	ext := path.Ext(originalFilename)
	uniqueFilename := strconv.FormatInt(time.Now().UnixNano(), 10) + ext

	log.Printf("[文章图片上传] 准备将 '%s' 作为 '%s' 上传到文章存储策略", originalFilename, uniqueFilename)
	fileItem, err := s.fileSvc.UploadFileByPolicyFlagWithGroup(ctx, ownerID, userGroupID, fileReader, constant.PolicyFlagArticleImage, uniqueFilename)
	if err != nil {
		log.Printf("[文章图片上传] 调用 fileSvc.UploadFileByPolicyFlagWithGroup 失败: %v", err)
		return "", "", fmt.Errorf("文件上传到系统策略失败: %w", err)
	}
	log.Printf("[文章图片上传] 文件上传成功，新文件公共ID: %s", fileItem.ID)

	// 将文件的公共ID(string)解码为数据库ID(uint)
	dbFileID, _, err := idgen.DecodePublicID(fileItem.ID)
	if err != nil {
		log.Printf("[文章图片上传] 解码文件公共ID '%s' 失败: %v", fileItem.ID, err)
		return "", "", fmt.Errorf("无效的文件ID: %w", err)
	}

	// 3. 为上传成功的文件创建直链
	linksMap, err := s.directLinkSvc.GetOrCreateDirectLinks(ctx, ownerID, []uint{dbFileID})
	if err != nil {
		log.Printf("[文章图片上传] 为文件 %d 创建直链时发生错误: %v", dbFileID, err)
		return "", "", fmt.Errorf("创建直链失败: %w", err)
	}

	// 4. 从 map 中通过文件数据库ID获取对应的结果
	linkResult, ok := linksMap[dbFileID]
	if !ok || linkResult.URL == "" {
		log.Printf("[文章图片上传] directLinkSvc 未能返回文件 %d 的直链结果", dbFileID)
		return "", "", fmt.Errorf("获取直链URL失败")
	}

	// 5. 获取文章图片存储策略的样式分隔符配置
	finalURL := linkResult.URL

	// 查询标记为 article_image 的存储策略
	policy, err := s.fileSvc.GetPolicyByFlag(ctx, constant.PolicyFlagArticleImage)
	if err != nil {
		log.Printf("[文章图片上传] 获取文章图片存储策略失败: %v，使用原始URL", err)
	} else if policy != nil && policy.Settings != nil {
		// 从存储策略配置中获取样式分隔符
		if styleSeparator, ok := policy.Settings[constant.StyleSeparatorSettingKey].(string); ok && styleSeparator != "" {
			// 只有腾讯云COS和阿里云OSS支持样式分隔符
			if policy.Type == constant.PolicyTypeTencentCOS || policy.Type == constant.PolicyTypeAliOSS {
				finalURL = finalURL + styleSeparator
				log.Printf("[文章图片上传] 已拼接样式分隔符: %s，最终URL: %s", styleSeparator, finalURL)
			}
		}
	}

	log.Printf("[文章图片上传] 成功获取最终直链URL: %s", finalURL)

	return finalURL, fileItem.ID, nil
}

func (s *serviceImpl) determinePrimaryColor(ctx context.Context, topImgURL, coverURL string) string {
	imageURLToUse := ""
	if topImgURL != "" {
		imageURLToUse = topImgURL
	} else if coverURL != "" {
		imageURLToUse = coverURL
	}

	if imageURLToUse == "" {
		log.Printf("[determinePrimaryColor] 没有可用的图片URL，返回空字符串")
		return ""
	}

	// 使用新的主色调服务智能获取主色调
	// 返回空字符串表示获取失败，前端应使用默认值
	color := s.primaryColorSvc.GetPrimaryColorFromURL(ctx, imageURLToUse)
	if color == "" {
		log.Printf("[determinePrimaryColor] 主色调服务获取失败，返回空字符串，前端将使用默认值")
	}
	return color
}

// updateSiteStatsInBackground 异步更新全站的文章和字数统计配置。
func (s *serviceImpl) updateSiteStatsInBackground() {
	go func() {
		ctx := context.Background()
		stats, err := s.repo.GetSiteStats(ctx)
		if err != nil {
			log.Printf("[错误] updateSiteStats: 无法获取站点统计数据: %v", err)
			return
		}

		settingsToUpdate := make(map[string]string)

		postCountKey := constant.KeySidebarSiteInfoTotalPostCount.String()
		currentPostCountStr := s.settingSvc.Get(postCountKey)
		if currentPostCountStr != "-1" {
			settingsToUpdate[postCountKey] = strconv.Itoa(stats.TotalPosts)
		} else {
			log.Printf("[信息] 跳过文章总数更新，因为其在后台被设置为禁用 (-1)。")
		}

		wordCountKey := constant.KeySidebarSiteInfoTotalWordCount.String()
		currentWordCountStr := s.settingSvc.Get(wordCountKey)
		if currentWordCountStr != "-1" {
			settingsToUpdate[wordCountKey] = strconv.Itoa(stats.TotalWords)
		} else {
			log.Printf("[信息] 跳过全站字数更新，因为其在后台被设置为禁用 (-1)。")
		}

		if len(settingsToUpdate) > 0 {
			if err := s.settingSvc.UpdateSettings(ctx, settingsToUpdate); err != nil {
				log.Printf("[错误] updateSiteStats: 更新站点统计配置失败: %v", err)
			} else {
				log.Printf("[信息] 站点统计已更新：%v", settingsToUpdate)
			}
		} else {
			log.Printf("[信息] 无需更新站点统计，所有项均被禁用。")
		}
	}()
}

// calculatePostStats 是一个私有辅助函数，用于从 Markdown 内容计算字数和预计阅读时长。
func calculatePostStats(content string) (wordCount, readingTime int) {
	chineseCharCount := 0
	for _, r := range content {
		if unicode.Is(unicode.Han, r) {
			chineseCharCount++
		}
	}
	englishWordCount := len(strings.Fields(content))
	wordCount = chineseCharCount + englishWordCount
	const wordsPerMinute = 200
	if wordCount > 0 {
		readingTime = int(math.Ceil(float64(wordCount) / wordsPerMinute))
	}
	if readingTime == 0 && wordCount > 0 {
		readingTime = 1
	}
	return wordCount, readingTime
}

// ToAPIResponse 将领域模型转换为用于API响应的DTO。
func (s *serviceImpl) ToAPIResponse(a *model.Article, useAbbrlinkAsID bool, includeHTML bool) *model.ArticleResponse {
	if a == nil {
		return nil
	}
	tags := make([]*model.PostTagResponse, len(a.PostTags))
	for i, t := range a.PostTags {
		tags[i] = &model.PostTagResponse{ID: t.ID, CreatedAt: t.CreatedAt, UpdatedAt: t.UpdatedAt, Name: t.Name, Count: t.Count}
	}
	categories := make([]*model.PostCategoryResponse, len(a.PostCategories))
	for i, c := range a.PostCategories {
		categories[i] = &model.PostCategoryResponse{ID: c.ID, CreatedAt: c.CreatedAt, UpdatedAt: c.UpdatedAt, Name: c.Name, Description: c.Description, Count: c.Count, IsSeries: c.IsSeries}
	}

	responseID := a.ID
	if useAbbrlinkAsID && a.Abbrlink != "" {
		responseID = a.Abbrlink
	}

	effectiveTopImgURL := a.TopImgURL
	if effectiveTopImgURL == "" {
		effectiveTopImgURL = a.CoverURL
	}

	resp := &model.ArticleResponse{
		ID:                   responseID,
		CreatedAt:            a.CreatedAt,
		UpdatedAt:            a.UpdatedAt,
		Title:                a.Title,
		ContentMd:            a.ContentMd,
		CoverURL:             a.CoverURL,
		Status:               a.Status,
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
		TopImgURL:            effectiveTopImgURL,
		Summaries:            a.Summaries,
		Abbrlink:             a.Abbrlink,
		Copyright:            a.Copyright,
		CopyrightAuthor:      a.CopyrightAuthor,
		CopyrightAuthorHref:  a.CopyrightAuthorHref,
		CopyrightURL:         a.CopyrightURL,
		Keywords:             a.Keywords,
		ReviewStatus:         a.ReviewStatus,   // 审核状态（多人共创功能）
		OwnerID:              a.OwnerID,        // 发布者ID（多人共创功能）
		IsTakedown:           a.IsTakedown,     // 下架状态（PRO版管理员功能）
		TakedownReason:       a.TakedownReason, // 下架原因
		TakedownAt:           a.TakedownAt,     // 下架时间
		TakedownBy:           a.TakedownBy,     // 下架操作人
	}

	if includeHTML {
		resp.ContentHTML = a.ContentHTML
	}
	return resp
}

// 将领域模型转换为简化的 API 响应
func toSimpleAPIResponse(a *model.Article) *model.SimpleArticleResponse {
	if a == nil {
		return nil
	}
	responseID := a.ID
	if a.Abbrlink != "" {
		responseID = a.Abbrlink
	}
	return &model.SimpleArticleResponse{ID: responseID, Title: a.Title, CoverURL: a.CoverURL, Abbrlink: a.Abbrlink, CreatedAt: a.CreatedAt}
}

// getCacheKey 生成文章渲染结果的 Redis 缓存键。
func (s *serviceImpl) getCacheKey(publicID string) string {
	return fmt.Sprintf("article:html:%s", publicID)
}

// ownerInfoCache 用于缓存用户信息（昵称、头像和邮箱）
type ownerInfoCache struct {
	Nickname string
	Avatar   string
	Email    string
}

// fillOwnerInfo 填充文章发布者信息（昵称、头像和邮箱，使用简单缓存避免重复查询）
func (s *serviceImpl) fillOwnerInfo(ctx context.Context, resp *model.ArticleResponse, cache map[uint]*ownerInfoCache) {
	if resp == nil || resp.OwnerID == 0 || s.userRepo == nil {
		return
	}

	// 已有完整信息则跳过
	if resp.OwnerNickname != "" && resp.OwnerAvatar != "" && resp.OwnerEmail != "" {
		return
	}

	// 先查缓存
	if cache != nil {
		if info, ok := cache[resp.OwnerID]; ok {
			resp.OwnerNickname = info.Nickname
			resp.OwnerAvatar = info.Avatar
			resp.OwnerEmail = info.Email
			return
		}
	}

	// 查询用户信息
	user, err := s.userRepo.FindByID(ctx, resp.OwnerID)
	if err != nil || user == nil {
		return
	}
	resp.OwnerNickname = user.Nickname
	resp.OwnerAvatar = user.Avatar
	resp.OwnerEmail = user.Email

	// 写入缓存
	if cache != nil {
		cache[resp.OwnerID] = &ownerInfoCache{
			Nickname: user.Nickname,
			Avatar:   user.Avatar,
			Email:    user.Email,
		}
	}
}

// fillOwnerNickname 填充文章发布者的昵称、头像和邮箱（保留用于兼容）
// Deprecated: 请使用 fillOwnerInfo
func (s *serviceImpl) fillOwnerNickname(ctx context.Context, resp *model.ArticleResponse, cache map[uint]string) {
	if resp == nil || resp.OwnerID == 0 || s.userRepo == nil {
		return
	}

	// 已有昵称则跳过（但仍需要填充头像和邮箱）
	needsFill := resp.OwnerNickname == "" || resp.OwnerAvatar == "" || resp.OwnerEmail == ""
	if !needsFill {
		return
	}

	// 先查缓存（仅缓存昵称，头像和邮箱需要从用户信息获取）
	if cache != nil && resp.OwnerNickname == "" {
		if nickname, ok := cache[resp.OwnerID]; ok {
			resp.OwnerNickname = nickname
			// 缓存命中昵称，但还需要查询用户获取头像和邮箱
		}
	}

	// 查询用户信息
	user, err := s.userRepo.FindByID(ctx, resp.OwnerID)
	if err != nil || user == nil {
		return
	}
	if resp.OwnerNickname == "" {
		resp.OwnerNickname = user.Nickname
	}
	resp.OwnerAvatar = user.Avatar
	resp.OwnerEmail = user.Email

	// 写入缓存
	if cache != nil {
		cache[resp.OwnerID] = user.Nickname
	}
}

// invalidateRelatedCaches 清除与文章相关的所有缓存
func (s *serviceImpl) invalidateRelatedCaches(ctx context.Context) {
	// 清除 RSS feed 缓存
	if err := s.cacheSvc.Delete(ctx, "rss:feed:latest"); err != nil {
		log.Printf("[警告] 清除 RSS 缓存失败: %v", err)
	}

	// 清除首页缓存相关的键
	homePageKeys := []string{
		"home:articles:cache",
		"home:featured:cache",
		"sidebar:recent:cache",
	}
	for _, key := range homePageKeys {
		if err := s.cacheSvc.Delete(ctx, key); err != nil {
			log.Printf("[警告] 清除首页缓存 %s 失败: %v", key, err)
		}
	}

	log.Printf("[信息] 已清除文章相关缓存，包括RSS和首页缓存")
}

// invalidateArticleCache 清除特定文章的缓存（包括CDN缓存）
func (s *serviceImpl) invalidateArticleCache(ctx context.Context, articleID, abbrlink string) {
	// 清除Redis缓存
	cacheKeys := []string{
		s.getCacheKey(articleID),
	}

	if abbrlink != "" {
		cacheKeys = append(cacheKeys, s.getCacheKey(abbrlink))
	}

	for _, key := range cacheKeys {
		if err := s.cacheSvc.Delete(ctx, key); err != nil {
			log.Printf("[警告] 清除文章缓存 %s 失败: %v", key, err)
		}
	}

	// 异步清除CDN缓存
	go func() {
		if s.cdnSvc != nil {
			// 使用文章ID清除CDN缓存（优先使用abbrlink）
			cacheID := articleID
			if abbrlink != "" {
				cacheID = abbrlink
			}

			if err := s.cdnSvc.PurgeArticleCache(context.Background(), cacheID); err != nil {
				log.Printf("[警告] 清除CDN缓存失败: %v", err)
			} else {
				log.Printf("[信息] CDN缓存清除成功，文章ID: %s", cacheID)
			}
		}
	}()

	log.Printf("[信息] 已清除文章 %s 的相关缓存（包括CDN）", articleID)
}

// GetPublicBySlugOrID 为公开浏览，通过 slug 或 ID 获取单篇文章，并处理浏览量。
func (s *serviceImpl) GetPublicBySlugOrID(ctx context.Context, slugOrID string) (*model.ArticleDetailResponse, error) {
	article, err := s.repo.GetBySlugOrID(ctx, slugOrID)
	if err != nil {
		return nil, err
	}

	currentArticleDbID, _, _ := idgen.DecodePublicID(article.ID)

	var wg sync.WaitGroup
	var chronoPrev, chronoNext *model.Article
	var relatedArticles []*model.Article
	var prevErr, nextErr, relatedErr error

	wg.Add(3)

	go func() {
		defer wg.Done()
		chronoPrev, prevErr = s.repo.GetPrevArticle(ctx, currentArticleDbID, article.CreatedAt)
	}()

	go func() {
		defer wg.Done()
		chronoNext, nextErr = s.repo.GetNextArticle(ctx, currentArticleDbID, article.CreatedAt)
	}()

	go func() {
		defer wg.Done()
		relatedArticles, relatedErr = s.repo.FindRelatedArticles(ctx, article, 2)
	}()

	viewCacheKey := s.getArticleViewCacheKey(article.ID)
	go func() {
		if _, err := s.cacheSvc.Increment(context.Background(), viewCacheKey); err != nil {
			log.Printf("[错误] 无法在 Redis 中为文章 %s 增加浏览次数: %v", article.ID, err)
		}
	}()

	redisIncrStr, err := s.cacheSvc.Get(ctx, viewCacheKey)
	if err != nil {
		log.Printf("[警告] 无法从 Redis 获取文章 %s 的增量浏览量: %v。将只返回数据库中的值。", article.ID, err)
	}

	var redisIncr int
	if redisIncrStr != "" {
		val, convErr := strconv.Atoi(redisIncrStr)
		if convErr == nil {
			redisIncr = val
		}
	}
	article.ViewCount += redisIncr

	wg.Wait()

	if prevErr != nil {
		log.Printf("[警告] 获取上一篇文章失败: %v", prevErr)
	}
	if nextErr != nil {
		log.Printf("[警告] 获取下一篇文章失败: %v", nextErr)
	}
	if relatedErr != nil {
		log.Printf("[警告] 获取相关文章失败: %v", relatedErr)
	}

	// 同时返回上一篇和下一篇（如果存在）
	// chronoPrev: 数据库查询得到的创建时间更早的文章
	// chronoNext: 数据库查询得到的创建时间更晚的文章
	//
	// 按照用户阅读习惯（从新到旧浏览）：
	// - "上一篇"应该带用户往更新的文章走 → chronoNext（创建时间更晚）
	// - "下一篇"应该带用户往更早的文章走 → chronoPrev（创建时间更早）
	finalPrevArticle := chronoNext // 上一篇 = 创建时间更晚的文章
	finalNextArticle := chronoPrev // 下一篇 = 创建时间更早的文章

	if chronoPrev == nil {
		log.Printf("[信息] GetPublicBySlugOrID: 当前是最早文章 (ID: %s)，没有更早的文章（没有下一篇）。", article.ID)
	}
	if chronoNext == nil {
		log.Printf("[信息] GetPublicBySlugOrID: 当前是最新文章 (ID: %s)，没有更晚的文章（没有上一篇）。", article.ID)
	}

	// 注意：这里 useAbbrlinkAsID 设置为 false，确保返回的 ID 始终是公共ID
	// 这样PRO版可以正确解码ID获取数据库ID
	// abbrlink 信息仍然通过 Abbrlink 字段返回
	mainArticleResponse := s.ToAPIResponse(article, false, true)
	s.fillOwnerNickname(ctx, mainArticleResponse, nil)
	relatedResponses := make([]*model.SimpleArticleResponse, 0, len(relatedArticles))
	for _, rel := range relatedArticles {
		relatedResponses = append(relatedResponses, toSimpleAPIResponse(rel))
	}

	detailResponse := &model.ArticleDetailResponse{
		ArticleResponse: *mainArticleResponse,
		PrevArticle:     toSimpleAPIResponse(finalPrevArticle),
		NextArticle:     toSimpleAPIResponse(finalNextArticle),
		RelatedArticles: relatedResponses,
	}

	return detailResponse, nil
}

// GetBySlugOrIDForPreview 为预览模式获取文章，不过滤状态，不增加浏览量。
func (s *serviceImpl) GetBySlugOrIDForPreview(ctx context.Context, slugOrID string) (*model.ArticleDetailResponse, error) {
	article, err := s.repo.GetBySlugOrIDForPreview(ctx, slugOrID)
	if err != nil {
		return nil, err
	}

	// 预览模式不增加浏览量

	// 注意：这里 useAbbrlinkAsID 设置为 false，确保返回的 ID 始终是公共ID
	mainArticleResponse := s.ToAPIResponse(article, false, true)
	s.fillOwnerNickname(ctx, mainArticleResponse, nil)

	detailResponse := &model.ArticleDetailResponse{
		ArticleResponse: *mainArticleResponse,
		// 预览模式下不返回上下篇和相关文章
		PrevArticle:     nil,
		NextArticle:     nil,
		RelatedArticles: nil,
	}

	return detailResponse, nil
}

// Create 处理创建新文章的完整业务流程。
func (s *serviceImpl) Create(ctx context.Context, req *model.CreateArticleRequest, ip string) (*model.ArticleResponse, error) {
	var newArticle *model.Article
	sanitizedHTML := s.parserSvc.SanitizeHTML(req.ContentHTML)

	err := s.txManager.Do(ctx, func(repos repository.Repositories) error {
		wordCount, readingTime := calculatePostStats(req.ContentMd)

		var ipLocation string
		log.Printf("[新增文章] 开始处理IP属地设置 - 传入IP: %s, 请求中的IPLocation: %s", ip, req.IPLocation)

		if req.IPLocation != "" {
			ipLocation = req.IPLocation
			log.Printf("[新增文章]使用请求中提供的IP属地 - 结果: %s", ipLocation)
		} else {
			log.Printf("[新增文章] 请求中未提供IP属地，开始自动获取...")
			ipLocation = "未知"

			if ip == "" {
				log.Printf("[新增文章] ❌ IP属地设为'未知' - 原因: 传入的IP地址为空")
			} else if s.geoService == nil {
				log.Printf("[新增文章] ❌ IP属地设为'未知' - 原因: GeoIP服务未初始化 (IP: %s)", ip)
			} else {
				log.Printf("[新增文章] 开始调用GeoIP服务查询IP属地 - IP: %s", ip)
				location, err := s.geoService.Lookup(ip)
				if err == nil {
					ipLocation = location
					log.Printf("[新增文章]IP属地自动获取成功 - IP: %s, 结果: %s", ip, ipLocation)
				} else {
					log.Printf("[新增文章] ❌ IP属地最终设为'未知' - IP: %s, GeoIP查询失败: %v", ip, err)
				}
			}
		}

		log.Printf("[新增文章] IP属地处理完成 - 最终结果: %s", ipLocation)
		tagDBIDs, err := idgen.DecodePublicIDBatch(req.PostTagIDs)
		if err != nil {
			return err
		}
		categoryDBIDs, err := idgen.DecodePublicIDBatch(req.PostCategoryIDs)
		if err != nil {
			return err
		}
		// 如果文章关联了多个分类，检查其中是否包含“系列”
		if len(categoryDBIDs) > 1 {
			isSeries, err := repos.PostCategory.FindAnySeries(ctx, categoryDBIDs)
			if err != nil {
				return fmt.Errorf("检查系列分类失败: %w", err)
			}
			if isSeries {
				return errors.New("系列分类不能与其他分类同时选择")
			}
		}
		coverURL := req.CoverURL
		if coverURL == "" {
			coverURL = s.settingSvc.Get(constant.KeyPostDefaultCover.String())
		}

		var primaryColor string
		isManual := false
		if req.IsPrimaryColorManual != nil && *req.IsPrimaryColorManual {
			isManual = true
			primaryColor = req.PrimaryColor
		} else {
			primaryColor = s.determinePrimaryColor(ctx, req.TopImgURL, coverURL)
		}

		copyright := true
		if req.Copyright != nil {
			copyright = *req.Copyright
		}

		showOnHome := true
		if req.ShowOnHome != nil {
			showOnHome = *req.ShowOnHome
		}

		// 过滤空的摘要字符串
		filteredSummaries := make([]string, 0, len(req.Summaries))
		for _, summary := range req.Summaries {
			if strings.TrimSpace(summary) != "" {
				filteredSummaries = append(filteredSummaries, summary)
			}
		}

		// 解析自定义发布时间
		log.Printf("[Service.Create] ========== 解析自定义时间 ==========")
		log.Printf("[Service.Create] CustomPublishedAt 指针: %v", req.CustomPublishedAt)
		if req.CustomPublishedAt != nil {
			log.Printf("[Service.Create] CustomPublishedAt 值: %s", *req.CustomPublishedAt)
		}
		log.Printf("[Service.Create] CustomUpdatedAt 指针: %v", req.CustomUpdatedAt)
		if req.CustomUpdatedAt != nil {
			log.Printf("[Service.Create] CustomUpdatedAt 值: %s", *req.CustomUpdatedAt)
		}

		var customPublishedAt *time.Time
		if req.CustomPublishedAt != nil && *req.CustomPublishedAt != "" {
			log.Printf("[Service.Create] 开始解析自定义发布时间: %s", *req.CustomPublishedAt)
			if parsedTime, parseErr := time.Parse(time.RFC3339, *req.CustomPublishedAt); parseErr == nil {
				customPublishedAt = &parsedTime
				log.Printf("[Service.Create]解析自定义发布时间成功: %v", parsedTime)
			} else {
				log.Printf("[Service.Create] ❌ 解析自定义发布时间失败: %v", parseErr)
			}
		} else {
			log.Printf("[Service.Create] ⚠️ 未提供自定义发布时间")
		}

		// 解析自定义更新时间
		var customUpdatedAt *time.Time
		if req.CustomUpdatedAt != nil && *req.CustomUpdatedAt != "" {
			log.Printf("[Service.Create] 开始解析自定义更新时间: %s", *req.CustomUpdatedAt)
			if parsedTime, parseErr := time.Parse(time.RFC3339, *req.CustomUpdatedAt); parseErr == nil {
				customUpdatedAt = &parsedTime
				log.Printf("[Service.Create]解析自定义更新时间成功: %v", parsedTime)
			} else {
				log.Printf("[Service.Create] ❌ 解析自定义更新时间失败: %v", parseErr)
			}
		} else {
			log.Printf("[Service.Create] ⚠️ 未提供自定义更新时间")
		}

		log.Printf("[Service.Create] 最终传递给Repository的 CustomPublishedAt: %v", customPublishedAt)
		log.Printf("[Service.Create] 最终传递给Repository的 CustomUpdatedAt: %v", customUpdatedAt)

		params := &model.CreateArticleParams{
			Title:                req.Title,
			OwnerID:              req.OwnerID,   // 文章作者ID（多人共创功能）
			ContentMd:            req.ContentMd, // 存储Markdown原文
			ContentHTML:          sanitizedHTML, // 存储安全过滤后的HTML
			CoverURL:             coverURL,
			Status:               req.Status,
			PostTagIDs:           tagDBIDs,
			PostCategoryIDs:      categoryDBIDs,
			WordCount:            wordCount,
			ReadingTime:          readingTime,
			IPLocation:           ipLocation,
			HomeSort:             req.HomeSort,
			PinSort:              req.PinSort,
			TopImgURL:            req.TopImgURL,
			Summaries:            filteredSummaries,
			PrimaryColor:         primaryColor,
			IsPrimaryColorManual: isManual,
			ShowOnHome:           showOnHome,
			Abbrlink:             req.Abbrlink,
			Copyright:            copyright,
			CopyrightAuthor:      req.CopyrightAuthor,
			CopyrightAuthorHref:  req.CopyrightAuthorHref,
			CopyrightURL:         req.CopyrightURL,
			CustomPublishedAt:    customPublishedAt,
			CustomUpdatedAt:      customUpdatedAt,
			Keywords:             req.Keywords,
			ReviewStatus:         req.ReviewStatus, // 审核状态（多人共创功能）
		}
		createdArticle, err := repos.Article.Create(ctx, params)
		if err != nil {
			return err
		}
		newArticle = createdArticle
		if err := repos.PostTag.UpdateCount(ctx, tagDBIDs, nil); err != nil {
			return fmt.Errorf("更新标签计数失败: %w", err)
		}
		if err := repos.PostCategory.UpdateCount(ctx, categoryDBIDs, nil); err != nil {
			return fmt.Errorf("更新分类计数失败: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	s.updateSiteStatsInBackground()

	// 清除相关缓存（包括 RSS feed）
	go s.invalidateRelatedCaches(context.Background())

	// 异步更新搜索索引
	go func() {
		if err := s.searchSvc.IndexArticle(context.Background(), newArticle); err != nil {
			log.Printf("[警告] 更新搜索索引失败: %v", err)
		}
	}()

	resp := s.ToAPIResponse(newArticle, false, false)
	s.fillOwnerNickname(ctx, resp, nil)
	return resp, nil
}

// Get 根据公共ID检索单个文章。
func (s *serviceImpl) Get(ctx context.Context, publicID string) (*model.ArticleResponse, error) {
	article, err := s.repo.GetByID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	resp := s.ToAPIResponse(article, false, false)
	s.fillOwnerNickname(ctx, resp, nil)
	return resp, nil
}

// getArticleViewCacheKey 生成文章浏览量在 Redis 中的缓存键。
func (s *serviceImpl) getArticleViewCacheKey(publicID string) string {
	return fmt.Sprintf("article:view_count:%s", publicID)
}

// GetPublicByID (此方法似乎与 GetPublicBySlugOrID 功能重叠，暂时保留)
func (s *serviceImpl) GetPublicByID(ctx context.Context, publicID string) (*model.ArticleResponse, error) {
	viewCacheKey := s.getArticleViewCacheKey(publicID)
	go func() {
		if _, err := s.cacheSvc.Increment(context.Background(), viewCacheKey); err != nil {
			log.Printf("[错误] 无法在 Redis 中为文章 %s 增加浏览次数: %v", publicID, err)
		}
	}()

	article, err := s.repo.GetByID(ctx, publicID)
	if err != nil {
		return nil, err
	}

	redisIncrStr, err := s.cacheSvc.Get(ctx, viewCacheKey)
	if err != nil {
		log.Printf("[警告] 无法从 Redis 获取文章 %s 的增量浏览量: %v。将只返回数据库中的值。", publicID, err)
	}

	var redisIncr int
	if redisIncrStr != "" {
		val, convErr := strconv.Atoi(redisIncrStr)
		if convErr == nil {
			redisIncr = val
		}
	}

	article.ViewCount = article.ViewCount + redisIncr

	resp := s.ToAPIResponse(article, true, true)
	s.fillOwnerNickname(ctx, resp, nil)
	return resp, nil
}

// Update 处理更新文章的业务逻辑。
func (s *serviceImpl) Update(ctx context.Context, publicID string, req *model.UpdateArticleRequest, ip string) (*model.ArticleResponse, error) {
	var updatedArticle *model.Article

	err := s.txManager.Do(ctx, func(repos repository.Repositories) error {
		oldArticle, err := repos.Article.GetByID(ctx, publicID)
		if err != nil {
			return err
		}
		oldTagIDs := make([]uint, len(oldArticle.PostTags))
		for i, t := range oldArticle.PostTags {
			oldTagIDs[i], _, _ = idgen.DecodePublicID(t.ID)
		}
		oldCategoryIDs := make([]uint, len(oldArticle.PostCategories))
		for i, c := range oldArticle.PostCategories {
			oldCategoryIDs[i], _, _ = idgen.DecodePublicID(c.ID)
		}

		var newCategoryDBIDs []uint
		if req.PostCategoryIDs != nil {
			var err error
			newCategoryDBIDs, err = idgen.DecodePublicIDBatch(req.PostCategoryIDs)
			if err != nil {
				return fmt.Errorf("无效的分类ID: %w", err)
			}

			// 验证所有分类ID是否存在
			log.Printf("[更新文章] 验证分类ID有效性: %v", newCategoryDBIDs)
			for _, categoryDBID := range newCategoryDBIDs {
				categoryPublicID, _ := idgen.GeneratePublicID(categoryDBID, idgen.EntityTypePostCategory)
				_, err := repos.PostCategory.GetByID(ctx, categoryPublicID)
				if err != nil {
					return fmt.Errorf("分类ID %d 不存在，请刷新页面重新选择分类", categoryDBID)
				}
			}
			log.Printf("[更新文章]所有分类ID验证通过")

			// 如果文章被分配到多个分类，则检查其中是否包含"系列"分类
			if len(newCategoryDBIDs) > 1 {
				isSeries, err := repos.PostCategory.FindAnySeries(ctx, newCategoryDBIDs)
				if err != nil {
					return fmt.Errorf("检查系列分类失败: %w", err)
				}
				if isSeries {
					return errors.New("系列分类不能与其他分类同时选择")
				}
			}
		}

		var computedParams model.UpdateArticleComputedParams

		// 如果 Markdown 内容有更新，则重新计算字数和阅读时间
		if req.ContentMd != nil {
			wordCount, readingTime := calculatePostStats(*req.ContentMd)
			computedParams.WordCount = wordCount
			computedParams.ReadingTime = readingTime
		}
		if req.ContentHTML != nil {
			sanitizedHTML := s.parserSvc.SanitizeHTML(*req.ContentHTML)
			computedParams.ContentHTML = sanitizedHTML
		}

		isManual := oldArticle.IsPrimaryColorManual
		if req.IsPrimaryColorManual != nil {
			isManual = *req.IsPrimaryColorManual
			computedParams.IsPrimaryColorManual = &isManual
		}

		newTopImgURL := oldArticle.TopImgURL
		if req.TopImgURL != nil {
			newTopImgURL = *req.TopImgURL
		}
		newCoverURL := oldArticle.CoverURL
		if req.CoverURL != nil {
			newCoverURL = *req.CoverURL
		}

		if isManual {
			if req.PrimaryColor != nil {
				computedParams.PrimaryColor = req.PrimaryColor
			}
		} else {
			oldImageSource := oldArticle.TopImgURL
			if oldImageSource == "" {
				oldImageSource = oldArticle.CoverURL
			}
			newImageSource := newTopImgURL
			if newImageSource == "" {
				newImageSource = newCoverURL
			}
			modeChangedToAuto := req.IsPrimaryColorManual != nil && !(*req.IsPrimaryColorManual)
			imageChangedInAuto := oldImageSource != newImageSource
			if modeChangedToAuto || imageChangedInAuto {
				log.Printf("[信息] 文章 %s 需要重新获取主色调。原因: 模式切换=%t, 图片改变=%t", publicID, modeChangedToAuto, imageChangedInAuto)
				newColor := s.determinePrimaryColor(ctx, newTopImgURL, newCoverURL)
				computedParams.PrimaryColor = &newColor
			}
		}

		// 如果更新了Summaries，过滤空的摘要字符串
		if req.Summaries != nil {
			filteredSummaries := make([]string, 0, len(req.Summaries))
			for _, summary := range req.Summaries {
				if strings.TrimSpace(summary) != "" {
					filteredSummaries = append(filteredSummaries, summary)
				}
			}
			req.Summaries = filteredSummaries
		}

		if req.IPLocation != nil && *req.IPLocation == "" {
			log.Printf("[更新文章] 检测到IPLocation为空字符串，开始自动获取IP属地 - 传入IP: %s", ip)
			location := "未知"

			if ip == "" {
				log.Printf("[更新文章] ❌ IP属地设为'未知' - 原因: 传入的IP地址为空")
			} else if s.geoService == nil {
				log.Printf("[更新文章] ❌ IP属地设为'未知' - 原因: GeoIP服务未初始化 (IP: %s)", ip)
			} else {
				log.Printf("[更新文章] 开始调用GeoIP服务查询IP属地 - IP: %s", ip)
				fetchedLocation, err := s.geoService.Lookup(ip)
				if err == nil {
					location = fetchedLocation
					log.Printf("[更新文章]IP属地自动获取成功 - IP: %s, 结果: %s", ip, location)
				} else {
					log.Printf("[更新文章] ❌ IP属地最终设为'未知' - IP: %s, GeoIP查询失败: %v", ip, err)
				}
			}

			*req.IPLocation = location
			log.Printf("[更新文章] IP属地自动获取完成 - 最终结果: %s", location)
		}
		if req.CoverURL != nil && *req.CoverURL == "" {
			*req.CoverURL = s.settingSvc.Get(constant.KeyPostDefaultCover.String())
		}

		articleAfterUpdate, err := repos.Article.Update(ctx, publicID, req, &computedParams)
		if err != nil {
			return err
		}
		updatedArticle = articleAfterUpdate

		var newTagIDs []uint
		// 仅当请求中提供了标签时才解码，用于后续计数
		if req.PostTagIDs != nil {
			newTagIDs, err = idgen.DecodePublicIDBatch(req.PostTagIDs)
			if err != nil {
				return err
			}

			// 验证所有标签ID是否存在
			log.Printf("[更新文章] 验证标签ID有效性: %v", newTagIDs)
			for _, tagDBID := range newTagIDs {
				tagPublicID, _ := idgen.GeneratePublicID(tagDBID, idgen.EntityTypePostTag)
				_, err := repos.PostTag.GetByID(ctx, tagPublicID)
				if err != nil {
					return fmt.Errorf("标签ID %d 不存在，请刷新页面重新选择标签", tagDBID)
				}
			}
			log.Printf("[更新文章]所有标签ID验证通过")
		}

		// 计算需要增加和减少计数的标签/分类
		incTag, decTag := diffIDs(oldTagIDs, newTagIDs)
		// 使用之前已解码的 newCategoryDBIDs，避免重复操作
		incCat, decCat := diffIDs(oldCategoryIDs, newCategoryDBIDs)

		if err := repos.PostTag.UpdateCount(ctx, incTag, decTag); err != nil {
			return fmt.Errorf("更新标签计数失败: %w", err)
		}
		if err := repos.PostTag.DeleteIfUnused(ctx, decTag); err != nil {
			return fmt.Errorf("删除未使用的标签失败: %w", err)
		}

		if err := repos.PostCategory.UpdateCount(ctx, incCat, decCat); err != nil {
			return fmt.Errorf("更新分类计数失败: %w", err)
		}
		if err := repos.PostCategory.DeleteIfUnused(ctx, decCat); err != nil {
			return fmt.Errorf("删除未使用的分类失败: %w", err)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	// 清除特定文章的缓存
	s.invalidateArticleCache(ctx, publicID, updatedArticle.Abbrlink)

	s.updateSiteStatsInBackground()

	// 清除相关缓存（包括 RSS feed 和首页缓存）
	go s.invalidateRelatedCaches(context.Background())

	// 异步更新搜索索引
	go func() {
		if err := s.searchSvc.IndexArticle(context.Background(), updatedArticle); err != nil {
			log.Printf("[警告] 更新搜索索引失败: %v", err)
		}
	}()

	resp := s.ToAPIResponse(updatedArticle, false, false)
	s.fillOwnerNickname(ctx, resp, nil)
	return resp, nil
}

// Delete 处理删除文章的业务逻辑。
func (s *serviceImpl) Delete(ctx context.Context, publicID string) error {
	err := s.txManager.Do(ctx, func(repos repository.Repositories) error {
		article, err := repos.Article.GetByID(ctx, publicID)
		if err != nil {
			return err
		}
		tagIDs := make([]uint, len(article.PostTags))
		for i, t := range article.PostTags {
			tagIDs[i], _, _ = idgen.DecodePublicID(t.ID)
		}
		categoryIDs := make([]uint, len(article.PostCategories))
		for i, c := range article.PostCategories {
			categoryIDs[i], _, _ = idgen.DecodePublicID(c.ID)
		}

		if err := repos.Article.Delete(ctx, publicID); err != nil {
			return err
		}

		if err := repos.PostTag.UpdateCount(ctx, nil, tagIDs); err != nil {
			return fmt.Errorf("更新标签计数失败: %w", err)
		}
		if err := repos.PostTag.DeleteIfUnused(ctx, tagIDs); err != nil {
			return fmt.Errorf("删除未使用的标签失败: %w", err)
		}

		if err := repos.PostCategory.UpdateCount(ctx, nil, categoryIDs); err != nil {
			return fmt.Errorf("更新分类计数失败: %w", err)
		}
		if err := repos.PostCategory.DeleteIfUnused(ctx, categoryIDs); err != nil {
			return fmt.Errorf("删除未使用的分类失败: %w", err)
		}

		_ = s.cacheSvc.Delete(ctx, s.getCacheKey(publicID))
		if article.Abbrlink != "" {
			_ = s.cacheSvc.Delete(ctx, s.getCacheKey(article.Abbrlink))
		}
		return nil
	})

	if err != nil {
		return err
	}

	s.updateSiteStatsInBackground()

	// 清除相关缓存（包括 RSS feed）
	go s.invalidateRelatedCaches(context.Background())

	// 异步删除搜索索引
	go func() {
		if err := s.searchSvc.DeleteArticle(context.Background(), publicID); err != nil {
			log.Printf("[警告] 删除搜索索引失败: %v", err)
		}
	}()

	return nil
}

// diffIDs 是一个辅助函数，用于计算两个 ID 切片的差异
func diffIDs(oldIDs, newIDs []uint) (inc, dec []uint) {
	oldMap := make(map[uint]bool)
	for _, id := range oldIDs {
		oldMap[id] = true
	}
	newMap := make(map[uint]bool)
	for _, id := range newIDs {
		newMap[id] = true
	}
	for _, id := range newIDs {
		if !oldMap[id] {
			inc = append(inc, id)
		}
	}
	for _, id := range oldIDs {
		if !newMap[id] {
			dec = append(dec, id)
		}
	}
	return
}

// List 检索分页的文章列表。
func (s *serviceImpl) List(ctx context.Context, options *model.ListArticlesOptions) (*model.ArticleListResponse, error) {
	options.WithContent = false
	articles, total, err := s.repo.List(ctx, options)
	if err != nil {
		return nil, err
	}
	list := make([]model.ArticleResponse, len(articles))
	ownerCache := make(map[uint]*ownerInfoCache)
	for i, a := range articles {
		a.ContentMd = ""
		// 调试日志：检查数据库返回的 OwnerID
		log.Printf("[List] 文章 %s (标题: %s) - 数据库 OwnerID: %d", a.ID, a.Title, a.OwnerID)
		resp := s.ToAPIResponse(a, false, false)
		s.fillOwnerInfo(ctx, resp, ownerCache)
		// 调试日志：检查填充后的用户信息
		log.Printf("[List] 文章 %s - 填充后: OwnerID=%d, OwnerNickname=%s, OwnerAvatar=%s, OwnerEmail=%s",
			resp.ID, resp.OwnerID, resp.OwnerNickname, resp.OwnerAvatar, resp.OwnerEmail)
		list[i] = *resp
	}
	return &model.ArticleListResponse{List: list, Total: int64(total), Page: options.Page, PageSize: options.PageSize}, nil
}

// GetRandom 获取一篇随机文章。
func (s *serviceImpl) GetRandom(ctx context.Context) (*model.ArticleResponse, error) {
	article, err := s.repo.GetRandom(ctx)
	if err != nil {
		return nil, err
	}
	resp := s.ToAPIResponse(article, true, true)
	s.fillOwnerNickname(ctx, resp, nil)
	return resp, nil
}

// ListHome 获取首页推荐文章列表。
func (s *serviceImpl) ListHome(ctx context.Context) ([]model.ArticleResponse, error) {
	articles, err := s.repo.ListHome(ctx)
	if err != nil {
		return nil, err
	}
	list := make([]model.ArticleResponse, len(articles))
	ownerCache := make(map[uint]string)
	for i, a := range articles {
		a.ContentMd = ""
		resp := s.ToAPIResponse(a, true, false)
		s.fillOwnerNickname(ctx, resp, ownerCache)
		list[i] = *resp
	}
	return list, nil
}

// ListPublic 获取公开的、分页的文章列表。
func (s *serviceImpl) ListPublic(ctx context.Context, options *model.ListPublicArticlesOptions) (*model.ArticleListResponse, error) {
	articles, total, err := s.repo.ListPublic(ctx, options)
	if err != nil {
		return nil, err
	}
	list := make([]model.ArticleResponse, len(articles))
	ownerCache := make(map[uint]string)
	for i, a := range articles {
		a.ContentMd = ""
		resp := s.ToAPIResponse(a, true, false)
		s.fillOwnerNickname(ctx, resp, ownerCache)
		list[i] = *resp
	}

	// 批量查询评论数量
	if len(articles) > 0 {
		targetPaths := make([]string, len(articles))
		for i, a := range articles {
			// 构造target_path：优先使用abbrlink，如果没有则使用公共ID
			if a.Abbrlink != "" {
				targetPaths[i] = fmt.Sprintf("/posts/%s", a.Abbrlink)
			} else {
				targetPaths[i] = fmt.Sprintf("/posts/%s", a.ID)
			}
		}

		commentCounts, err := s.commentRepo.CountByTargetPaths(ctx, targetPaths)
		if err != nil {
			log.Printf("[ListPublic] 查询评论数量失败: %v", err)
			// 即使查询失败也继续返回文章列表，只是评论数量为0
		} else {
			// 将评论数量设置到每篇文章
			for i := range list {
				targetPath := targetPaths[i]
				if count, ok := commentCounts[targetPath]; ok {
					list[i].CommentCount = count
				}
			}
		}
	}

	return &model.ArticleListResponse{List: list, Total: int64(total), Page: options.Page, PageSize: options.PageSize}, nil
}

// ListArchives 获取文章归档摘要列表
func (s *serviceImpl) ListArchives(ctx context.Context) (*model.ArchiveSummaryResponse, error) {
	items, err := s.repo.GetArchiveSummary(ctx)
	if err != nil {
		return nil, err
	}

	limitStr := s.settingSvc.Get(constant.KeySidebarArchiveCount.String())
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 8
	}

	if len(items) > limit {
		items = items[:limit]
	}

	return &model.ArchiveSummaryResponse{List: items}, nil
}

// GetPrimaryColorFromURL 从图片URL获取主色调
func (s *serviceImpl) GetPrimaryColorFromURL(ctx context.Context, imageURL string) (string, error) {
	if imageURL == "" {
		return "", fmt.Errorf("图片URL不能为空")
	}

	log.Printf("[GetPrimaryColorFromURL] 开始获取主色调，图片URL: %s", imageURL)

	// 使用主色调服务获取主色调
	color := s.primaryColorSvc.GetPrimaryColorFromURL(ctx, imageURL)

	log.Printf("[GetPrimaryColorFromURL] 主色调服务返回: %s", color)

	// 如果返回空字符串，表示获取失败
	if color == "" {
		log.Printf("[GetPrimaryColorFromURL] 获取主色调失败，返回错误，前端将使用默认值")
		return "", fmt.Errorf("无法从图片获取主色调")
	}

	return color, nil
}

// GetArticleOwnerID 获取文章的作者ID（多人共创功能）
func (s *serviceImpl) GetArticleOwnerID(ctx context.Context, publicID string) (uint, error) {
	article, err := s.repo.GetByID(ctx, publicID)
	if err != nil {
		return 0, err
	}
	return article.OwnerID, nil
}
