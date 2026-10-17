/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-15 11:30:55
 * @LastEditTime: 2025-07-12 15:59:51
 * @LastEditors: 安知鱼
 */
package public_handler

import (
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/utils"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/album"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/album_category"

	"github.com/gin-gonic/gin"
)

// PublicHandler 封装了所有公开接口的控制器方法
type PublicHandler struct {
	albumSvc         album.AlbumService
	albumCategorySvc album_category.Service
}

// NewPublicHandler 是 PublicHandler 的构造函数
func NewPublicHandler(albumSvc album.AlbumService, albumCategorySvc album_category.Service) *PublicHandler {
	return &PublicHandler{
		albumSvc:         albumSvc,
		albumCategorySvc: albumCategorySvc,
	}
}

// GetPublicAlbums 获取公开的相册列表
// @Summary      获取公开相册列表
// @Description  获取公开的相册图片列表，支持分页和筛选
// @Tags         公共接口
// @Produce      json
// @Param        page          query  int     false  "页码"  default(1)
// @Param        pageSize      query  int     false  "每页数量"  default(12)
// @Param        categoryId    query  int     false  "分类ID筛选"
// @Param        tag           query  string  false  "标签筛选"
// @Param        createdAt[0]  query  string  false  "开始时间"
// @Param        createdAt[1]  query  string  false  "结束时间"
// @Param        sort          query  string  false  "排序方式"  default(display_order_asc)
// @Success      200  {object}  response.Response  "获取成功"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /public/albums [get]
func (h *PublicHandler) GetPublicAlbums(c *gin.Context) {
	// 1. 解析参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "12"))
	categoryIdStr := c.Query("categoryId")
	tag := c.Query("tag")
	startStr := c.Query("createdAt[0]")
	endStr := c.Query("createdAt[1]")
	sort := c.DefaultQuery("sort", "display_order_asc")

	// 解析 categoryId
	var categoryID *uint
	if categoryIdStr != "" {
		if id, err := strconv.ParseUint(categoryIdStr, 10, 32); err == nil {
			categoryIDVal := uint(id)
			categoryID = &categoryIDVal
		}
	}

	var startTime, endTime *time.Time
	const layout = "2006/01/02 15:04:05"
	if t, err := utils.ParseInChina(layout, startStr); err == nil {
		startTime = &t
	}
	if t, err := utils.ParseInChina(layout, endStr); err == nil {
		endTime = &t
	}

	// 3. 调用 Service 方法，并确保传递了 Sort 字段
	pageResult, err := h.albumSvc.FindAlbums(c.Request.Context(), album.FindAlbumsParams{
		Page:       page,
		PageSize:   pageSize,
		CategoryID: categoryID,
		Tag:        tag,
		Start:      startTime,
		End:        endTime,
		Sort:       sort,
	})
	if err != nil {
		log.Printf("获取公开相册列表失败: %v", err)
		response.Fail(c, http.StatusInternalServerError, "获取相册列表失败")
		return
	}

	// 4. 返回成功响应
	response.Success(c, gin.H{
		"list":     pageResult.Items,
		"total":    pageResult.Total,
		"pageNum":  page,
		"pageSize": pageSize,
	}, "获取相册列表成功")
}

// UpdateAlbumStat 更新访问量或下载量
// @Summary      更新相册统计
// @Description  更新相册图片的访问量或下载量
// @Tags         公共接口
// @Param        id    path   int     true  "图片ID"
// @Param        type  query  string  true  "统计类型: view 或 download"
// @Success      200  {object}  response.Response  "更新成功"
// @Failure      400  {object}  response.Response  "无效的ID或统计类型"
// @Failure      500  {object}  response.Response  "更新失败"
// @Router       /public/albums/{id}/stat [post]
func (h *PublicHandler) UpdateAlbumStat(c *gin.Context) {
	// 1. 解析参数
	idStr := c.Param("id")
	statType := c.Query("type") // "view" 或 "download"

	id, err := strconv.Atoi(idStr)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "无效的ID")
		return
	}

	// 2. 调用 Service
	if err := h.albumSvc.IncrementAlbumStat(c.Request.Context(), uint(id), statType); err != nil {
		// 根据错误类型判断返回码
		if strings.Contains(err.Error(), "无效的统计类型") {
			response.Fail(c, http.StatusBadRequest, err.Error())
		} else {
			response.Fail(c, http.StatusInternalServerError, "更新失败: "+err.Error())
		}
		return
	}

	// 3. 返回成功响应
	response.Success(c, nil, "更新成功")
}

// GetPublicAlbumCategories 获取公开的相册分类列表
// @Summary      获取公开相册分类列表
// @Description  获取所有相册分类列表，无需认证
// @Tags         公共接口
// @Produce      json
// @Success      200  {object}  response.Response  "获取成功"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /public/album-categories [get]
func (h *PublicHandler) GetPublicAlbumCategories(c *gin.Context) {
	categories, err := h.albumCategorySvc.ListCategories(c.Request.Context())
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取分类列表失败: "+err.Error())
		return
	}

	response.Success(c, categories, "获取成功")
}
