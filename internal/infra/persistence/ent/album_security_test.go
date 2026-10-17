package ent

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/sql"
	"github.com/DATA-DOG/go-sqlmock"
	appent "github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/enttest"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	_ "github.com/ncruces/go-sqlite3/driver"
	_ "github.com/ncruces/go-sqlite3/embed"
)

func TestAlbumTagFilterUsesPostgresPlaceholders(t *testing.T) {
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(_, actual string) error {
		if strings.Contains(actual, "?") || !strings.Contains(actual, "$1") || !strings.Contains(actual, "$4") {
			return fmt.Errorf("invalid PostgreSQL placeholders: %s", actual)
		}
		return nil
	})))
	if err != nil {
		t.Fatal(err)
	}
	client := appent.NewClient(appent.Driver(sql.OpenDB(dialect.Postgres, db)))
	t.Cleanup(func() {
		if err := client.Close(); err != nil {
			t.Error(err)
		}
	})
	mock.ExpectQuery("count").WithArgs("nature", "nature,%", "%,nature", "%,nature,%").WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	_, err = NewEntAlbumRepository(client).FindListByOptions(context.Background(), repository.AlbumQueryOptions{PageQuery: repository.PageQuery{Page: 1, PageSize: 10}, Tag: "nature"})
	if err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
	mock.ExpectClose()
}

func TestAlbumTagFilterMatchesLiteralWholeTags(t *testing.T) {
	ctx := context.Background()
	client := enttest.Open(t, "sqlite3", "file:album_security?mode=memory&cache=shared&_fk=1")
	t.Cleanup(func() {
		if err := client.Close(); err != nil {
			t.Error(err)
		}
	})
	for i, tags := range []string{"nature", "other,nature", "nature,other", "other,nature,last", "unnature", "nat_re", "nat%re"} {
		client.Album.Create().SetImageURL(fmt.Sprintf("https://images.example/%d.png", i)).SetFileHash(fmt.Sprintf("hash-%d", i)).SetTags(tags).SaveX(ctx)
	}
	repo := NewEntAlbumRepository(client)
	for tag, expected := range map[string]int64{"nature": 4, "nat_re": 1, "nat%re": 1, "missing": 0, "' OR 1=1 --": 0} {
		t.Run(tag, func(t *testing.T) {
			got, err := repo.FindListByOptions(ctx, repository.AlbumQueryOptions{PageQuery: repository.PageQuery{Page: 1, PageSize: 20}, Tag: tag})
			if err != nil {
				t.Fatal(err)
			}
			if got.Total != expected {
				t.Fatalf("total = %d, want %d", got.Total, expected)
			}
		})
	}
}
