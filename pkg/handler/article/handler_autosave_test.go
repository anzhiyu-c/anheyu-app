package article

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/auth"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	articleSvc "github.com/anzhiyu-c/anheyu-app/pkg/service/article"
	"github.com/gin-gonic/gin"
)

type failingArticleService struct {
	articleSvc.Service
	err error
}

func (s failingArticleService) Create(
	context.Context,
	*model.CreateArticleRequest,
	string,
	string,
) (*model.ArticleResponse, error) {
	return nil, s.err
}

func (s failingArticleService) CreateWithOptions(
	context.Context,
	*model.CreateArticleRequest,
	string,
	string,
	articleSvc.CreateOptions,
) (*model.ArticleResponse, error) {
	return nil, s.err
}

func (s failingArticleService) Update(
	context.Context,
	string,
	*model.UpdateArticleRequest,
	string,
	string,
) (*model.ArticleResponse, error) {
	return nil, s.err
}

func newArticleHandlerTestContext(t *testing.T, method, target, body string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, target, bytes.NewBufferString(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set(auth.ClaimsKey, &auth.CustomClaims{UserID: "test-user"})
	return ctx, recorder
}

func TestCreateMapsArticleBusinessErrors(t *testing.T) {
	tests := []struct {
		name       string
		serviceErr error
		wantStatus int
	}{
		{name: "bad request", serviceErr: fmtWrap(constant.ErrBadRequest, "发布文章必须填写标题"), wantStatus: http.StatusBadRequest},
		{name: "not found", serviceErr: fmtWrap(constant.ErrNotFound, "文章不存在"), wantStatus: http.StatusNotFound},
		{name: "conflict", serviceErr: fmtWrap(constant.ErrConflict, "幂等键冲突"), wantStatus: http.StatusConflict},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx, recorder := newArticleHandlerTestContext(t, http.MethodPost, "/api/articles", `{"status":"PUBLISHED"}`)
			NewHandler(failingArticleService{err: tt.serviceErr}).Create(ctx)

			if recorder.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d; body = %s", recorder.Code, tt.wantStatus, recorder.Body.String())
			}
		})
	}
}

func TestUpdateMapsArticleBusinessErrors(t *testing.T) {
	tests := []struct {
		name       string
		serviceErr error
		wantStatus int
	}{
		{name: "bad request", serviceErr: fmtWrap(constant.ErrBadRequest, "发布文章必须填写标题"), wantStatus: http.StatusBadRequest},
		{name: "not found", serviceErr: fmtWrap(constant.ErrNotFound, "文章不存在"), wantStatus: http.StatusNotFound},
		{name: "conflict", serviceErr: fmtWrap(constant.ErrConflict, "文章状态冲突"), wantStatus: http.StatusConflict},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx, recorder := newArticleHandlerTestContext(t, http.MethodPut, "/api/articles/article-id", `{"status":"PUBLISHED"}`)
			ctx.Params = gin.Params{{Key: "id", Value: "article-id"}}
			NewHandler(failingArticleService{err: tt.serviceErr}).Update(ctx)

			if recorder.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d; body = %s", recorder.Code, tt.wantStatus, recorder.Body.String())
			}
		})
	}
}

type capturingArticleService struct {
	articleSvc.Service
	options *articleSvc.CreateOptions
}

func (s *capturingArticleService) CreateWithOptions(
	_ context.Context,
	_ *model.CreateArticleRequest,
	_, _ string,
	options articleSvc.CreateOptions,
) (*model.ArticleResponse, error) {
	s.options = &options
	if strings.TrimSpace(options.IdempotencyKey) == "" && options.IdempotencyKeyPresent {
		return nil, fmtWrap(constant.ErrBadRequest, "Idempotency-Key 不能为空")
	}
	return &model.ArticleResponse{ID: "article-id", Status: "DRAFT"}, nil
}

func TestCreatePassesIdempotencyHeaderWithAuthenticatedUserScope(t *testing.T) {
	ctx, recorder := newArticleHandlerTestContext(t, http.MethodPost, "/api/articles", `{"status":"DRAFT"}`)
	ctx.Request.Header.Set("Idempotency-Key", "autosave-key")
	svc := &capturingArticleService{}

	NewHandler(svc).Create(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body = %s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	if svc.options == nil {
		t.Fatal("CreateWithOptions() was not called")
	}
	if svc.options.ActorUserID != "test-user" {
		t.Fatalf("ActorUserID = %q, want %q", svc.options.ActorUserID, "test-user")
	}
	if svc.options.IdempotencyKey != "autosave-key" || !svc.options.IdempotencyKeyPresent {
		t.Fatalf("idempotency options = %+v, want the supplied header", *svc.options)
	}
}

func TestCreateRejectsRepeatedIdempotencyHeader(t *testing.T) {
	ctx, recorder := newArticleHandlerTestContext(t, http.MethodPost, "/api/articles", `{"status":"DRAFT"}`)
	ctx.Request.Header.Add("Idempotency-Key", "first")
	ctx.Request.Header.Add("Idempotency-Key", "second")
	svc := &capturingArticleService{}

	NewHandler(svc).Create(ctx)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d; body = %s", recorder.Code, http.StatusBadRequest, recorder.Body.String())
	}
	if svc.options != nil {
		t.Fatal("CreateWithOptions() was called for repeated Idempotency-Key headers")
	}
}

func fmtWrap(base error, message string) error {
	return errors.Join(base, errors.New(message))
}
