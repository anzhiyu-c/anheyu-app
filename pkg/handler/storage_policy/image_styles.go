package storage_policy_handler

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/image_style"
)

// PolicyImageStylesPayload 对应社区版图片样式配置读写请求体。
type PolicyImageStylesPayload struct {
	ImageProcess model.ImageProcessConfig `json:"image_process"`
	ImageStyles  []model.ImageStyleConfig `json:"image_styles"`
}

// GetImageStyles 读取指定策略的 image_process + image_styles 配置。
func (h *StoragePolicyHandler) GetImageStyles(c *gin.Context) {
	publicID := c.Param("id")
	if publicID == "" {
		response.Fail(c, http.StatusBadRequest, "策略ID不能为空")
		return
	}
	policy, err := h.svc.GetPolicyByID(c.Request.Context(), publicID)
	if err != nil {
		response.Fail(c, http.StatusNotFound, "存储策略不存在")
		return
	}
	payload := extractImageStylesPayloadFromPolicy(policy)
	response.Success(c, payload, "获取成功")
}

// PutImageStyles 整体替换指定策略的 image_process + image_styles 配置。
func (h *StoragePolicyHandler) PutImageStyles(c *gin.Context) {
	publicID := c.Param("id")
	if publicID == "" {
		response.Fail(c, http.StatusBadRequest, "策略ID不能为空")
		return
	}

	var payload PolicyImageStylesPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求体解析失败: "+err.Error())
		return
	}

	payload.ImageProcess.NormalizeApplyExtensionsWhenEnabled()
	if errs := image_style.ValidateConfig(payload.ImageProcess, payload.ImageStyles); errs.Has() {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    http.StatusBadRequest,
			"message": "参数校验失败",
			"data":    errs,
		})
		return
	}

	policy, err := h.svc.GetPolicyByID(c.Request.Context(), publicID)
	if err != nil {
		response.Fail(c, http.StatusNotFound, "存储策略不存在")
		return
	}

	if err := applyImageStylesPayloadToPolicy(policy, payload); err != nil {
		response.Fail(c, http.StatusBadRequest, "写入策略失败: "+err.Error())
		return
	}

	if err := h.svc.UpdatePolicy(c.Request.Context(), policy); err != nil {
		response.Fail(c, http.StatusInternalServerError, "更新存储策略失败: "+err.Error())
		return
	}

	response.Success(c, nil, "更新成功")
}

func extractImageStylesPayloadFromPolicy(policy *model.StoragePolicy) PolicyImageStylesPayload {
	payload := PolicyImageStylesPayload{}
	if policy == nil {
		payload.ImageStyles = []model.ImageStyleConfig{}
		payload.ImageProcess.ApplyToExtensions = []string{}
		return payload
	}
	if raw, ok := policy.Settings[constant.ImageProcessSettingsKey]; ok && raw != nil {
		_ = reencodeImageStyles(raw, &payload.ImageProcess)
	}
	if raw, ok := policy.Settings[constant.ImageStylesSettingsKey]; ok && raw != nil {
		_ = reencodeImageStyles(raw, &payload.ImageStyles)
	}
	if payload.ImageStyles == nil {
		payload.ImageStyles = []model.ImageStyleConfig{}
	}
	if payload.ImageProcess.ApplyToExtensions == nil {
		payload.ImageProcess.ApplyToExtensions = []string{}
	}
	payload.ImageProcess.NormalizeApplyExtensionsWhenEnabled()
	return payload
}

func applyImageStylesPayloadToPolicy(policy *model.StoragePolicy, payload PolicyImageStylesPayload) error {
	if policy.Settings == nil {
		policy.Settings = model.StoragePolicySettings{}
	}
	procRaw, err := toImageStylesGenericJSON(payload.ImageProcess)
	if err != nil {
		return err
	}
	stylesRaw, err := toImageStylesGenericJSON(payload.ImageStyles)
	if err != nil {
		return err
	}
	policy.Settings[constant.ImageProcessSettingsKey] = procRaw
	policy.Settings[constant.ImageStylesSettingsKey] = stylesRaw
	return nil
}

func reencodeImageStyles(src any, dst any) error {
	b, err := json.Marshal(src)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, dst)
}

func toImageStylesGenericJSON(v any) (any, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	var out any
	if err := json.Unmarshal(b, &out); err != nil {
		return nil, err
	}
	return out, nil
}
