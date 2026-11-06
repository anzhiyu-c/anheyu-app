package thumbnail

import (
	"context"
	"database/sql"
	"errors"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/internal/infra/storage"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

type deniedSourceProvider struct{ storage.IStorageProvider }

func (deniedSourceProvider) Get(context.Context, *model.StoragePolicy, string) (io.ReadCloser, error) {
	return nil, constant.ErrForbidden
}

func TestLocalThumbnailUsesStorageBoundary(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "sample.txt")
	if err := os.WriteFile(source, []byte("private marker"), 0600); err != nil {
		t.Fatal(err)
	}
	file := &model.File{PrimaryEntity: &model.FileStorageEntity{Source: sql.NullString{String: source, Valid: true}}}
	policy := &model.StoragePolicy{Type: constant.PolicyTypeLocal, BasePath: root}
	path, cleanup, err := (&ThumbnailService{}).getOriginalFile(context.Background(), file, policy, deniedSourceProvider{})
	if cleanup != nil {
		defer cleanup()
	}
	if !errors.Is(err, constant.ErrForbidden) || path != "" {
		t.Fatalf("storage denial bypassed: path=%q err=%v", path, err)
	}
}

func TestLocalThumbnailUsesStablePrivateCopy(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "sample.txt")
	if err := os.WriteFile(source, []byte("original bytes"), 0600); err != nil {
		t.Fatal(err)
	}
	file := &model.File{PrimaryEntity: &model.FileStorageEntity{Source: sql.NullString{String: source, Valid: true}}}
	policy := &model.StoragePolicy{Type: constant.PolicyTypeLocal, BasePath: root}
	path, cleanup, err := (&ThumbnailService{}).getOriginalFile(context.Background(), file, policy, storage.NewLocalProvider("test"))
	if err != nil {
		t.Fatal(err)
	}
	if path == source || cleanup == nil {
		t.Fatal("thumbnail generator received mutable original path")
	}
	defer cleanup()
	if err := os.WriteFile(source, []byte("changed bytes"), 0600); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil || string(data) != "original bytes" {
		t.Fatalf("private copy changed: data=%q err=%v", data, err)
	}
}
