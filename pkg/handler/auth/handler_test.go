package auth_handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/auth"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/captcha"
	"github.com/gin-gonic/gin"
)

type forgotPasswordAuthService struct {
	err error
}

type securityAuthService struct {
	auth.AuthService
	exists  bool
	err     error
	queries int
}

func (s *securityAuthService) CheckEmailExists(context.Context, string) (bool, error) {
	s.queries++
	return s.exists, s.err
}

func (s *securityAuthService) Register(context.Context, string, string, string) (bool, error) {
	return false, s.err
}

func TestCheckEmailNeverDisclosesAccountExistence(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var first string
	for _, tc := range []struct {
		name   string
		exists bool
		err    error
	}{
		{name: "existing", exists: true},
		{name: "unknown"},
		{name: "database error", err: errors.New("database unavailable")},
	} {
		t.Run(tc.name, func(t *testing.T) {
			svc := &securityAuthService{exists: tc.exists, err: tc.err}
			handler := &AuthHandler{authSvc: svc}
			router := gin.New()
			router.GET("/auth/check-email", handler.CheckEmail)
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/auth/check-email?email=user@example.com", nil))
			if recorder.Code != http.StatusOK || !strings.Contains(recorder.Body.String(), `"exists":true`) || svc.queries != 0 {
				t.Fatalf("status=%d body=%s queries=%d", recorder.Code, recorder.Body.String(), svc.queries)
			}
			if first == "" {
				first = recorder.Body.String()
			} else if recorder.Body.String() != first {
				t.Fatalf("response reveals account existence: %s", recorder.Body.String())
			}
		})
	}
}

func TestRegisterReturnsForbiddenWhenRegistrationIsDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := &AuthHandler{authSvc: &securityAuthService{err: auth.ErrRegistrationDisabled}, captchaSvc: forgotPasswordCaptchaService{}}
	router := gin.New()
	router.POST("/auth/register", handler.Register)
	request := httptest.NewRequest(http.MethodPost, "/auth/register", strings.NewReader(`{"email":"user@example.com","nickname":"User","password":"password123","repeat_password":"password123"}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
	}
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
