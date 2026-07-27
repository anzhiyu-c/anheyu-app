package article

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/event"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	appParser "github.com/anzhiyu-c/anheyu-app/pkg/service/parser"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"
)

type idempotencyArticleRecord struct {
	article *model.Article
	digest  string
}

type idempotencyArticleRepo struct {
	repository.ArticleRepository
	mu          sync.Mutex
	byKey       map[string]idempotencyArticleRecord
	createCalls int

	forceConcurrentPreflight bool
	preflightCount           int
	preflightBarrier         chan struct{}
}

func newIdempotencyArticleRepo() *idempotencyArticleRepo {
	return &idempotencyArticleRepo{byKey: make(map[string]idempotencyArticleRecord)}
}

func (r *idempotencyArticleRepo) FindByCreateIdempotencyKey(
	_ context.Context,
	key string,
) (*model.Article, string, error) {
	r.mu.Lock()
	record, ok := r.byKey[key]
	if ok {
		articleCopy := *record.article
		r.mu.Unlock()
		return &articleCopy, record.digest, nil
	}
	if r.forceConcurrentPreflight && r.preflightCount < 2 {
		r.preflightCount++
		if r.preflightCount == 2 {
			close(r.preflightBarrier)
		}
		barrier := r.preflightBarrier
		r.mu.Unlock()
		<-barrier
		return nil, "", nil
	}
	r.mu.Unlock()
	return nil, "", nil
}

func (r *idempotencyArticleRepo) Create(
	_ context.Context,
	params *model.CreateArticleParams,
) (*model.Article, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.createCalls++
	if params.CreateIdempotencyKey != "" {
		if _, exists := r.byKey[params.CreateIdempotencyKey]; exists {
			return nil, fmt.Errorf("%w: duplicate create idempotency key", constant.ErrConflict)
		}
	}
	created := &model.Article{
		ID:      fmt.Sprintf("article-%d", r.createCalls),
		OwnerID: params.OwnerID,
		Title:   params.Title,
		Status:  params.Status,
	}
	if params.CreateIdempotencyKey != "" {
		r.byKey[params.CreateIdempotencyKey] = idempotencyArticleRecord{
			article: created,
			digest:  params.CreateRequestDigest,
		}
	}
	return created, nil
}

func (r *idempotencyArticleRepo) GetSiteStats(context.Context) (*model.SiteStats, error) {
	return &model.SiteStats{}, nil
}

type idempotencyPostTagRepo struct {
	repository.PostTagRepository
}

func (idempotencyPostTagRepo) UpdateCount(context.Context, []uint, []uint) error {
	return nil
}

type idempotencyPostCategoryRepo struct {
	repository.PostCategoryRepository
}

func (idempotencyPostCategoryRepo) UpdateCount(context.Context, []uint, []uint) error {
	return nil
}

type idempotencyTransactionManager struct {
	mu       sync.Mutex
	calls    int
	articles repository.ArticleRepository
}

func (m *idempotencyTransactionManager) Do(ctx context.Context, fn func(repository.Repositories) error) error {
	m.mu.Lock()
	m.calls++
	m.mu.Unlock()
	return fn(repository.Repositories{
		Article:      m.articles,
		PostTag:      idempotencyPostTagRepo{},
		PostCategory: idempotencyPostCategoryRepo{},
	})
}

func (m *idempotencyTransactionManager) callCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.calls
}

type idempotencyCacheService struct {
	utility.CacheService
}

func (idempotencyCacheService) Delete(context.Context, ...string) error {
	return nil
}

type idempotencySettingService struct {
	setting.SettingService
}

func (idempotencySettingService) Get(string) string {
	return ""
}

func (idempotencySettingService) UpdateSettings(context.Context, map[string]string) error {
	return nil
}

func newIdempotencyArticleService(t *testing.T) (*serviceImpl, *idempotencyArticleRepo, *idempotencyTransactionManager) {
	t.Helper()
	repo := newIdempotencyArticleRepo()
	txManager := &idempotencyTransactionManager{articles: repo}
	settingSvc := idempotencySettingService{}
	bus := event.NewEventBus()
	t.Cleanup(bus.Shutdown)
	return &serviceImpl{
		repo:       repo,
		txManager:  txManager,
		cacheSvc:   idempotencyCacheService{},
		settingSvc: settingSvc,
		parserSvc:  appParser.NewService(settingSvc, bus),
	}, repo, txManager
}

func TestCreateWithOptionsReplaysSameIdempotencyRequestWithoutSecondTransaction(t *testing.T) {
	svc, repo, txManager := newIdempotencyArticleService(t)
	options := CreateOptions{ActorUserID: "user-1", IdempotencyKey: "autosave-key"}

	first, err := svc.CreateWithOptions(context.Background(), &model.CreateArticleRequest{
		ContentMd: "first body",
		Title:     "  ",
		Summaries: []string{"", "summary"},
	}, "", "", options)
	if err != nil {
		t.Fatalf("first CreateWithOptions() error = %v", err)
	}
	second, err := svc.CreateWithOptions(context.Background(), &model.CreateArticleRequest{
		ContentMd: "first body",
		Status:    "DRAFT",
		Summaries: []string{"summary"},
	}, "", "", options)
	if err != nil {
		t.Fatalf("second CreateWithOptions() error = %v", err)
	}

	if first.ID != second.ID {
		t.Fatalf("IDs = (%q, %q), want identical IDs", first.ID, second.ID)
	}
	if txManager.callCount() != 1 {
		t.Fatalf("transaction calls = %d, want 1", txManager.callCount())
	}
	if repo.createCalls != 1 {
		t.Fatalf("repository create calls = %d, want 1", repo.createCalls)
	}
}

func TestCreateWithOptionsRejectsIdempotencyKeyReuseWithDifferentRequest(t *testing.T) {
	svc, _, txManager := newIdempotencyArticleService(t)
	options := CreateOptions{ActorUserID: "user-1", IdempotencyKey: "autosave-key"}

	if _, err := svc.CreateWithOptions(context.Background(), &model.CreateArticleRequest{
		ContentMd: "first body",
		Status:    "DRAFT",
	}, "", "", options); err != nil {
		t.Fatalf("first CreateWithOptions() error = %v", err)
	}
	_, err := svc.CreateWithOptions(context.Background(), &model.CreateArticleRequest{
		ContentMd: "different body",
		Status:    "DRAFT",
	}, "", "", options)

	if !errors.Is(err, constant.ErrConflict) {
		t.Fatalf("second CreateWithOptions() error = %v, want ErrConflict", err)
	}
	if txManager.callCount() != 1 {
		t.Fatalf("transaction calls = %d, want 1", txManager.callCount())
	}
}

func TestCreateWithOptionsScopesIdempotencyKeyByAuthenticatedUser(t *testing.T) {
	svc, repo, _ := newIdempotencyArticleService(t)
	request := func() *model.CreateArticleRequest {
		return &model.CreateArticleRequest{ContentMd: "body", Status: "DRAFT"}
	}

	first, err := svc.CreateWithOptions(context.Background(), request(), "", "", CreateOptions{
		ActorUserID:    "user-1",
		IdempotencyKey: "shared-key",
	})
	if err != nil {
		t.Fatalf("first CreateWithOptions() error = %v", err)
	}
	second, err := svc.CreateWithOptions(context.Background(), request(), "", "", CreateOptions{
		ActorUserID:    "user-2",
		IdempotencyKey: "shared-key",
	})
	if err != nil {
		t.Fatalf("second CreateWithOptions() error = %v", err)
	}

	if first.ID == second.ID {
		t.Fatalf("IDs = (%q, %q), want separate articles for separate authenticated users", first.ID, second.ID)
	}
	if repo.createCalls != 2 {
		t.Fatalf("repository create calls = %d, want 2", repo.createCalls)
	}
}

func TestCreateWithOptionsRejectsOversizedIdempotencyKey(t *testing.T) {
	svc, _, txManager := newIdempotencyArticleService(t)
	_, err := svc.CreateWithOptions(context.Background(), &model.CreateArticleRequest{
		Status: "DRAFT",
	}, "", "", CreateOptions{
		ActorUserID:    "user-1",
		IdempotencyKey: strings.Repeat("k", maxIdempotencyKeyLength+1),
	})

	if !errors.Is(err, constant.ErrBadRequest) {
		t.Fatalf("CreateWithOptions() error = %v, want ErrBadRequest", err)
	}
	if txManager.callCount() != 0 {
		t.Fatalf("transaction calls = %d, want 0", txManager.callCount())
	}
}

func TestCreateWithOptionsRejectsBlankIdempotencyKey(t *testing.T) {
	svc, _, txManager := newIdempotencyArticleService(t)
	_, err := svc.CreateWithOptions(context.Background(), &model.CreateArticleRequest{
		Status: "DRAFT",
	}, "", "", CreateOptions{
		ActorUserID:           "user-1",
		IdempotencyKey:        " \t ",
		IdempotencyKeyPresent: true,
	})

	if !errors.Is(err, constant.ErrBadRequest) {
		t.Fatalf("CreateWithOptions() error = %v, want ErrBadRequest", err)
	}
	if txManager.callCount() != 0 {
		t.Fatalf("transaction calls = %d, want 0", txManager.callCount())
	}
}

func TestCreateWithOptionsRecoversConcurrentUniqueConflictAfterTransaction(t *testing.T) {
	svc, repo, txManager := newIdempotencyArticleService(t)
	repo.forceConcurrentPreflight = true
	repo.preflightBarrier = make(chan struct{})
	options := CreateOptions{ActorUserID: "user-1", IdempotencyKey: "concurrent-key"}

	type result struct {
		article *model.ArticleResponse
		err     error
	}
	results := make(chan result, 2)
	for range 2 {
		go func() {
			article, err := svc.CreateWithOptions(context.Background(), &model.CreateArticleRequest{
				ContentMd: "same body",
				Status:    "DRAFT",
			}, "", "", options)
			results <- result{article: article, err: err}
		}()
	}

	first := <-results
	second := <-results
	if first.err != nil || second.err != nil {
		t.Fatalf("concurrent errors = (%v, %v), want nil", first.err, second.err)
	}
	if first.article == nil || second.article == nil || first.article.ID != second.article.ID {
		t.Fatalf("concurrent articles = (%v, %v), want the same article", first.article, second.article)
	}
	if txManager.callCount() != 2 {
		t.Fatalf("transaction calls = %d, want 2 to exercise unique-conflict recovery", txManager.callCount())
	}
	repo.mu.Lock()
	defer repo.mu.Unlock()
	if len(repo.byKey) != 1 {
		t.Fatalf("committed idempotency records = %d, want 1", len(repo.byKey))
	}
}

func TestCreateWithOptionsReplaysScheduledRequestAfterScheduledTimePassed(t *testing.T) {
	svc, repo, txManager := newIdempotencyArticleService(t)
	options := CreateOptions{ActorUserID: "user-1", IdempotencyKey: "scheduled-key"}
	scheduledText := time.Now().Add(-time.Hour).Format(time.RFC3339Nano)
	request := func() *model.CreateArticleRequest {
		value := scheduledText
		return &model.CreateArticleRequest{
			Title:       "Scheduled article",
			Status:      "DRAFT",
			ScheduledAt: &value,
		}
	}

	normalized := request()
	if _, err := normalizeCreateArticlePayload(normalized); err != nil {
		t.Fatalf("normalizeCreateArticlePayload() error = %v", err)
	}
	key, digest, err := prepareCreateIdempotency(normalized, options)
	if err != nil {
		t.Fatalf("prepareCreateIdempotency() error = %v", err)
	}
	repo.byKey[key] = idempotencyArticleRecord{
		article: &model.Article{
			ID:     "existing-scheduled-article",
			Title:  "Scheduled article",
			Status: "SCHEDULED",
		},
		digest: digest,
	}

	replayed, err := svc.CreateWithOptions(context.Background(), request(), "", "", options)
	if err != nil {
		t.Fatalf("replayed CreateWithOptions() error = %v", err)
	}

	if replayed.ID != "existing-scheduled-article" {
		t.Fatalf("replayed ID = %q, want %q", replayed.ID, "existing-scheduled-article")
	}
	if txManager.callCount() != 0 {
		t.Fatalf("transaction calls = %d, want 0", txManager.callCount())
	}
}
