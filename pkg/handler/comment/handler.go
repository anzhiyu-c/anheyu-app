// internal/app/handler/comment/handler.go
package comment

import (
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/auth"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/handler/comment/dto"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/comment"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/anzhiyu-c/anheyu-app/pkg/util"

	"github.com/gin-gonic/gin"
)

// 天气默认坐标配置键（与前端 sidebar.weather.rectangle 一致）
const keyWeatherRectangle = "sidebar.weather.rectangle"

type Handler struct {
	svc        *comment.Service
	settingSvc setting.SettingService // 可选，用于天气 IP 定位返回 default_rectangle
}

// NewHandler 创建评论处理器。settingSvc 可选，传入时在天气 IP 定位（局域网/无经纬度）响应中会带 default_rectangle
func NewHandler(svc *comment.Service, settingSvc setting.SettingService) *Handler {
	return &Handler{svc: svc, settingSvc: settingSvc}
}

// ListChildren
// @Summary      获取指定评论的子评论列表（分页）
// @Description  分页获取指定根评论下的所有回复评论
// @Tags         公开评论
// @Produce      json
// @Param        id path string true "父评论的公共ID"
// @Param        page query int false "页码" default(1)
// @Param        pageSize query int false "每页数量" default(10)
// @Success      200 {object} response.Response{data=dto.ListResponse} "成功响应"
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /public/comments/{id}/children [get]
func (h *Handler) ListChildren(c *gin.Context) {
	parentID := c.Param("id")
	if parentID == "" {
		response.Fail(c, http.StatusBadRequest, "父评论ID不能为空")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	childrenResponse, err := h.svc.ListChildren(c.Request.Context(), parentID, page, pageSize)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取子评论列表失败: "+err.Error())
		return
	}

	response.Success(c, childrenResponse, "获取成功")
}

// UploadCommentImage
// @Summary      上传评论图片
// @Description  上传一张图片，用于插入到评论中。返回图片的内部URI。
// @Tags         公开评论
// @Security     BearerAuth
// @Accept       multipart/form-data
// @Produce      json
// @Param        file formData file true "图片文件"
// @Success      200 {object} response.Response{data=dto.UploadImageResponse} "成功响应，返回文件信息"
// @Failure      400 {object} response.Response "请求错误，例如没有上传文件"
// @Failure      401 {object} response.Response "未授权"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /public/comments/upload [post]
func (h *Handler) UploadCommentImage(c *gin.Context) {
	viewerID := c.GetUint("viewer_id")
	// 为 multipart 边界留出空间，避免在图片校验之前无界解析请求体。
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, comment.MaxCommentImageSize+(1<<20))

	fileHeader, err := c.FormFile("file")
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "未找到上传的文件")
		return
	}

	fileContent, err := fileHeader.Open()
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "无法读取上传的文件")
		return
	}
	defer fileContent.Close()

	fileItem, err := h.svc.UploadImage(c.Request.Context(), viewerID, fileHeader.Filename, fileContent)
	if err != nil {
		if errors.Is(err, comment.ErrInvalidCommentImage) {
			response.Fail(c, http.StatusBadRequest, err.Error())
			return
		}
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	if fileItem == nil {
		response.Fail(c, http.StatusInternalServerError, "图片上传后未能获取文件信息")
		return
	}

	respData := dto.UploadImageResponse{
		ID: fileItem.ID,
	}

	response.Success(c, respData, "图片上传成功")
}

// ListLatest
// @Summary      公开获取最新评论列表
// @Description  分页获取全站所有最新的已发布评论
// @Tags         公开评论
// @Produce      json
// @Param        page query int false "页码" default(1)
// @Param        pageSize query int false "每页数量" default(10)
// @Success      200 {object} response.Response{data=dto.ListResponse} "成功响应"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /public/comments/latest [get]
func (h *Handler) ListLatest(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	commentsResponse, err := h.svc.ListLatest(c.Request.Context(), page, pageSize)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取最新评论列表失败: "+err.Error())
		return
	}

	response.Success(c, commentsResponse, "获取成功")
}

// SetPin
// @Summary      管理员置顶或取消置顶评论
// @Description  设置或取消指定ID评论的置顶状态
// @Tags         评论管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id path string true "评论的公共ID"
// @Param        pin_request body dto.SetPinRequest true "置顶请求"
// @Success      200 {object} response.Response{data=dto.Response} "成功响应，返回更新后的评论对象"
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      401 {object} response.Response "未授权"
// @Failure      404 {object} response.Response "评论不存在"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /comments/{id}/pin [put]
func (h *Handler) SetPin(c *gin.Context) {
	commentID := c.Param("id")
	if commentID == "" {
		response.Fail(c, http.StatusBadRequest, "评论ID不能为空")
		return
	}

	var req dto.SetPinRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数无效: "+err.Error())
		return
	}

	updatedCommentDTO, err := h.svc.SetPin(c.Request.Context(), commentID, *req.Pinned)
	if err != nil {
		if ent.IsNotFound(err) {
			response.Fail(c, http.StatusNotFound, "评论不存在")
		} else {
			response.Fail(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	response.Success(c, updatedCommentDTO, "评论置顶状态更新成功")
}

// UpdateStatus
// @Summary      管理员更新评论状态
// @Description  更新指定ID的评论的状态（例如，通过审核发布或设为待审核）
// @Tags         评论管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id path string true "评论的公共ID"
// @Param        status_request body dto.UpdateStatusRequest true "新的状态 (1: 已发布, 2: 待审核)"
// @Success      200 {object} response.Response{data=dto.Response} "成功响应，返回更新后的评论对象"
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      401 {object} response.Response "未授权"
// @Failure      404 {object} response.Response "评论不存在"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /comments/{id}/status [put]
func (h *Handler) UpdateStatus(c *gin.Context) {
	commentID := c.Param("id")
	if commentID == "" {
		response.Fail(c, http.StatusBadRequest, "评论ID不能为空")
		return
	}

	var req dto.UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数无效: "+err.Error())
		return
	}

	updatedCommentDTO, err := h.svc.UpdateStatus(c.Request.Context(), commentID, req.Status)
	if err != nil {
		if ent.IsNotFound(err) {
			response.Fail(c, http.StatusNotFound, "评论不存在")
		} else {
			response.Fail(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	response.Success(c, updatedCommentDTO, "评论状态更新成功")
}

// Create
// @Summary      创建新评论
// @Description  为指定路径的页面创建一条新评论，可以是根评论或回复
// @Tags         公开评论
// @Accept       json
// @Produce      json
// @Param        comment_request body dto.CreateRequest true "创建评论的请求体"
// @Success      200 {object} response.Response{data=dto.Response} "成功响应"
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /public/comments [post]
func (h *Handler) Create(c *gin.Context) {
	var req dto.CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数无效: "+err.Error())
		return
	}

	// 添加详细的调试日志来排查IP获取问题
	log.Printf("[DEBUG] 评论创建 - 原始请求信息:")
	log.Printf("[DEBUG]   RemoteAddr: %s", c.Request.RemoteAddr)
	log.Printf("[DEBUG]   Host: %s", c.Request.Host)
	log.Printf("[DEBUG]   X-Forwarded-For: '%s'", c.GetHeader("X-Forwarded-For"))
	log.Printf("[DEBUG]   X-Real-IP: '%s'", c.GetHeader("X-Real-IP"))
	log.Printf("[DEBUG]   X-Original-Forwarded-For: '%s'", c.GetHeader("X-Original-Forwarded-For"))
	log.Printf("[DEBUG]   CF-Connecting-IP: '%s'", c.GetHeader("CF-Connecting-IP"))
	log.Printf("[DEBUG]   CF-Ray: '%s'", c.GetHeader("CF-Ray"))
	log.Printf("[DEBUG]   True-Client-IP: '%s'", c.GetHeader("True-Client-IP"))
	log.Printf("[DEBUG]   X-Client-IP: '%s'", c.GetHeader("X-Client-IP"))
	log.Printf("[DEBUG]   Forwarded: '%s'", c.GetHeader("Forwarded"))
	log.Printf("[DEBUG]   User-Agent: '%s'", c.GetHeader("User-Agent"))
	log.Printf("[DEBUG]   Gin ClientIP(): %s", c.ClientIP())

	// 使用改进的IP获取方法，优先检查代理头部
	ip := util.GetRealClientIP(c)
	log.Printf("[DEBUG]   最终获取的IP: %s", ip)

	// 获取完整的 User-Agent 信息，包括 UA-CH (User-Agent Client Hints)
	// 用于准确识别 Windows 11
	ua := c.Request.UserAgent()
	uaPlatformVersion := c.GetHeader("Sec-CH-UA-Platform-Version")
	if uaPlatformVersion != "" {
		// 将 Platform Version 附加到 UA 字符串中，用特殊标记分隔
		ua = ua + " |PV:" + uaPlatformVersion
		log.Printf("[DEBUG]   UA-CH Platform Version: %s", uaPlatformVersion)
	}

	var claims *auth.CustomClaims
	if userClaim, exists := c.Get(auth.ClaimsKey); exists {
		claims, _ = userClaim.(*auth.CustomClaims)
	}

	// 获取客户端 Referer，用于 NSUUU API 白名单验证
	referer := c.GetHeader("Referer")

	commentDTO, err := h.svc.Create(c.Request.Context(), &req, ip, ua, referer, claims)
	if err != nil {
		if errors.Is(err, comment.ErrForbiddenNickname) {
			response.Fail(c, http.StatusBadRequest, err.Error())
		} else if errors.Is(err, constant.ErrAdminEmailUsedByGuest) {
			response.Fail(c, http.StatusForbidden, err.Error())
		} else {
			response.Fail(c, http.StatusInternalServerError, "创建评论失败: "+err.Error())
		}
		return
	}

	response.Success(c, commentDTO, "评论发布成功")
}

// ListByPath
// @Summary      获取指定路径的评论列表（分页）
// @Description  分页获取指定路径下的根评论，并附带其所有子评论
// @Tags         公开评论
// @Produce      json
// @Param        target_path query string true "目标路径 (例如 /posts/some-slug)"
// @Param        page query int false "页码" default(1)
// @Param        pageSize query int false "每页数量" default(10)
// @Success      200 {object} response.Response{data=dto.ListResponse} "成功响应"
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /public/comments [get]
func (h *Handler) ListByPath(c *gin.Context) {
	path := c.Query("target_path")
	if path == "" {
		response.Fail(c, http.StatusBadRequest, "目标路径不能为空")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	commentsResponse, err := h.svc.ListByPath(c.Request.Context(), path, page, pageSize)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取评论列表失败: "+err.Error())
		return
	}

	response.Success(c, commentsResponse, "获取成功")
}

// LikeComment
// @Summary      点赞评论
// @Description  为指定ID的评论增加一次点赞
// @Tags         公开评论
// @Produce      json
// @Param        id path string true "评论的公共ID"
// @Success      200 {object} response.Response{data=integer} "成功响应，返回最新的点赞数"
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /public/comments/{id}/like [post]
func (h *Handler) LikeComment(c *gin.Context) {
	commentID := c.Param("id")
	if commentID == "" {
		response.Fail(c, http.StatusBadRequest, "评论ID不能为空")
		return
	}

	newLikeCount, err := h.svc.LikeComment(c.Request.Context(), commentID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, newLikeCount, "点赞成功")
}

// UnlikeComment
// @Summary      取消点赞评论
// @Description  为指定ID的评论减少一次点赞
// @Tags         公开评论
// @Produce      json
// @Param        id path string true "评论的公共ID"
// @Success      200 {object} response.Response{data=integer} "成功响应，返回最新的点赞数"
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /public/comments/{id}/unlike [post]
func (h *Handler) UnlikeComment(c *gin.Context) {
	commentID := c.Param("id")
	if commentID == "" {
		response.Fail(c, http.StatusBadRequest, "评论ID不能为空")
		return
	}

	newLikeCount, err := h.svc.UnlikeComment(c.Request.Context(), commentID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, newLikeCount, "取消点赞成功")
}

// --- Admin Handlers ---

// AdminList
// @Summary      管理员查询评论列表
// @Description  根据多种条件分页查询评论
// @Tags         评论管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        query query dto.AdminListRequest true "查询参数"
// @Success      200 {object} response.Response{data=dto.ListResponse} "成功响应"
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      401 {object} response.Response "未授权"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /comments [get]
func (h *Handler) AdminList(c *gin.Context) {
	var req dto.AdminListRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数无效: "+err.Error())
		return
	}

	commentsResponse, err := h.svc.AdminList(c.Request.Context(), &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取评论列表失败: "+err.Error())
		return
	}

	response.Success(c, commentsResponse, "获取成功")
}

// Delete
// @Summary      管理员批量删除评论
// @Description  根据评论的公共ID批量删除评论
// @Tags         评论管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        delete_request body dto.DeleteRequest true "删除请求，包含ID列表"
// @Success      200 {object} response.Response{data=integer} "成功响应，返回删除的数量"
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      401 {object} response.Response "未授权"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /comments [delete]
func (h *Handler) Delete(c *gin.Context) {
	var req dto.DeleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数无效: "+err.Error())
		return
	}

	deletedCount, err := h.svc.Delete(c.Request.Context(), req.IDs)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "删除评论失败: "+err.Error())
		return
	}

	response.Success(c, deletedCount, fmt.Sprintf("成功删除 %d 条评论", deletedCount))
}

// UpdateContent
// @Summary      管理员更新评论内容
// @Description  根据评论ID更新评论的内容
// @Tags         评论管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id   path  string  true  "评论公共ID"
// @Param        update_request body dto.UpdateContentRequest true "更新请求，包含新的内容"
// @Success      200  {object}  response.Response{data=dto.Response}  "更新成功"
// @Failure      400  {object}  response.Response  "请求参数错误"
// @Failure      401  {object}  response.Response  "未授权"
// @Failure      500  {object}  response.Response  "服务器内部错误"
// @Router       /comments/{id} [put]
func (h *Handler) UpdateContent(c *gin.Context) {
	publicID := c.Param("id")
	if publicID == "" {
		response.Fail(c, http.StatusBadRequest, "评论ID不能为空")
		return
	}

	var req dto.UpdateContentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数无效: "+err.Error())
		return
	}

	updatedComment, err := h.svc.UpdateContent(c.Request.Context(), publicID, req.Content)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "更新评论失败: "+err.Error())
		return
	}

	response.Success(c, updatedComment, "评论更新成功")
}

// UpdateCommentInfo
// @Summary      管理员更新评论信息
// @Description  根据评论ID更新评论的内容、昵称、邮箱和网站等信息
// @Tags         评论管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id   path  string  true  "评论公共ID"
// @Param        update_request body dto.UpdateCommentRequest true "更新请求，可包含 content、nickname、email、website"
// @Success      200  {object}  response.Response{data=dto.Response}  "更新成功"
// @Failure      400  {object}  response.Response  "请求参数错误"
// @Failure      401  {object}  response.Response  "未授权"
// @Failure      500  {object}  response.Response  "服务器内部错误"
// @Router       /comments/{id}/info [put]
func (h *Handler) UpdateCommentInfo(c *gin.Context) {
	publicID := c.Param("id")
	if publicID == "" {
		response.Fail(c, http.StatusBadRequest, "评论ID不能为空")
		return
	}

	var req dto.UpdateCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数无效: "+err.Error())
		return
	}

	// 验证至少提供了一个字段
	if req.Content == nil && req.Nickname == nil && req.Email == nil && req.Website == nil {
		response.Fail(c, http.StatusBadRequest, "请至少提供一个要更新的字段")
		return
	}

	updatedComment, err := h.svc.UpdateCommentInfo(c.Request.Context(), publicID, &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "更新评论信息失败: "+err.Error())
		return
	}

	response.Success(c, updatedComment, "评论信息更新成功")
}

// GetQQInfo
// @Summary      获取QQ信息
// @Description  根据QQ号获取QQ昵称和头像URL。用于评论表单自动填充功能。
// @Tags         公开评论
// @Produce      json
// @Param        qq query string true "QQ号码"
// @Success      200 {object} response.Response{data=comment.QQInfoResponse} "成功响应"
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /public/comments/qq-info [get]
func (h *Handler) GetQQInfo(c *gin.Context) {
	qqNumber := c.Query("qq")
	if qqNumber == "" {
		response.Fail(c, http.StatusBadRequest, "QQ号不能为空")
		return
	}

	// 获取客户端 Referer，用于 NSUUU API 白名单验证
	referer := c.GetHeader("Referer")

	info, err := h.svc.GetQQInfo(c.Request.Context(), qqNumber, referer)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, info, "获取成功")
}

// GetIPLocation
// @Summary      获取IP定位信息
// @Description  根据客户端IP地址获取地理位置信息（城市、经纬度等）。用于天气组件等功能。
// @Tags         公开评论
// @Produce      json
// @Success      200 {object} response.Response{data=comment.IPLocationResponse} "成功响应"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /public/comments/ip-location [get]
func (h *Handler) GetIPLocation(c *gin.Context) {
	// 获取客户端真实 IP
	clientIP := util.GetRealClientIP(c)

	// 获取客户端 Referer，用于 NSUUU API 白名单验证
	referer := c.GetHeader("Referer")

	info, err := h.svc.GetIPLocation(c.Request.Context(), clientIP, referer)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	// 局域网或无有效经纬度时，若配置了天气默认坐标则一并返回，前端用其请求天气
	if h.settingSvc != nil && isLANOrEmptyLocation(info) {
		if rect := strings.TrimSpace(h.settingSvc.Get(keyWeatherRectangle)); rect != "" {
			c.JSON(http.StatusOK, gin.H{
				"code":              http.StatusOK,
				"message":           "获取成功",
				"data":              info,
				"default_rectangle": rect,
			})
			return
		}
	}
	response.Success(c, info, "获取成功")
}

// isLANOrEmptyLocation 是否为局域网或 city/经纬度都为空（无法用于天气定位）
func isLANOrEmptyLocation(info *comment.IPLocationResponse) bool {
	if info == nil {
		return true
	}
	isLAN := info.Country == "局域网" || info.Province == "局域网"
	noCoords := (info.Latitude == "" || info.Longitude == "") && info.City == ""
	return isLAN || noCoords
}

// ExportComments
// @Summary      管理员导出评论
// @Description  导出选定的评论或所有评论为 ZIP 文件
// @Tags         评论管理
// @Security     BearerAuth
// @Accept       json
// @Produce      application/zip
// @Param        export_request body dto.ExportRequest true "导出请求，包含ID列表（空则导出所有）"
// @Success      200 {file} file "ZIP文件下载"
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      401 {object} response.Response "未授权"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /comments/export [post]
func (h *Handler) ExportComments(c *gin.Context) {
	var req dto.ExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// 如果没有 body 或解析失败，默认导出所有
		req.IDs = []string{}
	}

	log.Printf("[Handler.ExportComments] 开始导出评论，共 %d 个ID", len(req.IDs))

	zipData, err := h.svc.ExportCommentsToZip(c.Request.Context(), req.IDs)
	if err != nil {
		log.Printf("[Handler.ExportComments] 导出失败: %v", err)
		response.Fail(c, http.StatusInternalServerError, "导出评论失败: "+err.Error())
		return
	}

	// 设置响应头
	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", "attachment; filename=comments_export.zip")
	c.Header("Content-Length", strconv.Itoa(len(zipData)))

	c.Data(http.StatusOK, "application/zip", zipData)
}

// ImportComments
// @Summary      管理员导入评论
// @Description  从 JSON 或 ZIP 文件导入评论
// @Tags         评论管理
// @Security     BearerAuth
// @Accept       multipart/form-data
// @Produce      json
// @Param        file formData file true "评论数据文件（JSON或ZIP格式）"
// @Param        skip_existing formData bool false "是否跳过已存在的评论"
// @Param        default_status formData int false "默认状态（1:已发布, 2:待审核）"
// @Param        keep_create_time formData bool false "是否保留原创建时间"
// @Success      200 {object} response.Response{data=dto.ImportResult} "导入成功"
// @Failure      400 {object} response.Response "参数错误"
// @Failure      401 {object} response.Response "未授权"
// @Failure      500 {object} response.Response "导入失败"
// @Router       /comments/import [post]
func (h *Handler) ImportComments(c *gin.Context) {
	log.Printf("[Handler.ImportComments] 开始处理评论导入请求")

	// 获取上传的文件
	fileHeader, err := c.FormFile("file")
	if err != nil {
		log.Printf("[Handler.ImportComments] 获取上传文件失败: %v", err)
		response.Fail(c, http.StatusBadRequest, "无效的文件上传请求")
		return
	}

	log.Printf("[Handler.ImportComments] 接收到文件: %s, 大小: %d bytes", fileHeader.Filename, fileHeader.Size)

	// 读取文件内容
	file, err := fileHeader.Open()
	if err != nil {
		log.Printf("[Handler.ImportComments] 打开文件失败: %v", err)
		response.Fail(c, http.StatusInternalServerError, "无法处理上传的文件")
		return
	}
	defer file.Close()

	fileData, err := io.ReadAll(file)
	if err != nil {
		log.Printf("[Handler.ImportComments] 读取文件失败: %v", err)
		response.Fail(c, http.StatusInternalServerError, "读取文件失败")
		return
	}

	// 解析导入选项
	skipExisting := c.DefaultPostForm("skip_existing", "true") == "true"
	keepCreateTime := c.DefaultPostForm("keep_create_time", "true") == "true"
	defaultStatusStr := c.DefaultPostForm("default_status", "1")
	defaultStatus, _ := strconv.Atoi(defaultStatusStr)
	if defaultStatus < 1 || defaultStatus > 2 {
		defaultStatus = 1
	}

	importReq := &comment.ImportCommentRequest{
		SkipExisting:   skipExisting,
		DefaultStatus:  defaultStatus,
		KeepCreateTime: keepCreateTime,
	}

	log.Printf("[Handler.ImportComments] 导入选项 - 跳过已存在: %v, 默认状态: %d, 保留时间: %v",
		skipExisting, defaultStatus, keepCreateTime)

	// 根据文件类型调用不同的导入方法
	var result *comment.ImportCommentResult
	ext := filepath.Ext(fileHeader.Filename)

	ctx := c.Request.Context()

	switch ext {
	case ".json":
		result, err = h.svc.ImportCommentsFromJSON(ctx, fileData, importReq)
	case ".zip":
		result, err = h.svc.ImportCommentsFromZip(ctx, fileData, importReq)
	default:
		response.Fail(c, http.StatusBadRequest, "不支持的文件格式，仅支持 .json 和 .zip 文件")
		return
	}

	if err != nil {
		log.Printf("[Handler.ImportComments] 导入失败: %v", err)
		response.Fail(c, http.StatusInternalServerError, "导入评论失败: "+err.Error())
		return
	}

	// 转换为 DTO
	importResult := &dto.ImportResult{
		TotalCount:    result.TotalCount,
		SuccessCount:  result.SuccessCount,
		SkippedCount:  result.SkippedCount,
		FailedCount:   result.FailedCount,
		ErrorMessages: result.Errors,
	}

	response.Success(c, importResult, fmt.Sprintf("导入完成：成功 %d，跳过 %d，失败 %d",
		result.SuccessCount, result.SkippedCount, result.FailedCount))
}
