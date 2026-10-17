package comment

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"image"
	"image/png"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	filesvc "github.com/anzhiyu-c/anheyu-app/pkg/service/file"
)

type commentSecurityFiles struct {
	filesvc.FileService
	file             *model.File
	policy           *model.StoragePolicy
	signed, uploaded int
	content          []byte
	filename         string
}

func (f *commentSecurityFiles) GetPolicyByFlag(context.Context, string) (*model.StoragePolicy, error) {
	return f.policy, nil
}
func (f *commentSecurityFiles) FindFileByPublicID(context.Context, string) (*model.File, error) {
	return f.file, nil
}
func (f *commentSecurityFiles) GetDownloadURLForFileWithExpiration(context.Context, *model.File, string, time.Time) (string, error) {
	f.signed++
	return "/needcache/download/file?sign=secret", nil
}
func (f *commentSecurityFiles) UploadFileByPolicyFlag(_ context.Context, _ uint, r io.Reader, _, filename string) (*model.FileItem, error) {
	f.uploaded++
	f.filename = filename
	var err error
	f.content, err = io.ReadAll(r)
	return &model.FileItem{ID: "image"}, err
}

func TestCommentReferencesCannotMintPrivateFileURLs(t *testing.T) {
	nodeID := uint(10)
	for _, tc := range []struct {
		name     string
		parent   int64
		fileType model.FileType
		filename string
		allowed  bool
	}{
		{"private image", 20, model.FileTypeFile, "private.png", false},
		{"comment image", 10, model.FileTypeFile, "comment.png", true},
		{"legacy archive", 10, model.FileTypeFile, "old.zip", false},
		{"directory", 10, model.FileTypeDir, "folder.png", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			files := &commentSecurityFiles{policy: &model.StoragePolicy{ID: 7, Flag: constant.PolicyFlagCommentImage, NodeID: &nodeID}, file: &model.File{OwnerID: 1, Type: tc.fileType, Name: tc.filename, ParentID: sql.NullInt64{Int64: tc.parent, Valid: true}, PrimaryEntity: &model.FileStorageEntity{PolicyID: 7}}}
			svc := &Service{fileSvc: files}
			got, err := svc.renderHTMLURLs(context.Background(), `<img src="anzhiyu://file/private">`)
			if err != nil {
				t.Fatal(err)
			}
			if (files.signed > 0) != tc.allowed || strings.Contains(got, "sign=secret") != tc.allowed {
				t.Fatalf("allowed=%v signed=%d html=%s", tc.allowed, files.signed, got)
			}
		})
	}
}

func TestCommentReferencesRejectHistoricalDisguisedImages(t *testing.T) {
	nodeID := uint(10)
	files := &commentSecurityFiles{
		policy: &model.StoragePolicy{ID: 7, Flag: constant.PolicyFlagCommentImage, NodeID: &nodeID},
		file:   &model.File{Type: model.FileTypeFile, Name: "fake.png", ParentID: sql.NullInt64{Int64: 10, Valid: true}, PrimaryEntity: &model.FileStorageEntity{PolicyID: 7, MimeType: sql.NullString{String: "text/html", Valid: true}}},
	}
	svc := &Service{fileSvc: files}
	got, err := svc.renderHTMLURLs(context.Background(), `<img src="anzhiyu://file/private">`)
	if err != nil {
		t.Fatal(err)
	}
	if files.signed != 0 || strings.Contains(got, "sign=") {
		t.Fatalf("historical non-image minted URL: %s", got)
	}
}

func TestCommentUploadRejectsNonImagesAndDisguisedContent(t *testing.T) {
	for _, tc := range []struct{ name, data string }{
		{"archive.zip", "PK\x03\x04archive"},
		{"fake.png", "<html><script>alert(1)</script></html>"},
		{"active.svg", `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>`},
		{"truncated.png", "\x89PNG\r\n\x1a\n"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			files := &commentSecurityFiles{}
			svc := &Service{fileSvc: files}
			if _, err := svc.UploadImage(context.Background(), 0, tc.name, strings.NewReader(tc.data)); err == nil {
				t.Error("invalid image accepted")
			}
			if files.uploaded != 0 {
				t.Error("invalid bytes reached storage")
			}
		})
	}
}

func TestCommentUploadRejectsOversizedInput(t *testing.T) {
	files := &commentSecurityFiles{}
	svc := &Service{fileSvc: files}
	content := bytes.NewReader(make([]byte, MaxCommentImageSize+2))
	if _, err := svc.UploadImage(context.Background(), 0, "photo.png", content); !errors.Is(err, ErrInvalidCommentImage) {
		t.Fatalf("oversized input not rejected: %v", err)
	}
	if files.uploaded != 0 || content.Len() != 1 {
		t.Fatalf("upload did not stop at bounded read: uploads=%d unread=%d", files.uploaded, content.Len())
	}
}

func TestCommentReferencesFailClosedWhenPolicyIsUnavailable(t *testing.T) {
	files := &commentSecurityFiles{}
	svc := &Service{fileSvc: files}
	got, err := svc.renderHTMLURLs(context.Background(), `<img src="anzhiyu://file/private">`)
	if err != nil {
		t.Fatal(err)
	}
	if files.signed != 0 || strings.Contains(got, "anzhiyu://") {
		t.Fatalf("unavailable public policy exposed a reference: %s", got)
	}
}

func TestCommentUploadAcceptsRealImageWithCanonicalExtension(t *testing.T) {
	var data bytes.Buffer
	if err := png.Encode(&data, image.NewRGBA(image.Rect(0, 0, 2, 2))); err != nil {
		t.Fatal(err)
	}
	files := &commentSecurityFiles{}
	svc := &Service{fileSvc: files}
	if _, err := svc.UploadImage(context.Background(), 0, "image.jpg", bytes.NewReader(data.Bytes())); err != nil {
		t.Fatal(err)
	}
	if files.uploaded != 1 || !strings.HasSuffix(files.filename, ".png") || !bytes.Equal(files.content, data.Bytes()) {
		t.Fatalf("image was not stored correctly: filename=%s", files.filename)
	}
}
