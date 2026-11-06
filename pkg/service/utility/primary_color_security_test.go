package utility

import (
	"bytes"
	"context"
	"database/sql"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/internal/infra/storage"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

func TestPrimaryColorRejectsOutsideLocalStorage(t *testing.T) {
	root := t.TempDir()
	outside := filepath.Join(t.TempDir(), "outside.png")
	img := image.NewRGBA(image.Rect(0, 0, 8, 8))
	for y := 0; y < 8; y++ {
		for x := 0; x < 8; x++ {
			img.Set(x, y, color.RGBA{R: 255, A: 255})
		}
	}
	var encoded bytes.Buffer
	if err := png.Encode(&encoded, img); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(outside, encoded.Bytes(), 0600); err != nil {
		t.Fatal(err)
	}
	service := &PrimaryColorService{colorSvc: &ColorService{}, storageProviders: map[constant.StoragePolicyType]storage.IStorageProvider{constant.PolicyTypeLocal: storage.NewLocalProvider("test")}}
	file := &model.File{PrimaryEntity: &model.FileStorageEntity{Source: sql.NullString{String: outside, Valid: true}}}
	policy := &model.StoragePolicy{Type: constant.PolicyTypeLocal, BasePath: root}
	if got := service.getColorFromLocalFile(context.Background(), file, policy); got != "" {
		t.Fatalf("read image outside storage: %s", got)
	}
	inside := filepath.Join(root, "inside.png")
	if err := os.WriteFile(inside, encoded.Bytes(), 0600); err != nil {
		t.Fatal(err)
	}
	file.PrimaryEntity.Source.String = inside
	if got := service.getColorFromLocalFile(context.Background(), file, policy); got == "" {
		t.Fatal("legitimate local image no longer provides primary color")
	}
}
