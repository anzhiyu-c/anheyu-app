// pkg/service/captcha/service.go
/*
 * @Description: 统一人机验证服务
 * @Author: 安知鱼
 * @Date: 2026-01-20
 */
package captcha

import (
	"context"
	"errors"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/geetest"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/imagecaptcha"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/turnstile"
)

// CaptchaProvider 验证码提供者类型
type CaptchaProvider string

const (
	ProviderNone      CaptchaProvider = "none"      // 不启用验证
	ProviderTurnstile CaptchaProvider = "turnstile" // Cloudflare Turnstile
	ProviderGeetest   CaptchaProvider = "geetest"   // 极验 4.0
	ProviderImage     CaptchaProvider = "image"     // 系统图形验证码
)

// CaptchaConfig 返回给前端的验证码配置
type CaptchaConfig struct {
	Provider CaptchaProvider `json:"provider"` // 验证方式
	// Turnstile 配置
	TurnstileSiteKey string `json:"turnstile_site_key,omitempty"`
	// 极验配置
	GeetestCaptchaId string `json:"geetest_captcha_id,omitempty"`
	// 系统验证码配置
	ImageCaptchaLength int `json:"image_captcha_length,omitempty"`
}

// CaptchaParams 统一验证参数
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

// ImageCaptchaResponse 图形验证码生成响应
type ImageCaptchaResponse struct {
	CaptchaId   string `json:"captcha_id"`
	ImageBase64 string `json:"image_base64"`
}

// CaptchaService 统一验证服务接口
type CaptchaService interface {
	// GetProvider 获取当前验证方式
	GetProvider() CaptchaProvider
	// GetConfig 获取前端配置
	GetConfig() CaptchaConfig
	// GenerateImageCaptcha 生成图形验证码（仅 image 模式时可用）
	GenerateImageCaptcha(ctx context.Context) (*ImageCaptchaResponse, error)
	// Verify 统一验证接口
	Verify(ctx context.Context, params CaptchaParams, remoteIP string) error
	// IsEnabled 检查验证是否启用
	IsEnabled() bool
}

// captchaService 是 CaptchaService 的实现
type captchaService struct {
	settingSvc      setting.SettingService
	turnstileSvc    turnstile.TurnstileService
	geetestSvc      geetest.GeetestService
	imageCaptchaSvc imagecaptcha.ImageCaptchaService
}

// NewCaptchaService 创建统一验证服务
func NewCaptchaService(
	settingSvc setting.SettingService,
	turnstileSvc turnstile.TurnstileService,
	geetestSvc geetest.GeetestService,
	imageCaptchaSvc imagecaptcha.ImageCaptchaService,
) CaptchaService {
	return &captchaService{
		settingSvc:      settingSvc,
		turnstileSvc:    turnstileSvc,
		geetestSvc:      geetestSvc,
		imageCaptchaSvc: imageCaptchaSvc,
	}
}

// GetProvider 获取当前验证方式
func (s *captchaService) GetProvider() CaptchaProvider {
	provider := s.settingSvc.Get(constant.KeyCaptchaProvider.String())

	switch CaptchaProvider(provider) {
	case ProviderTurnstile, ProviderGeetest, ProviderImage:
		return CaptchaProvider(provider)
	default:
		return ProviderNone
	}
}

// IsEnabled 检查验证是否启用
func (s *captchaService) IsEnabled() bool {
	return s.GetProvider() != ProviderNone
}

// GetConfig 获取前端配置
func (s *captchaService) GetConfig() CaptchaConfig {
	provider := s.GetProvider()
	config := CaptchaConfig{
		Provider: provider,
	}

	switch provider {
	case ProviderTurnstile:
		config.TurnstileSiteKey = s.settingSvc.Get(constant.KeyTurnstileSiteKey.String())
	case ProviderGeetest:
		config.GeetestCaptchaId = s.geetestSvc.GetCaptchaId()
	case ProviderImage:
		// 图形验证码长度
		config.ImageCaptchaLength = imagecaptcha.EffectiveLength(s.settingSvc.Get(constant.KeyImageCaptchaLength.String()))
	}

	return config
}

// GenerateImageCaptcha 生成图形验证码
func (s *captchaService) GenerateImageCaptcha(ctx context.Context) (*ImageCaptchaResponse, error) {
	provider := s.GetProvider()
	if provider != ProviderImage {
		return nil, errors.New("当前验证方式不支持生成图形验证码")
	}

	captchaId, imageBase64, err := s.imageCaptchaSvc.Generate(ctx)
	if err != nil {
		return nil, err
	}

	return &ImageCaptchaResponse{
		CaptchaId:   captchaId,
		ImageBase64: imageBase64,
	}, nil
}

// Verify 统一验证接口
func (s *captchaService) Verify(ctx context.Context, params CaptchaParams, remoteIP string) error {
	provider := s.GetProvider()

	switch provider {
	case ProviderNone:
		// 不启用验证，直接通过
		return nil

	case ProviderTurnstile:
		return s.turnstileSvc.Verify(ctx, params.TurnstileToken, remoteIP)

	case ProviderGeetest:
		return s.geetestSvc.Verify(
			ctx,
			params.GeetestLotNumber,
			params.GeetestCaptchaOutput,
			params.GeetestPassToken,
			params.GeetestGenTime,
		)

	case ProviderImage:
		return s.imageCaptchaSvc.Verify(ctx, params.ImageCaptchaId, params.ImageCaptchaAnswer)

	default:
		return errors.New("未知的验证方式")
	}
}
