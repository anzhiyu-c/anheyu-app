package link

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/link"

	"github.com/gin-gonic/gin"
)

// HealthCheckStatus 健康检查状态
type HealthCheckStatus struct {
	IsRunning bool                           `json:"is_running"`
	StartTime *time.Time                     `json:"start_time,omitempty"`
	EndTime   *time.Time                     `json:"end_time,omitempty"`
	Result    *model.LinkHealthCheckResponse `json:"result,omitempty"`
	Error     string                         `json:"error,omitempty"`
}

var (
	healthCheckStatus = &HealthCheckStatus{IsRunning: false}
	healthCheckMutex  sync.RWMutex
)

// Handler 负责处理友链相关的 API 请求。
type Handler struct {
	linkSvc link.Service
}

// NewHandler 是 Handler 的构造函数。
func NewHandler(linkSvc link.Service) *Handler {
	return &Handler{linkSvc: linkSvc}
}

// --- 前台公开接口 ---

// GetRandomLinks 处理随机获取友链的请求。
// @Summary      随机获取友链
// @Description  随机获取指定数量的已批准友链
// @Tags         友情链接
// @Produce      json
// @Param        num  query  int  false  "获取数量，0表示全部"  default(0)
// @Success      200  {object}  response.Response{data=[]model.LinkDTO}  "获取成功"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /public/links/random [get]
func (h *Handler) GetRandomLinks(c *gin.Context) {
	// 从查询参数中获取 num，如果不存在或无效，则默认为 0
	num, _ := strconv.Atoi(c.DefaultQuery("num", "0"))

	links, err := h.linkSvc.GetRandomLinks(c.Request.Context(), num)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取随机友链失败: "+err.Error())
		return
	}
	response.Success(c, links, "获取成功")
}

// ApplyLink 处理前台用户申请友链的请求。
// @Summary      申请友链
// @Description  前台用户提交友链申请，等待管理员审核
// @Tags         友情链接
// @Accept       json
// @Produce      json
// @Param        body  body  model.ApplyLinkRequest  true  "友链申请信息"
// @Success      200  {object}  response.Response  "申请已提交"
// @Failure      400  {object}  response.Response  "参数无效"
// @Failure      500  {object}  response.Response  "申请失败"
// @Router       /public/links [post]
func (h *Handler) ApplyLink(c *gin.Context) {
	var req model.ApplyLinkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数无效: "+err.Error())
		return
	}

	_, err := h.linkSvc.ApplyLink(c.Request.Context(), &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "申请失败: "+err.Error())
		return
	}
	response.Success(c, nil, "申请已提交，等待审核")
}

// CheckLinkExists 处理检查友链URL是否已存在的请求。
// @Summary      检查友链URL是否存在
// @Description  检查指定的网站URL是否已经申请过友链
// @Tags         友情链接
// @Produce      json
// @Param        url  query  string  true  "网站URL"
// @Success      200  {object}  response.Response{data=model.CheckLinkExistsResponse}  "检查成功"
// @Failure      400  {object}  response.Response  "参数无效"
// @Failure      500  {object}  response.Response  "检查失败"
// @Router       /public/links/check-exists [get]
func (h *Handler) CheckLinkExists(c *gin.Context) {
	url := c.Query("url")
	if url == "" {
		response.Fail(c, http.StatusBadRequest, "URL参数不能为空")
		return
	}

	result, err := h.linkSvc.CheckLinkExistsByURL(c.Request.Context(), url)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "检查失败: "+err.Error())
		return
	}
	response.Success(c, result, "检查成功")
}

// ListPublicLinks 处理前台获取已批准友链列表的请求。
// @Summary      获取公开友链列表
// @Description  获取所有已批准的友链列表，支持按分类和标签筛选
// @Tags         友情链接
// @Produce      json
// @Param        category_id  query  string  false  "分类ID"
// @Param        tag_id       query  string  false  "标签ID"
// @Success      200  {object}  response.Response{data=[]model.LinkDTO}  "获取成功"
// @Failure      400  {object}  response.Response  "参数无效"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /public/links [get]
func (h *Handler) ListPublicLinks(c *gin.Context) {
	var req model.ListPublicLinksRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数无效: "+err.Error())
		return
	}

	result, err := h.linkSvc.ListPublicLinks(c.Request.Context(), &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取列表失败: "+err.Error())
		return
	}
	response.Success(c, result, "获取成功")
}

// ListAllApplications 处理前台获取所有友链申请列表的请求（公开接口）
// @Summary      获取所有友链申请列表
// @Description  获取所有友链申请，包括待审核、已通过、已拒绝等状态，按申请时间倒序
// @Tags         友情链接
// @Produce      json
// @Param        page      query  int     false  "页码"  default(1)
// @Param        pageSize  query  int     false  "每页数量"  default(20)
// @Param        status    query  string  false  "状态筛选"  Enums(PENDING, APPROVED, REJECTED, INVALID)
// @Param        name      query  string  false  "名称搜索（模糊匹配）"
// @Success      200  {object}  response.Response{data=model.LinkListResponse}  "获取成功"
// @Failure      400  {object}  response.Response  "参数无效"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /public/links/applications [get]
func (h *Handler) ListAllApplications(c *gin.Context) {
	var req model.ListPublicLinksRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数无效: "+err.Error())
		return
	}

	result, err := h.linkSvc.ListAllApplications(c.Request.Context(), &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取申请列表失败: "+err.Error())
		return
	}
	response.Success(c, result, "获取成功")
}

// ListCategories 获取友链分类列表。
// @Summary      获取分类列表（管理员）
// @Description  获取所有友链分类列表，包括统计信息
// @Tags         友链管理
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  response.Response{data=[]model.LinkCategoryDTO}  "获取成功"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /links/categories [get]
func (h *Handler) ListCategories(c *gin.Context) {
	categories, err := h.linkSvc.ListCategories(c.Request.Context())
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取分类列表失败: "+err.Error())
		return
	}
	response.Success(c, categories, "获取成功")
}

// ListPublicCategories 获取有已审核通过友链的分类列表，用于前台。
// @Summary      获取公开分类列表
// @Description  获取包含已批准友链的分类列表
// @Tags         友情链接
// @Produce      json
// @Success      200  {object}  response.Response{data=[]model.LinkCategoryDTO}  "获取成功"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /public/link-categories [get]
func (h *Handler) ListPublicCategories(c *gin.Context) {
	categories, err := h.linkSvc.ListPublicCategories(c.Request.Context())
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取分类列表失败: "+err.Error())
		return
	}
	response.Success(c, categories, "获取成功")
}

// --- 后台管理接口 ---

// ListAllTags 获取所有友链标签。
// @Summary      获取标签列表
// @Description  获取所有友链标签列表
// @Tags         友链管理
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  response.Response{data=[]model.LinkTagDTO}  "获取成功"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /links/tags [get]
func (h *Handler) ListAllTags(c *gin.Context) {
	tags, err := h.linkSvc.AdminListAllTags(c.Request.Context())
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取标签列表失败: "+err.Error())
		return
	}
	response.Success(c, tags, "获取成功")
}

// AdminCreateLink 处理后台管理员直接创建友链的请求。
// @Summary      创建友链
// @Description  管理员手动创建新友链
// @Tags         友链管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  model.AdminCreateLinkRequest  true  "友链信息"
// @Success      201  {object}  response.Response{data=model.LinkDTO}  "创建成功"
// @Failure      400  {object}  response.Response  "参数无效"
// @Failure      500  {object}  response.Response  "创建失败"
// @Router       /links [post]
func (h *Handler) AdminCreateLink(c *gin.Context) {
	var req model.AdminCreateLinkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数无效: "+err.Error())
		return
	}
	link, err := h.linkSvc.AdminCreateLink(c.Request.Context(), &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "创建失败: "+err.Error())
		return
	}
	response.SuccessWithStatus(c, http.StatusCreated, link, "创建成功")
}

// ListLinks 处理后台管理员获取友链列表的请求。
// @Summary      获取友链列表（管理员）
// @Description  获取所有友链列表，支持分页和筛选
// @Tags         友链管理
// @Security     BearerAuth
// @Produce      json
// @Param        page         query  int     false  "页码"  default(1)
// @Param        page_size    query  int     false  "每页数量"  default(10)
// @Param        name         query  string  false  "友链名称（模糊搜索）"
// @Param        status       query  string  false  "审核状态"
// @Param        category_id  query  int     false  "分类ID"
// @Param        tag_id       query  int     false  "标签ID"
// @Success      200  {object}  response.Response{data=model.LinkListResponse}  "获取成功"
// @Failure      400  {object}  response.Response  "参数无效"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /links [get]
func (h *Handler) ListLinks(c *gin.Context) {
	var req model.ListLinksRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数无效: "+err.Error())
		return
	}

	result, err := h.linkSvc.ListLinks(c.Request.Context(), &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取列表失败: "+err.Error())
		return
	}
	response.Success(c, result, "获取成功")
}

// AdminUpdateLink 处理后台管理员更新友链的请求。
// @Summary      更新友链
// @Description  管理员更新友链信息
// @Tags         友链管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id    path  string  true  "友链ID"
// @Param        body  body  model.AdminUpdateLinkRequest  true  "友链信息"
// @Success      200  {object}  response.Response{data=model.LinkDTO}  "更新成功"
// @Failure      400  {object}  response.Response  "参数无效"
// @Failure      500  {object}  response.Response  "更新失败"
// @Router       /links/{id} [put]
func (h *Handler) AdminUpdateLink(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "ID 格式无效")
		return
	}
	var req model.AdminUpdateLinkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数无效: "+err.Error())
		return
	}
	link, err := h.linkSvc.AdminUpdateLink(c.Request.Context(), id, &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "更新失败: "+err.Error())
		return
	}
	response.Success(c, link, "更新成功")
}

// AdminDeleteLink 处理后台管理员删除友链的请求。
// @Summary      删除友链
// @Description  管理员删除指定友链
// @Tags         友链管理
// @Security     BearerAuth
// @Param        id  path  string  true  "友链ID"
// @Success      200  {object}  response.Response  "删除成功"
// @Failure      400  {object}  response.Response  "参数无效"
// @Failure      500  {object}  response.Response  "删除失败"
// @Router       /links/{id} [delete]
func (h *Handler) AdminDeleteLink(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "ID 格式无效")
		return
	}
	err = h.linkSvc.AdminDeleteLink(c.Request.Context(), id)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "删除失败: "+err.Error())
		return
	}
	response.Success(c, nil, "删除成功")
}

// ReviewLink 处理后台管理员审核友链的请求。
// @Summary      审核友链
// @Description  管理员审核友链申请（批准/拒绝）
// @Tags         友链管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id    path  string  true  "友链ID"
// @Param        body  body  model.ReviewLinkRequest  true  "审核信息"
// @Success      200  {object}  response.Response  "审核成功"
// @Failure      400  {object}  response.Response  "参数无效"
// @Failure      500  {object}  response.Response  "审核失败"
// @Router       /links/{id}/review [put]
func (h *Handler) ReviewLink(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "ID 格式无效")
		return
	}

	var req model.ReviewLinkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数无效: "+err.Error())
		return
	}

	if err := h.linkSvc.ReviewLink(c.Request.Context(), id, &req); err != nil {
		response.Fail(c, http.StatusInternalServerError, "审核操作失败: "+err.Error())
		return
	}
	response.Success(c, nil, "审核状态更新成功")
}

// CreateCategory 处理后台管理员创建友链分类的请求。
// @Summary      创建分类
// @Description  创建友链分类
// @Tags         友链管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  model.CreateLinkCategoryRequest  true  "分类信息"
// @Success      201  {object}  response.Response{data=model.LinkCategoryDTO}  "创建成功"
// @Failure      400  {object}  response.Response  "参数无效"
// @Failure      500  {object}  response.Response  "创建失败"
// @Router       /links/categories [post]
func (h *Handler) CreateCategory(c *gin.Context) {
	var req model.CreateLinkCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数无效: "+err.Error())
		return
	}

	cat, err := h.linkSvc.CreateCategory(c.Request.Context(), &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "创建分类失败: "+err.Error())
		return
	}
	response.SuccessWithStatus(c, http.StatusCreated, cat, "创建成功")
}

// CreateTag 处理后台管理员创建友链标签的请求。
// @Summary      创建标签
// @Description  创建友链标签
// @Tags         友链管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  model.CreateLinkTagRequest  true  "标签信息"
// @Success      201  {object}  response.Response{data=model.LinkTagDTO}  "创建成功"
// @Failure      400  {object}  response.Response  "参数无效"
// @Failure      500  {object}  response.Response  "创建失败"
// @Router       /links/tags [post]
func (h *Handler) CreateTag(c *gin.Context) {
	var req model.CreateLinkTagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数无效: "+err.Error())
		return
	}

	tag, err := h.linkSvc.CreateTag(c.Request.Context(), &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "创建标签失败: "+err.Error())
		return
	}
	response.SuccessWithStatus(c, http.StatusCreated, tag, "创建成功")
}

// UpdateCategory 处理后台管理员更新友链分类的请求。
// @Summary      更新分类
// @Description  更新友链分类信息
// @Tags         友链管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id    path  string  true  "分类ID"
// @Param        body  body  model.UpdateLinkCategoryRequest  true  "分类信息"
// @Success      200  {object}  response.Response{data=model.LinkCategoryDTO}  "更新成功"
// @Failure      400  {object}  response.Response  "参数无效"
// @Failure      500  {object}  response.Response  "更新失败"
// @Router       /links/categories/{id} [put]
func (h *Handler) UpdateCategory(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "ID 格式无效")
		return
	}

	var req model.UpdateLinkCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数无效: "+err.Error())
		return
	}

	cat, err := h.linkSvc.UpdateCategory(c.Request.Context(), id, &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "更新分类失败: "+err.Error())
		return
	}
	response.Success(c, cat, "更新成功")
}

// UpdateTag 处理后台管理员更新友链标签的请求。
// @Summary      更新标签
// @Description  更新友链标签信息
// @Tags         友链管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id    path  string  true  "标签ID"
// @Param        body  body  model.UpdateLinkTagRequest  true  "标签信息"
// @Success      200  {object}  response.Response{data=model.LinkTagDTO}  "更新成功"
// @Failure      400  {object}  response.Response  "参数无效"
// @Failure      500  {object}  response.Response  "更新失败"
// @Router       /links/tags/{id} [put]
func (h *Handler) UpdateTag(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "ID 格式无效")
		return
	}

	var req model.UpdateLinkTagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数无效: "+err.Error())
		return
	}

	tag, err := h.linkSvc.UpdateTag(c.Request.Context(), id, &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "更新标签失败: "+err.Error())
		return
	}
	response.Success(c, tag, "更新成功")
}

// DeleteCategory 处理后台管理员删除友链分类的请求。
// @Summary      删除分类
// @Description  删除友链分类
// @Tags         友链管理
// @Security     BearerAuth
// @Param        id  path  string  true  "分类ID"
// @Success      200  {object}  response.Response  "删除成功"
// @Failure      400  {object}  response.Response  "参数无效或删除失败"
// @Router       /links/categories/{id} [delete]
func (h *Handler) DeleteCategory(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "ID 格式无效")
		return
	}

	err = h.linkSvc.DeleteCategory(c.Request.Context(), id)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "删除分类失败: "+err.Error())
		return
	}
	response.Success(c, nil, "删除成功")
}

// DeleteTag 处理后台管理员删除友链标签的请求。
// @Summary      删除标签
// @Description  删除友链标签
// @Tags         友链管理
// @Security     BearerAuth
// @Param        id  path  string  true  "标签ID"
// @Success      200  {object}  response.Response  "删除成功"
// @Failure      400  {object}  response.Response  "参数无效或删除失败"
// @Router       /links/tags/{id} [delete]
func (h *Handler) DeleteTag(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "ID 格式无效")
		return
	}

	err = h.linkSvc.DeleteTag(c.Request.Context(), id)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "删除标签失败: "+err.Error())
		return
	}
	response.Success(c, nil, "删除成功")
}

// ImportLinks 处理后台管理员批量导入友链的请求。
// @Summary      批量导入友链
// @Description  批量导入友链数据（最多1000个）
// @Tags         友链管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  model.ImportLinksRequest  true  "导入的友链数据"
// @Success      201  {object}  response.Response{data=model.ImportLinksResponse}  "导入完成"
// @Failure      400  {object}  response.Response  "参数无效"
// @Failure      500  {object}  response.Response  "导入失败"
// @Router       /links/import [post]
func (h *Handler) ImportLinks(c *gin.Context) {
	var req model.ImportLinksRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数无效: "+err.Error())
		return
	}

	// 验证至少提供一个友链
	if len(req.Links) == 0 {
		response.Fail(c, http.StatusBadRequest, "至少需要提供一个友链数据")
		return
	}

	// 检查数量限制，防止过多数据一次性导入
	const maxImportCount = 1000
	if len(req.Links) > maxImportCount {
		response.Fail(c, http.StatusBadRequest, "单次导入友链数量不能超过 "+strconv.Itoa(maxImportCount)+" 个")
		return
	}

	result, err := h.linkSvc.ImportLinks(c.Request.Context(), &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "导入失败: "+err.Error())
		return
	}

	response.SuccessWithStatus(c, http.StatusCreated, result, "导入完成")
}

// ExportLinks 处理后台管理员导出友链的请求。
// @Summary      导出友链
// @Description  根据筛选条件导出友链数据（JSON格式）
// @Tags         友链管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        name         query  string  false  "网站名称（模糊搜索）"
// @Param        url          query  string  false  "网站URL（模糊搜索）"
// @Param        description  query  string  false  "网站描述（模糊搜索）"
// @Param        status       query  string  false  "友链状态"  Enums(PENDING, APPROVED, REJECTED, INVALID)
// @Param        category_id  query  int     false  "分类ID"
// @Param        tag_id       query  int     false  "标签ID"
// @Success      200  {object}  response.Response{data=model.ExportLinksResponse}  "导出成功"
// @Failure      400  {object}  response.Response  "参数无效"
// @Failure      500  {object}  response.Response  "导出失败"
// @Router       /links/export [get]
func (h *Handler) ExportLinks(c *gin.Context) {
	var req model.ExportLinksRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数无效: "+err.Error())
		return
	}

	result, err := h.linkSvc.ExportLinks(c.Request.Context(), &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "导出失败: "+err.Error())
		return
	}

	response.Success(c, result, "导出成功")
}

// CheckLinksHealth 处理后台管理员手动触发友链健康检查的请求。
// 该操作为异步执行，不会阻塞请求，立即返回任务已启动的响应。
// @Summary      检查友链健康状态
// @Description  异步检查所有友链的可访问性（后台执行）
// @Tags         友链管理
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  response.Response  "健康检查任务已启动"
// @Failure      409  {object}  response.Response  "健康检查正在执行中"
// @Router       /links/health-check [post]
func (h *Handler) CheckLinksHealth(c *gin.Context) {
	// 检查是否已经在运行
	healthCheckMutex.RLock()
	if healthCheckStatus.IsRunning {
		healthCheckMutex.RUnlock()
		response.Fail(c, http.StatusConflict, "健康检查任务正在执行中，请稍后再试")
		return
	}
	healthCheckMutex.RUnlock()

	// 在后台异步执行健康检查
	go func() {
		// 设置开始状态
		healthCheckMutex.Lock()
		now := time.Now()
		healthCheckStatus = &HealthCheckStatus{
			IsRunning: true,
			StartTime: &now,
			EndTime:   nil,
			Result:    nil,
			Error:     "",
		}
		healthCheckMutex.Unlock()

		// 创建一个新的 context，避免使用已关闭的请求 context
		ctx := context.Background()
		result, err := h.linkSvc.CheckLinksHealth(ctx)

		// 更新结束状态
		healthCheckMutex.Lock()
		endTime := time.Now()
		healthCheckStatus.IsRunning = false
		healthCheckStatus.EndTime = &endTime

		if err != nil {
			healthCheckStatus.Error = err.Error()
			fmt.Printf("[友链健康检查] 执行失败: %v\n", err)
		} else {
			healthCheckStatus.Result = result
			fmt.Printf("[友链健康检查] 完成 - 总计: %d, 健康: %d, 失联: %d\n",
				result.Total, result.Healthy, result.Unhealthy)
		}
		healthCheckMutex.Unlock()
	}()

	// 立即返回响应
	response.Success(c, gin.H{
		"message": "友链健康检查任务已启动，将在后台执行",
		"status":  "started",
	}, "健康检查任务已启动")
}

// GetHealthCheckStatus 获取健康检查任务的当前状态。
// @Summary      获取健康检查状态
// @Description  获取友链健康检查任务的执行状态和结果
// @Tags         友链管理
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  response.Response{data=HealthCheckStatus}  "获取成功"
// @Router       /links/health-check/status [get]
func (h *Handler) GetHealthCheckStatus(c *gin.Context) {
	healthCheckMutex.RLock()
	status := *healthCheckStatus
	healthCheckMutex.RUnlock()

	response.Success(c, status, "获取成功")
}

// BatchUpdateLinkSort 批量更新友链排序。
// @Summary      批量更新友链排序
// @Description  批量更新友链的显示顺序
// @Tags         友链管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  model.BatchUpdateLinkSortRequest  true  "排序信息"
// @Success      200  {object}  response.Response  "更新成功"
// @Failure      400  {object}  response.Response  "参数无效"
// @Failure      500  {object}  response.Response  "更新失败"
// @Router       /links/sort [put]
func (h *Handler) BatchUpdateLinkSort(c *gin.Context) {
	var req model.BatchUpdateLinkSortRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数无效: "+err.Error())
		return
	}

	err := h.linkSvc.BatchUpdateLinkSort(c.Request.Context(), &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "更新排序失败: "+err.Error())
		return
	}

	response.Success(c, nil, "排序更新成功")
}
