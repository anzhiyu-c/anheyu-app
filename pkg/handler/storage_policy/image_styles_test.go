package storage_policy_handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

type imageStylesPolicyServiceStub struct {
	policy *model.StoragePolicy
	saved  *model.StoragePolicy
}

func (s *imageStylesPolicyServiceStub) CreatePolicy(context.Context, uint, *model.StoragePolicy) error {
	return nil
}

func (s *imageStylesPolicyServiceStub) GetPolicyByID(context.Context, string) (*model.StoragePolicy, error) {
	return s.policy, nil
}

func (s *imageStylesPolicyServiceStub) UpdatePolicy(_ context.Context, policy *model.StoragePolicy) error {
	s.saved = policy
	return nil
}

func (s *imageStylesPolicyServiceStub) DeletePolicy(context.Context, string) error {
	return nil
}

func (s *imageStylesPolicyServiceStub) ListPolicies(context.Context, int, int) ([]*model.StoragePolicy, int64, error) {
	return nil, 0, nil
}

func (s *imageStylesPolicyServiceStub) ListAll(context.Context) ([]*model.StoragePolicy, error) {
	return nil, nil
}

func (s *imageStylesPolicyServiceStub) GetPolicyByDatabaseID(context.Context, uint) (*model.StoragePolicy, error) {
	return nil, nil
}

func (s *imageStylesPolicyServiceStub) GenerateAuthURL(context.Context, string) (string, error) {
	return "", nil
}

func (s *imageStylesPolicyServiceStub) FinalizeAuth(context.Context, string, string) error {
	return nil
}

func TestPutImageStyles_PreservesAutoCompressFalseRotate(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &imageStylesPolicyServiceStub{
		policy: &model.StoragePolicy{
			ID:          7,
			Name:        "Local",
			Type:        constant.PolicyTypeLocal,
			BasePath:    "data/storage/local",
			VirtualPath: "/local",
			Settings: model.StoragePolicySettings{
				"keep": "yes",
			},
		},
	}
	handler := NewStoragePolicyHandler(svc)
	router := gin.New()
	router.PUT("/api/policies/:id/image-styles", handler.PutImageStyles)

	body := `{"image_process":{"enabled":true,"apply_to_extensions":["jpg"],"default_style":"","auto_compress":{"enabled":true,"quality":72,"format":"webp","max_width":1200,"auto_rotate":false}},"image_styles":[]}`
	req := httptest.NewRequest(http.MethodPut, "/api/policies/p1/image-styles", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("期望 200，实际 %d: %s", w.Code, w.Body.String())
	}
	if svc.saved == nil {
		t.Fatal("期望保存策略")
	}
	if svc.saved.Settings["keep"] != "yes" {
		t.Fatalf("非图片样式 settings 应保留，实际 %+v", svc.saved.Settings)
	}
	rawProcess, ok := svc.saved.Settings[constant.ImageProcessSettingsKey].(map[string]any)
	if !ok {
		t.Fatalf("image_process 应写回基础 map，实际 %T", svc.saved.Settings[constant.ImageProcessSettingsKey])
	}
	rawAuto, ok := rawProcess["auto_compress"].(map[string]any)
	if !ok {
		t.Fatalf("auto_compress 应写回基础 map，实际 %+v", rawProcess)
	}
	if rawAuto["auto_rotate"] != false {
		t.Fatalf("auto_rotate=false 应被保留，实际 %+v", rawAuto)
	}
}

func TestPutImageStyles_InvalidAutoCompress_ReturnsFieldError(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &imageStylesPolicyServiceStub{policy: &model.StoragePolicy{
		ID:          7,
		Type:        constant.PolicyTypeLocal,
		BasePath:    "data/storage/local",
		VirtualPath: "/local",
		Settings:    model.StoragePolicySettings{},
	}}
	handler := NewStoragePolicyHandler(svc)
	router := gin.New()
	router.PUT("/api/policies/:id/image-styles", handler.PutImageStyles)

	body := `{"image_process":{"enabled":true,"apply_to_extensions":["jpg"],"auto_compress":{"enabled":true,"quality":101,"format":"bmp"}},"image_styles":[]}`
	req := httptest.NewRequest(http.MethodPut, "/api/policies/p1/image-styles", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("期望 400，实际 %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "image_process.auto_compress.quality") {
		t.Fatalf("响应应包含 quality 字段错误，实际 %s", w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "image_process.auto_compress.format") {
		t.Fatalf("响应应包含 format 字段错误，实际 %s", w.Body.String())
	}
}

func TestGetImageStyles_ReturnsAutoCompress(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &imageStylesPolicyServiceStub{policy: &model.StoragePolicy{
		ID: 7,
		Settings: model.StoragePolicySettings{
			constant.ImageProcessSettingsKey: map[string]any{
				"enabled":             true,
				"apply_to_extensions": []string{"jpg"},
				"auto_compress": map[string]any{
					"enabled":     true,
					"quality":     80,
					"format":      "jpg",
					"auto_rotate": false,
				},
			},
			constant.ImageStylesSettingsKey: []any{},
		},
	}}
	handler := NewStoragePolicyHandler(svc)
	router := gin.New()
	router.GET("/api/policies/:id/image-styles", handler.GetImageStyles)

	req := httptest.NewRequest(http.MethodGet, "/api/policies/p1/image-styles", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("期望 200，实际 %d: %s", w.Code, w.Body.String())
	}

	var envelope struct {
		Data PolicyImageStylesPayload `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("响应 JSON 解析失败: %v", err)
	}
	if envelope.Data.ImageProcess.AutoCompress == nil || envelope.Data.ImageProcess.AutoCompress.AutoRotate == nil {
		t.Fatalf("auto_compress.auto_rotate 应返回，实际 %+v", envelope.Data.ImageProcess.AutoCompress)
	}
	if *envelope.Data.ImageProcess.AutoCompress.AutoRotate {
		t.Fatalf("auto_rotate=false 应被保留")
	}
}
