/*
 * @Description: 直链 handler 样式解析工具测试
 * @Author: 安知鱼
 *
 * 聚焦 extractLocalStyleName / isValidStyleName 两个纯函数的边界行为；
 * serveStyledLocal 依赖 gin.Context 与 ImageStyleService，留给上层集成测试覆盖。
 */
package direct_link

import (
	"bytes"
	"context"
	"database/sql"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/anzhiyu-c/anheyu-app/internal/infra/storage"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	directlinksvc "github.com/anzhiyu-c/anheyu-app/pkg/service/direct_link"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/image_style"
)

type recordingStyleService struct {
	image_style.ImageStyleService
	result *image_style.StyleResult
	err    error
	req    *image_style.StyleRequest
}

func (s *recordingStyleService) Process(_ context.Context, req *image_style.StyleRequest) (*image_style.StyleResult, error) {
	s.req = req
	return s.result, s.err
}

type preparedDirectLinkService struct {
	directlinksvc.Service
	file       *model.File
	filename   string
	policy     *model.StoragePolicy
	speedLimit int64
	prepareErr error
}

func (s *preparedDirectLinkService) PrepareDownload(context.Context, string) (*model.File, string, *model.StoragePolicy, int64, error) {
	return s.file, s.filename, s.policy, s.speedLimit, s.prepareErr
}

type streamingStorageProvider struct {
	storage.IStorageProvider
	body        []byte
	streamCalls int
}

func (p *streamingStorageProvider) Stream(_ context.Context, _ *model.StoragePolicy, _ string, w io.Writer) error {
	p.streamCalls++
	_, err := w.Write(p.body)
	return err
}

func newDirectLinkHandlerForStyleTest(
	styleSvc image_style.ImageStyleService,
	provider storage.IStorageProvider,
) *DirectLinkHandler {
	file := &model.File{
		ID:   42,
		Name: "a.jpg",
		Size: 8,
		PrimaryEntity: &model.FileStorageEntity{
			Source:   sql.NullString{String: "/a.jpg", Valid: true},
			MimeType: sql.NullString{String: "image/jpeg", Valid: true},
		},
	}
	policy := &model.StoragePolicy{ID: 7, Type: constant.PolicyTypeLocal}
	h := NewDirectLinkHandler(
		&preparedDirectLinkService{file: file, filename: file.Name, policy: policy},
		map[constant.StoragePolicyType]storage.IStorageProvider{constant.PolicyTypeLocal: provider},
	)
	h.SetImageStyleService(styleSvc)
	return h
}

func TestIsValidStyleName(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want bool
	}{
		{"空字符串", "", false},
		{"单字符合法", "a", true},
		{"数字开头合法", "9thumb", true},
		{"下划线合法", "foo_bar", true},
		{"连字符合法", "foo-bar", true},
		{"混合合法", "ABC_abc-123", true},
		{"32 位边界合法", "abcdefghijklmnopqrstuvwxyz012345", true}, // 32 chars
		{"超长非法", "abcdefghijklmnopqrstuvwxyz0123456", false},   // 33 chars
		{"空格非法", "foo bar", false},
		{"点号非法", "foo.bar", false},
		{"斜杠非法", "foo/bar", false},
		{"感叹号非法", "!foo", false},
		{"查询字符非法", "foo?bar", false},
		{"中文非法", "缩略图", false},
		{"HTML 注入字符", "<script>", false},
	}
	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			got := isValidStyleName(tc.in)
			if got != tc.want {
				t.Fatalf("isValidStyleName(%q) = %v, 期望 %v", tc.in, got, tc.want)
			}
		})
	}
}

func TestExtractLocalStyleName(t *testing.T) {
	tests := []struct {
		name     string
		fullPath string
		filename string
		want     string
	}{
		// 基础命中
		{
			name:     "标准命中",
			fullPath: "/1776843958024851004.jpg!thumbnail",
			filename: "1776843958024851004.jpg",
			want:     "thumbnail",
		},
		{
			name:     "开头无斜杠",
			fullPath: "foo.png!thumbnail",
			filename: "foo.png",
			want:     "thumbnail",
		},
		{
			name:     "样式名含连字符",
			fullPath: "/foo.png!thumb-1",
			filename: "foo.png",
			want:     "thumb-1",
		},
		{
			name:     "样式名含下划线",
			fullPath: "/foo.png!thumb_x",
			filename: "foo.png",
			want:     "thumb_x",
		},

		// 无样式（回退原图）
		{
			name:     "路径无感叹号",
			fullPath: "/foo.jpg",
			filename: "foo.jpg",
			want:     "",
		},
		{
			name:     "filename 不匹配前缀",
			fullPath: "/other.jpg!thumb",
			filename: "foo.jpg",
			want:     "",
		},
		{
			name:     "空路径",
			fullPath: "",
			filename: "foo.jpg",
			want:     "",
		},
		{
			name:     "空 filename",
			fullPath: "/foo.jpg!thumb",
			filename: "",
			want:     "",
		},

		// 样式名非法 → 视为无样式，交由调用方降级
		{
			name:     "样式名含空格非法",
			fullPath: "/foo.jpg!thumb x",
			filename: "foo.jpg",
			want:     "",
		},
		{
			name:     "样式名含 HTML 非法",
			fullPath: "/foo.jpg!<script>",
			filename: "foo.jpg",
			want:     "",
		},
		{
			name:     "样式名以斜杠包含 (路径遍历)",
			fullPath: "/foo.jpg!../etc/passwd",
			filename: "foo.jpg",
			want:     "",
		},
		{
			name:     "样式名空 (仅尾感叹号)",
			fullPath: "/foo.jpg!",
			filename: "foo.jpg",
			want:     "",
		},
		{
			name:     "样式名超长",
			fullPath: "/foo.jpg!abcdefghijklmnopqrstuvwxyz0123456", // 33 chars
			filename: "foo.jpg",
			want:     "",
		},

		// filename 本身含感叹号（罕见但允许）
		{
			name:     "filename 含感叹号无样式",
			fullPath: "/foo!bar.jpg",
			filename: "foo!bar.jpg",
			want:     "",
		},
		{
			name:     "filename 含感叹号加样式",
			fullPath: "/foo!bar.jpg!thumbnail",
			filename: "foo!bar.jpg",
			want:     "thumbnail",
		},

		// 连续感叹号 → 第一个 `!` 后面的部分会被判为非法（因包含 `!`）
		{
			name:     "连续感叹号非法",
			fullPath: "/foo.jpg!!thumbnail",
			filename: "foo.jpg",
			want:     "",
		},
	}
	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			got := extractLocalStyleName(tc.fullPath, tc.filename)
			if got != tc.want {
				t.Fatalf("extractLocalStyleName(%q, %q) = %q, 期望 %q",
					tc.fullPath, tc.filename, got, tc.want)
			}
		})
	}
}

func TestHandleDirectDownload_NoStyleUsesImageStyleService(t *testing.T) {
	gin.SetMode(gin.TestMode)
	styledBody := []byte("COMPRESSED")
	styleSvc := &recordingStyleService{
		result: &image_style.StyleResult{
			ContentType:  "image/jpeg",
			Reader:       io.NopCloser(bytes.NewReader(styledBody)),
			Size:         int64(len(styledBody)),
			StyleHash:    "style-source-v1",
			LastModified: time.Unix(1_700_000_000, 0),
		},
	}
	provider := &streamingStorageProvider{body: []byte("ORIGINAL")}
	h := newDirectLinkHandlerForStyleTest(styleSvc, provider)
	router := gin.New()
	router.GET("/api/f/:link/*filename", h.HandleDirectDownload)

	req := httptest.NewRequest(http.MethodGet, "/api/f/public/a.jpg", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("期望 200，实际 %d body=%s", rec.Code, rec.Body.String())
	}
	if !bytes.Equal(rec.Body.Bytes(), styledBody) {
		t.Fatalf("无样式直链应返回压缩结果，实际 %q", rec.Body.Bytes())
	}
	if styleSvc.req == nil {
		t.Fatal("无样式直链必须调用 ImageStyleService")
	}
	if styleSvc.req.StyleName != "" {
		t.Fatalf("无样式直链传入的 StyleName 应为空，实际 %q", styleSvc.req.StyleName)
	}
	if provider.streamCalls != 0 {
		t.Fatalf("压缩成功时不应读取原图流，实际 %d 次", provider.streamCalls)
	}
}

func TestHandleDirectDownload_IfNoneMatchPreservesValidators(t *testing.T) {
	gin.SetMode(gin.TestMode)
	styleSvc := &recordingStyleService{
		result: &image_style.StyleResult{
			ContentType:  "image/jpeg",
			Reader:       io.NopCloser(bytes.NewReader([]byte("COMPRESSED"))),
			StyleHash:    "style-source-v1",
			LastModified: time.Unix(1_700_000_000, 0),
		},
	}
	h := newDirectLinkHandlerForStyleTest(styleSvc, &streamingStorageProvider{})
	router := gin.New()
	router.GET("/api/f/:link/*filename", h.HandleDirectDownload)

	req := httptest.NewRequest(http.MethodGet, "/api/f/public/a.jpg", nil)
	req.Header.Set("If-None-Match", `"style-source-v1"`)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotModified {
		t.Fatalf("期望 304，实际 %d", rec.Code)
	}
	if got := rec.Header().Get("ETag"); got != `"style-source-v1"` {
		t.Fatalf("304 ETag 期望 \"style-source-v1\"，实际 %q", got)
	}
	if got := rec.Header().Get("Cache-Control"); got != "public, max-age=604800" {
		t.Fatalf("304 Cache-Control 期望 public, max-age=604800，实际 %q", got)
	}
	if got := rec.Header().Get("Last-Modified"); got == "" {
		t.Fatal("304 Last-Modified 不应为空")
	}
}

func TestHandleDirectDownload_AutoCompressFailureFallsBackToOriginal(t *testing.T) {
	gin.SetMode(gin.TestMode)
	styleSvc := &recordingStyleService{err: image_style.ErrStyleProcessFailed}
	originalBody := []byte("ORIGINAL")
	provider := &streamingStorageProvider{body: originalBody}
	h := newDirectLinkHandlerForStyleTest(styleSvc, provider)
	router := gin.New()
	router.GET("/api/f/:link/*filename", h.HandleDirectDownload)

	req := httptest.NewRequest(http.MethodGet, "/api/f/public/a.jpg", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("期望回退原图并返回 200，实际 %d", rec.Code)
	}
	if !bytes.Equal(rec.Body.Bytes(), originalBody) {
		t.Fatalf("处理失败应回退原图，实际 %q", rec.Body.Bytes())
	}
	if provider.streamCalls != 1 {
		t.Fatalf("处理失败应读取一次原图流，实际 %d 次", provider.streamCalls)
	}
}
