/*
 * @Description: 插件管理后台 API Handler
 * @Author: 安知鱼
 * @Date: 2026-04-09
 * @LastEditTime: 2026-08-13
 * @LastEditors: 安知鱼
 */
package plugin_admin

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/anzhiyu-c/anheyu-app/pkg/plugin"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"
)

// maxUploadSize 插件安装包上传大小上限
const maxUploadSize = 100 << 20 // 100MB

// Handler 插件管理 HTTP 处理器
type Handler struct {
	manager *plugin.Manager
}

// NewHandler 创建插件管理处理器
func NewHandler(manager *plugin.Manager) *Handler {
	return &Handler{manager: manager}
}

// List 获取所有已加载插件列表
// @Summary 获取插件列表
// @Tags 管理端-插件
// @Router /admin/plugins [GET]
func (h *Handler) List(c *gin.Context) {
	if h.manager == nil {
		response.Success(c, []plugin.PluginInfo{}, "插件系统未初始化")
		return
	}
	response.Success(c, h.manager.List(), "获取插件列表成功")
}

// Reload 重新加载指定插件
// @Summary 重新加载插件
// @Tags 管理端-插件
// @Router /admin/plugins/:id/reload [POST]
func (h *Handler) Reload(c *gin.Context) {
	id := c.Param("id")
	if h.manager == nil {
		response.Fail(c, http.StatusServiceUnavailable, "插件系统未初始化")
		return
	}

	if err := h.manager.ReloadByID(id); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	response.Success(c, nil, "插件已重新加载")
}

// Disable 禁用指定插件
// @Summary 禁用插件
// @Tags 管理端-插件
// @Router /admin/plugins/:id/disable [POST]
func (h *Handler) Disable(c *gin.Context) {
	id := c.Param("id")
	if h.manager == nil {
		response.Fail(c, http.StatusServiceUnavailable, "插件系统未初始化")
		return
	}

	if err := h.manager.DisableByID(id); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	response.Success(c, nil, "插件已禁用")
}

// Enable 启用已禁用的插件
// @Summary 启用插件
// @Tags 管理端-插件
// @Router /admin/plugins/:id/enable [POST]
func (h *Handler) Enable(c *gin.Context) {
	id := c.Param("id")
	if h.manager == nil {
		response.Fail(c, http.StatusServiceUnavailable, "插件系统未初始化")
		return
	}

	if err := h.manager.EnableByID(id); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	response.Success(c, nil, "插件已启用")
}

// Install 上传 zip 安装包安装（或升级）插件
// @Summary 安装插件
// @Tags 管理端-插件
// @Router /admin/plugins/install [POST]
func (h *Handler) Install(c *gin.Context) {
	if h.manager == nil {
		response.Fail(c, http.StatusServiceUnavailable, "插件系统未初始化")
		return
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadSize)
	fileHeader, err := c.FormFile("file")
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "请上传插件安装包（zip 格式，字段名 file，大小不超过 100MB）")
		return
	}
	if !strings.EqualFold(filepath.Ext(fileHeader.Filename), ".zip") {
		response.Fail(c, http.StatusBadRequest, "插件安装包必须为 zip 格式")
		return
	}

	src, err := fileHeader.Open()
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "读取上传文件失败")
		return
	}
	defer src.Close()

	tmpPath, err := plugin.SaveUploadToTemp(src)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer os.Remove(tmpPath)

	info, err := h.manager.InstallFromZip(tmpPath)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	response.Success(c, info, "插件安装成功")
}

// Uninstall 卸载插件（停止进程、删除文件、清理状态）
// @Summary 卸载插件
// @Tags 管理端-插件
// @Router /admin/plugins/:id [DELETE]
func (h *Handler) Uninstall(c *gin.Context) {
	id := c.Param("id")
	if h.manager == nil {
		response.Fail(c, http.StatusServiceUnavailable, "插件系统未初始化")
		return
	}

	if err := h.manager.UninstallByID(id); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	response.Success(c, nil, "插件已卸载")
}

// UpdateConfig 更新插件配置（保存后运行中的插件自动重载生效）
// @Summary 更新插件配置
// @Tags 管理端-插件
// @Router /admin/plugins/:id/config [PUT]
func (h *Handler) UpdateConfig(c *gin.Context) {
	id := c.Param("id")
	if h.manager == nil {
		response.Fail(c, http.StatusServiceUnavailable, "插件系统未初始化")
		return
	}

	var req struct {
		Config map[string]string `json:"config"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求体格式错误")
		return
	}

	if err := h.manager.UpdateConfig(id, req.Config); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	response.Success(c, nil, "插件配置已保存")
}

// RegisterRoutes 注册插件管理路由（社区版与 PRO 版共用，保证两端路由一致）
func RegisterRoutes(group *gin.RouterGroup, h *Handler) {
	group.GET("", h.List)
	group.POST("/install", h.Install)
	group.DELETE("/:id", h.Uninstall)
	group.POST("/:id/reload", h.Reload)
	group.POST("/:id/disable", h.Disable)
	group.POST("/:id/enable", h.Enable)
	group.PUT("/:id/config", h.UpdateConfig)
}
