package auth_handler

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/auth"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/captcha"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"

	"github.com/gin-gonic/gin"
)

// AuthHandler 封装了所有认证相关的控制器方法
type AuthHandler struct {
	authSvc    auth.AuthService
	tokenSvc   auth.TokenService
	settingSvc setting.SettingService
	captchaSvc captcha.CaptchaService
}

// NewAuthHandler 是 AuthHandler 的构造函数，用于依赖注入
func NewAuthHandler(authSvc auth.AuthService, tokenSvc auth.TokenService, settingSvc setting.SettingService, captchaSvc captcha.CaptchaService) *AuthHandler {
	return &AuthHandler{
		authSvc:    authSvc,
		tokenSvc:   tokenSvc,
		settingSvc: settingSvc,
		captchaSvc: captchaSvc,
	}
}

// CaptchaParams 统一验证码参数（嵌入到请求中）
type CaptchaParams struct {
	// Turnstile 参数
	TurnstileToken string `json:"turnstile_token,omitempty"`
	// 极验参数
	GeetestLotNumber     string `json:"geetest_lot_number,omitempty"`
	GeetestCaptchaOutput string `json:"geetest_captcha_output,omitempty"`
	GeetestPassToken     string `json:"geetest_pass_token,omitempty"`
	GeetestGenTime       string `json:"geetest_gen_time,omitempty"`
	// 系统验证码参数
	ImageCaptchaId     string `json:"image_captcha_id,omitempty"`
	ImageCaptchaAnswer string `json:"image_captcha_answer,omitempty"`
}

// LoginRequest 定义了登录请求的结构
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
	CaptchaParams
}

// RegisterRequest 定义了注册请求的结构
type RegisterRequest struct {
	Email          string `json:"email" binding:"required,email"`
	Nickname       string `json:"nickname" binding:"required"`
	Password       string `json:"password" binding:"required,min=6"`
	RepeatPassword string `json:"repeat_password" binding:"required"`
	CaptchaParams
}

// RefreshTokenRequest 定义了刷新令牌请求的结构
type RefreshTokenRequest struct {
	RefreshToken string `json:"refreshToken"`
}

// ActivateUserRequest 定义了激活用户请求的结构
type ActivateUserRequest struct {
	PublicUserID string `json:"id" binding:"required"` // 公共用户ID
	Sign         string `json:"sign" binding:"required"`
}

// ForgotPasswordRequest 定义了忘记密码请求的结构
type ForgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
	CaptchaParams
}

// ResetPasswordRequest 定义了重置密码请求的结构
type ResetPasswordRequest struct {
	PublicUserID   string `json:"id" binding:"required"` // 公共用户ID
	Sign           string `json:"sign" binding:"required"`
	Password       string `json:"password" binding:"required,min=6"`
	RepeatPassword string `json:"repeat_password" binding:"required"`
}

// UserGroupResponse 定义了用户组的响应结构，用于嵌套在用户信息中
type UserGroupResponse struct {
	ID          string `json:"id"`          // 用户组的公共ID，改为 string 类型
	Name        string `json:"name"`        // 用户组名称
	Description string `json:"description"` // 用户组描述
	// 根据需要，可以添加 Permissions 或其他用户组相关的公开信息
}

// LoginUserInfoResponse 定义了登录成功时返回给客户端的用户信息结构
type LoginUserInfoResponse struct {
	ID          string            `json:"id"`          // 用户的公共ID
	CreatedAt   time.Time         `json:"created_at"`  // 创建时间
	UpdatedAt   time.Time         `json:"updated_at"`  // 更新时间
	Username    string            `json:"username"`    // 用户名
	Nickname    string            `json:"nickname"`    // 昵称
	Avatar      string            `json:"avatar"`      // 头像URL
	Email       string            `json:"email"`       // 邮箱
	LastLoginAt *time.Time        `json:"lastLoginAt"` // 最后登录时间
	UserGroupID uint              `json:"userGroupID"` // 用户组ID (原始的数据库ID，根据需求决定是否暴露)
	UserGroup   UserGroupResponse `json:"userGroup"`   // 用户的用户组信息 (嵌套 DTO)
	Status      int               `json:"status"`      // 用户状态
}

// Login 处理用户登录请求
// @Summary      用户登录
// @Description  用户通过邮箱和密码进行登录
// @Tags         用户认证
// @Accept       json
// @Produce      json
// @Param        body  body      LoginRequest  true  "登录信息"
// @Success      200   {object}  response.Response{data=object{userInfo=LoginUserInfoResponse,roles=[]string,accessToken=string,refreshToken=string,expires=string}}  "登录成功"
// @Failure      400   {object}  response.Response  "邮箱或密码格式不正确"
// @Failure      401   {object}  response.Response  "认证失败"
// @Failure      500   {object}  response.Response  "内部错误"
// @Router       /auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "邮箱或密码格式不正确")
		return
	}

	// 0. 验证人机验证（如果启用）
	captchaParams := captcha.CaptchaParams{
		TurnstileToken:       req.TurnstileToken,
		GeetestLotNumber:     req.GeetestLotNumber,
		GeetestCaptchaOutput: req.GeetestCaptchaOutput,
		GeetestPassToken:     req.GeetestPassToken,
		GeetestGenTime:       req.GeetestGenTime,
		ImageCaptchaId:       req.ImageCaptchaId,
		ImageCaptchaAnswer:   req.ImageCaptchaAnswer,
	}
	if err := h.captchaSvc.Verify(c.Request.Context(), captchaParams, c.ClientIP()); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	// 1. 调用认证服务进行登录逻辑处理
	user, err := h.authSvc.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		switch {
		case errors.Is(err, auth.ErrInvalidCredentials), errors.Is(err, auth.ErrPasswordIncorrect):
			response.Fail(c, http.StatusUnauthorized, err.Error())
		case errors.Is(err, auth.ErrAuthServiceBusy):
			response.Fail(c, http.StatusServiceUnavailable, err.Error())
		default:
			response.Fail(c, http.StatusInternalServerError, "登录失败，请稍后重试")
		}
		return
	}

	// 2. 调用令牌服务生成会话令牌
	// 注意：这里的 GenerateSessionTokens 内部也需要更新为使用 GeneratePublicID
	accessToken, refreshToken, expires, err := h.tokenSvc.GenerateSessionTokens(c.Request.Context(), user)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "生成令牌失败: "+err.Error())
		return
	}

	// 3. 构建 roles 数组
	roles := []string{fmt.Sprintf("%d", user.UserGroupID)}

	// 4. 生成用户的公共 ID
	publicUserID, err := idgen.GeneratePublicID(user.ID, idgen.EntityTypeUser) // 统一使用 GeneratePublicID
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "生成用户公共ID失败")
		return
	}

	// 5. 生成用户组的公共 ID
	publicUserGroupID, err := idgen.GeneratePublicID(user.UserGroup.ID, idgen.EntityTypeUserGroup) // 统一使用 GeneratePublicID
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "生成用户组公共ID失败")
		return
	}

	// 处理头像URL：如果是完整URL则直接使用，否则拼接gravatar URL
	avatar := user.Avatar
	if avatar != "" && !strings.HasPrefix(avatar, "http://") && !strings.HasPrefix(avatar, "https://") {
		gravatarBaseURL := h.settingSvc.Get(constant.KeyGravatarURL.String())
		avatar = gravatarBaseURL + avatar
	}

	// 6. 构建 LoginUserInfoResponse DTO，只包含需要暴露给客户端的字段
	userInfoResp := LoginUserInfoResponse{
		ID:          publicUserID, // 返回公共ID
		CreatedAt:   user.CreatedAt,
		UpdatedAt:   user.UpdatedAt,
		Username:    user.Username,
		Nickname:    user.Nickname,
		Avatar:      avatar,
		Email:       user.Email,
		LastLoginAt: user.LastLoginAt,
		UserGroupID: user.UserGroupID,
		UserGroup: UserGroupResponse{
			ID:          publicUserGroupID, // 返回用户组的公共ID
			Name:        user.UserGroup.Name,
			Description: user.UserGroup.Description,
		},
		Status: user.Status,
	}

	// 7. 返回成功响应
	response.Success(c, gin.H{
		"userInfo":     userInfoResp, // 返回包含公共ID和用户组信息的 DTO
		"roles":        roles,
		"accessToken":  accessToken,
		"refreshToken": refreshToken,
		"expires":      expires,
	}, "登录成功")
}

// Register 处理用户注册请求
// @Summary      用户注册
// @Description  创建新用户账号
// @Tags         用户认证
// @Accept       json
// @Produce      json
// @Param        body  body      RegisterRequest  true  "注册信息"
// @Success      200   {object}  response.Response  "注册成功"
// @Failure      400   {object}  response.Response  "参数错误"
// @Failure      500   {object}  response.Response  "内部错误"
// @Router       /auth/register [post]
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数错误：邮箱、密码或重复密码格式不正确")
		return
	}
	if req.Password != req.RepeatPassword {
		response.Fail(c, http.StatusBadRequest, "两次输入的密码不一致")
		return
	}

	// 验证人机验证（如果启用）
	captchaParams := captcha.CaptchaParams{
		TurnstileToken:       req.TurnstileToken,
		GeetestLotNumber:     req.GeetestLotNumber,
		GeetestCaptchaOutput: req.GeetestCaptchaOutput,
		GeetestPassToken:     req.GeetestPassToken,
		GeetestGenTime:       req.GeetestGenTime,
		ImageCaptchaId:       req.ImageCaptchaId,
		ImageCaptchaAnswer:   req.ImageCaptchaAnswer,
	}
	if err := h.captchaSvc.Verify(c.Request.Context(), captchaParams, c.ClientIP()); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	activationRequired, err := h.authSvc.Register(c.Request.Context(), req.Email, req.Nickname, req.Password)
	if err != nil {
		response.Fail(c, http.StatusConflict, err.Error())
		return
	}

	message := "注册成功"
	if activationRequired {
		message = "注册成功，请查收激活邮件以完成注册"
	}
	response.Success(c, gin.H{"activation_required": activationRequired}, message)
}

// RefreshToken 刷新访问 Token
// @Summary      刷新访问令牌
// @Description  使用刷新令牌获取新的访问令牌
// @Tags         用户认证
// @Accept       json
// @Produce      json
// @Param        Authorization  header  string  false  "Bearer {refresh_token}"
// @Param        body           body    object{refreshToken=string}  false  "刷新令牌（可选，优先使用Header）"
// @Success      200  {object}  response.Response{data=object{accessToken=string,expires=string}}  "刷新成功"
// @Failure      401  {object}  response.Response  "未提供RefreshToken或令牌无效"
// @Router       /auth/refresh [post]
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	// 优先从 Header 获取
	refreshToken := strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")

	// 如果 Header 中没有，再尝试从 Body 获取
	if refreshToken == "" {
		var req RefreshTokenRequest
		if err := c.ShouldBindJSON(&req); err == nil {
			refreshToken = req.RefreshToken
		}
	}

	if refreshToken == "" {
		response.Fail(c, http.StatusUnauthorized, "未提供RefreshToken")
		return
	}

	// 注意：这里的 RefreshAccessToken 内部也需要更新为使用 DecodePublicID
	accessToken, expires, err := h.tokenSvc.RefreshAccessToken(c.Request.Context(), refreshToken)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, err.Error())
		return
	}

	response.Success(c, gin.H{
		"accessToken": accessToken,
		"expires":     expires,
	}, "刷新Token成功")
}

// ActivateUser 处理用户激活请求
// @Summary      激活用户账号
// @Description  通过激活链接激活用户账号，并自动登录
// @Tags         用户认证
// @Accept       json
// @Produce      json
// @Param        body  body  object{publicUserId=string,sign=string}  true  "激活信息"
// @Success      200  {object}  response.Response{data=object{userInfo=LoginUserInfoResponse,roles=[]string,accessToken=string,refreshToken=string,expires=string}}  "账户已成功激活并登录"
// @Failure      400  {object}  response.Response  "参数错误或激活链接无效"
// @Failure      401  {object}  response.Response  "激活失败"
// @Router       /auth/activate [post]
func (h *AuthHandler) ActivateUser(c *gin.Context) {
	var req ActivateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	// 将公共ID解码为数据库ID，并验证实体类型
	userID, entityType, err := idgen.DecodePublicID(req.PublicUserID) // 统一使用 DecodePublicID
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "无效的用户激活链接或ID")
		return
	}
	if entityType != idgen.EntityTypeUser {
		response.Fail(c, http.StatusBadRequest, "无效的用户激活链接：ID类型不匹配")
		return
	}

	if err := h.authSvc.ActivateUser(c.Request.Context(), userID, req.Sign); err != nil { // 传递数据库ID
		response.Fail(c, http.StatusUnauthorized, err.Error())
		return
	}

	// 激活成功后，获取用户信息并生成登录令牌
	user, err := h.authSvc.GetUserByID(c.Request.Context(), userID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "激活成功，但获取用户信息失败")
		return
	}

	// 生成会话令牌
	accessToken, refreshToken, expires, err := h.tokenSvc.GenerateSessionTokens(c.Request.Context(), user)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "激活成功，但生成登录令牌失败")
		return
	}

	// 构建 roles 数组
	roles := []string{fmt.Sprintf("%d", user.UserGroupID)}

	// 生成用户的公共 ID
	publicUserID, err := idgen.GeneratePublicID(user.ID, idgen.EntityTypeUser)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "生成用户公共ID失败")
		return
	}

	// 生成用户组的公共 ID
	publicUserGroupID, err := idgen.GeneratePublicID(user.UserGroup.ID, idgen.EntityTypeUserGroup)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "生成用户组公共ID失败")
		return
	}

	// 处理头像URL
	avatar := user.Avatar
	if avatar != "" && !strings.HasPrefix(avatar, "http://") && !strings.HasPrefix(avatar, "https://") {
		gravatarBaseURL := h.settingSvc.Get(constant.KeyGravatarURL.String())
		avatar = gravatarBaseURL + avatar
	}

	// 构建用户信息响应
	userInfoResp := LoginUserInfoResponse{
		ID:          publicUserID,
		CreatedAt:   user.CreatedAt,
		UpdatedAt:   user.UpdatedAt,
		Username:    user.Username,
		Nickname:    user.Nickname,
		Avatar:      avatar,
		Email:       user.Email,
		LastLoginAt: user.LastLoginAt,
		UserGroupID: user.UserGroupID,
		UserGroup: UserGroupResponse{
			ID:          publicUserGroupID,
			Name:        user.UserGroup.Name,
			Description: user.UserGroup.Description,
		},
		Status: user.Status,
	}

	// 返回成功响应，包含登录信息
	response.Success(c, gin.H{
		"userInfo":     userInfoResp,
		"roles":        roles,
		"accessToken":  accessToken,
		"refreshToken": refreshToken,
		"expires":      expires,
	}, "您的账户已成功激活并自动登录！")
}

// ForgotPasswordRequest 处理发送密码重置邮件的请求
// @Summary      忘记密码
// @Description  请求发送密码重置邮件
// @Tags         用户认证
// @Accept       json
// @Produce      json
// @Param        body  body  object{email=string}  true  "邮箱地址"
// @Success      200  {object}  response.Response  "如果该邮箱已注册，将收到重置邮件"
// @Failure      400  {object}  response.Response  "邮箱格式不正确"
// @Router       /auth/forgot-password [post]
func (h *AuthHandler) ForgotPasswordRequest(c *gin.Context) {
	var req ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "邮箱格式不正确")
		return
	}

	// 验证人机验证（如果启用）
	captchaParams := captcha.CaptchaParams{
		TurnstileToken:       req.TurnstileToken,
		GeetestLotNumber:     req.GeetestLotNumber,
		GeetestCaptchaOutput: req.GeetestCaptchaOutput,
		GeetestPassToken:     req.GeetestPassToken,
		GeetestGenTime:       req.GeetestGenTime,
		ImageCaptchaId:       req.ImageCaptchaId,
		ImageCaptchaAnswer:   req.ImageCaptchaAnswer,
	}
	if err := h.captchaSvc.Verify(c.Request.Context(), captchaParams, c.ClientIP()); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	// 无论用户是否存在或内部处理是否成功，都返回相同响应，防止邮箱枚举攻击。
	if err := h.authSvc.RequestPasswordReset(c.Request.Context(), req.Email); err != nil {
		log.Printf("[ERROR] 处理密码重置邮件请求失败: %v", err)
	}
	response.Success(c, nil, "如果该邮箱已注册，您将会收到一封密码重置邮件。")
}

// ResetPassword 执行密码重置
// @Summary      重置密码
// @Description  通过重置链接设置新密码
// @Tags         用户认证
// @Accept       json
// @Produce      json
// @Param        body  body  object{publicUserId=string,sign=string,password=string,repeatPassword=string}  true  "重置信息"
// @Success      200  {object}  response.Response  "密码重置成功"
// @Failure      400  {object}  response.Response  "参数错误、链接无效或两次密码不一致"
// @Failure      401  {object}  response.Response  "重置失败"
// @Router       /auth/reset-password [post]
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数错误")
		return
	}
	if req.Password != req.RepeatPassword {
		response.Fail(c, http.StatusBadRequest, "两次输入的密码不一致")
		return
	}

	// 将公共ID解码为数据库ID，并验证实体类型
	userID, entityType, err := idgen.DecodePublicID(req.PublicUserID) // 统一使用 DecodePublicID
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "无效的密码重置链接或ID")
		return
	}
	if entityType != idgen.EntityTypeUser {
		response.Fail(c, http.StatusBadRequest, "无效的密码重置链接：ID类型不匹配")
		return
	}

	if err := h.authSvc.PerformPasswordReset(c.Request.Context(), userID, req.Sign, req.Password); err != nil { // 传递数据库ID
		response.Fail(c, http.StatusUnauthorized, err.Error())
		return
	}

	response.Success(c, nil, "密码重置成功，请使用新密码登录。")
}

// CheckEmail 检查邮箱是否已被注册
// @Summary      检查邮箱
// @Description  检查邮箱是否已被注册
// @Tags         用户认证
// @Produce      json
// @Param        email  query  string  true  "邮箱地址"
// @Success      200  {object}  response.Response{data=object{exists=bool}}  "查询成功"
// @Failure      400  {object}  response.Response  "缺少email参数"
// @Failure      500  {object}  response.Response  "查询失败"
// @Router       /auth/check-email [get]
func (h *AuthHandler) CheckEmail(c *gin.Context) {
	email := c.Query("email")
	if email == "" {
		response.Fail(c, http.StatusBadRequest, "参数错误：缺少 email")
		return
	}

	exists, err := h.authSvc.CheckEmailExists(c.Request.Context(), email)
	if err != nil {
		response.Fail(c, http.StatusServiceUnavailable, "登录服务暂时不可用，请稍后重试")
		return
	}

	response.Success(c, gin.H{"exists": exists}, "查询成功")

}
