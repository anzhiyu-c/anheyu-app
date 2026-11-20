package file

import (
	"errors"
	"log"
	"net/http"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"

	"github.com/gin-gonic/gin"
)

// CopyItems 处理复制文件或文件夹的请求
// @Summary      复制文件/文件夹
// @Description  复制一个或多个文件/文件夹到目标位置
// @Tags         文件管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  model.CopyItemsRequest  true  "复制请求"
// @Success      200  {object}  response.Response  "复制成功"
// @Failure      400  {object}  response.Response  "请求参数无效或操作无效"
// @Failure      401  {object}  response.Response  "未授权"
// @Failure      403  {object}  response.Response  "复制失败：无权限"
// @Failure      404  {object}  response.Response  "复制失败：文件不存在"
// @Failure      409  {object}  response.Response  "复制失败：目标已存在"
// @Failure      500  {object}  response.Response  "复制失败"
// @Router       /file/copy [post]
func (h *FileHandler) CopyItems(c *gin.Context) {
	var req model.CopyItemsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数无效: "+err.Error())
		return
	}

	claims, err := getClaims(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, err.Error())
		return
	}
	ownerID, _, err := idgen.DecodePublicID(claims.UserID)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "无效的用户凭证")
		return
	}

	err = h.fileSvc.CopyItems(c.Request.Context(), ownerID, req.SourceIDs, req.DestinationID)
	if err != nil {
		switch {
		case errors.Is(err, constant.ErrConflict):
			response.Fail(c, http.StatusConflict, "复制失败: "+err.Error())
		case errors.Is(err, constant.ErrForbidden):
			response.Fail(c, http.StatusForbidden, "复制失败: "+err.Error())
		case errors.Is(err, constant.ErrNotFound):
			response.Fail(c, http.StatusNotFound, "复制失败: "+err.Error())
		case errors.Is(err, constant.ErrInvalidOperation):
			response.Fail(c, http.StatusBadRequest, "复制失败: "+err.Error())
		default:
			response.Fail(c, http.StatusInternalServerError, "复制失败: "+err.Error())
		}
		return
	}

	response.Success(c, nil, "复制成功")
}

// MoveItems 处理移动文件或文件夹的请求
// @Summary      移动文件/文件夹
// @Description  移动一个或多个文件/文件夹到目标位置
// @Tags         文件管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  model.MoveItemsRequest  true  "移动请求"
// @Success      200  {object}  response.Response  "移动成功"
// @Failure      400  {object}  response.Response  "请求参数无效或操作无效"
// @Failure      401  {object}  response.Response  "未授权"
// @Failure      403  {object}  response.Response  "移动失败：无权限"
// @Failure      404  {object}  response.Response  "移动失败：文件不存在"
// @Failure      409  {object}  response.Response  "移动失败：目标已存在"
// @Failure      500  {object}  response.Response  "移动失败"
// @Router       /file/move [post]
func (h *FileHandler) MoveItems(c *gin.Context) {
	var req model.MoveItemsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数无效: "+err.Error())
		return
	}

	claims, err := getClaims(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, err.Error())
		return
	}
	ownerID, _, err := idgen.DecodePublicID(claims.UserID)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "无效的用户凭证")
		return
	}

	err = h.fileSvc.MoveItems(c.Request.Context(), ownerID, req.SourceIDs, req.DestinationID)
	if err != nil {
		switch {
		case errors.Is(err, constant.ErrConflict):
			response.Fail(c, http.StatusConflict, "移动失败: "+err.Error())
		case errors.Is(err, constant.ErrForbidden):
			response.Fail(c, http.StatusForbidden, "移动失败: "+err.Error())
		case errors.Is(err, constant.ErrNotFound):
			response.Fail(c, http.StatusNotFound, "移动失败: "+err.Error())
		case errors.Is(err, constant.ErrInvalidOperation):
			response.Fail(c, http.StatusBadRequest, "移动失败: "+err.Error())
		default:
			response.Fail(c, http.StatusInternalServerError, "移动失败: "+err.Error())
		}
		return
	}

	response.Success(c, nil, "移动成功")
}

// CreateEmptyFile 处理创建空文件或目录的请求
// @Summary      创建文件/文件夹
// @Description  创建空文件或空文件夹
// @Tags         文件管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  model.CreateFileRequest  true  "创建请求"
// @Success      200  {object}  response.Response  "创建成功"
// @Failure      400  {object}  response.Response  "请求参数无效"
// @Failure      401  {object}  response.Response  "未授权"
// @Failure      409  {object}  response.Response  "创建失败：文件已存在"
// @Failure      500  {object}  response.Response  "创建失败"
// @Router       /file/create [post]
func (h *FileHandler) CreateEmptyFile(c *gin.Context) {
	var req model.CreateFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数无效: "+err.Error())
		return
	}
	claims, err := getClaims(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, err.Error())
		return
	}
	ownerID, _, err := idgen.DecodePublicID(claims.UserID)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "无效的用户凭证")
		return
	}
	fileItem, err := h.fileSvc.CreateEmptyFile(c.Request.Context(), ownerID, &req)
	if err != nil {
		if errors.Is(err, constant.ErrConflict) {
			response.Fail(c, http.StatusConflict, "创建失败: "+err.Error())
		} else if errors.Is(err, constant.ErrForbidden) {
			response.Fail(c, http.StatusForbidden, "创建失败: "+err.Error())
		} else {
			response.Fail(c, http.StatusInternalServerError, "创建失败: "+err.Error())
		}
		return
	}
	response.Success(c, fileItem, "创建成功")
}

// DeleteItems 处理删除文件或文件夹的请求 (DELETE /api/files)
// @Summary      删除文件/文件夹
// @Description  删除一个或多个文件/文件夹
// @Tags         文件管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  model.DeleteItemsRequest  true  "删除请求"
// @Success      200  {object}  response.Response  "项目已删除"
// @Failure      400  {object}  response.Response  "请求参数无效"
// @Failure      401  {object}  response.Response  "未授权"
// @Failure      403  {object}  response.Response  "删除失败：无权限"
// @Failure      500  {object}  response.Response  "删除失败"
// @Router       /files [delete]
func (h *FileHandler) DeleteItems(c *gin.Context) {
	var req model.DeleteItemsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数无效: "+err.Error())
		return
	}

	claims, err := getClaims(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, err.Error())
		return
	}
	ownerID, _, err := idgen.DecodePublicID(claims.UserID)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "无效的用户凭证")
		return
	}

	err = h.fileSvc.DeleteItems(c.Request.Context(), ownerID, req.IDs)
	if err != nil {
		if errors.Is(err, constant.ErrForbidden) {
			response.Fail(c, http.StatusForbidden, "删除失败: "+err.Error())
		} else {
			response.Fail(c, http.StatusInternalServerError, "删除失败: "+err.Error())
		}
		return
	}

	response.Success(c, nil, "项目已删除")
}

// RenameItem 处理重命名文件或文件夹的请求 (PUT /api/file/rename)
// @Summary      重命名文件/文件夹
// @Description  重命名文件或文件夹
// @Tags         文件管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  model.RenameItemRequest  true  "重命名请求"
// @Success      200  {object}  response.Response  "重命名成功"
// @Failure      400  {object}  response.Response  "请求参数无效"
// @Failure      401  {object}  response.Response  "未授权"
// @Failure      403  {object}  response.Response  "重命名失败：无权限"
// @Failure      404  {object}  response.Response  "重命名失败：项目不存在"
// @Failure      409  {object}  response.Response  "重命名失败：目标已存在同名文件"
// @Failure      500  {object}  response.Response  "重命名失败"
// @Router       /file/rename [put]
func (h *FileHandler) RenameItem(c *gin.Context) {
	var req model.RenameItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数无效: "+err.Error())
		return
	}

	claims, err := getClaims(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, err.Error())
		return
	}
	ownerID, _, err := idgen.DecodePublicID(claims.UserID)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "无效的用户凭证")
		return
	}

	updatedFileItem, err := h.fileSvc.RenameItem(c.Request.Context(), ownerID, &req)
	if err != nil {
		if errors.Is(err, constant.ErrConflict) {
			response.Fail(c, http.StatusConflict, "重命名失败：目标位置已存在同名文件或文件夹")
		} else if errors.Is(err, constant.ErrForbidden) {
			response.Fail(c, http.StatusForbidden, "重命名失败：您没有权限执行此操作")
		} else if errors.Is(err, constant.ErrNotFound) {
			response.Fail(c, http.StatusNotFound, "重命名失败：要操作的项目不存在")
		} else {
			log.Printf("[Handler-ERROR] RenameItem failed for ID '%s': %v", req.ID, err)
			response.Fail(c, http.StatusInternalServerError, "重命名失败，发生未知错误")
		}
		return
	}
	response.Success(c, updatedFileItem, "重命名成功")
}

// UpdateFolderView 更新文件夹视图配置
// @Summary      更新文件夹视图配置
// @Description  更新文件夹的显示视图配置（如排序方式、显示模式等）
// @Tags         文件管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  model.UpdateViewConfigRequest  true  "视图配置"
// @Success      200  {object}  response.Response  "视图配置更新成功"
// @Failure      400  {object}  response.Response  "请求参数无效"
// @Failure      401  {object}  response.Response  "未授权"
// @Failure      403  {object}  response.Response  "操作失败：无权限"
// @Failure      404  {object}  response.Response  "操作失败：文件夹不存在"
// @Failure      500  {object}  response.Response  "操作失败"
// @Router       /file/folder-view [put]
func (h *FileHandler) UpdateFolderView(c *gin.Context) {
	var req model.UpdateViewConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数无效: "+err.Error())
		return
	}
	claims, err := getClaims(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, err.Error())
		return
	}
	ownerID, _, err := idgen.DecodePublicID(claims.UserID)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "无效的用户凭证")
		return
	}
	view, err := h.fileSvc.UpdateFolderViewConfig(c.Request.Context(), ownerID, &req)
	if err != nil {
		if errors.Is(err, constant.ErrNotFound) {
			response.Fail(c, http.StatusNotFound, "操作失败: "+err.Error())
		} else if errors.Is(err, constant.ErrForbidden) {
			response.Fail(c, http.StatusForbidden, "操作失败: "+err.Error())
		} else {
			response.Fail(c, http.StatusInternalServerError, "操作失败: "+err.Error())
		}
		return
	}
	response.Success(c, view, "视图配置更新成功")
}

// UpdateFileContentByID 处理通过ID和URI更新文件内容的请求
// @Summary      更新文件内容
// @Description  通过文件ID和URI更新文件内容
// @Tags         文件管理
// @Security     BearerAuth
// @Accept       octet-stream
// @Produce      json
// @Param        publicID  path   string  true  "文件公共ID"
// @Param        uri       query  string  true  "文件URI"
// @Param        body      body   string  true  "文件内容"
// @Success      200  {object}  response.Response  "文件内容更新成功"
// @Failure      400  {object}  response.Response  "缺少参数"
// @Failure      401  {object}  response.Response  "未授权"
// @Failure      403  {object}  response.Response  "访问被拒绝"
// @Failure      404  {object}  response.Response  "文件未找到"
// @Failure      409  {object}  response.Response  "文件位置或名称已更改，请刷新"
// @Failure      500  {object}  response.Response  "更新文件内容失败"
// @Router       /file/content/{publicID} [put]
func (h *FileHandler) UpdateFileContentByID(c *gin.Context) {
	// 1. 从路径和查询参数获取ID和URI
	publicID := c.Param("publicID")
	uriStr := c.Query("uri")

	if publicID == "" {
		response.Fail(c, http.StatusBadRequest, "Missing file public ID in path")
		return
	}
	if uriStr == "" {
		response.Fail(c, http.StatusBadRequest, "Missing required 'uri' parameter")
		return
	}

	// 2. 获取用户身份
	claims, err := getClaims(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, err.Error())
		return
	}

	// 3. 将所有参数传递给 Service 层
	updatedResult, err := h.fileSvc.UpdateFileContentByIDAndURI(
		c.Request.Context(),
		claims.UserID,
		publicID,
		uriStr,
		c.Request.Body,
	)

	// 4. 处理错误
	if err != nil {
		switch {
		case errors.Is(err, constant.ErrNotFound):
			response.Fail(c, http.StatusNotFound, "File not found")
		case errors.Is(err, constant.ErrForbidden):
			response.Fail(c, http.StatusForbidden, "Access denied")
		case errors.Is(err, constant.ErrConflict):
			// 这个冲突现在有了更明确的含义：文件被移动或重命名了
			response.Fail(c, http.StatusConflict, "File location or name has changed. Please refresh.")
		default:
			log.Printf("[Handler-ERROR] UpdateFileContentByIDAndURI failed for ID '%s': %v", publicID, err)
			response.Fail(c, http.StatusInternalServerError, "Failed to update file content")
		}
		return
	}

	// 5. 发送成功响应
	response.Success(c, updatedResult, "File content updated successfully.")
}
