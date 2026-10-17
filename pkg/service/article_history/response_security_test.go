package article_history

import (
	"context"
	"strings"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
)

type unsafeHistoryRepo struct {
	repository.ArticleHistoryRepository
}

func (unsafeHistoryRepo) GetByArticleAndVersion(context.Context, uint, int) (*model.ArticleHistory, error) {
	return &model.ArticleHistory{ContentHTML: `<div class="md-editor-mermaid"><img src="/safe.png" onerror="alert(1)"></div><p>retained</p>`}, nil
}
func TestHistoryResponsesSanitizeStoredHTML(t *testing.T) {
	if err := idgen.InitSqidsEncoder(); err != nil {
		t.Fatal(err)
	}
	articleID, err := idgen.GeneratePublicID(1, idgen.EntityTypeArticle)
	if err != nil {
		t.Fatal(err)
	}
	svc := NewService(unsafeHistoryRepo{}, nil, nil)
	ctx := context.Background()
	version, err := svc.GetHistoryVersion(ctx, articleID, 1)
	if err != nil {
		t.Fatal(err)
	}
	restored, err := svc.RestoreVersion(ctx, articleID, 1)
	if err != nil {
		t.Fatal(err)
	}
	compared, err := svc.CompareVersions(ctx, articleID, 1, 2)
	if err != nil {
		t.Fatal(err)
	}
	for _, history := range []*model.ArticleHistory{version, restored, compared.OldVersion, compared.NewVersion} {
		if strings.Contains(history.ContentHTML, "onerror") {
			t.Errorf("historical XSS exposed: %s", history.ContentHTML)
		}
		if !strings.Contains(history.ContentHTML, "retained") {
			t.Error("safe historical content lost")
		}
	}
}
