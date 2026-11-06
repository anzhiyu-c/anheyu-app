package file

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"

	"github.com/gin-gonic/gin"
)

// CreateUploadSession 处理创建上传会话的请求 (PUT /api/file/upload)
// @Summary      创建上传会话
// @Description  创建文件上传会话，用于分片上传
// @Tags         文件管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  model.CreateUploadRequest  true  "上传会话请求"
// @Success      200  {object}  response.Response  "创建成功"
// @Failure      400  {object}  response.Response  "请求参数无效"
// @Failure      401  {object}  response.Response  "未授权"
// @Failure      404  {object}  response.Response  "目标路径不存在"
// @Failure      409  {object}  response.Response  "文件已存在"
// @Failure      500  {object}  response.Response  "创建失败"
// @Router       /file/upload [put]
func (h *FileHandler) CreateUploadSession(c *gin.Context) {
	var req model.CreateUploadRequest
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

	sessionData, err := h.uploadSvc.CreateUploadSession(c.Request.Context(), ownerID, &req)
	if err != nil {
		if errors.Is(err, constant.ErrConflict) {
			response.Fail(c, http.StatusConflict, "创建失败: "+err.Error())
		} else if errors.Is(err, constant.ErrNotFound) {
			response.Fail(c, http.StatusNotFound, "创建失败: "+err.Error())
		} else if errors.Is(err, constant.ErrBadRequest) {
			response.Fail(c, http.StatusBadRequest, "创建失败: "+err.Error())
		} else if errors.Is(err, constant.ErrForbidden) {
			response.Fail(c, http.StatusForbidden, "创建失败: "+err.Error())
		} else {
			response.Fail(c, http.StatusInternalServerError, "创建失败: "+err.Error())
		}
		return
	}
	response.Success(c, sessionData, "上传会话创建成功")
}

// GetUploadSessionStatus 处理获取上传会话状态的请求 (GET /api/file/upload/session/:sessionId)
// @Summary      获取上传会话状态
// @Description  获取指定上传会话的状态信息
// @Tags         文件管理
// @Security     BearerAuth
// @Produce      json
// @Param        sessionId  path  string  true  "会话ID"
// @Success      200  {object}  response.Response  "会话有效"
// @Failure      400  {object}  response.Response  "缺少sessionId"
// @Failure      401  {object}  response.Response  "未授权"
// @Failure      403  {object}  response.Response  "无权访问此上传会话"
// @Failure      404  {object}  response.Response  "上传会话不存在或已过期"
// @Failure      500  {object}  response.Response  "服务器内部错误"
// @Router       /file/upload/session/{sessionId} [get]
func (h *FileHandler) GetUploadSessionStatus(c *gin.Context) {
	sessionId := c.Param("sessionId")
	if sessionId == "" {
		response.Fail(c, http.StatusBadRequest, "缺少 sessionId")
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

	sessionStatus, err := h.uploadSvc.GetUploadSessionStatus(c.Request.Context(), ownerID, sessionId)
	if err != nil {
		if errors.Is(err, constant.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"code":    http.StatusNotFound,
				"data":    model.UploadSessionInvalidResponse{IsValid: false},
				"message": "上传会话不存在或已过期",
			})
			return
		}
		if errors.Is(err, constant.ErrForbidden) {
			c.JSON(http.StatusForbidden, gin.H{
				"code":    http.StatusForbidden,
				"data":    model.UploadSessionInvalidResponse{IsValid: false},
				"message": "无权访问此上传会话",
			})
			return
		}
		response.Fail(c, http.StatusInternalServerError, "服务器内部错误: "+err.Error())
		return
	}

	response.Success(c, sessionStatus, "会话有效")
}

// UploadChunk 处理上传文件分片的请求 (POST /api/file/upload/:sessionId/:index)
// @Summary      上传文件分片
// @Description  上传文件的某个分片
// @Tags         文件管理
// @Security     BearerAuth
// @Accept       octet-stream
// @Produce      json
// @Param        sessionId  path  string  true  "会话ID"
// @Param        index      path  int     true  "分片索引（从0开始）"
// @Param        chunk      body  string  true  "分片数据"
// @Success      200  {object}  response.Response  "文件块上传成功"
// @Failure      400  {object}  response.Response  "无效的分块索引"
// @Failure      500  {object}  response.Response  "文件块上传失败"
// @Router       /file/upload/{sessionId}/{index} [post]
func (h *FileHandler) UploadChunk(c *gin.Context) {
	sessionID := c.Param("sessionId")
	indexStr := c.Param("index")
	index, err := strconv.Atoi(indexStr)
	if err != nil || index < 0 {
		response.Fail(c, http.StatusBadRequest, "无效的分块索引")
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

	err = h.uploadSvc.UploadChunk(c.Request.Context(), ownerID, sessionID, index, c.Request.Body)
	if err != nil {
		if errors.Is(err, constant.ErrForbidden) {
			response.Fail(c, http.StatusForbidden, "无权操作此上传会话")
			return
		}
		response.Fail(c, http.StatusInternalServerError, "文件块上传失败: "+err.Error())
		return
	}
	response.Success(c, nil, "文件块上传成功")
}

// DeleteUploadSession 处理删除/取消上传会话的请求 (DELETE /api/file/upload)
// @Summary      删除上传会话
// @Description  取消并删除指定的上传会话
// @Tags         文件管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  model.DeleteUploadRequest  true  "删除会话请求"
// @Success      200  {object}  response.Response  "上传会话已删除"
// @Failure      400  {object}  response.Response  "请求参数无效"
// @Failure      401  {object}  response.Response  "未授权"
// @Failure      403  {object}  response.Response  "删除失败"
// @Failure      500  {object}  response.Response  "删除上传会话失败"
// @Router       /file/upload [delete]
func (h *FileHandler) DeleteUploadSession(c *gin.Context) {
	var req model.DeleteUploadRequest
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

	err = h.uploadSvc.DeleteUploadSession(c.Request.Context(), ownerID, &req)
	if err != nil {
		if errors.Is(err, constant.ErrForbidden) {
			response.Fail(c, http.StatusForbidden, "删除失败: "+err.Error())
		} else {
			response.Fail(c, http.StatusInternalServerError, "删除上传会话失败: "+err.Error())
		}
		return
	}
	response.Success(c, nil, "上传会话已删除")
}

// FinalizeClientUpload 处理客户端直传完成后的回调请求 (POST /api/file/upload/finalize)
// @Summary      客户端直传完成回调
// @Description  客户端直传完成后调用此接口，通知服务器创建文件记录
// @Tags         文件管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  model.FinalizeUploadRequest  true  "完成上传请求"
// @Success      200  {object}  response.Response  "文件记录创建成功"
// @Failure      400  {object}  response.Response  "请求参数无效"
// @Failure      401  {object}  response.Response  "未授权"
// @Failure      404  {object}  response.Response  "存储策略不存在"
// @Failure      500  {object}  response.Response  "创建文件记录失败"
// @Router       /file/upload/finalize [post]
func (h *FileHandler) FinalizeClientUpload(c *gin.Context) {
	var req model.FinalizeUploadRequest
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

	file, err := h.uploadSvc.FinalizeClientUpload(c.Request.Context(), ownerID, &req)
	if err != nil {
		if errors.Is(err, constant.ErrBadRequest) {
			response.Fail(c, http.StatusBadRequest, "创建失败: "+err.Error())
		} else if errors.Is(err, constant.ErrForbidden) {
			response.Fail(c, http.StatusForbidden, "创建失败: "+err.Error())
		} else if errors.Is(err, constant.ErrConflict) {
			response.Fail(c, http.StatusConflict, "创建失败: "+err.Error())
		} else if errors.Is(err, constant.ErrNotFound) {
			response.Fail(c, http.StatusNotFound, "创建失败: "+err.Error())
		} else {
			response.Fail(c, http.StatusInternalServerError, "创建文件记录失败: "+err.Error())
		}
		return
	}

	// 生成公共ID用于返回
	publicFileID, err := idgen.GeneratePublicID(file.ID, idgen.EntityTypeFile)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "生成文件ID失败: "+err.Error())
		return
	}
	response.Success(c, gin.H{
		"file_id": publicFileID,
		"name":    file.Name,
		"size":    file.Size,
	}, "文件记录创建成功")
}
