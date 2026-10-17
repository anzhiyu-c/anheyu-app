package ent

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	entclient "github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/article"
	"github.com/anzhiyu-c/anheyu-app/ent/enttest"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	_ "github.com/ncruces/go-sqlite3/driver"
	_ "github.com/ncruces/go-sqlite3/embed"
)

func openArticlePublicAccessClient(t *testing.T) *entclient.Client {
	t.Helper()
	name := strings.ReplaceAll(t.Name(), "/", "_")
	if err := idgen.InitSqidsEncoderWithSeed(name); err != nil {
		t.Fatal(err)
	}
	client := enttest.Open(t, "sqlite3", "file:"+name+"?mode=memory&cache=shared&_fk=1")
	t.Cleanup(func() {
		if err := client.Close(); err != nil {
			t.Errorf("close test database: %v", err)
		}
	})
	return client
}

func TestPublicArticleQueriesRespectVisibility(t *testing.T) {
	for _, tt := range []struct {
		name     string
		status   article.Status
		review   article.ReviewStatus
		takedown bool
		deleted  bool
		visible  bool
	}{
		{name: "no_review", status: article.StatusPUBLISHED, review: article.ReviewStatusNONE, visible: true},
		{name: "approved", status: article.StatusPUBLISHED, review: article.ReviewStatusAPPROVED, visible: true},
		{name: "pending", status: article.StatusPUBLISHED, review: article.ReviewStatusPENDING},
		{name: "rejected", status: article.StatusPUBLISHED, review: article.ReviewStatusREJECTED},
		{name: "takedown", status: article.StatusPUBLISHED, review: article.ReviewStatusAPPROVED, takedown: true},
		{name: "deleted", status: article.StatusPUBLISHED, review: article.ReviewStatusAPPROVED, deleted: true},
		{name: "draft", status: article.StatusDRAFT, review: article.ReviewStatusNONE},
		{name: "scheduled", status: article.StatusSCHEDULED, review: article.ReviewStatusAPPROVED},
	} {
		t.Run(tt.name, func(t *testing.T) {
			client := openArticlePublicAccessClient(t)
			ctx := context.Background()
			createdAt := time.Date(2026, 10, 10, 0, 0, 0, 0, time.UTC)
			tag := client.PostTag.Create().SetName("shared tag").SaveX(ctx)
			series := client.DocSeries.Create().SetName("documentation").SaveX(ctx)
			builder := client.Article.Create().SetTitle("private candidate").SetContentMd("secret markdown").
				SetContentHTML("<p>secret html</p>").SetStatus(tt.status).SetReviewStatus(tt.review).
				SetIsTakedown(tt.takedown).SetCreatedAt(createdAt).SetWordCount(123).
				SetShowOnHome(true).SetHomeSort(1).SetIsDoc(true).SetDocSeriesID(series.ID).AddPostTags(tag)
			if tt.deleted {
				builder.SetDeletedAt(createdAt.Add(time.Hour))
			}
			entity := builder.SaveX(ctx)
			repo := &articleRepo{db: client, dbType: "sqlite3"}
			candidate, err := repo.FindByID(ctx, entity.ID)
			if err != nil {
				t.Fatal(err)
			}
			wantCount := 0
			if tt.visible {
				wantCount = 1
			}
			checkArticle := func(name string, got *model.Article, err error) {
				t.Helper()
				if err != nil && !errors.Is(err, constant.ErrNotFound) && !entclient.IsNotFound(err) {
					t.Errorf("%s() unexpected error: %v", name, err)
					return
				}
				if (got != nil) != tt.visible {
					t.Errorf("%s() returned article = %t, want %t", name, got != nil, tt.visible)
				}
			}
			got, err := repo.GetRandom(ctx)
			checkArticle("GetRandom", got, err)
			got, err = repo.GetPrevArticle(ctx, entity.ID+1, createdAt.Add(time.Hour))
			checkArticle("GetPrevArticle", got, err)
			got, err = repo.GetNextArticle(ctx, entity.ID+1, createdAt.Add(-time.Hour))
			checkArticle("GetNextArticle", got, err)
			got, err = repo.GetBySlugOrID(ctx, candidate.ID)
			checkArticle("GetBySlugOrID", got, err)

			// A separate source article with the same tag lets related-article lookup
			// consider this candidate without including a public anchor in random queries.
			source := *candidate
			source.ID, err = idgen.GeneratePublicID(entity.ID+1, idgen.EntityTypeArticle)
			if err != nil {
				t.Fatal(err)
			}
			related, err := repo.FindRelatedArticles(ctx, &source, 5)
			if err != nil || len(related) != wantCount {
				t.Errorf("FindRelatedArticles() count = %d, error = %v; want %d", len(related), err, wantCount)
			}
			home, err := repo.ListHome(ctx)
			if err != nil || len(home) != wantCount {
				t.Errorf("ListHome() count = %d, error = %v; want %d", len(home), err, wantCount)
			}
			listed, total, err := repo.ListPublic(ctx, &model.ListPublicArticlesOptions{})
			if err != nil || len(listed) != wantCount || total != wantCount {
				t.Errorf("ListPublic() count/total = %d/%d, error = %v; want %d", len(listed), total, err, wantCount)
			}
			stats, err := repo.GetSiteStats(ctx)
			if err != nil {
				t.Errorf("GetSiteStats() error = %v", err)
			} else if stats.TotalPosts != wantCount || stats.TotalWords != wantCount*123 {
				t.Errorf("GetSiteStats() = %+v, want posts=%d, words=%d", stats, wantCount, wantCount*123)
			}
			archives, err := repo.GetArchiveSummary(ctx)
			if err != nil || len(archives) != wantCount {
				t.Errorf("GetArchiveSummary() count = %d, error = %v; want %d", len(archives), err, wantCount)
			}
			seriesID, err := idgen.GeneratePublicID(series.ID, idgen.EntityTypeDocSeries)
			if err != nil {
				t.Fatal(err)
			}
			documentation, err := NewDocSeriesRepo(client).GetByIDWithArticles(ctx, seriesID)
			if err != nil {
				t.Errorf("GetByIDWithArticles() error = %v", err)
			} else if len(documentation.Articles) != wantCount {
				t.Errorf("GetByIDWithArticles() count = %d, want %d", len(documentation.Articles), wantCount)
			}

			// Management lookup must retain access to non-public articles.
			managed, err := repo.GetByID(ctx, candidate.ID)
			if !tt.deleted && (err != nil || managed == nil) {
				t.Errorf("GetByID() lost management access: article=%v, error=%v", managed, err)
			}
		})
	}
}
