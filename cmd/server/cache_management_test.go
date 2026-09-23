package server

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/internal/app/middleware"
	internal_auth "github.com/anzhiyu-c/anheyu-app/internal/pkg/auth"
	cache_service "github.com/anzhiyu-c/anheyu-app/internal/service/cache"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	cache_handler "github.com/anzhiyu-c/anheyu-app/pkg/handler/cache"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/auth"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/image_style"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/search"
	"github.com/gin-gonic/gin"
)

type cacheTokenService struct {
	auth.TokenService
	claims map[string]*internal_auth.CustomClaims
}

func (s *cacheTokenService) ParseAccessToken(_ context.Context, token string) (*internal_auth.CustomClaims, error) {
	if claims, ok := s.claims[token]; ok {
		return claims, nil
	}
	return nil, errors.New("invalid token")
}

func TestCacheRoutesRequireAdministrator(t *testing.T) {
	if err := idgen.InitSqidsEncoderWithSeed("cache_routes_test"); err != nil {
		t.Fatal(err)
	}
	adminGroup, err := idgen.GeneratePublicID(1, idgen.EntityTypeUserGroup)
	if err != nil {
		t.Fatal(err)
	}
	userGroup, err := idgen.GeneratePublicID(2, idgen.EntityTypeUserGroup)
	if err != nil {
		t.Fatal(err)
	}
	tokens := &cacheTokenService{claims: map[string]*internal_auth.CustomClaims{
		"admin": {UserGroupID: adminGroup}, "user": {UserGroupID: userGroup},
	}}
	var calls int
	handler := cache_handler.NewHandler(cache_service.NewRevalidateService())
	handler.Configure(nil, map[string]func(context.Context) error{"index": func(context.Context) error { calls++; return nil }})
	router := gin.New()
	registerCacheManagementRoutes(router, middleware.NewMiddleware(tokens), handler)
	for _, route := range []struct{ method, path string }{{http.MethodGet, "/status"}, {http.MethodPost, "/revalidate"}, {http.MethodPost, "/manage"}} {
		for _, token := range []string{"", "invalid", "user"} {
			request := httptest.NewRequest(route.method, "/api/admin/cache"+route.path, strings.NewReader(`{"type":"index"}`))
			request.Header.Set("Content-Type", "application/json")
			if token != "" {
				request.Header.Set("Authorization", "Bearer "+token)
			}
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, request)
			want := http.StatusUnauthorized
			if token == "user" {
				want = http.StatusForbidden
			}
			if recorder.Code != want {
				t.Fatalf("route=%s token=%q status=%d want=%d", route.path, token, recorder.Code, want)
			}
		}
	}
	if calls != 0 {
		t.Fatalf("unauthorized actions=%d", calls)
	}
	request := httptest.NewRequest(http.MethodPost, "/api/admin/cache/manage", strings.NewReader(`{"type":"index"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer admin")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK || calls != 1 {
		t.Fatalf("admin status=%d calls=%d", recorder.Code, calls)
	}
}

type cacheArticleRepo struct {
	repository.ArticleRepository
	pages    [][]*model.Article
	readErr  error
	failPage int
	options  []model.ListArticlesOptions
}

func (r *cacheArticleRepo) List(ctx context.Context, options *model.ListArticlesOptions) ([]*model.Article, int, error) {
	r.options = append(r.options, *options)
	if options.Page == r.failPage {
		return nil, 0, r.readErr
	}
	if options.Page > len(r.pages) {
		return nil, 0, nil
	}
	return r.pages[options.Page-1], 0, nil
}

type cacheTestIndexer struct {
	model.Searcher
	clears   int
	clearErr error
	indexErr error
	indexed  []*model.Article
}

func (s *cacheTestIndexer) ClearAllDocuments(context.Context) error {
	s.clears++
	return s.clearErr
}

func (s *cacheTestIndexer) IndexArticle(_ context.Context, article *model.Article) error {
	if s.indexErr != nil {
		return s.indexErr
	}
	s.indexed = append(s.indexed, article)
	return nil
}

func cacheManageRequest(handler *cache_handler.Handler, kind string) *httptest.ResponseRecorder {
	router := gin.New()
	router.POST("/manage", handler.Manage)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/manage", strings.NewReader(fmt.Sprintf(`{"type":%q}`, kind)))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)
	return recorder
}

func useCacheTestIndexer(t *testing.T, indexer model.Searcher) {
	t.Helper()
	old := search.AppSearcher
	search.AppSearcher = indexer
	t.Cleanup(func() { search.AppSearcher = old })
}

func TestCacheIndexRebuildExcludesNonPublicArticles(t *testing.T) {
	indexer := &cacheTestIndexer{}
	useCacheTestIndexer(t, indexer)
	repo := &cacheArticleRepo{pages: [][]*model.Article{{
		{ID: "public", Status: "PUBLISHED", ReviewStatus: "NONE", ContentHTML: "public content"},
		{ID: "approved-doc", Status: "PUBLISHED", ReviewStatus: "APPROVED", IsDoc: true},
		{ID: "draft", Status: "DRAFT", ReviewStatus: "NONE", ContentHTML: "draft secret"},
		{ID: "scheduled", Status: "SCHEDULED", ReviewStatus: "NONE"},
		{ID: "archived", Status: "ARCHIVED", ReviewStatus: "NONE"},
		{ID: "pending", Status: "PUBLISHED", ReviewStatus: "PENDING"},
		{ID: "rejected", Status: "PUBLISHED", ReviewStatus: "REJECTED"},
		{ID: "unknown-review", Status: "PUBLISHED"},
		{ID: "taken-down", Status: "PUBLISHED", ReviewStatus: "APPROVED", IsTakedown: true},
	}}}
	response := cacheManageRequest(newCacheManagement(nil, nil, repo, nil), "index")
	if response.Code != http.StatusOK {
		t.Fatalf("response = %d %s", response.Code, response.Body.String())
	}
	if len(indexer.indexed) != 2 || indexer.indexed[0].ID != "public" || indexer.indexed[1].ID != "approved-doc" {
		t.Fatalf("indexed %d articles, want only public and approved-doc", len(indexer.indexed))
	}
	if len(repo.options) != 1 || repo.options[0].Status != "PUBLISHED" {
		t.Fatalf("source query must restrict published status: %+v", repo.options)
	}
}

func TestCacheIndexRebuildReadFailurePreservesExistingIndex(t *testing.T) {
	indexer := &cacheTestIndexer{}
	useCacheTestIndexer(t, indexer)
	batch := make([]*model.Article, 200)
	for i := range batch {
		batch[i] = &model.Article{ID: fmt.Sprint(i), Status: "PUBLISHED", ReviewStatus: "NONE"}
	}
	repo := &cacheArticleRepo{pages: [][]*model.Article{batch}, failPage: 2, readErr: errors.New("database unavailable")}
	response := cacheManageRequest(newCacheManagement(nil, nil, repo, nil), "index")
	if response.Code != http.StatusInternalServerError || indexer.clears != 0 || len(indexer.indexed) != 0 {
		t.Fatalf("response=%d clears=%d indexed=%d", response.Code, indexer.clears, len(indexer.indexed))
	}
}

func TestCacheIndexRebuildPropagatesIndexFailures(t *testing.T) {
	for _, operation := range []string{"clear", "index"} {
		t.Run(operation, func(t *testing.T) {
			indexer := &cacheTestIndexer{}
			if operation == "clear" {
				indexer.clearErr = errors.New("clear failed")
			} else {
				indexer.indexErr = errors.New("index failed")
			}
			useCacheTestIndexer(t, indexer)
			repo := &cacheArticleRepo{pages: [][]*model.Article{{{ID: "public", Status: "PUBLISHED", ReviewStatus: "NONE"}}}}
			response := cacheManageRequest(newCacheManagement(nil, nil, repo, nil), "index")
			if response.Code != http.StatusInternalServerError || !strings.Contains(response.Body.String(), operation+" failed") {
				t.Fatalf("response=%d %s", response.Code, response.Body.String())
			}
		})
	}
}

func TestCacheImagePurgeRetainsOriginalAndUntrackedFiles(t *testing.T) {
	root := t.TempDir()
	original := filepath.Join(root, "original.png")
	cacheRoot := filepath.Join(root, "derived")
	if err := os.WriteFile(original, []byte("original bytes"), 0o600); err != nil {
		t.Fatal(err)
	}
	images, err := image_style.NewDiskCache(image_style.CacheConfig{Root: cacheRoot})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := images.Close(); err != nil {
			t.Error(err)
		}
	})
	unknown := filepath.Join(cacheRoot, "untracked.txt")
	if err := os.WriteFile(unknown, []byte("untracked bytes"), 0o600); err != nil {
		t.Fatal(err)
	}
	entry, err := images.Put(context.Background(), 1, 2, "style-hash", "image/png", "png", []byte("derived bytes"))
	if err != nil {
		t.Fatal(err)
	}
	response := cacheManageRequest(newCacheManagement(nil, images, nil, nil), "image")
	if response.Code != http.StatusOK {
		t.Fatalf("response=%d %s", response.Code, response.Body.String())
	}
	for _, path := range []string{original, unknown} {
		if _, err := os.Stat(path); err != nil {
			t.Fatalf("preserved file %s: %v", path, err)
		}
	}
	if _, err := os.Stat(entry.Path); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("derived file was not removed: %v", err)
	}
}

func TestCacheIndexProjectionFailurePreservesExistingIndex(t *testing.T) {
	indexer := &cacheTestIndexer{}
	useCacheTestIndexer(t, indexer)
	repo := &cacheArticleRepo{pages: [][]*model.Article{{{ID: "public", Status: "PUBLISHED", ReviewStatus: "NONE", ContentHTML: "secret"}}}}
	projection := func(context.Context, *model.Article) (*model.Article, error) {
		return nil, errors.New("protection lookup failed")
	}
	response := cacheManageRequest(newCacheManagement(nil, nil, repo, projection), "index")
	if response.Code != http.StatusInternalServerError || indexer.clears != 0 {
		t.Fatalf("response=%d clears=%d", response.Code, indexer.clears)
	}
}

func TestCacheIndexUsesProjectedContent(t *testing.T) {
	indexer := &cacheTestIndexer{}
	useCacheTestIndexer(t, indexer)
	source := &model.Article{ID: "public", Title: "public title", Status: "PUBLISHED", ReviewStatus: "NONE", ContentHTML: "secret"}
	repo := &cacheArticleRepo{pages: [][]*model.Article{{source}}}
	projection := func(_ context.Context, article *model.Article) (*model.Article, error) {
		return &model.Article{ID: article.ID, Title: article.Title}, nil
	}
	response := cacheManageRequest(newCacheManagement(nil, nil, repo, projection), "index")
	if response.Code != http.StatusOK || len(indexer.indexed) != 1 || indexer.indexed[0].ContentHTML != "" || source.ContentHTML != "secret" {
		t.Fatalf("projection not respected: response=%d indexed=%+v source=%+v", response.Code, indexer.indexed, source)
	}
}
