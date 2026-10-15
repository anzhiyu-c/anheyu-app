package router

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/internal/app/middleware"
	internal_auth "github.com/anzhiyu-c/anheyu-app/internal/pkg/auth"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	theme_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/theme"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/auth"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/theme"
	"github.com/gin-gonic/gin"
)

const themeRouteJWTSecret = "theme-route-regression-test-secret"

type themeRouteSettings struct{ setting.SettingService }

func (themeRouteSettings) Get(key string) string {
	if key == constant.KeyJWTSecret.String() {
		return themeRouteJWTSecret
	}
	return ""
}

// The production router, handlers, JWT parser, and administrator middleware run
// unchanged. This boundary records whether a request reached theme operations.
type themeRouteService struct {
	theme.ThemeService
	calls []string
}

func (s *themeRouteService) record(operation string) { s.calls = append(s.calls, operation) }

func (s *themeRouteService) GetCurrentTheme(context.Context, uint) (*theme.ThemeInfo, error) {
	s.record("current")
	return &theme.ThemeInfo{Name: "theme-safe"}, nil
}

func (s *themeRouteService) GetInstalledThemes(context.Context, uint) ([]*theme.ThemeInfo, error) {
	s.record("installed")
	return []*theme.ThemeInfo{}, nil
}

func (s *themeRouteService) InstallTheme(context.Context, uint, *theme.ThemeInstallRequest) error {
	s.record("install")
	return nil
}

func (s *themeRouteService) UploadTheme(context.Context, uint, *multipart.FileHeader, ...bool) (*theme.ThemeInfo, error) {
	s.record("upload")
	return &theme.ThemeInfo{Name: "theme-safe"}, nil
}

func (s *themeRouteService) ValidateThemePackage(context.Context, uint, *multipart.FileHeader) (*theme.ThemeValidationResult, error) {
	s.record("validate")
	return &theme.ThemeValidationResult{IsValid: true}, nil
}

func (s *themeRouteService) SwitchToTheme(context.Context, uint, string, theme.SSRManagerInterface) error {
	s.record("switch")
	return nil
}

func (s *themeRouteService) SwitchToOfficial(context.Context, uint, theme.SSRManagerInterface) error {
	s.record("official")
	return nil
}

func (s *themeRouteService) UninstallTheme(context.Context, uint, string) error {
	s.record("uninstall")
	return nil
}

func (s *themeRouteService) GetThemeSettings(context.Context, string) ([]theme.ThemeSettingGroup, error) {
	s.record("settings")
	return []theme.ThemeSettingGroup{}, nil
}

func (s *themeRouteService) GetUserThemeConfig(context.Context, uint, string) (map[string]interface{}, error) {
	s.record("config")
	return map[string]interface{}{}, nil
}

func (s *themeRouteService) SaveUserThemeConfig(context.Context, uint, string, map[string]interface{}) error {
	s.record("save-config")
	return nil
}

func (s *themeRouteService) GetCurrentThemeConfig(context.Context, uint) (*theme.ThemeConfigResponse, error) {
	s.record("current-config")
	return &theme.ThemeConfigResponse{Values: map[string]interface{}{}}, nil
}

func (s *themeRouteService) GetThemeMarketList(context.Context) ([]*theme.MarketTheme, error) {
	s.record("market")
	return []*theme.MarketTheme{}, nil
}

func (s *themeRouteService) IsStaticModeActive() bool {
	s.record("static-mode")
	return false
}

func newThemeSecurityRouter(t *testing.T) (*gin.Engine, *themeRouteService, map[string]string) {
	t.Helper()
	if err := idgen.InitSqidsEncoderWithSeed("theme-route-security"); err != nil {
		t.Fatal(err)
	}
	tokens := map[string]string{"anonymous": "", "invalid": "invalid-jwt"}
	for role, groupID := range map[string]uint{"user": 2, "admin": 1} {
		token, err := internal_auth.GenerateToken(7, nil, groupID, []byte(themeRouteJWTSecret))
		if err != nil {
			t.Fatal(err)
		}
		tokens[role] = token
	}
	service := &themeRouteService{}
	router := &Router{
		mw:           middleware.NewMiddleware(auth.NewTokenService(nil, themeRouteSettings{}, nil)),
		themeHandler: theme_handler.NewHandler(service, nil),
	}
	engine := gin.New()
	router.registerThemeRoutes(engine.Group("/api"))
	return engine, service, tokens
}

func themeRouteRequest(t *testing.T, method, path, token string) *http.Request {
	t.Helper()
	var body io.Reader = strings.NewReader(`{"theme_name":"theme-safe","download_url":"https://example.invalid/theme.zip","config":{}}`)
	contentType := "application/json"
	if path == "/api/theme/upload" || path == "/api/theme/validate" {
		var buffer bytes.Buffer
		writer := multipart.NewWriter(&buffer)
		part, err := writer.CreateFormFile("file", "theme-safe.zip")
		if err != nil {
			t.Fatal(err)
		}
		archive := zip.NewWriter(part)
		for name, contents := range map[string]string{
			"theme.json": `{"name":"theme-safe","displayName":"Safe theme","version":"1.0.0","description":"Regression fixture","author":"Test"}`,
			"index.html": "<!DOCTYPE html><html><body>Safe theme</body></html>",
		} {
			file, err := archive.Create(name)
			if err != nil {
				t.Fatal(err)
			}
			if _, err := io.WriteString(file, contents); err != nil {
				t.Fatal(err)
			}
		}
		if err := archive.Close(); err != nil {
			t.Fatal(err)
		}
		if err := writer.Close(); err != nil {
			t.Fatal(err)
		}
		body = &buffer
		contentType = writer.FormDataContentType()
	}
	request := httptest.NewRequest(method, path+"?theme_name=theme-safe", body)
	request.Header.Set("Content-Type", contentType)
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	return request
}

func TestThemeRoutesRequireAdministrator(t *testing.T) {
	engine, service, tokens := newThemeSecurityRouter(t)
	for _, route := range engine.Routes() {
		if !strings.HasPrefix(route.Path, "/api/theme/") {
			continue
		}
		for _, role := range []string{"anonymous", "invalid", "user", "admin"} {
			t.Run(route.Method+" "+route.Path+"/"+role, func(t *testing.T) {
				service.calls = nil
				recorder := httptest.NewRecorder()
				engine.ServeHTTP(recorder, themeRouteRequest(t, route.Method, route.Path, tokens[role]))
				wantStatus, wantCalls := http.StatusUnauthorized, 0
				if role == "user" {
					wantStatus = http.StatusForbidden
				} else if role == "admin" {
					wantStatus, wantCalls = http.StatusOK, 1
				}
				if recorder.Code != wantStatus || len(service.calls) != wantCalls {
					t.Errorf("status=%d want=%d calls=%v want count=%d body=%s", recorder.Code, wantStatus, service.calls, wantCalls, recorder.Body.String())
				}
			})
		}
	}
}

func TestPublicThemeRoutesRemainPublic(t *testing.T) {
	engine, service, _ := newThemeSecurityRouter(t)
	for _, path := range []string{"market", "static-mode", "config"} {
		t.Run(path, func(t *testing.T) {
			service.calls = nil
			recorder := httptest.NewRecorder()
			engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/public/theme/"+path, nil))
			if recorder.Code != http.StatusOK || len(service.calls) != 1 {
				t.Fatalf("status=%d calls=%v body=%s", recorder.Code, service.calls, recorder.Body.String())
			}
		})
	}
}

func TestThemeInstallRejectsUnsafeNamesBeforeService(t *testing.T) {
	engine, service, tokens := newThemeSecurityRouter(t)
	for _, name := range []string{
		"theme-xxx/../../data/plugins", `theme-xxx\..\..\data\plugins`,
		"/tmp/theme-evil", "theme-xxx%2f..%2f..%2fdata%2fplugins", "theme-", "theme-evil.txt",
	} {
		t.Run(name, func(t *testing.T) {
			body, err := json.Marshal(map[string]string{"theme_name": name, "download_url": "https://example.invalid/theme.zip"})
			if err != nil {
				t.Fatal(err)
			}
			request := httptest.NewRequest(http.MethodPost, "/api/theme/install", bytes.NewReader(body))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("Authorization", "Bearer "+tokens["admin"])
			service.calls = nil
			recorder := httptest.NewRecorder()
			engine.ServeHTTP(recorder, request)
			if recorder.Code != http.StatusBadRequest || len(service.calls) != 0 {
				t.Errorf("status=%d want=400 calls=%v body=%s", recorder.Code, service.calls, recorder.Body.String())
			}
		})
	}
}
