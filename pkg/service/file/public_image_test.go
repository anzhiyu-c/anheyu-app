package file

import (
	"database/sql"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

func TestPublicImageScope(t *testing.T) {
	nodeID := uint(10)
	for _, flag := range []string{constant.PolicyFlagArticleImage, constant.PolicyFlagCommentImage, constant.PolicyFlagUserAvatar} {
		policy := &model.StoragePolicy{ID: 7, Flag: flag, NodeID: &nodeID}
		file := &model.File{Type: model.FileTypeFile, Name: "photo.jpg", ParentID: sql.NullInt64{Int64: 10, Valid: true}, PrimaryEntity: &model.FileStorageEntity{PolicyID: 7}}
		if !IsPublicImage(file, policy) {
			t.Errorf("legitimate %s image rejected", flag)
		}
		file.PrimaryEntity.MimeType = sql.NullString{String: "text/html", Valid: true}
		if IsPublicImage(file, policy) {
			t.Errorf("non-image MIME exposed for %s", flag)
		}
		file.PrimaryEntity.MimeType = sql.NullString{}
		file.PrimaryEntity.PolicyID = 8
		if IsPublicImage(file, policy) {
			t.Errorf("mismatched storage policy exposed for %s", flag)
		}
	}
	if IsPublicImage(nil, nil) {
		t.Error("missing file is public")
	}
}
