/*
 * @Description: 缓存管理 API
 * @Author: 安知鱼
 * @Date: 2025-01-26
 *
 * SSR 模式下提供缓存清理功能
 */
package cache

import (
	"context"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"

	"github.com/anzhiyu-c/anheyu-app/internal/service/cache"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"
)

// Handler 缓存管理 handler
type Handler struct {
	revalidateSvc *cache.RevalidateService
	status        func(context.Context) map[string]any
	actions       map[string]func(context.Context) error
	operationMu   sync.Mutex
}

// Configure adds capabilities owned by the running application, without exposing cache paths.
func (h *Handler) Configure(status func(context.Context) map[string]any, actions map[string]func(context.Context) error) {
	h.status, h.actions = status, actions
}

func (h *Handler) Manage(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	var req struct {
		Type string `json:"type" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, 400, "请选择缓存操作")
		return
	}
	action, ok := h.actions[req.Type]
	if !ok {
		response.Fail(c, 400, "当前运行模式不支持此操作")
		return
	}
	if !h.operationMu.TryLock() {
		response.Fail(c, 409, "已有缓存操作正在执行")
		return
	}
	defer h.operationMu.Unlock()
	if err := action(c.Request.Context()); err != nil {
		response.Fail(c, 500, "缓存操作失败："+err.Error())
		return
	}
	response.Success(c, nil, "缓存操作完成")
}

// NewHandler 创建缓存管理 handler
func NewHandler(revalidateSvc *cache.RevalidateService) *Handler {
	return &Handler{
		revalidateSvc: revalidateSvc,
	}
}

// RevalidateRequest 缓存清理请求
type RevalidateRequest struct {
	Type string `json:"type" binding:"required,oneof=all article config categories tags links"`
	Slug string `json:"slug,omitempty"` // 当 type=article 时必填
}

// Revalidate 清理前端缓存
// @Summary      清理前端缓存
// @Description  SSR 模式下清理 Next.js 前端缓存
// @Tags         缓存管理
// @Accept       json
// @Produce      json
// @Param        request body RevalidateRequest true "清理类型"
// @Success      200 {object} response.Response{data=string}
// @Failure      400 {object} response.Response
// @Failure      500 {object} response.Response
// @Router       /api/admin/cache/revalidate [post]
// @Security     BearerAuth
func (h *Handler) Revalidate(c *gin.Context) {
	if !h.revalidateSvc.IsEnabled() {
		response.Fail(c, http.StatusBadRequest, "缓存清理功能仅在 SSR 模式下可用")
		return
	}

	var req RevalidateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数错误: "+err.Error())
		return
	}

	var err error
	switch req.Type {
	case "all":
		err = h.revalidateSvc.RevalidateAll()
	case "article":
		if req.Slug == "" {
			response.Fail(c, http.StatusBadRequest, "清理文章缓存需要提供 slug")
			return
		}
		err = h.revalidateSvc.RevalidateArticle(req.Slug, "")
	case "config":
		err = h.revalidateSvc.RevalidateSiteConfig()
	case "categories":
		err = h.revalidateSvc.RevalidateCategories()
	case "tags":
		err = h.revalidateSvc.RevalidateTags()
	case "links":
		err = h.revalidateSvc.RevalidateFriendLinks()
	default:
		response.Fail(c, http.StatusBadRequest, "未知的清理类型")
		return
	}

	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "缓存清理失败: "+err.Error())
		return
	}

	response.Success(c, nil, "缓存清理成功")
}

// GetStatus 获取缓存清理服务状态
// @Summary      获取缓存服务状态
// @Description  检查缓存清理功能是否启用
// @Tags         缓存管理
// @Produce      json
// @Success      200 {object} response.Response{data=map[string]bool}
// @Router       /api/admin/cache/status [get]
// @Security     BearerAuth
func (h *Handler) GetStatus(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	status := map[string]any{"enabled": h.revalidateSvc.IsEnabled()}
	if h.status != nil {
		for key, value := range h.status(c.Request.Context()) {
			status[key] = value
		}
	}
	response.Success(c, status, "success")
}
