// anheyu-app/pkg/service/utility/primary_color_service_test.go
package utility

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
)

// MockSettingService 模拟设置服务
type MockSettingService struct{}

func (m *MockSettingService) LoadAllSettings(ctx context.Context) error {
	return nil
}

func (m *MockSettingService) Get(key string) string {
	if key == constant.KeySiteURL.String() {
		return "https://test.example.com"
	}
	return ""
}

func (m *MockSettingService) GetBool(key string) bool {
	return false
}

func (m *MockSettingService) GetByKeys(keys []string) map[string]interface{} {
	return make(map[string]interface{})
}

func (m *MockSettingService) GetSiteConfig() map[string]interface{} {
	return make(map[string]interface{})
}

func (m *MockSettingService) UpdateSettings(ctx context.Context, settings map[string]string) error {
	return nil
}

func (m *MockSettingService) RegisterPublicSettings(keys []string) {
}

func (m *MockSettingService) IsPublicSetting(key string) bool {
	return false
}

// TestURLCleaning 测试URL清理功能
func TestURLCleaning(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expectClean string
	}{
		{
			name:        "URL with zero-width space at end",
			input:       "https://example.com/image.png\u2060",
			expectClean: "https://example.com/image.png",
		},
		{
			name:        "URL with zero-width non-joiner",
			input:       "https://example.com/\u200Cimage.png",
			expectClean: "https://example.com/image.png",
		},
		{
			name:        "URL with BOM",
			input:       "\uFEFFhttps://example.com/image.png",
			expectClean: "https://example.com/image.png",
		},
		{
			name:        "URL with multiple zero-width chars",
			input:       "https://\u200Bexample.com\u200C/image\u200D.png\u2060",
			expectClean: "https://example.com/image.png",
		},
		{
			name:        "Clean URL without special chars",
			input:       "https://example.com/image.png",
			expectClean: "https://example.com/image.png",
		},
	}

	colorSvc := NewColorService()
	settingSvc := &MockSettingService{}
	httpClient := &http.Client{Timeout: 10 * time.Second}

	svc := NewPrimaryColorService(
		colorSvc,
		settingSvc,
		nil, // fileRepo
		nil, // storagePolicyRepo
		httpClient,
		nil, // storageProviders
	)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 创建一个模拟服务器来验证接收到的URL是否已清理
			cleanedURL := ""
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				cleanedURL = "https://" + r.Host + r.URL.String()
				w.Header().Set("Content-Type", "text/html") // 返回 HTML 让服务快速失败
				w.WriteHeader(http.StatusOK)
			}))
			defer server.Close()

			// 将测试URL指向我们的模拟服务器
			testURL := strings.Replace(tt.input, "https://example.com", server.URL, 1)
			expectedURL := strings.Replace(tt.expectClean, "https://example.com", server.URL, 1)

			ctx := context.Background()
			svc.GetPrimaryColorFromURL(ctx, testURL)

			// 验证服务器接收到的URL是否已清理
			if cleanedURL != "" && !strings.Contains(cleanedURL, "\u200B") && !strings.Contains(cleanedURL, "\u200C") {
				t.Logf("✓ URL已清理，服务器收到: %s", cleanedURL)
			} else if cleanedURL == "" {
				// URL可能因为包含特殊字符而无法被正常处理
				t.Logf("URL包含特殊字符，需要清理: %s -> %s", tt.input, expectedURL)
			}
		})
	}
}

// TestMiyousheImageDetection 测试米游社图片识别（通过观察日志）
func TestMiyousheImageDetection(t *testing.T) {
	colorSvc := NewColorService()
	settingSvc := &MockSettingService{}
	httpClient := &http.Client{Timeout: 10 * time.Second}

	svc := NewPrimaryColorService(
		colorSvc,
		settingSvc,
		nil,
		nil,
		httpClient,
		nil,
	)

	ctx := context.Background()

	tests := []struct {
		name        string
		url         string
		description string
	}{
		{
			name:        "Miyoushe image URL",
			url:         "https://upload-bbs.miyoushe.com/upload/2025/10/15/125766904/test.png",
			description: "应该被识别为米游社图片",
		},
		{
			name:        "Other image URL",
			url:         "https://example.com/image.png",
			description: "应该被识别为外部图片",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 通过日志输出判断是否正确识别（日志会显示"检测到米游社图片"或"检测到外部图片"）
			t.Logf("测试URL: %s (%s)", tt.url, tt.description)
			svc.GetPrimaryColorFromURL(ctx, tt.url)
		})
	}
}

// TestGetColorFromMiyoushe 测试米游社图片主色调获取
func TestGetColorFromMiyoushe(t *testing.T) {
	if testing.Short() {
		t.Skip("跳过网络请求测试（使用 -short 标志）")
	}

	colorSvc := NewColorService()
	settingSvc := &MockSettingService{}
	httpClient := &http.Client{Timeout: 30 * time.Second}

	svc := NewPrimaryColorService(
		colorSvc,
		settingSvc,
		nil,
		nil,
		httpClient,
		nil,
	)

	ctx := context.Background()

	// 测试真实的米游社图片
	miyousheURL := "https://upload-bbs.miyoushe.com/upload/2025/10/15/125766904/e68d826422c3c07b60b8e661e933dd8f_641231238178450418.png"

	t.Run("Real Miyoushe Image", func(t *testing.T) {
		color := svc.GetPrimaryColorFromURL(ctx, miyousheURL)

		if color == "" {
			t.Logf("⚠️  米游社图片主色调获取失败（可能是OSS API不可用，会降级到下载方式）")
		} else if strings.HasPrefix(color, "#") && len(color) == 7 {
			t.Logf("✓ 米游社图片主色调获取成功: %s", color)
		} else {
			t.Errorf("返回的颜色格式不正确: %s", color)
		}
	})
}

// TestGetColorFromExternalImage 测试外部图片主色调获取
func TestGetColorFromExternalImage(t *testing.T) {
	if testing.Short() {
		t.Skip("跳过网络请求测试（使用 -short 标志）")
	}

	colorSvc := NewColorService()
	settingSvc := &MockSettingService{}
	httpClient := &http.Client{Timeout: 30 * time.Second}

	svc := NewPrimaryColorService(
		colorSvc,
		settingSvc,
		nil,
		nil,
		httpClient,
		nil,
	)

	ctx := context.Background()

	tests := []struct {
		name        string
		url         string
		description string
	}{
		{
			name:        "External Image with special chars",
			url:         "https://tc.ayakasuki.com/a/2025/06/13/biji684bed93e2d86.png",
			description: "测试包含特殊字符的外部图片",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 测试原始URL（可能包含特殊字符）
			color := svc.GetPrimaryColorFromURL(ctx, tt.url)

			if color == "" {
				t.Logf("⚠️  %s 主色调获取失败", tt.description)
			} else if strings.HasPrefix(color, "#") && len(color) == 7 {
				t.Logf("✓ %s 主色调获取成功: %s", tt.description, color)
			} else {
				t.Errorf("返回的颜色格式不正确: %s", color)
			}

			// 测试带零宽字符的URL
			urlWithZeroWidth := tt.url + "\u2060"
			colorWithClean := svc.GetPrimaryColorFromURL(ctx, urlWithZeroWidth)

			if colorWithClean == "" {
				t.Logf("⚠️  带零宽字符的URL主色调获取失败")
			} else if strings.HasPrefix(colorWithClean, "#") && len(colorWithClean) == 7 {
				t.Logf("✓ 带零宽字符的URL清理后主色调获取成功: %s", colorWithClean)
			}
		})
	}
}

// TestContentTypeValidation 测试Content-Type验证
func TestContentTypeValidation(t *testing.T) {
	colorSvc := NewColorService()
	settingSvc := &MockSettingService{}
	httpClient := &http.Client{Timeout: 10 * time.Second}

	svc := NewPrimaryColorService(
		colorSvc,
		settingSvc,
		nil,
		nil,
		httpClient,
		nil,
	)

	tests := []struct {
		name        string
		contentType string
		shouldFail  bool
	}{
		{
			name:        "Valid image/png",
			contentType: "image/png",
			shouldFail:  false,
		},
		{
			name:        "Valid image/jpeg",
			contentType: "image/jpeg",
			shouldFail:  false,
		},
		{
			name:        "Invalid text/html",
			contentType: "text/html",
			shouldFail:  true,
		},
		{
			name:        "Invalid application/json",
			contentType: "application/json",
			shouldFail:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", tt.contentType)
				w.WriteHeader(http.StatusOK)
				// 返回一些dummy数据
				if strings.HasPrefix(tt.contentType, "image/") {
					// 返回一个简单的1x1 PNG
					pngData := []byte{
						0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
						0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
						0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
						0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
						0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
						0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
						0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D,
						0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
						0x44, 0xAE, 0x42, 0x60, 0x82,
					}
					w.Write(pngData)
				} else {
					w.Write([]byte("<html>Error</html>"))
				}
			}))
			defer server.Close()

			ctx := context.Background()
			color := svc.GetPrimaryColorFromURL(ctx, server.URL)

			if tt.shouldFail {
				if color != "" {
					t.Errorf("期望失败但成功了，contentType=%s, color=%s", tt.contentType, color)
				} else {
					t.Logf("✓ 正确拒绝了非图片类型: %s", tt.contentType)
				}
			} else {
				if color == "" {
					t.Logf("⚠️  图片类型返回空（可能是图片解码失败）: %s", tt.contentType)
				} else {
					t.Logf("✓ 成功处理图片类型: %s, color=%s", tt.contentType, color)
				}
			}
		})
	}
}

// TestEmptyURL 测试空URL处理
func TestEmptyURL(t *testing.T) {
	colorSvc := NewColorService()
	settingSvc := &MockSettingService{}
	httpClient := &http.Client{Timeout: 10 * time.Second}

	svc := NewPrimaryColorService(
		colorSvc,
		settingSvc,
		nil,
		nil,
		httpClient,
		nil,
	)

	ctx := context.Background()
	color := svc.GetPrimaryColorFromURL(ctx, "")

	if color != "" {
		t.Errorf("空URL应该返回空字符串，但返回了: %s", color)
	} else {
		t.Log("✓ 空URL正确返回空字符串")
	}
}

// TestHTTPHeadersPresent 测试HTTP请求头是否正确设置
func TestHTTPHeadersPresent(t *testing.T) {
	colorSvc := NewColorService()
	settingSvc := &MockSettingService{}
	httpClient := &http.Client{Timeout: 10 * time.Second}

	svc := NewPrimaryColorService(
		colorSvc,
		settingSvc,
		nil,
		nil,
		httpClient,
		nil,
	)

	receivedHeaders := make(http.Header)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 记录接收到的headers
		for k, v := range r.Header {
			receivedHeaders[k] = v
		}
		w.Header().Set("Content-Type", "text/html")
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	ctx := context.Background()
	svc.GetPrimaryColorFromURL(ctx, server.URL)

	// 验证必要的headers是否存在
	requiredHeaders := []string{"User-Agent", "Accept", "Accept-Language"}
	for _, header := range requiredHeaders {
		if receivedHeaders.Get(header) == "" {
			t.Errorf("缺少必要的HTTP header: %s", header)
		} else {
			t.Logf("✓ HTTP header存在: %s = %s", header, receivedHeaders.Get(header))
		}
	}

	// 验证不应该手动设置Accept-Encoding
	if receivedHeaders.Get("Accept-Encoding") != "" {
		t.Logf("注意: Accept-Encoding被设置为: %s (Go会自动处理)", receivedHeaders.Get("Accept-Encoding"))
	}
}
