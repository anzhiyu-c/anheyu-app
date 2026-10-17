package file

import (
	"context"
	"errors"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/file_info"
)

type fileInfoMetadataRepository struct{ repository.MetadataRepository }

func (fileInfoMetadataRepository) GetAll(context.Context, uint) ([]*model.Metadata, error) {
	return nil, nil
}

func TestGetFileInfoRequiresOwner(t *testing.T) {
	if err := idgen.InitSqidsEncoder(); err != nil {
		t.Fatal(err)
	}
	id, err := idgen.GeneratePublicID(30, idgen.EntityTypeFile)
	if err != nil {
		t.Fatal(err)
	}
	svc := &serviceImpl{
		fileRepo:        uploadFileRepository{parent: &model.File{ID: 30, OwnerID: 7, Type: model.FileTypeDir, Name: "private"}},
		metadataService: file_info.NewMetadataService(fileInfoMetadataRepository{}),
	}
	for _, viewer := range []uint{0, 8} {
		got, err := svc.GetFileInfo(context.Background(), viewer, id)
		if !errors.Is(err, constant.ErrForbidden) || got != nil {
			t.Errorf("viewer %d received private file: got=%+v err=%v", viewer, got, err)
		}
	}
	got, err := svc.GetFileInfo(context.Background(), 7, id)
	if err != nil || got == nil || !got.File.Owned {
		t.Fatalf("owner should retain access: got=%+v err=%v", got, err)
	}
}
