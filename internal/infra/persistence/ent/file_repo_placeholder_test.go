package ent

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func postgresPlaceholderMatcher(expectedPlaceholders ...string) sqlmock.QueryMatcher {
	return sqlmock.QueryMatcherFunc(func(_, actual string) error {
		if strings.Contains(actual, "?") {
			return fmt.Errorf("query still contains ? placeholders: %s", actual)
		}
		for _, placeholder := range expectedPlaceholders {
			if !strings.Contains(actual, placeholder) {
				return fmt.Errorf("query missing %s placeholder: %s", placeholder, actual)
			}
		}
		return nil
	})
}

func TestGetDescendantFileInfoUsesPostgresPlaceholders(t *testing.T) {
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(postgresPlaceholderMatcher("$1")))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := db.Close(); err != nil {
			t.Error(err)
		}
	})
	mock.ExpectQuery("descendant_files").WithArgs(uint(7)).WillReturnRows(sqlmock.NewRows([]string{"size", "primary_entity_id"}).AddRow(int64(10), int64(3)))
	repo := &entFileRepository{db: db, dbType: "postgres"}
	results, err := repo.GetDescendantFileInfo(context.Background(), 7)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 1 || results[0].Size != 10 {
		t.Fatalf("unexpected results: %+v", results)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
	mock.ExpectClose()
}

func TestIsDescendantUsesPostgresPlaceholders(t *testing.T) {
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(postgresPlaceholderMatcher("$1", "$2")))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := db.Close(); err != nil {
			t.Error(err)
		}
	})
	mock.ExpectQuery("descendants").WithArgs(uint(1), uint(2)).WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	repo := &entFileRepository{db: db, dbType: "postgres"}
	exists, err := repo.IsDescendant(context.Background(), 1, 2)
	if err != nil || !exists {
		t.Fatalf("exists=%v err=%v", exists, err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
	mock.ExpectClose()
}

func TestRebindPlaceholdersKeepsQuestionMarksForMySQL(t *testing.T) {
	repo := &entFileRepository{dbType: "mysql"}
	query := "SELECT 1 WHERE a = ? AND b = ?"
	if got := repo.rebindPlaceholders(query); got != query {
		t.Fatalf("mysql query changed: %s", got)
	}
}
