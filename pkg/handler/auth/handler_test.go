package auth_handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/captcha"
	"github.com/gin-gonic/gin"
)

type forgotPasswordAuthService struct {
	err error
}

func (s *forgotPasswordAuthService) Login(context.Context, string, string) (*model.User, error) {
	return nil, nil
}

func (s *forgotPasswordAuthService) Register(context.Context, string, string, string) (bool, error) {
	return false, nil
}

func (s *forgotPasswordAuthService) ActivateUser(context.Context, uint, string) error { return nil }

func (s *forgotPasswordAuthService) RequestPasswordReset(context.Context, string) error {
	return s.err
}

func (s *forgotPasswordAuthService) PerformPasswordReset(context.Context, uint, string, string) error {
	return nil
}

func (s *forgotPasswordAuthService) CheckEmailExists(context.Context, string) (bool, error) {
	return false, nil
}

func (s *forgotPasswordAuthService) GetUserByID(context.Context, uint) (*model.User, error) {
	return nil, nil
}

type forgotPasswordCaptchaService struct{}

func (forgotPasswordCaptchaService) GetProvider() captcha.CaptchaProvider {
	return captcha.ProviderNone
}

func (forgotPasswordCaptchaService) GetConfig() captcha.CaptchaConfig { return captcha.CaptchaConfig{} }

func (forgotPasswordCaptchaService) GenerateImageCaptcha(context.Context) (*captcha.ImageCaptchaResponse, error) {
	return nil, nil
}

func (forgotPasswordCaptchaService) Verify(context.Context, captcha.CaptchaParams, string) error {
	return nil
}

func (forgotPasswordCaptchaService) IsEnabled() bool { return false }

func TestForgotPasswordRequestKeepsUniformResponseForInternalErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name string
		err  error
	}{
		{name: "success"},
		{name: "internal error", err: errors.New("email preparation failed")},
	}

	responses := make([]string, 0, len(tests))
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := &AuthHandler{
				authSvc:    &forgotPasswordAuthService{err: tt.err},
				captchaSvc: forgotPasswordCaptchaService{},
			}
			router := gin.New()
			router.POST("/auth/forgot-password", handler.ForgotPasswordRequest)

			request := httptest.NewRequest(
				http.MethodPost,
				"/auth/forgot-password",
				strings.NewReader(`{"email":"user@example.com"}`),
			)
			request.Header.Set("Content-Type", "application/json")
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, request)

			if recorder.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d; body = %s", recorder.Code, http.StatusOK, recorder.Body.String())
			}
			responses = append(responses, recorder.Body.String())
		})
	}

	if len(responses) != len(tests) {
		t.Fatalf("collected %d responses, want %d", len(responses), len(tests))
	}
	if responses[0] != responses[1] {
		t.Fatalf("forgot-password responses differ: success=%q error=%q", responses[0], responses[1])
	}
}
