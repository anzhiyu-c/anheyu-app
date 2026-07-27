/*
 * @Description: 社区版 /api/image 图片样式处理 HTTP 入口
 * @Author: 安知鱼
 *
 * 对应规范：§8.1。
 * 处理链：
 *   URL 解析 → DecodePublicID → FileRepo → StoragePolicyRepo →
 *   ImageStyleService.Process →
 *     Success: stream body + ETag headers (支持 If-None-Match 304)
 *     ErrStyleNotApplicable / ErrStyleProcessFailed → 302 到原图直链
 *     ErrStyleNotFound → 404
 */
package image

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/direct_link"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/image_style"
)

// FileFinder handler 仅依赖"按 ID 查文件"的能力。
// repository.FileRepository 的真实实现会自动满足该接口。
type FileFinder interface {
	FindByID(ctx context.Context, id uint) (*model.File, error)
}

// PolicyFinder handler 仅依赖"按 ID 查存储策略"的能力。
// repository.StoragePolicyRepository 的真实实现会自动满足该接口。
type PolicyFinder interface {
	FindByID(ctx context.Context, id uint) (*model.StoragePolicy, error)
}

// Handler 是社区版 /api/image 路由的处理器。
type Handler struct {
	styleSvc      image_style.ImageStyleService
	fileRepo      FileFinder
	policyRepo    PolicyFinder
	directLinkSvc direct_link.Service
}

// NewHandler 构造 Handler。
// styleSvc 若为 nil，所有请求将直接 302 回原图直链（缓存与样式处理被禁用）。
func NewHandler(
	styleSvc image_style.ImageStyleService,
	fileRepo FileFinder,
	policyRepo PolicyFinder,
	directLinkSvc direct_link.Service,
) *Handler {
	return &Handler{
		styleSvc:      styleSvc,
		fileRepo:      fileRepo,
		policyRepo:    policyRepo,
		directLinkSvc: directLinkSvc,
	}
}

// ServeStyled 处理 GET /api/image/*pathWithStyle。
// pathWithStyle 的形式：
//
//	{publicFileID}                     → 无样式
//	{publicFileID}!{styleName}         → 命名样式（OSS / COS 标准）
//	{publicFileID}/{styleName}         → 命名样式（另一种常见写法）
//
// 若命名样式段为空且 URL 带 ?w=&h=&... query，走动态参数路径。
func (h *Handler) ServeStyled(c *gin.Context) {
	full := strings.TrimPrefix(c.Param("pathWithStyle"), "/")
	if full == "" {
		response.Fail(c, http.StatusBadRequest, "缺少文件 ID")
		return
	}
	publicID, styleName := splitPublicIDAndStyle(full)
	if publicID == "" {
		response.Fail(c, http.StatusBadRequest, "缺少文件 ID")
		return
	}

	dbFileID, _, err := idgen.DecodePublicID(publicID)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "无效的文件 ID 格式")
		return
	}

	ctx := c.Request.Context()
	file, err := h.fileRepo.FindByID(ctx, dbFileID)
	if err != nil || file == nil {
		response.Fail(c, http.StatusNotFound, "文件不存在")
		return
	}
	if file.PrimaryEntity == nil {
		response.Fail(c, http.StatusNotFound, "文件无可用存储实体")
		return
	}

	policy, err := h.policyRepo.FindByID(ctx, file.PrimaryEntity.PolicyID)
	if err != nil || policy == nil {
		response.Fail(c, http.StatusNotFound, "存储策略不存在")
		return
	}

	// styleSvc 为 nil 时（缓存初始化失败场景）直接回落原图
	if h.styleSvc == nil {
		h.redirectToOriginal(c, dbFileID)
		return
	}

	req := &image_style.StyleRequest{
		Policy:      policy,
		File:        file,
		Filename:    file.Name,
		StyleName:   styleName,
		DynamicOpts: c.Request.URL.Query(),
	}

	result, err := h.styleSvc.Process(ctx, req)
	if err != nil {
		switch {
		case errors.Is(err, image_style.ErrStyleNotApplicable):
			h.redirectToOriginal(c, dbFileID)
			return
		case errors.Is(err, image_style.ErrStyleNotFound):
			response.Fail(c, http.StatusNotFound, "样式不存在")
			return
		case errors.Is(err, image_style.ErrStyleProcessFailed):
			log.Printf("[image_style] 处理失败 file=%d: %v", dbFileID, err)
			h.redirectToOriginal(c, dbFileID)
			return
		default:
			log.Printf("[image_style] 未知错误 file=%d: %v", dbFileID, err)
			h.redirectToOriginal(c, dbFileID)
			return
		}
	}
	defer result.Reader.Close()

	etag := `"` + result.StyleHash + `"`
	writeStyleHeaders(c, result.ContentType, etag, result)
	// If-None-Match 短路返回 304
	if image_style.MatchesIfNoneMatch(c.GetHeader("If-None-Match"), etag) {
		c.Status(http.StatusNotModified)
		return
	}

	c.Status(http.StatusOK)
	if _, err := io.Copy(c.Writer, result.Reader); err != nil {
		log.Printf("[image_style] 写响应失败 file=%d: %v", dbFileID, err)
	}
}

// writeStyleHeaders 统一设置样式响应的 HTTP 头。
// 若发生了格式降级（请求 avif/heic/webp 但因引擎限制实际输出 jpeg 等），
// 额外写入 `X-Style-Fallback: <requested>-><actual>` 便于客户端与运维排查（Spec §6.3.3）。
func writeStyleHeaders(c *gin.Context, mime, etag string, result *image_style.StyleResult) {
	c.Header("Content-Type", mime)
	c.Header("ETag", etag)
	c.Header("Cache-Control", "public, max-age=604800")
	if !result.LastModified.IsZero() {
		c.Header("Last-Modified", result.LastModified.UTC().Format(http.TimeFormat))
	}
	if fb := styleFallbackHeader(result.RequestedFormat, mime); fb != "" {
		c.Header("X-Style-Fallback", fb)
	}
}

// styleFallbackHeader 根据请求的格式 requested 与实际 MIME 计算 X-Style-Fallback 头值；
// 未发生降级或 requested 未指定格式时返回空串。
func styleFallbackHeader(requested, mime string) string {
	req := strings.ToLower(strings.TrimSpace(requested))
	if req == "" || req == "original" {
		return ""
	}
	applied := formatFromMIME(mime)
	if applied == "" {
		return ""
	}
	if normalizeStyleFormat(req) == normalizeStyleFormat(applied) {
		return ""
	}
	return fmt.Sprintf("%s->%s", req, applied)
}

// formatFromMIME 将 HTTP Content-Type 映射为小写格式标识（jpg / png / webp 等）。
// 未识别返回 ""，调用方按"无降级信息"处理。
func formatFromMIME(mime string) string {
	switch strings.ToLower(strings.TrimSpace(mime)) {
	case "image/jpeg":
		return "jpg"
	case "image/png":
		return "png"
	case "image/webp":
		return "webp"
	case "image/avif":
		return "avif"
	case "image/heic", "image/heif":
		return "heic"
	case "image/gif":
		return "gif"
	case "image/tiff":
		return "tiff"
	default:
		return ""
	}
}

// normalizeStyleFormat 把同义别名归一（jpeg/jpg 同类；heif/heic 同类），
// 避免把 "jpg"→"image/jpeg" 这种别名差异误报为降级。
func normalizeStyleFormat(f string) string {
	switch strings.ToLower(f) {
	case "jpeg":
		return "jpg"
	case "heif":
		return "heic"
	default:
		return strings.ToLower(f)
	}
}

// redirectToOriginal 通过 DirectLinkService 拿原图直链并 302。
func (h *Handler) redirectToOriginal(c *gin.Context, dbFileID uint) {
	if h.directLinkSvc == nil {
		response.Fail(c, http.StatusNotFound, "无法获取原图直链")
		return
	}
	linksMap, err := h.directLinkSvc.GetOrCreateDirectLinks(c.Request.Context(), 0, []uint{dbFileID})
	if err != nil {
		log.Printf("[image_style] 获取直链失败 file=%d: %v", dbFileID, err)
		response.Fail(c, http.StatusInternalServerError, "获取直链失败")
		return
	}
	link, ok := linksMap[dbFileID]
	if !ok || link.URL == "" {
		response.Fail(c, http.StatusNotFound, "找不到文件对应的链接")
		return
	}
	c.Redirect(http.StatusFound, link.URL)
}

// splitPublicIDAndStyle 从路径段中分离 publicFileID 与 styleName。
// 按 "!" 优先，"/" 其次；路径不含这些分隔符时整段即 publicFileID。
func splitPublicIDAndStyle(full string) (publicID, styleName string) {
	for _, sep := range []string{"!", "/"} {
		if idx := strings.Index(full, sep); idx > 0 {
			return full[:idx], full[idx+len(sep):]
		}
	}
	return full, ""
}
