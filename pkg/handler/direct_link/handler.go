package direct_link

import (
	"fmt"
	"log"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/anzhiyu-c/anheyu-app/internal/infra/storage"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/auth"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/utils"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/direct_link"
)

// getContentTypeFromFilename 根据文件名推断正确的 Content-Type
// 如果数据库中的 MimeType 为空或无效，使用此函数来推断
func getContentTypeFromFilename(filename string) string {
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(filename), "."))

	// MIME 类型映射表
	mimeTypes := map[string]string{
		// 图片
		"svg":  "image/svg+xml",
		"png":  "image/png",
		"jpg":  "image/jpeg",
		"jpeg": "image/jpeg",
		"gif":  "image/gif",
		"webp": "image/webp",
		"bmp":  "image/bmp",
		"ico":  "image/x-icon",
		"avif": "image/avif",
		// 其他常见类型
		"pdf":  "application/pdf",
		"json": "application/json",
		"xml":  "application/xml",
		"txt":  "text/plain",
		"html": "text/html",
		"css":  "text/css",
		"js":   "application/javascript",
	}

	if mimeType, ok := mimeTypes[ext]; ok {
		return mimeType
	}

	// 默认返回 application/octet-stream
	return "application/octet-stream"
}

// DirectLinkHandler 负责处理直链相关的HTTP请求。
type DirectLinkHandler struct {
	//修正 #1: 将这里的字段类型从 *direct_link.Service (结构体指针)
	// 修改为 direct_link.Service (接口)。
	svc              direct_link.Service
	storageProviders map[constant.StoragePolicyType]storage.IStorageProvider
}

// NewDirectLinkHandler 是 DirectLinkHandler 的构造函数。
func NewDirectLinkHandler(
	svc direct_link.Service,
	providers map[constant.StoragePolicyType]storage.IStorageProvider,
) *DirectLinkHandler {
	return &DirectLinkHandler{
		svc:              svc,
		storageProviders: providers,
	}
}

// CreateDirectLinksRequest 定义了创建多个直链的请求体。
type CreateDirectLinksRequest struct {
	FileIDs []string `json:"file_ids" binding:"required,min=1"`
}

// DirectLinkResponseItem 定义了响应体中数组元素的结构
type DirectLinkResponseItem struct {
	Link    string `json:"link"`
	FileURL string `json:"file_url"`
}

// GetOrCreateDirectLinks 获取或创建文件直链
// @Summary      获取或创建文件直链
// @Description  为一个或多个文件生成公开的直接下载链接
// @Tags         直链管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  CreateDirectLinksRequest  true  "文件ID列表"
// @Success      200  {object}  response.Response{data=[]DirectLinkResponseItem}  "获取成功"
// @Failure      400  {object}  response.Response  "请求参数无效"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /direct-links [post]
func (h *DirectLinkHandler) GetOrCreateDirectLinks(c *gin.Context) {
	var req CreateDirectLinksRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "无效的请求参数")
		return
	}

	claimsValue, _ := c.Get(auth.ClaimsKey)
	claims := claimsValue.(*auth.CustomClaims)

	userGroupID, _, _ := idgen.DecodePublicID(claims.UserGroupID)

	dbFileIDs := make([]uint, 0, len(req.FileIDs))
	publicToDBIDMap := make(map[string]uint)
	for _, pid := range req.FileIDs {
		dbID, entityType, err := idgen.DecodePublicID(pid)
		if err == nil && entityType == idgen.EntityTypeFile {
			dbFileIDs = append(dbFileIDs, dbID)
			publicToDBIDMap[pid] = dbID
		}
	}

	if len(dbFileIDs) == 0 {
		response.Fail(c, http.StatusBadRequest, "未提供任何有效的文件ID")
		return
	}

	resultsMap, err := h.svc.GetOrCreateDirectLinks(c.Request.Context(), userGroupID, dbFileIDs)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	finalResult := make([]DirectLinkResponseItem, 0, len(resultsMap))
	for _, publicID := range req.FileIDs {
		dbID := publicToDBIDMap[publicID]
		if result, ok := resultsMap[dbID]; ok {
			finalResult = append(finalResult, DirectLinkResponseItem{
				Link:    result.URL,
				FileURL: result.VirtualURI,
			})
		}
	}

	response.Success(c, finalResult, "直链获取成功")
}

// HandleDirectDownload 处理公开的直链下载请求。
// @Summary      直链下载
// @Description  通过直链ID下载文件（无需认证）
// @Tags         直链管理
// @Produce      octet-stream
// @Param        publicID  path  string  true   "直链公共ID"
// @Param        filename  path  string  false  "文件名（可选）"
// @Success      200  {file}    file  "文件内容"
// @Success      302  {string}  string  "重定向到云存储下载链接"
// @Failure      404  {object}  response.Response  "直链未找到"
// @Failure      500  {object}  response.Response  "下载失败"
// @Router       /f/{publicID}/{filename} [get]
func (h *DirectLinkHandler) HandleDirectDownload(c *gin.Context) {
	publicID := c.Param("publicID")

	file, filename, policy, speedLimit, err := h.svc.PrepareDownload(c.Request.Context(), publicID)
	if err != nil {
		response.Fail(c, http.StatusNotFound, err.Error())
		return
	}

	provider, ok := h.storageProviders[policy.Type]
	if !ok {
		log.Printf("错误：找不到类型为 '%s' 的存储提供者", policy.Type)
		response.Fail(c, http.StatusInternalServerError, "存储提供者不可用")
		return
	}

	if policy.Type == constant.PolicyTypeLocal {
		// 本地存储：直接流式传输
		encodedFileName := url.QueryEscape(filename)
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename*=UTF-8''%s", encodedFileName))

		// 确定 Content-Type：优先使用数据库中的 MimeType，如果为空或无效则根据文件扩展名推断
		contentType := file.PrimaryEntity.MimeType.String
		if contentType == "" || contentType == "text/plain" {
			// 如果 MimeType 为空或是 text/plain，根据文件扩展名推断
			contentType = getContentTypeFromFilename(filename)
		}
		c.Header("Content-Type", contentType)
		c.Header("Content-Length", fmt.Sprintf("%d", file.Size))

		throttledWriter := utils.NewThrottledWriter(c.Writer, speedLimit, c.Request.Context())

		err = provider.Stream(c.Request.Context(), policy, file.PrimaryEntity.Source.String, throttledWriter)
		if err != nil {
			log.Printf("下载文件 [FileID: %d] 时流式传输失败: %v", file.ID, err)
		}
	} else {
		// 云存储：重定向到直接下载链接
		// 获取请求中的查询参数（用于图片处理，如 ?imageMogr2/format/avif）
		queryParams := c.Request.URL.RawQuery

		// 提取URL路径中的样式分隔符（如果有）
		// URL格式：/api/f/:publicID/filename 或 /api/f/:publicID/filename/StyleName
		fullPath := c.Param("filename") // 可能包含 /filename 或 /filename/StyleName
		styleSeparator := h.extractStyleSeparatorFromPath(fullPath, filename, policy)

		// 如果从路径中提取到样式分隔符，需要拼接到queryParams中
		if styleSeparator != "" {
			log.Printf("[直链下载] 从URL路径中提取到样式分隔符: %s", styleSeparator)
			// 将样式分隔符作为路径参数传递（不是查询参数）
			// 对于腾讯云COS和阿里云OSS，样式分隔符应该追加到URL路径末尾
			if queryParams != "" {
				queryParams = styleSeparator + "?" + queryParams
			} else {
				queryParams = styleSeparator
			}
		}

		options := storage.DownloadURLOptions{
			ExpiresIn:   3600,
			QueryParams: queryParams,
		}
		downloadURL, err := provider.GetDownloadURL(c.Request.Context(), policy, file.PrimaryEntity.Source.String, options)
		if err != nil {
			log.Printf("获取云存储下载链接失败 [FileID: %d]: %v", file.ID, err)
			response.Fail(c, http.StatusInternalServerError, "获取下载链接失败")
			return
		}

		log.Printf("[直链下载] 重定向到云存储URL: %s", downloadURL)
		// 302重定向到云存储的直接下载链接
		c.Redirect(http.StatusFound, downloadURL)
	}
}

// extractStyleSeparatorFromPath 从URL路径中提取样式分隔符
// 支持多种分隔符格式：
// - /ArticleImage  =>  /ArticleImage
// - !ArticleImage  =>  !ArticleImage
// - ?ArticleImage  =>  ?ArticleImage
// - |ArticleImage  =>  |ArticleImage
// - -ArticleImage  =>  -ArticleImage
func (h *DirectLinkHandler) extractStyleSeparatorFromPath(fullPath, filename string, policy *model.StoragePolicy) string {
	// 移除开头的斜杠
	fullPath = strings.TrimPrefix(fullPath, "/")

	// 如果路径就是文件名本身，说明没有样式分隔符
	if fullPath == filename {
		return ""
	}

	// 检查是否是支持样式分隔符的存储类型
	if policy.Type != constant.PolicyTypeTencentCOS && policy.Type != constant.PolicyTypeAliOSS && policy.Type != constant.PolicyTypeQiniu {
		return ""
	}

	// 检查路径是否以文件名开头
	if !strings.HasPrefix(fullPath, filename) {
		return ""
	}

	// 提取文件名后面的部分作为样式分隔符
	styleSeparator := strings.TrimPrefix(fullPath, filename)

	// 支持的分隔符字符
	validSeparatorChars := []string{"/", "!", "?", "|", "-"}

	// 检查样式分隔符是否以有效字符开头
	if styleSeparator != "" {
		for _, validChar := range validSeparatorChars {
			if strings.HasPrefix(styleSeparator, validChar) {
				log.Printf("[直链下载] 从路径中提取到样式分隔符: %s (fullPath=%s, filename=%s)", styleSeparator, fullPath, filename)
				return styleSeparator
			}
		}
		log.Printf("[直链下载] 警告：检测到无效的样式分隔符格式: %s", styleSeparator)
	}

	return ""
}
