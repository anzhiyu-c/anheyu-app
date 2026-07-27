/*
 * @Description: /api/image handler 行为测试
 * @Author: 安知鱼
 */
package image

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/direct_link"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/image_style"
)

// --- stubs ---

type stubStyleService struct {
	result *image_style.StyleResult
	err    error
	calls  int
}

func (s *stubStyleService) Process(ctx context.Context, req *image_style.StyleRequest) (*image_style.StyleResult, error) {
	s.calls++
	return s.result, s.err
}
func (s *stubStyleService) ResolveUploadURLSuffix(policy *model.StoragePolicy, filename string) string {
	return ""
}
func (s *stubStyleService) PurgeCache(ctx context.Context, policyID uint, styleName string, fileID uint) (int, error) {
	return 0, nil
}
func (s *stubStyleService) Stats(ctx context.Context, policyID uint) (*image_style.CacheStats, error) {
	return &image_style.CacheStats{}, nil
}

// --- Phase 4 扩展接口的空实现（handler 测试无需覆盖这些方法）---

func (s *stubStyleService) ListAllStats(ctx context.Context) ([]image_style.CacheStats, error) {
	return nil, nil
}
func (s *stubStyleService) Preview(ctx context.Context, style model.ImageStyleConfig, src []byte) (*image_style.PreviewResult, error) {
	return nil, nil
}
func (s *stubStyleService) WarmCache(ctx context.Context, policyID uint, styleName string) (string, bool, error) {
	return "", false, nil
}
func (s *stubStyleService) GetWarmProgress(taskID string) (*image_style.WarmProgress, error) {
	return nil, nil
}
func (s *stubStyleService) CancelWarm(taskID string) bool { return false }

type stubFileFinder struct {
	file *model.File
	err  error
}

func (s *stubFileFinder) FindByID(ctx context.Context, id uint) (*model.File, error) {
	return s.file, s.err
}

type stubPolicyFinder struct {
	policy *model.StoragePolicy
	err    error
}

func (s *stubPolicyFinder) FindByID(ctx context.Context, id uint) (*model.StoragePolicy, error) {
	return s.policy, s.err
}

type stubDirectLink struct {
	redirectURL string
	err         error
}

func (s *stubDirectLink) GetOrCreateDirectLinks(ctx context.Context, userGroupID uint, fileIDs []uint) (map[uint]direct_link.BatchLinkResult, error) {
	if s.err != nil {
		return nil, s.err
	}
	return map[uint]direct_link.BatchLinkResult{
		fileIDs[0]: {URL: s.redirectURL},
	}, nil
}

// PrepareDownload 仅为满足 direct_link.Service 接口；本 handler 不会调用它。
func (s *stubDirectLink) PrepareDownload(ctx context.Context, publicID string) (*model.File, string, *model.StoragePolicy, int64, error) {
	return nil, "", nil, 0, errors.New("stub: not used")
}

// --- helpers ---

// encodePublicID 为 test 产生合法的 public ID；它会初始化 idgen encoder（若尚未初始化）。
func encodePublicID(t *testing.T, dbID uint) string {
	t.Helper()
	_ = idgen.InitSqidsEncoderWithSeed("test_seed_for_image_handler")
	pub, err := idgen.GeneratePublicID(dbID, idgen.EntityTypeFile)
	if err != nil {
		t.Fatalf("GeneratePublicID: %v", err)
	}
	return pub
}

func newTestHandler(svc image_style.ImageStyleService, dir direct_link.Service) *Handler {
	file := &model.File{
		ID:   42,
		Name: "a.jpg",
		PrimaryEntity: &model.FileStorageEntity{
			PolicyID: 7,
			Source:   sql.NullString{String: "/a.jpg", Valid: true},
		},
	}
	policy := &model.StoragePolicy{ID: 7, Type: constant.PolicyTypeLocal}
	return NewHandler(
		svc,
		&stubFileFinder{file: file},
		&stubPolicyFinder{policy: policy},
		dir,
	)
}

// --- 测试用例 ---

func TestServeStyled_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := []byte("FAKEJPEGBYTES")
	svc := &stubStyleService{
		result: &image_style.StyleResult{
			ContentType:  "image/jpeg",
			Reader:       io.NopCloser(bytes.NewReader(body)),
			Size:         int64(len(body)),
			StyleHash:    "abc12345",
			LastModified: time.Unix(1_600_000_000, 0),
		},
	}
	h := newTestHandler(svc, &stubDirectLink{})
	router := gin.New()
	router.GET("/api/image/*pathWithStyle", h.ServeStyled)

	req := httptest.NewRequest(http.MethodGet, "/api/image/"+encodePublicID(t, 42)+"!thumbnail", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("期望 200，实际 %d body=%s", rec.Code, rec.Body.String())
	}
	if rec.Header().Get("Content-Type") != "image/jpeg" {
		t.Errorf("Content-Type 期望 image/jpeg，实际 %s", rec.Header().Get("Content-Type"))
	}
	if rec.Header().Get("ETag") != `"abc12345"` {
		t.Errorf("ETag 期望 \"abc12345\"，实际 %s", rec.Header().Get("ETag"))
	}
	if !bytes.Equal(rec.Body.Bytes(), body) {
		t.Errorf("响应 body 不一致")
	}
	if cc := rec.Header().Get("Cache-Control"); cc != "public, max-age=604800" {
		t.Errorf("Cache-Control 期望 public, max-age=604800，实际 %s", cc)
	}
	if rec.Header().Get("Last-Modified") == "" {
		t.Errorf("Last-Modified 不应为空")
	}
}

func TestServeStyled_IfNoneMatch_Returns304(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &stubStyleService{
		result: &image_style.StyleResult{
			ContentType:  "image/jpeg",
			Reader:       io.NopCloser(bytes.NewReader([]byte("X"))),
			StyleHash:    "abc12345",
			LastModified: time.Unix(1_600_000_000, 0),
		},
	}
	h := newTestHandler(svc, &stubDirectLink{})
	router := gin.New()
	router.GET("/api/image/*pathWithStyle", h.ServeStyled)

	req := httptest.NewRequest(http.MethodGet, "/api/image/"+encodePublicID(t, 42)+"!thumbnail", nil)
	req.Header.Set("If-None-Match", `"abc12345"`)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotModified {
		t.Errorf("期望 304，实际 %d", rec.Code)
	}
	if rec.Body.Len() != 0 {
		t.Errorf("304 响应 body 应为空，实际 %d 字节", rec.Body.Len())
	}
	if got := rec.Header().Get("ETag"); got != `"abc12345"` {
		t.Errorf("304 ETag 期望 \"abc12345\"，实际 %q", got)
	}
	if got := rec.Header().Get("Cache-Control"); got != "public, max-age=604800" {
		t.Errorf("304 Cache-Control 期望 public, max-age=604800，实际 %q", got)
	}
	if got := rec.Header().Get("Last-Modified"); got == "" {
		t.Error("304 Last-Modified 不应为空")
	}
}

func TestServeStyled_NotApplicable_RedirectsToOriginal(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &stubStyleService{err: image_style.ErrStyleNotApplicable}
	dir := &stubDirectLink{redirectURL: "https://example.com/original.jpg"}
	h := newTestHandler(svc, dir)

	router := gin.New()
	router.GET("/api/image/*pathWithStyle", h.ServeStyled)

	req := httptest.NewRequest(http.MethodGet, "/api/image/"+encodePublicID(t, 42), nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusFound {
		t.Fatalf("期望 302，实际 %d", rec.Code)
	}
	if loc := rec.Header().Get("Location"); loc != "https://example.com/original.jpg" {
		t.Errorf("Location 错误，实际 %s", loc)
	}
}

func TestServeStyled_NotFound_Returns404(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &stubStyleService{err: image_style.ErrStyleNotFound}
	h := newTestHandler(svc, &stubDirectLink{})
	router := gin.New()
	router.GET("/api/image/*pathWithStyle", h.ServeStyled)

	req := httptest.NewRequest(http.MethodGet, "/api/image/"+encodePublicID(t, 42)+"!nope", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("期望 404，实际 %d", rec.Code)
	}
}

func TestServeStyled_ProcessFailed_RedirectsToOriginal(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &stubStyleService{err: image_style.ErrStyleProcessFailed}
	dir := &stubDirectLink{redirectURL: "https://example.com/original.jpg"}
	h := newTestHandler(svc, dir)

	router := gin.New()
	router.GET("/api/image/*pathWithStyle", h.ServeStyled)

	req := httptest.NewRequest(http.MethodGet, "/api/image/"+encodePublicID(t, 42)+"!thumbnail", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusFound {
		t.Errorf("处理失败应 302 fallback；实际 %d", rec.Code)
	}
}

func TestServeStyled_InvalidPublicID_Returns400(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &stubStyleService{}
	h := newTestHandler(svc, &stubDirectLink{})
	router := gin.New()
	router.GET("/api/image/*pathWithStyle", h.ServeStyled)

	req := httptest.NewRequest(http.MethodGet, "/api/image/???", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("期望 400，实际 %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestServeStyled_FileNotFound_Returns404(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h := NewHandler(
		&stubStyleService{},
		&stubFileFinder{err: errors.New("not found")},
		&stubPolicyFinder{},
		&stubDirectLink{},
	)
	router := gin.New()
	router.GET("/api/image/*pathWithStyle", h.ServeStyled)

	req := httptest.NewRequest(http.MethodGet, "/api/image/"+encodePublicID(t, 42)+"!thumbnail", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("期望 404，实际 %d", rec.Code)
	}
}

// TestServeStyled_DegradedFormat_SetsXStyleFallback 验证：
// 当请求 avif 但实际输出 jpeg 时，响应头应包含 X-Style-Fallback（Spec §6.3.3）。
func TestServeStyled_DegradedFormat_SetsXStyleFallback(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := []byte("FAKEJPEG")
	svc := &stubStyleService{
		result: &image_style.StyleResult{
			ContentType:     "image/jpeg", // 实际输出 jpeg
			Reader:          io.NopCloser(bytes.NewReader(body)),
			Size:            int64(len(body)),
			StyleHash:       "deadbeef",
			RequestedFormat: "avif", // 用户原始请求 avif
		},
	}
	h := newTestHandler(svc, &stubDirectLink{})
	router := gin.New()
	router.GET("/api/image/*pathWithStyle", h.ServeStyled)

	req := httptest.NewRequest(http.MethodGet, "/api/image/"+encodePublicID(t, 42)+"!avif-style", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("期望 200，实际 %d body=%s", rec.Code, rec.Body.String())
	}
	fb := rec.Header().Get("X-Style-Fallback")
	if fb != "avif->jpg" {
		t.Errorf("X-Style-Fallback 期望 'avif->jpg'，实际 %q", fb)
	}
}

// TestServeStyled_NoDegradation_NoFallbackHeader 验证：
// 请求 webp 且实际输出 webp 时，不写 X-Style-Fallback 响应头。
func TestServeStyled_NoDegradation_NoFallbackHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &stubStyleService{
		result: &image_style.StyleResult{
			ContentType:     "image/webp",
			Reader:          io.NopCloser(bytes.NewReader([]byte("W"))),
			Size:            1,
			StyleHash:       "cafe",
			RequestedFormat: "webp",
		},
	}
	h := newTestHandler(svc, &stubDirectLink{})
	router := gin.New()
	router.GET("/api/image/*pathWithStyle", h.ServeStyled)

	req := httptest.NewRequest(http.MethodGet, "/api/image/"+encodePublicID(t, 42)+"!ok", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("期望 200，实际 %d", rec.Code)
	}
	if fb := rec.Header().Get("X-Style-Fallback"); fb != "" {
		t.Errorf("实际输出匹配请求格式时不应设 X-Style-Fallback，实际 %q", fb)
	}
}

// TestServeStyled_JpegVsJpgNotTreatedAsFallback 验证：
// "jpg" 请求与 "image/jpeg" 输出是同一种格式，不应误判为降级。
func TestServeStyled_JpegVsJpgNotTreatedAsFallback(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &stubStyleService{
		result: &image_style.StyleResult{
			ContentType:     "image/jpeg",
			Reader:          io.NopCloser(bytes.NewReader([]byte("J"))),
			Size:            1,
			StyleHash:       "ha",
			RequestedFormat: "jpg",
		},
	}
	h := newTestHandler(svc, &stubDirectLink{})
	router := gin.New()
	router.GET("/api/image/*pathWithStyle", h.ServeStyled)

	req := httptest.NewRequest(http.MethodGet, "/api/image/"+encodePublicID(t, 42)+"!jpg", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if fb := rec.Header().Get("X-Style-Fallback"); fb != "" {
		t.Errorf("jpg vs jpeg 属同一格式；不应触发 X-Style-Fallback，实际 %q", fb)
	}
}

// TestServeStyled_OriginalFormat_NoFallbackHeader 验证：
// RequestedFormat 为 "original" / "" 时永远不写 X-Style-Fallback。
func TestServeStyled_OriginalFormat_NoFallbackHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)

	for _, req := range []string{"", "original"} {
		svc := &stubStyleService{
			result: &image_style.StyleResult{
				ContentType:     "image/jpeg",
				Reader:          io.NopCloser(bytes.NewReader([]byte("O"))),
				Size:            1,
				StyleHash:       "orig",
				RequestedFormat: req,
			},
		}
		h := newTestHandler(svc, &stubDirectLink{})
		router := gin.New()
		router.GET("/api/image/*pathWithStyle", h.ServeStyled)

		httpReq := httptest.NewRequest(http.MethodGet, "/api/image/"+encodePublicID(t, 42), nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httpReq)

		if fb := rec.Header().Get("X-Style-Fallback"); fb != "" {
			t.Errorf("RequestedFormat=%q 时不应设 X-Style-Fallback，实际 %q", req, fb)
		}
	}
}

func TestSplitPublicIDAndStyle(t *testing.T) {
	cases := []struct {
		in, id, style string
	}{
		{"abc", "abc", ""},
		{"abc!thumb", "abc", "thumb"},
		{"abc/thumb", "abc", "thumb"},
		{"abc!thumb/ignored", "abc", "thumb/ignored"}, // "!" 优先
		{"", "", ""},
	}
	for _, c := range cases {
		id, style := splitPublicIDAndStyle(c.in)
		if id != c.id || style != c.style {
			t.Errorf("splitPublicIDAndStyle(%q)=(%q,%q), want=(%q,%q)", c.in, id, style, c.id, c.style)
		}
	}
}
