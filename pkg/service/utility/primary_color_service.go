// anheyu-app/pkg/service/utility/primary_color_service.go
package utility

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/internal/infra/storage"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
)

const (
	defaultPrimaryColor = "#b4bfe2"
)

// DefaultFallbackPrimaryColor 与 ent article.primary_color 数据库默认值一致。
// 自动从封面取色失败时持久化该值，避免写入空字符串导致前台忽略文章主色。
func DefaultFallbackPrimaryColor() string {
	return defaultPrimaryColor
}

// PrimaryColorService 主色调服务，根据不同的存储策略采用不同的方法获取图片主色调
type PrimaryColorService struct {
	colorSvc          *ColorService
	settingSvc        setting.SettingService
	fileRepo          repository.FileRepository
	directLinkRepo    repository.DirectLinkRepository
	storagePolicyRepo repository.StoragePolicyRepository
	httpClient        *http.Client
	storageProviders  map[constant.StoragePolicyType]storage.IStorageProvider
}

// NewPrimaryColorService 创建主色调服务实例
func NewPrimaryColorService(
	colorSvc *ColorService,
	settingSvc setting.SettingService,
	fileRepo repository.FileRepository,
	directLinkRepo repository.DirectLinkRepository,
	storagePolicyRepo repository.StoragePolicyRepository,
	httpClient *http.Client,
	storageProviders map[constant.StoragePolicyType]storage.IStorageProvider,
) *PrimaryColorService {
	return &PrimaryColorService{
		colorSvc:          colorSvc,
		settingSvc:        settingSvc,
		fileRepo:          fileRepo,
		directLinkRepo:    directLinkRepo,
		storagePolicyRepo: storagePolicyRepo,
		httpClient:        httpClient,
		storageProviders:  storageProviders,
	}
}

// GetPrimaryColorFromURL 根据图片URL智能获取主色调
// 支持本地存储、阿里云OSS、腾讯云COS、OneDrive等多种存储方式
// 返回空字符串表示获取失败，前端应使用默认值
func (s *PrimaryColorService) GetPrimaryColorFromURL(ctx context.Context, imageURL string) string {
	if imageURL == "" {
		log.Printf("[主色调服务] 图片URL为空，返回空字符串")
		return ""
	}

	// 清理URL中的特殊字符（包括零宽字符等）
	imageURL = strings.TrimSpace(imageURL)
	// 移除常见的零宽字符和不可见字符
	imageURL = strings.ReplaceAll(imageURL, "\u200B", "") // 零宽空格
	imageURL = strings.ReplaceAll(imageURL, "\u200C", "") // 零宽非连接符
	imageURL = strings.ReplaceAll(imageURL, "\u200D", "") // 零宽连接符
	imageURL = strings.ReplaceAll(imageURL, "\uFEFF", "") // 零宽非断空格 (BOM)
	imageURL = strings.ReplaceAll(imageURL, "\u2060", "") // 字连接符

	log.Printf("[主色调服务] 开始处理图片URL: %s", imageURL)

	// 判断是否是系统内的图片
	if isSystemImage, filePublicID := s.isSystemImage(imageURL); isSystemImage {
		log.Printf("[主色调服务] 检测到系统内图片，FileID: %s", filePublicID)
		color := s.getColorFromSystemFile(ctx, filePublicID)
		if color != "" {
			return color
		}
		// 系统内图片查找失败（如直链关联文件不存在），降级到HTTP下载方式
		log.Printf("[主色调服务] 系统内图片查找失败，降级到HTTP下载方式获取主色调: %s", imageURL)
		return s.getColorFromExternalURL(ctx, imageURL)
	}

	// 判断是否是米游社的图片
	if s.isMiyousheImage(imageURL) {
		log.Printf("[主色调服务] 检测到米游社图片，使用OSS图片处理API")
		return s.getColorFromMiyoushe(ctx, imageURL)
	}

	// 外部图片，直接下载处理
	log.Printf("[主色调服务] 检测到外部图片，使用HTTP下载方式获取")
	return s.getColorFromExternalURL(ctx, imageURL)
}

// isSystemImage 判断URL是否是系统内的图片
// 返回：(是否系统图片, 文件公共ID)
func (s *PrimaryColorService) isSystemImage(imageURL string) (bool, string) {
	siteURL := s.settingSvc.Get(constant.KeySiteURL.String())
	if siteURL == "" || siteURL == "https://" || siteURL == "http://" {
		siteURL = "https://anheyu.com"
	}
	trimmedSiteURL := strings.TrimSuffix(siteURL, "/")

	// 使用正则表达式匹配系统图片URL模式，支持任意域名
	// 支持的模式：
	// 1. /api/pro/images/{fileID} - anheyu-pro项目的图片
	// 2. /api/f/{publicID}/{filename} - anheyu-app项目的直链
	// 3. /api/file/content?sign={token} - anheyu-app项目的签名内容

	// 模式1: anheyu-pro项目的图片API
	proImagePattern := regexp.MustCompile(`^https?://[^/]+/api/pro/images/([^?]+)`)
	if matches := proImagePattern.FindStringSubmatch(imageURL); matches != nil {
		filePublicID := matches[1]
		log.Printf("[主色调服务] 匹配到anheyu-pro图片URL，FileID: %s", filePublicID)
		return true, filePublicID
	}

	// 模式2: anheyu-app项目的直链格式 /api/f/{publicID}/{filename}
	directLinkPattern := regexp.MustCompile(`^https?://[^/]+/api/f/([^/?]+)`)
	if matches := directLinkPattern.FindStringSubmatch(imageURL); matches != nil {
		publicID := matches[1]
		log.Printf("[主色调服务] 匹配到anheyu-app直链URL，PublicID: %s", publicID)
		return true, publicID
	}

	// 模式3: anheyu-app项目的签名内容格式 /api/file/content?sign={token}
	signedContentPattern := regexp.MustCompile(`^https?://[^/]+/api/file/content\?.*sign=([^&]+)`)
	if matches := signedContentPattern.FindStringSubmatch(imageURL); matches != nil {
		token := matches[1]
		log.Printf("[主色调服务] 匹配到anheyu-app签名内容URL，Token: %s", token)
		// 对于签名内容，我们不能直接提取fileID，需要通过HTTP下载
		return false, ""
	}

	// 备选方案：检查配置的站点URL（向后兼容）
	if trimmedSiteURL != "" {
		patterns := []string{
			trimmedSiteURL + "/api/pro/images/",
			trimmedSiteURL + "/api/f/",
		}

		for _, pattern := range patterns {
			if strings.HasPrefix(imageURL, pattern) {
				remaining := strings.TrimPrefix(imageURL, pattern)
				// 移除可能的查询参数
				if idx := strings.Index(remaining, "?"); idx != -1 {
					remaining = remaining[:idx]
				}
				// 对于 /api/f/ 格式，只取第一部分作为publicID
				if strings.Contains(pattern, "/api/f/") {
					if parts := strings.Split(remaining, "/"); len(parts) > 0 {
						remaining = parts[0]
					}
				}
				log.Printf("[主色调服务] 匹配到配置站点URL模式: %s -> ID: %s", pattern, remaining)
				return true, remaining
			}
		}
	}

	return false, ""
}

// isMiyousheImage 判断URL是否是米游社的图片
func (s *PrimaryColorService) isMiyousheImage(imageURL string) bool {
	return strings.Contains(imageURL, "upload-bbs.miyoushe.com")
}

// getColorFromSystemFile 从系统内的文件获取主色调
func (s *PrimaryColorService) getColorFromSystemFile(ctx context.Context, filePublicID string) string {
	// 解码公共ID
	entityID, entityType, err := idgen.DecodePublicID(filePublicID)
	if err != nil {
		log.Printf("[主色调服务] 解码ID失败: %v，返回空字符串", err)
		return ""
	}

	var file *model.File

	// 根据实体类型获取文件信息
	switch entityType {
	case idgen.EntityTypeFile:
		// 直接是文件类型
		log.Printf("[主色调服务] ID类型为文件，FileID: %d", entityID)
		file, err = s.fileRepo.FindByID(ctx, entityID)
		if err != nil {
			log.Printf("[主色调服务] 查找文件失败: %v，返回空字符串", err)
			return ""
		}
	case idgen.EntityTypeDirectLink:
		// 直链类型，需要先获取直链关联的文件
		log.Printf("[主色调服务] ID类型为直链，DirectLinkID: %d，正在查找关联文件...", entityID)
		directLink, err := s.directLinkRepo.FindByPublicID(ctx, filePublicID)
		if err != nil {
			log.Printf("[主色调服务] 查找直链失败: %v，返回空字符串", err)
			return ""
		}
		if directLink == nil || directLink.File == nil {
			log.Printf("[主色调服务] 直链或关联文件不存在，返回空字符串")
			return ""
		}
		file = directLink.File
		log.Printf("[主色调服务] 通过直链找到关联文件，FileID: %d", file.ID)
	default:
		log.Printf("[主色调服务] 不支持的ID类型: %v，返回空字符串", entityType)
		return ""
	}

	if file == nil || file.PrimaryEntity == nil {
		log.Printf("[主色调服务] 文件或实体信息不完整，返回空字符串")
		return ""
	}

	// 获取存储策略
	policy, err := s.storagePolicyRepo.FindByID(ctx, file.PrimaryEntity.PolicyID)
	if err != nil {
		log.Printf("[主色调服务] 查找存储策略失败: %v，返回空字符串", err)
		return ""
	}

	if policy == nil {
		log.Printf("[主色调服务] 存储策略不存在，返回空字符串")
		return ""
	}

	log.Printf("[主色调服务] 文件所属存储策略类型: %s", policy.Type)

	// 根据存储策略类型选择不同的处理方式
	switch policy.Type {
	case constant.PolicyTypeLocal:
		return s.getColorFromLocalFile(ctx, file, policy)
	case constant.PolicyTypeOneDrive:
		return s.getColorFromOneDriveFile(ctx, file, policy)
	case constant.PolicyTypeTencentCOS:
		return s.getColorFromTencentCOS(ctx, file, policy)
	case constant.PolicyTypeAliOSS:
		return s.getColorFromAliOSS(ctx, file, policy)
	case constant.PolicyTypeQiniu:
		return s.getColorFromQiniu(ctx, file, policy)
	default:
		log.Printf("[主色调服务] 不支持的存储策略类型: %s，返回空字符串", policy.Type)
		return ""
	}
}

// getColorFromLocalFile 从本地存储的文件获取主色调
// 与 internal/infra/storage/local.go LocalProvider.Get 一致：Source 可能已是绝对路径；若为相对路径则相对于策略 BasePath。
// 历史数据中偶发将「含存储根片段的相对路径」写入 Source，再与 BasePath 拼接会重复路径，故依次尝试多个候选路径。
func (s *PrimaryColorService) getColorFromLocalFile(ctx context.Context, file *model.File, policy *model.StoragePolicy) string {
	log.Printf("[主色调服务] 使用本地文件读取方式")

	if !file.PrimaryEntity.Source.Valid {
		log.Printf("[主色调服务] 文件Source字段无效，返回空字符串")
		return ""
	}

	sourceRaw := strings.TrimSpace(file.PrimaryEntity.Source.String)
	if sourceRaw == "" {
		log.Printf("[主色调服务] 文件Source为空，返回空字符串")
		return ""
	}

	provider, ok := s.storageProviders[constant.PolicyTypeLocal]
	if !ok {
		return ""
	}
	candidates := localPrimaryColorPathCandidates(policy.BasePath, sourceRaw)

	var lastErr error
	for _, fullPath := range candidates {
		// 兼容历史候选路径，但每个候选仍必须通过本地驱动的根目录边界。
		f, err := provider.Get(ctx, policy, fullPath)
		if err != nil {
			lastErr = err
			continue
		}
		color, err := s.colorSvc.GetPrimaryColor(f)
		if closeErr := f.Close(); closeErr != nil {
			log.Printf("[主色调服务] 关闭本地文件失败: %v", closeErr)
		}
		if err != nil {
			lastErr = err
			continue
		}
		log.Printf("[主色调服务] 成功从本地文件提取主色调: %s", color)
		return color
	}

	if lastErr != nil {
		log.Printf("[主色调服务] 打开/读取本地文件失败: %v，返回空字符串", lastErr)
	} else {
		log.Printf("[主色调服务] 无可用本地文件路径候选，返回空字符串")
	}
	return ""
}

// localPrimaryColorPathCandidates 生成本地取色可能使用的物理路径列表（去重、去空）。
func localPrimaryColorPathCandidates(basePath, sourceRaw string) []string {
	add := func(out *[]string, seen map[string]struct{}, p string) {
		p = filepath.Clean(p)
		if p == "" || p == "." {
			return
		}
		if _, ok := seen[p]; ok {
			return
		}
		seen[p] = struct{}{}
		*out = append(*out, p)
	}

	seen := make(map[string]struct{})
	out := make([]string, 0, 4)

	if filepath.IsAbs(sourceRaw) {
		add(&out, seen, sourceRaw)
	}
	add(&out, seen, filepath.Join(basePath, sourceRaw))
	baseName := filepath.Base(sourceRaw)
	if baseName != "" && baseName != "." && baseName != sourceRaw {
		add(&out, seen, filepath.Join(basePath, baseName))
	}
	return out
}

// getColorFromOneDriveFile 从OneDrive存储的文件获取主色调
func (s *PrimaryColorService) getColorFromOneDriveFile(ctx context.Context, file *model.File, policy *model.StoragePolicy) string {
	log.Printf("[主色调服务] 使用OneDrive下载方式")

	// 检查Source字段
	if !file.PrimaryEntity.Source.Valid {
		log.Printf("[主色调服务] 文件Source字段无效，返回空字符串")
		return ""
	}

	// 获取OneDrive存储提供者
	provider, exists := s.storageProviders[constant.PolicyTypeOneDrive]
	if !exists {
		log.Printf("[主色调服务] OneDrive存储提供者不存在，返回空字符串")
		return ""
	}

	// 获取下载URL
	downloadURL, err := provider.GetDownloadURL(ctx, policy, file.PrimaryEntity.Source.String, storage.DownloadURLOptions{})
	if err != nil {
		log.Printf("[主色调服务] 获取OneDrive下载URL失败: %v，返回空字符串", err)
		return ""
	}

	// 下载并处理图片
	return s.downloadAndExtractColor(ctx, downloadURL)
}

// getColorFromTencentCOS 从腾讯云COS获取主色调
func (s *PrimaryColorService) getColorFromTencentCOS(ctx context.Context, file *model.File, policy *model.StoragePolicy) string {
	log.Printf("[主色调服务] 使用腾讯云COS数据万象API")

	var imageAveURL string

	// 根据存储策略是否为私有来决定URL构建方式
	if policy.IsPrivate {
		log.Printf("[主色调服务] 私有存储桶，使用带签名的图片处理URL")
		// 私有存储桶：使用storage provider获取带签名的URL，然后添加图片处理参数
		downloadURL := s.getTencentCOSDownloadURL(ctx, file, policy)
		if downloadURL == "" {
			log.Printf("[主色调服务] 获取腾讯云COS签名URL失败，返回空字符串")
			return ""
		}
		// 在签名URL后添加图片处理参数
		if strings.Contains(downloadURL, "?") {
			imageAveURL = downloadURL + "&imageAve"
		} else {
			imageAveURL = downloadURL + "?imageAve"
		}
	} else {
		log.Printf("[主色调服务] 公有存储桶，使用直接图片处理URL")
		// 公有存储桶：直接构建图片处理URL
		baseURL := s.buildCOSURL(file, policy)
		if baseURL == "" {
			log.Printf("[主色调服务] 构建腾讯云COS URL失败，返回空字符串")
			return ""
		}
		imageAveURL = baseURL + "?imageAve"
	}

	log.Printf("[主色调服务] 腾讯云COS imageAve URL: %s", imageAveURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, imageAveURL, nil)
	if err != nil {
		log.Printf("[主色调服务] 创建腾讯云请求失败: %v，返回空字符串", err)
		return ""
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Printf("[主色调服务] 请求腾讯云接口失败: %v，返回空字符串", err)
		return ""
	}
	defer resp.Body.Close()

	// 如果返回403/401等权限错误，或404，降级到下载图片方式
	if resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusNotFound {
		log.Printf("[主色调服务] 腾讯云接口返回%d状态码（可能是权限问题或服务未开通），降级到下载图片方式", resp.StatusCode)
		// 尝试使用storage provider获取签名URL（适用于私有存储桶）
		downloadURL := s.getTencentCOSDownloadURL(ctx, file, policy)
		if downloadURL == "" {
			// 降级到直接URL
			downloadURL = s.buildCOSURL(file, policy)
		}
		return s.downloadAndExtractColor(ctx, downloadURL)
	}

	if resp.StatusCode != http.StatusOK {
		log.Printf("[主色调服务] 腾讯云接口返回非200状态码: %d，尝试降级处理", resp.StatusCode)
		downloadURL := s.getTencentCOSDownloadURL(ctx, file, policy)
		if downloadURL == "" {
			downloadURL = s.buildCOSURL(file, policy)
		}
		return s.downloadAndExtractColor(ctx, downloadURL)
	}

	// 解析返回的JSON
	var result struct {
		RGB string `json:"RGB"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("[主色调服务] 解析腾讯云返回数据失败: %v，返回空字符串", err)
		return ""
	}

	// RGB格式: "0xRRGGBB"
	if strings.HasPrefix(result.RGB, "0x") {
		hexColor := "#" + result.RGB[2:]
		log.Printf("[主色调服务] 从腾讯云COS获取主色调成功: %s", hexColor)
		return hexColor
	}

	log.Printf("[主色调服务] 腾讯云返回格式异常: %s，返回空字符串", result.RGB)
	return ""
}

// getColorFromAliOSS 从阿里云OSS获取主色调
func (s *PrimaryColorService) getColorFromAliOSS(ctx context.Context, file *model.File, policy *model.StoragePolicy) string {
	log.Printf("[主色调服务] 使用阿里云OSS图片处理API")

	var averageHueURL string

	// 根据存储策略是否为私有来决定URL构建方式
	if policy.IsPrivate {
		log.Printf("[主色调服务] 私有存储桶，使用带签名的图片处理URL")
		// 私有存储桶：使用storage provider获取带签名的URL，然后添加图片处理参数
		downloadURL := s.getAliyunOSSDownloadURL(ctx, file, policy)
		if downloadURL == "" {
			log.Printf("[主色调服务] 获取阿里云OSS签名URL失败，返回空字符串")
			return ""
		}
		// 在签名URL后添加图片处理参数
		if strings.Contains(downloadURL, "?") {
			averageHueURL = downloadURL + "&x-oss-process=image/average-hue"
		} else {
			averageHueURL = downloadURL + "?x-oss-process=image/average-hue"
		}
	} else {
		log.Printf("[主色调服务] 公有存储桶，使用直接图片处理URL")
		// 公有存储桶：直接构建图片处理URL
		baseURL := s.buildOSSURL(file, policy)
		if baseURL == "" {
			log.Printf("[主色调服务] 构建阿里云OSS URL失败，返回空字符串")
			return ""
		}
		averageHueURL = baseURL + "?x-oss-process=image/average-hue"
	}

	log.Printf("[主色调服务] 阿里云OSS average-hue URL: %s", averageHueURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, averageHueURL, nil)
	if err != nil {
		log.Printf("[主色调服务] 创建阿里云请求失败: %v，返回空字符串", err)
		return ""
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Printf("[主色调服务] 请求阿里云接口失败: %v，返回空字符串", err)
		return ""
	}
	defer resp.Body.Close()

	// 如果返回403/401等权限错误，或404，降级到下载图片方式
	if resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusNotFound {
		log.Printf("[主色调服务] 阿里云接口返回%d状态码（可能是权限问题或服务未开通），降级到下载图片方式", resp.StatusCode)
		// 尝试使用storage provider获取签名URL（适用于私有存储桶）
		downloadURL := s.getAliyunOSSDownloadURL(ctx, file, policy)
		if downloadURL == "" {
			// 降级到直接URL
			downloadURL = s.buildOSSURL(file, policy)
		}
		return s.downloadAndExtractColor(ctx, downloadURL)
	}

	if resp.StatusCode != http.StatusOK {
		log.Printf("[主色调服务] 阿里云接口返回非200状态码: %d，尝试降级处理", resp.StatusCode)
		downloadURL := s.getAliyunOSSDownloadURL(ctx, file, policy)
		if downloadURL == "" {
			downloadURL = s.buildOSSURL(file, policy)
		}
		return s.downloadAndExtractColor(ctx, downloadURL)
	}

	// 解析返回的JSON
	var result struct {
		RGB string `json:"RGB"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("[主色调服务] 解析阿里云返回数据失败: %v，返回空字符串", err)
		return ""
	}

	// RGB格式: "0xRRGGBB"
	if strings.HasPrefix(result.RGB, "0x") {
		hexColor := "#" + result.RGB[2:]
		log.Printf("[主色调服务] 从阿里云OSS获取主色调成功: %s", hexColor)
		return hexColor
	}

	log.Printf("[主色调服务] 阿里云返回格式异常: %s，返回空字符串", result.RGB)
	return ""
}

// buildCOSURL 构建腾讯云COS的完整URL
func (s *PrimaryColorService) buildCOSURL(file *model.File, policy *model.StoragePolicy) string {
	// 腾讯云COS的URL格式: https://{bucket}-{appid}.cos.{region}.myqcloud.com/{source}
	// Server字段通常包含完整的域名或endpoint
	if policy.Server == "" || !file.PrimaryEntity.Source.Valid {
		return ""
	}

	server := strings.TrimSuffix(policy.Server, "/")
	source := strings.TrimPrefix(file.PrimaryEntity.Source.String, "/")

	return fmt.Sprintf("%s/%s", server, source)
}

// buildOSSURL 构建阿里云OSS的完整URL
func (s *PrimaryColorService) buildOSSURL(file *model.File, policy *model.StoragePolicy) string {
	// 阿里云OSS的URL格式: https://{bucket}.{endpoint}/{source}
	if policy.Server == "" || !file.PrimaryEntity.Source.Valid {
		return ""
	}

	server := strings.TrimSuffix(policy.Server, "/")
	source := strings.TrimPrefix(file.PrimaryEntity.Source.String, "/")

	return fmt.Sprintf("%s/%s", server, source)
}

// getColorFromMiyoushe 从米游社图片获取主色调
func (s *PrimaryColorService) getColorFromMiyoushe(ctx context.Context, imageURL string) string {
	// 米游社使用阿里云OSS，支持通过添加 x-oss-process=image/average-hue 参数获取主色调
	// 需要处理URL中已有的x-oss-process参数，避免参数冲突
	var averageHueURL string

	// 检查URL中是否已经包含x-oss-process参数
	if strings.Contains(imageURL, "x-oss-process=") {
		// 找到问号位置，移除原有的x-oss-process参数
		if idx := strings.Index(imageURL, "?"); idx != -1 {
			// 只保留问号之前的部分（即原始图片URL）
			averageHueURL = imageURL[:idx] + "?x-oss-process=image/average-hue"
		} else {
			// 理论上不会走到这里，因为x-oss-process必定在查询参数中
			averageHueURL = imageURL + "?x-oss-process=image/average-hue"
		}
	} else if strings.Contains(imageURL, "?") {
		// URL有查询参数但没有x-oss-process，直接添加
		averageHueURL = imageURL + "&x-oss-process=image/average-hue"
	} else {
		// URL没有任何查询参数
		averageHueURL = imageURL + "?x-oss-process=image/average-hue"
	}

	log.Printf("[主色调服务] 米游社 average-hue URL: %s", averageHueURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, averageHueURL, nil)
	if err != nil {
		log.Printf("[主色调服务] 创建米游社请求失败: %v，返回空字符串", err)
		return ""
	}

	// 添加常用的 HTTP headers，米游社可能需要 Referer
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "application/json,*/*")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
	req.Header.Set("Referer", "https://www.miyoushe.com/")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Printf("[主色调服务] 请求米游社接口失败: %v，返回空字符串", err)
		return ""
	}
	defer resp.Body.Close()

	// 如果返回403/401等权限错误，或404，降级到下载图片方式
	if resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusNotFound {
		log.Printf("[主色调服务] 米游社接口返回%d状态码（可能是权限问题或服务未开通），降级到下载图片方式", resp.StatusCode)
		return s.downloadAndExtractColor(ctx, imageURL)
	}

	if resp.StatusCode != http.StatusOK {
		log.Printf("[主色调服务] 米游社接口返回非200状态码: %d，尝试降级处理", resp.StatusCode)
		return s.downloadAndExtractColor(ctx, imageURL)
	}

	// 解析返回的JSON
	var result struct {
		RGB string `json:"RGB"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("[主色调服务] 解析米游社返回数据失败: %v，返回空字符串", err)
		return ""
	}

	// RGB格式: "0xRRGGBB"
	if strings.HasPrefix(result.RGB, "0x") {
		hexColor := "#" + result.RGB[2:]
		log.Printf("[主色调服务] 从米游社获取主色调成功: %s", hexColor)
		return hexColor
	}

	log.Printf("[主色调服务] 米游社返回格式异常: %s，返回空字符串", result.RGB)
	return ""
}

// getColorFromExternalURL 从外部URL下载图片并提取主色调
func (s *PrimaryColorService) getColorFromExternalURL(ctx context.Context, imageURL string) string {
	return s.downloadAndExtractColor(ctx, imageURL)
}

// downloadAndExtractColor 下载图片并提取主色调的通用方法
func (s *PrimaryColorService) downloadAndExtractColor(ctx context.Context, imageURL string) string {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, imageURL, nil)
	if err != nil {
		log.Printf("[主色调服务] 创建HTTP请求失败: %v，返回空字符串", err)
		return ""
	}

	// 添加常用的 HTTP headers，避免服务器拒绝请求
	// 注意：不设置 Accept-Encoding，让 Go 的 http.Client 自动处理 gzip 解压
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Printf("[主色调服务] 下载图片失败: %v，返回空字符串", err)
		return ""
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("[主色调服务] 图片URL返回非200状态码: %d，返回空字符串", resp.StatusCode)
		return ""
	}

	// 检查 Content-Type
	contentType := resp.Header.Get("Content-Type")
	log.Printf("[主色调服务] 响应Content-Type: %s", contentType)

	// 如果返回的不是图片类型，检查是否是反爬虫机制
	if !strings.HasPrefix(contentType, "image/") {
		// 检查服务器类型
		server := resp.Header.Get("Server")
		if strings.Contains(server, "EdgeOne") || strings.Contains(server, "Cloudflare") {
			log.Printf("[主色调服务] 检测到CDN反爬虫保护 (Server: %s)，该图床需要JavaScript挑战验证，无法直接获取图片，返回空字符串", server)
		} else {
			log.Printf("[主色调服务] 响应类型不是图片: %s，可能是服务器返回了错误页面或反爬虫保护，返回空字符串", contentType)
		}
		return ""
	}

	color, err := s.colorSvc.GetPrimaryColor(resp.Body)
	if err != nil {
		log.Printf("[主色调服务] 提取主色调失败: %v，返回空字符串", err)
		return ""
	}

	log.Printf("[主色调服务] 成功提取主色调: %s", color)
	return color
}

// getTencentCOSDownloadURL 获取腾讯云COS的下载URL（可能包含签名）
func (s *PrimaryColorService) getTencentCOSDownloadURL(ctx context.Context, file *model.File, policy *model.StoragePolicy) string {
	if !file.PrimaryEntity.Source.Valid {
		log.Printf("[主色调服务] 文件Source字段无效")
		return ""
	}

	provider, exists := s.storageProviders[constant.PolicyTypeTencentCOS]
	if !exists {
		log.Printf("[主色调服务] 腾讯云COS存储提供者不存在")
		return ""
	}

	downloadURL, err := provider.GetDownloadURL(ctx, policy, file.PrimaryEntity.Source.String, storage.DownloadURLOptions{})
	if err != nil {
		log.Printf("[主色调服务] 获取腾讯云COS下载URL失败: %v", err)
		return ""
	}

	return downloadURL
}

// getAliyunOSSDownloadURL 获取阿里云OSS的下载URL（可能包含签名）
func (s *PrimaryColorService) getAliyunOSSDownloadURL(ctx context.Context, file *model.File, policy *model.StoragePolicy) string {
	if !file.PrimaryEntity.Source.Valid {
		log.Printf("[主色调服务] 文件Source字段无效")
		return ""
	}

	provider, exists := s.storageProviders[constant.PolicyTypeAliOSS]
	if !exists {
		log.Printf("[主色调服务] 阿里云OSS存储提供者不存在")
		return ""
	}

	downloadURL, err := provider.GetDownloadURL(ctx, policy, file.PrimaryEntity.Source.String, storage.DownloadURLOptions{})
	if err != nil {
		log.Printf("[主色调服务] 获取阿里云OSS下载URL失败: %v", err)
		return ""
	}

	return downloadURL
}

// getColorFromQiniu 从七牛云Kodo获取主色调
func (s *PrimaryColorService) getColorFromQiniu(ctx context.Context, file *model.File, policy *model.StoragePolicy) string {
	log.Printf("[主色调服务] 使用七牛云图片处理API")

	// 七牛云使用 imageAve 获取图片主色调
	// 文档: https://developer.qiniu.com/dora/api/1268/image-average-hue
	var imageAveURL string

	// 根据存储策略是否为私有来决定URL构建方式
	if policy.IsPrivate {
		log.Printf("[主色调服务] 私有空间，使用带签名的图片处理URL")
		downloadURL := s.getQiniuDownloadURL(ctx, file, policy)
		if downloadURL == "" {
			log.Printf("[主色调服务] 获取七牛云签名URL失败，返回空字符串")
			return ""
		}
		// 在签名URL后添加图片处理参数
		if strings.Contains(downloadURL, "?") {
			imageAveURL = downloadURL + "&imageAve"
		} else {
			imageAveURL = downloadURL + "?imageAve"
		}
	} else {
		log.Printf("[主色调服务] 公有空间，使用直接图片处理URL")
		baseURL := s.buildQiniuURL(file, policy)
		if baseURL == "" {
			log.Printf("[主色调服务] 构建七牛云URL失败，返回空字符串")
			return ""
		}
		imageAveURL = baseURL + "?imageAve"
	}

	log.Printf("[主色调服务] 七牛云 imageAve URL: %s", imageAveURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, imageAveURL, nil)
	if err != nil {
		log.Printf("[主色调服务] 创建七牛云请求失败: %v，返回空字符串", err)
		return ""
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Printf("[主色调服务] 请求七牛云接口失败: %v，返回空字符串", err)
		return ""
	}
	defer resp.Body.Close()

	// 如果返回403/401等权限错误，或404，降级到下载图片方式
	if resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusNotFound {
		log.Printf("[主色调服务] 七牛云接口返回%d状态码，降级到下载图片方式", resp.StatusCode)
		downloadURL := s.getQiniuDownloadURL(ctx, file, policy)
		if downloadURL == "" {
			downloadURL = s.buildQiniuURL(file, policy)
		}
		return s.downloadAndExtractColor(ctx, downloadURL)
	}

	if resp.StatusCode != http.StatusOK {
		log.Printf("[主色调服务] 七牛云接口返回非200状态码: %d，尝试降级处理", resp.StatusCode)
		downloadURL := s.getQiniuDownloadURL(ctx, file, policy)
		if downloadURL == "" {
			downloadURL = s.buildQiniuURL(file, policy)
		}
		return s.downloadAndExtractColor(ctx, downloadURL)
	}

	// 七牛云返回格式: {"RGB": "0xRRGGBB"}
	var result struct {
		RGB string `json:"RGB"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("[主色调服务] 解析七牛云返回数据失败: %v，返回空字符串", err)
		return ""
	}

	// RGB格式: "0xRRGGBB"
	if strings.HasPrefix(result.RGB, "0x") {
		hexColor := "#" + result.RGB[2:]
		log.Printf("[主色调服务] 从七牛云获取主色调成功: %s", hexColor)
		return hexColor
	}

	log.Printf("[主色调服务] 七牛云返回格式异常: %s，返回空字符串", result.RGB)
	return ""
}

// buildQiniuURL 构建七牛云的公开访问URL
func (s *PrimaryColorService) buildQiniuURL(file *model.File, policy *model.StoragePolicy) string {
	if !file.PrimaryEntity.Source.Valid {
		return ""
	}

	// 从settings获取CDN域名
	cdnDomain := ""
	if val, ok := policy.Settings["cdn_domain"].(string); ok && val != "" {
		cdnDomain = strings.TrimSuffix(val, "/")
	}
	if cdnDomain == "" {
		log.Printf("[主色调服务] 七牛云策略缺少cdn_domain配置")
		return ""
	}

	// 确保有协议前缀
	if !strings.HasPrefix(cdnDomain, "http://") && !strings.HasPrefix(cdnDomain, "https://") {
		cdnDomain = "https://" + cdnDomain
	}

	return fmt.Sprintf("%s/%s", cdnDomain, file.PrimaryEntity.Source.String)
}

// getQiniuDownloadURL 获取七牛云的下载URL（可能包含签名）
func (s *PrimaryColorService) getQiniuDownloadURL(ctx context.Context, file *model.File, policy *model.StoragePolicy) string {
	if !file.PrimaryEntity.Source.Valid {
		log.Printf("[主色调服务] 文件Source字段无效")
		return ""
	}

	provider, exists := s.storageProviders[constant.PolicyTypeQiniu]
	if !exists {
		log.Printf("[主色调服务] 七牛云存储提供者不存在")
		return ""
	}

	downloadURL, err := provider.GetDownloadURL(ctx, policy, file.PrimaryEntity.Source.String, storage.DownloadURLOptions{})
	if err != nil {
		log.Printf("[主色调服务] 获取七牛云下载URL失败: %v", err)
		return ""
	}

	return downloadURL
}
