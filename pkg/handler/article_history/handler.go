/*
 * @Description: 文章历史版本 HTTP 处理器
 * @Author: 安知鱼
 * @Date: 2026-01-13
 */
package article_history

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	articleHandler "github.com/anzhiyu-c/anheyu-app/pkg/handler/article"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	historySvc "github.com/anzhiyu-c/anheyu-app/pkg/service/article_history"
)

// Handler 封装了所有与文章历史版本相关的 HTTP 处理器
type Handler struct {
	svc historySvc.Service
}

// NewHandler 是 Handler 的构造函数
func NewHandler(svc historySvc.Service) *Handler {
	return &Handler{svc: svc}
}

// ListHistory 获取文章历史版本列表
// @Summary      获取文章历史版本列表
// @Description  分页获取指定文章的历史编辑记录
// @Tags         文章历史版本
// @Security     BearerAuth
// @Produce      json
// @Param        id path string true "文章公共ID"
// @Param        page query int false "页码" default(1)
// @Param        pageSize query int false "每页数量" default(20)
// @Success      200 {object} response.Response{data=model.ArticleHistoryListResponse}
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      401 {object} response.Response "未授权"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /articles/{id}/history [get]
func (h *Handler) ListHistory(c *gin.Context) {
	articleID := c.Param("id")
	if articleID == "" {
		response.Fail(c, http.StatusBadRequest, "文章ID不能为空")
		return
	}

	if _, ok := articleHandler.RequireArticleAccess(c, articleID, h.svc.GetArticleOwnerID); !ok {
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}

	result, err := h.svc.ListHistory(c.Request.Context(), articleID, page, pageSize)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取历史版本列表失败: "+err.Error())
		return
	}

	response.Success(c, result, "获取成功")
}

// GetVersion 获取指定版本详情
// @Summary      获取指定历史版本详情
// @Description  获取文章指定版本的完整内容
// @Tags         文章历史版本
// @Security     BearerAuth
// @Produce      json
// @Param        id path string true "文章公共ID"
// @Param        version path int true "版本号"
// @Success      200 {object} response.Response{data=model.ArticleHistory}
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      401 {object} response.Response "未授权"
// @Failure      404 {object} response.Response "版本不存在"
// @Router       /articles/{id}/history/{version} [get]
func (h *Handler) GetVersion(c *gin.Context) {
	articleID := c.Param("id")
	if articleID == "" {
		response.Fail(c, http.StatusBadRequest, "文章ID不能为空")
		return
	}

	if _, ok := articleHandler.RequireArticleAccess(c, articleID, h.svc.GetArticleOwnerID); !ok {
		return
	}
	version, err := strconv.Atoi(c.Param("version"))
	if err != nil || version <= 0 {
		response.Fail(c, http.StatusBadRequest, "无效的版本号")
		return
	}

	history, err := h.svc.GetHistoryVersion(c.Request.Context(), articleID, version)
	if err != nil {
		response.Fail(c, http.StatusNotFound, "版本不存在: "+err.Error())
		return
	}

	response.Success(c, history, "获取成功")
}

// CompareVersions 对比两个版本
// @Summary      对比两个历史版本
// @Description  获取两个版本的内容用于对比
// @Tags         文章历史版本
// @Security     BearerAuth
// @Produce      json
// @Param        id path string true "文章公共ID"
// @Param        v1 query int true "版本1"
// @Param        v2 query int true "版本2"
// @Success      200 {object} response.Response{data=model.ArticleHistoryCompareResponse}
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      401 {object} response.Response "未授权"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /articles/{id}/history/compare [get]
func (h *Handler) CompareVersions(c *gin.Context) {
	articleID := c.Param("id")
	if articleID == "" {
		response.Fail(c, http.StatusBadRequest, "文章ID不能为空")
		return
	}

	if _, ok := articleHandler.RequireArticleAccess(c, articleID, h.svc.GetArticleOwnerID); !ok {
		return
	}
	v1, err1 := strconv.Atoi(c.Query("v1"))
	v2, err2 := strconv.Atoi(c.Query("v2"))

	if err1 != nil || err2 != nil || v1 <= 0 || v2 <= 0 {
		response.Fail(c, http.StatusBadRequest, "请提供有效的版本号")
		return
	}

	if v1 == v2 {
		response.Fail(c, http.StatusBadRequest, "两个版本号不能相同")
		return
	}

	result, err := h.svc.CompareVersions(c.Request.Context(), articleID, v1, v2)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "版本对比失败: "+err.Error())
		return
	}

	response.Success(c, result, "获取成功")
}

// RestoreVersion 恢复到指定版本
// @Summary      恢复到指定历史版本
// @Description  将文章恢复到指定的历史版本（此接口仅返回历史版本数据，实际恢复需要调用更新文章接口）
// @Tags         文章历史版本
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id path string true "文章公共ID"
// @Param        version path int true "版本号"
// @Param        body body model.RestoreHistoryRequest false "恢复请求参数"
// @Success      200 {object} response.Response{data=model.ArticleHistory}
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      401 {object} response.Response "未授权"
// @Failure      404 {object} response.Response "版本不存在"
// @Router       /articles/{id}/history/{version}/restore [post]
func (h *Handler) RestoreVersion(c *gin.Context) {
	articleID := c.Param("id")
	if articleID == "" {
		response.Fail(c, http.StatusBadRequest, "文章ID不能为空")
		return
	}

	if _, ok := articleHandler.RequireArticleAccess(c, articleID, h.svc.GetArticleOwnerID); !ok {
		return
	}
	version, err := strconv.Atoi(c.Param("version"))
	if err != nil || version <= 0 {
		response.Fail(c, http.StatusBadRequest, "无效的版本号")
		return
	}

	// 获取历史版本数据
	history, err := h.svc.RestoreVersion(c.Request.Context(), articleID, version)
	if err != nil {
		response.Fail(c, http.StatusNotFound, "获取历史版本失败: "+err.Error())
		return
	}

	response.Success(c, history, "获取历史版本成功，请使用返回的数据调用更新文章接口完成恢复")
}

// GetHistoryCount 获取历史版本数量
// @Summary      获取文章历史版本数量
// @Description  获取指定文章的历史版本总数
// @Tags         文章历史版本
// @Security     BearerAuth
// @Produce      json
// @Param        id path string true "文章公共ID"
// @Success      200 {object} response.Response{data=object{count=int}}
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      401 {object} response.Response "未授权"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /articles/{id}/history/count [get]
func (h *Handler) GetHistoryCount(c *gin.Context) {
	articleID := c.Param("id")
	if articleID == "" {
		response.Fail(c, http.StatusBadRequest, "文章ID不能为空")
		return
	}

	if _, ok := articleHandler.RequireArticleAccess(c, articleID, h.svc.GetArticleOwnerID); !ok {
		return
	}
	count, err := h.svc.GetHistoryCount(c.Request.Context(), articleID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取历史版本数量失败: "+err.Error())
		return
	}

	response.Success(c, gin.H{"count": count}, "获取成功")
}
