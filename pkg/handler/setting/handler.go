/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-15 12:26:45
 * @LastEditTime: 2025-08-13 10:16:47
 * @LastEditors: 安知鱼
 */
package setting_handler

import (
	"log"
	"net/http"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/auth"
	"github.com/anzhiyu-c/anheyu-app/pkg/handler/setting/dto"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/cdn"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/config"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"

	"github.com/gin-gonic/gin"
)

// SettingHandler 封装了站点配置相关的控制器方法
type SettingHandler struct {
	settingSvc      setting.SettingService
	emailSvc        utility.EmailService
	cdnSvc          cdn.CDNService
	configBackupSvc config.BackupService
}

// NewSettingHandler 是 SettingHandler 的构造函数
func NewSettingHandler(
	settingSvc setting.SettingService,
	emailSvc utility.EmailService,
	cdnSvc cdn.CDNService,
	configBackupSvc config.BackupService,
) *SettingHandler {
	return &SettingHandler{
		settingSvc:      settingSvc,
		emailSvc:        emailSvc,
		cdnSvc:          cdnSvc,
		configBackupSvc: configBackupSvc,
	}
}

// TestEmail
// @Summary      发送测试邮件
// @Description  根据当前配置发送一封测试邮件到指定地址，用于验证邮件服务是否可用。
// @Tags         设置管理
// @Accept       json
// @Produce      json
// @Param        body body dto.TestEmailRequest true "测试邮件请求"
// @Success      200 {object} response.Response "成功发送"
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      500 {object} response.Response "邮件发送失败"
// @Security     ApiKeyAuth
// @Router       /settings/test-email [post]
func (h *SettingHandler) TestEmail(c *gin.Context) {
	var req dto.TestEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数无效: "+err.Error())
		return
	}

	err := h.emailSvc.SendTestEmail(c.Request.Context(), req.ToEmail)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "发送测试邮件失败: "+err.Error())
		return
	}

	response.Success(c, nil, "测试邮件已发送，请检查收件箱")
}

// GetSiteConfig 处理获取公开的站点配置的请求
// @Summary      获取站点配置
// @Description  获取公开的站点配置信息（无需认证）
// @Tags         站点设置
// @Produce      json
// @Success      200  {object}  response.Response  "获取成功"
// @Router       /public/site-config [get]
func (h *SettingHandler) GetSiteConfig(c *gin.Context) {
	siteConfig := h.settingSvc.GetSiteConfig()
	response.Success(c, siteConfig, "获取站点配置成功")
}

// GetSettingsByKeysReq 定义了按键获取配置的请求体结构
type GetSettingsByKeysReq struct {
	Keys []string `json:"keys" binding:"required,min=1"`
}

// GetSettingsByKeys 处理根据一组键名批量获取配置的请求
// @Summary      批量获取配置
// @Description  根据键名列表批量获取配置项（管理员可获取所有配置，普通用户只能获取公开配置）
// @Tags         站点设置
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body      GetSettingsByKeysReq  true  "配置键名列表"
// @Success      200   {object}  response.Response  "获取成功"
// @Failure      400   {object}  response.Response  "参数错误"
// @Router       /settings/get-by-keys [post]
func (h *SettingHandler) GetSettingsByKeys(c *gin.Context) {
	var req GetSettingsByKeysReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数无效: 'keys' 不能为空")
		return
	}

	// 检查是否为管理员
	isAdmin := false
	claimsValue, exists := c.Get(auth.ClaimsKey)
	if exists {
		if claims, ok := claimsValue.(*auth.CustomClaims); ok {
			userGroupID, entityType, err := idgen.DecodePublicID(claims.UserGroupID)
			if err == nil && entityType == idgen.EntityTypeUserGroup && userGroupID == 1 {
				isAdmin = true
			}
		}
	}

	var settings map[string]interface{}
	if isAdmin {
		// 管理员可以获取所有配置
		settings = h.settingSvc.GetByKeys(req.Keys)
	} else {
		// 普通用户只能获取公开配置
		// 先过滤出公开的键
		publicKeys := make([]string, 0)
		for _, key := range req.Keys {
			if h.settingSvc.IsPublicSetting(key) {
				publicKeys = append(publicKeys, key)
			}
		}
		// 只获取公开配置
		if len(publicKeys) > 0 {
			settings = h.settingSvc.GetByKeys(publicKeys)
		} else {
			settings = make(map[string]interface{})
		}
	}

	response.Success(c, settings, "获取配置成功")
}

// UpdateSettings 处理批量更新配置项的请求
// @Summary      批量更新配置
// @Description  批量更新站点配置项（需要管理员权限）
// @Tags         站点设置
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body      map[string]string  true  "配置项键值对"
// @Success      200   {object}  response.Response  "更新成功"
// @Failure      400   {object}  response.Response  "参数错误"
// @Failure      500   {object}  response.Response  "更新失败"
// @Router       /settings/update [post]
func (h *SettingHandler) UpdateSettings(c *gin.Context) {
	var settingsToUpdate map[string]string
	if err := c.ShouldBindJSON(&settingsToUpdate); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数格式错误")
		return
	}

	if len(settingsToUpdate) == 0 {
		response.Fail(c, http.StatusBadRequest, "没有需要更新的配置项")
		return
	}

	// 在更新配置前，自动创建备份（如果备份服务可用）
	if h.configBackupSvc != nil {
		_, err := h.configBackupSvc.CreateBackup(c.Request.Context(), "配置更新前自动备份", true)
		if err != nil {
			log.Printf("⚠️ 警告: 创建配置备份失败: %v（将继续更新配置）", err)
			// 备份失败不应阻止配置更新，只记录警告
		} else {
			log.Printf("✅ 已自动创建配置备份")
		}
	}

	// 检查是否有影响前端的公开配置被更新
	needsPurgeCDN := h.checkIfNeedsPurgeCDN(settingsToUpdate)

	// 调用 Service 层执行更新
	err := h.settingSvc.UpdateSettings(c.Request.Context(), settingsToUpdate)
	if err != nil {
		log.Printf("更新站点配置时发生错误: %v", err)
		response.Fail(c, http.StatusInternalServerError, "更新配置失败，请查看服务器日志")
		return
	}

	// 如果需要，异步清除CDN缓存
	if needsPurgeCDN && h.cdnSvc != nil {
		go func() {
			baseURL := h.settingSvc.Get("SITE_URL")
			if baseURL == "" {
				baseURL = "https://yourdomain.com"
			}

			// 只清除首页（因为HTML渲染配置会影响所有页面的meta标签和自定义代码）
			// 注意：文章详情页不需要清除，因为它们有自己的更新机制
			urls := []string{
				baseURL + "/", // 首页
			}

			if err := h.cdnSvc.PurgeCache(c.Request.Context(), urls); err != nil {
				log.Printf("[警告] CDN缓存清除失败: %v", err)
			} else {
				log.Printf("[信息] 配置更新后成功清除CDN缓存")
			}
		}()
	}

	response.Success(c, nil, "更新配置成功")
}

// checkIfNeedsPurgeCDN 检查更新的配置项中是否包含需要清除CDN缓存的配置
func (h *SettingHandler) checkIfNeedsPurgeCDN(settingsToUpdate map[string]string) bool {
	// 只有直接影响HTML渲染（SSR）的配置才需要清除CDN缓存
	// 大部分配置是通过API动态获取的，不会被水合到HTML中，因此不需要清除CDN
	//
	// 需要清除CDN的场景：
	// 1. SEO meta标签（直接渲染到HTML中）
	// 2. 自定义HTML/CSS/JS（直接注入到HTML中）
	//
	// 不需要清除CDN的场景（通过API获取）：
	// - 站点配置（APP_NAME, LOGO等）- 前端通过 /api/site/config 获取
	// - 导航菜单 - 前端通过API获取并渲染
	// - 页脚配置 - 前端通过API获取并渲染
	// - 文章列表 - 前端通过API分页获取
	htmlRenderingSettings := map[string]bool{
		// SEO相关（直接渲染到HTML meta标签）
		"SITE_KEYWORDS":              true, // <meta name="keywords">
		"SITE_DESCRIPTION":           true, // <meta name="description">
		"FRONT_DESK_SITE_OWNER_NAME": true, // <meta name="author">
		"ICON_URL":                   true, // <link rel="icon">

		// 自定义HTML/CSS/JS（直接注入到HTML）
		"CUSTOM_HEADER_HTML": true, // 注入到<head>
		"CUSTOM_FOOTER_HTML": true, // 注入到</body>前
		"CUSTOM_CSS":         true, // 内联CSS
		"CUSTOM_JS":          true, // 内联JS
	}

	// 检查是否有任何需要清除CDN的配置被更新
	for key := range settingsToUpdate {
		if htmlRenderingSettings[key] {
			log.Printf("[CDN] 检测到HTML渲染配置 %s 被更新，需要清除CDN缓存", key)
			return true
		}
	}

	return false
}
