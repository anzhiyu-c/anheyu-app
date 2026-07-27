package ent

import (
	"context"
	"errors"
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

func openArticleInvariantTestClient(t *testing.T, name string) *entclient.Client {
	t.Helper()

	if err := idgen.InitSqidsEncoderWithSeed(name); err != nil {
		t.Fatalf("InitSqidsEncoderWithSeed() error = %v", err)
	}
	client := enttest.Open(t, "sqlite3", "file:"+name+"?mode=memory&cache=shared&_fk=1")
	t.Cleanup(func() {
		if err := client.Close(); err != nil {
			t.Errorf("client.Close() error = %v", err)
		}
	})
	return client
}

func TestArticleRepositoryRejectsPublishedOrScheduledWithoutTitle(t *testing.T) {
	client := openArticleInvariantTestClient(t, "article_title_status_check")
	ctx := context.Background()
	repo := NewArticleRepo(client, "sqlite3")

	for _, status := range []article.Status{article.StatusPUBLISHED, article.StatusSCHEDULED} {
		t.Run(string(status), func(t *testing.T) {
			_, err := repo.Create(ctx, &model.CreateArticleParams{
				Title:  " \t\n",
				Status: string(status),
			})
			if !errors.Is(err, constant.ErrConflict) {
				t.Fatalf("Create() error = %v, want ErrConflict", err)
			}
		})
	}

	if _, err := repo.Create(ctx, &model.CreateArticleParams{
		Title:  "",
		Status: string(article.StatusDRAFT),
	}); err != nil {
		t.Fatalf("Create() empty-title draft error = %v", err)
	}
	if _, err := repo.Create(ctx, &model.CreateArticleParams{
		Title:  "",
		Status: string(article.StatusARCHIVED),
	}); err != nil {
		t.Fatalf("Create() empty-title archived article error = %v", err)
	}
}

func TestArticleRepositoryStoresAndFindsCreateIdempotencyMetadata(t *testing.T) {
	client := openArticleInvariantTestClient(t, "article_create_idempotency")
	ctx := context.Background()
	repo := NewArticleRepo(client, "sqlite3")
	const (
		key    = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
		digest = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
	)

	created, err := repo.Create(ctx, &model.CreateArticleParams{
		Title:                "",
		Status:               string(article.StatusDRAFT),
		CreateIdempotencyKey: key,
		CreateRequestDigest:  digest,
	})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	found, foundDigest, err := repo.FindByCreateIdempotencyKey(ctx, key)
	if err != nil {
		t.Fatalf("FindByCreateIdempotencyKey() error = %v", err)
	}
	if found == nil || found.ID != created.ID || foundDigest != digest {
		t.Fatalf("found = (%v, %q), want article %q and digest %q", found, foundDigest, created.ID, digest)
	}

	_, err = repo.Create(ctx, &model.CreateArticleParams{
		Status:               string(article.StatusDRAFT),
		CreateIdempotencyKey: key,
		CreateRequestDigest:  digest,
	})
	if !errors.Is(err, constant.ErrConflict) {
		t.Fatalf("duplicate Create() error = %v, want ErrConflict", err)
	}
}

func TestArticleRepositoryRejectsReplayAfterIdempotentResultWasDeleted(t *testing.T) {
	client := openArticleInvariantTestClient(t, "article_deleted_idempotency")
	ctx := context.Background()
	repo := NewArticleRepo(client, "sqlite3")
	const (
		key    = "1123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
		digest = "bbcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
	)

	created, err := repo.Create(ctx, &model.CreateArticleParams{
		Status:               string(article.StatusDRAFT),
		CreateIdempotencyKey: key,
		CreateRequestDigest:  digest,
	})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	dbID, _, err := idgen.DecodePublicID(created.ID)
	if err != nil {
		t.Fatalf("DecodePublicID() error = %v", err)
	}
	client.Article.UpdateOneID(dbID).SetDeletedAt(time.Now()).SaveX(ctx)

	found, _, err := repo.FindByCreateIdempotencyKey(ctx, key)
	if !errors.Is(err, constant.ErrConflict) {
		t.Fatalf("FindByCreateIdempotencyKey() error = %v, want ErrConflict", err)
	}
	if found != nil {
		t.Fatalf("FindByCreateIdempotencyKey() article = %v, want nil", found)
	}
}

func TestArticleRepositoryGetByIDMapsMissingArticleToErrNotFound(t *testing.T) {
	client := openArticleInvariantTestClient(t, "article_get_missing")
	ctx := context.Background()
	repo := NewArticleRepo(client, "sqlite3")
	publicID, err := idgen.GeneratePublicID(999, idgen.EntityTypeArticle)
	if err != nil {
		t.Fatalf("GeneratePublicID() error = %v", err)
	}

	_, err = repo.GetByID(ctx, publicID)
	if !errors.Is(err, constant.ErrNotFound) {
		t.Fatalf("GetByID() error = %v, want ErrNotFound", err)
	}
}

func TestArticleDatabasePreventsPartialUpdatesFromFormingInvalidPublicState(t *testing.T) {
	client := openArticleInvariantTestClient(t, "article_partial_update_check")
	ctx := context.Background()

	entity := client.Article.Create().
		SetTitle("Original").
		SetStatus(article.StatusDRAFT).
		SaveX(ctx)
	publicID, err := idgen.GeneratePublicID(entity.ID, idgen.EntityTypeArticle)
	if err != nil {
		t.Fatalf("GeneratePublicID() error = %v", err)
	}
	repo := NewArticleRepo(client, "sqlite3")

	blankTitle := "   "
	if _, err := repo.Update(ctx, publicID, &model.UpdateArticleRequest{Title: &blankTitle}, nil); err != nil {
		t.Fatalf("Update(title) error = %v", err)
	}

	published := string(article.StatusPUBLISHED)
	if _, err := repo.Update(ctx, publicID, &model.UpdateArticleRequest{Status: &published}, nil); !errors.Is(err, constant.ErrConflict) {
		t.Fatalf("Update(status) error = %v, want ErrConflict", err)
	}

	got := client.Article.GetX(ctx, entity.ID)
	if got.Status != article.StatusDRAFT || got.Title != blankTitle {
		t.Fatalf("stored article = (%q, %q), want (%q, %q)", got.Title, got.Status, blankTitle, article.StatusDRAFT)
	}
}

func TestArticlePartialStatusUpdateDoesNotOverwriteConcurrentTitle(t *testing.T) {
	client := openArticleInvariantTestClient(t, "article_partial_update_preserves_title")
	ctx := context.Background()

	entity := client.Article.Create().
		SetTitle("Original").
		SetStatus(article.StatusDRAFT).
		SaveX(ctx)
	publicID, err := idgen.GeneratePublicID(entity.ID, idgen.EntityTypeArticle)
	if err != nil {
		t.Fatalf("GeneratePublicID() error = %v", err)
	}
	repo := NewArticleRepo(client, "sqlite3")

	newTitle := "New title"
	if _, err := repo.Update(ctx, publicID, &model.UpdateArticleRequest{Title: &newTitle}, nil); err != nil {
		t.Fatalf("Update(title) error = %v", err)
	}
	published := string(article.StatusPUBLISHED)
	if _, err := repo.Update(ctx, publicID, &model.UpdateArticleRequest{Status: &published}, nil); err != nil {
		t.Fatalf("Update(status) error = %v", err)
	}

	got := client.Article.GetX(ctx, entity.ID)
	if got.Title != newTitle || got.Status != article.StatusPUBLISHED {
		t.Fatalf("stored article = (%q, %q), want (%q, %q)", got.Title, got.Status, newTitle, article.StatusPUBLISHED)
	}
}

func TestArticleRepositoryUsesUnicodeWhitespaceValidationForStatusGuard(t *testing.T) {
	client := openArticleInvariantTestClient(t, "article_unicode_whitespace_guard")
	ctx := context.Background()
	entity := client.Article.Create().
		SetTitle("\t\n").
		SetStatus(article.StatusDRAFT).
		SaveX(ctx)
	publicID, err := idgen.GeneratePublicID(entity.ID, idgen.EntityTypeArticle)
	if err != nil {
		t.Fatalf("GeneratePublicID() error = %v", err)
	}
	repo := NewArticleRepo(client, "sqlite3")
	published := string(article.StatusPUBLISHED)

	_, err = repo.Update(ctx, publicID, &model.UpdateArticleRequest{Status: &published}, nil)
	if !errors.Is(err, constant.ErrConflict) {
		t.Fatalf("Update(status) error = %v, want ErrConflict", err)
	}
}

func TestArticleInvariantGuardDistinguishesMissingArticle(t *testing.T) {
	client := openArticleInvariantTestClient(t, "article_invariant_missing")
	ctx := context.Background()
	publicID, err := idgen.GeneratePublicID(999, idgen.EntityTypeArticle)
	if err != nil {
		t.Fatalf("GeneratePublicID() error = %v", err)
	}
	repo := NewArticleRepo(client, "sqlite3")
	published := string(article.StatusPUBLISHED)

	_, err = repo.Update(ctx, publicID, &model.UpdateArticleRequest{Status: &published}, nil)
	if !errors.Is(err, constant.ErrNotFound) {
		t.Fatalf("Update(status) error = %v, want ErrNotFound", err)
	}
	if errors.Is(err, constant.ErrConflict) {
		t.Fatalf("Update(status) error = %v, must not report a missing article as ErrConflict", err)
	}
}

func TestPublishScheduledArticleRejectsLegacyBlankTitle(t *testing.T) {
	client := openArticleInvariantTestClient(t, "article_scheduled_publish_guard")
	ctx := context.Background()
	scheduledAt := time.Now().Add(-time.Minute)

	entity := client.Article.Create().
		SetTitle("  ").
		SetStatus(article.StatusSCHEDULED).
		SetScheduledAt(scheduledAt).
		SaveX(ctx)
	repo := NewArticleRepo(client, "sqlite3")

	err := repo.PublishScheduledArticle(ctx, entity.ID)
	if !errors.Is(err, constant.ErrConflict) {
		t.Fatalf("PublishScheduledArticle() error = %v, want ErrConflict", err)
	}

	got := client.Article.GetX(ctx, entity.ID)
	if got.Status != article.StatusSCHEDULED {
		t.Fatalf("stored status = %q, want %q", got.Status, article.StatusSCHEDULED)
	}
	if got.ScheduledAt == nil || !got.ScheduledAt.Equal(scheduledAt) {
		t.Fatalf("stored scheduled_at = %v, want %v", got.ScheduledAt, scheduledAt)
	}
}

func TestPublishScheduledArticleRejectsFutureSchedule(t *testing.T) {
	client := openArticleInvariantTestClient(t, "article_scheduled_publish_future_guard")
	ctx := context.Background()

	entity := client.Article.Create().
		SetTitle("Future article").
		SetStatus(article.StatusSCHEDULED).
		SetScheduledAt(time.Now().Add(time.Hour)).
		SaveX(ctx)
	repo := NewArticleRepo(client, "sqlite3")

	err := repo.PublishScheduledArticle(ctx, entity.ID)
	if !errors.Is(err, constant.ErrConflict) {
		t.Fatalf("PublishScheduledArticle() error = %v, want ErrConflict", err)
	}
	got := client.Article.GetX(ctx, entity.ID)
	if got.Status != article.StatusSCHEDULED {
		t.Fatalf("stored status = %q, want %q", got.Status, article.StatusSCHEDULED)
	}
}
