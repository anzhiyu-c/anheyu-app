package article

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/anzhiyu-c/anheyu-app/ent/enttest"
	persistenceEnt "github.com/anzhiyu-c/anheyu-app/internal/infra/persistence/ent"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/event"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	appParser "github.com/anzhiyu-c/anheyu-app/pkg/service/parser"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	_ "github.com/ncruces/go-sqlite3/driver"
	_ "github.com/ncruces/go-sqlite3/embed"
)

var errUnexpectedArticleWrite = errors.New("unexpected article write")

type articleValidationSettingService struct {
	setting.SettingService
}

func (articleValidationSettingService) Get(string) string {
	return ""
}

type rejectingArticleTransactionManager struct {
	called bool
}

func (m *rejectingArticleTransactionManager) Do(context.Context, func(repository.Repositories) error) error {
	m.called = true
	return errUnexpectedArticleWrite
}

type articleValidationRepo struct {
	repository.ArticleRepository
	oldArticle *model.Article
	updateReq  *model.UpdateArticleRequest
}

func (r *articleValidationRepo) GetByID(context.Context, string) (*model.Article, error) {
	return r.oldArticle, nil
}

func (r *articleValidationRepo) Update(
	_ context.Context,
	_ string,
	req *model.UpdateArticleRequest,
	_ *model.UpdateArticleComputedParams,
) (*model.Article, error) {
	r.updateReq = req
	return nil, errUnexpectedArticleWrite
}

type articleValidationTransactionManager struct {
	repo repository.ArticleRepository
}

func (m articleValidationTransactionManager) Do(ctx context.Context, fn func(repository.Repositories) error) error {
	return fn(repository.Repositories{Article: m.repo})
}

func newArticleValidationParser(t *testing.T) *appParser.Service {
	t.Helper()
	bus := event.NewEventBus()
	t.Cleanup(bus.Shutdown)
	return appParser.NewService(articleValidationSettingService{}, bus)
}

func TestCreateRejectsBlankTitleAfterScheduledStatusNormalization(t *testing.T) {
	txManager := &rejectingArticleTransactionManager{}
	svc := &serviceImpl{
		txManager: txManager,
		parserSvc: newArticleValidationParser(t),
	}
	future := time.Now().Add(time.Hour).Format(time.RFC3339)

	_, err := svc.Create(context.Background(), &model.CreateArticleRequest{
		Title:       " \t ",
		Status:      "DRAFT",
		ScheduledAt: &future,
	}, "", "")

	if !errors.Is(err, constant.ErrBadRequest) {
		t.Fatalf("Create() error = %v, want ErrBadRequest", err)
	}
	if txManager.called {
		t.Fatal("Create() started a transaction for an invalid final title/status pair")
	}
}

func TestUpdateRejectsBlankTitleAfterScheduledStatusNormalization(t *testing.T) {
	repo := &articleValidationRepo{
		oldArticle: &model.Article{
			ID:     "article-id",
			Title:  "",
			Status: "DRAFT",
		},
	}
	svc := &serviceImpl{
		txManager: articleValidationTransactionManager{repo: repo},
	}
	future := time.Now().Add(time.Hour).Format(time.RFC3339)

	_, err := svc.Update(context.Background(), "article-id", &model.UpdateArticleRequest{
		ScheduledAt: &future,
	}, "", "")

	if !errors.Is(err, constant.ErrBadRequest) {
		t.Fatalf("Update() error = %v, want ErrBadRequest", err)
	}
	if repo.updateReq != nil {
		t.Fatal("Update() called the repository for an invalid final title/status pair")
	}
}

func TestUpdateDoesNotWriteTitleWhenOnlyStatusWasRequested(t *testing.T) {
	repo := &articleValidationRepo{
		oldArticle: &model.Article{
			ID:     "article-id",
			Title:  "Original title",
			Status: "DRAFT",
		},
	}
	svc := &serviceImpl{
		txManager: articleValidationTransactionManager{repo: repo},
	}
	published := "PUBLISHED"

	_, err := svc.Update(context.Background(), "article-id", &model.UpdateArticleRequest{
		Status: &published,
	}, "", "")

	if !errors.Is(err, errUnexpectedArticleWrite) {
		t.Fatalf("Update() error = %v, want errUnexpectedArticleWrite", err)
	}
	if repo.updateReq == nil {
		t.Fatal("Update() did not call the repository")
	}
	if repo.updateReq.Title != nil {
		t.Fatalf("repository title = %q, want unspecified", *repo.updateReq.Title)
	}
	if repo.updateReq.Status == nil || *repo.updateReq.Status != published {
		t.Fatalf("repository status = %v, want %q", repo.updateReq.Status, published)
	}
}

func TestUpdateMapsMissingArticleFromRealRepositoryToErrNotFound(t *testing.T) {
	if err := idgen.InitSqidsEncoderWithSeed("service_update_missing_article"); err != nil {
		t.Fatalf("InitSqidsEncoderWithSeed() error = %v", err)
	}
	client := enttest.Open(t, "sqlite3", "file:service_update_missing_article?mode=memory&cache=shared&_fk=1")
	t.Cleanup(func() {
		if err := client.Close(); err != nil {
			t.Errorf("client.Close() error = %v", err)
		}
	})
	repo := persistenceEnt.NewArticleRepo(client, "sqlite3")
	publicID, err := idgen.GeneratePublicID(999, idgen.EntityTypeArticle)
	if err != nil {
		t.Fatalf("GeneratePublicID() error = %v", err)
	}
	svc := &serviceImpl{
		txManager: articleValidationTransactionManager{repo: repo},
	}

	_, err = svc.Update(context.Background(), publicID, &model.UpdateArticleRequest{}, "", "")
	if !errors.Is(err, constant.ErrNotFound) {
		t.Fatalf("Update() error = %v, want ErrNotFound", err)
	}
}
