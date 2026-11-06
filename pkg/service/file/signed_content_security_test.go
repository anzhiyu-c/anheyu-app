package file

import (
	"context"
	"database/sql"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/internal/infra/storage"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/types"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/volume"
)

type signedContentEntityRepo struct {
	repository.EntityRepository
	entity *model.FileStorageEntity
}

func (r signedContentEntityRepo) FindByID(context.Context, uint) (*model.FileStorageEntity, error) {
	return r.entity, nil
}

type signedContentPolicyService struct {
	volume.IStoragePolicyService
	policy *model.StoragePolicy
}

func (s signedContentPolicyService) GetPolicyByDatabaseID(context.Context, uint) (*model.StoragePolicy, error) {
	return s.policy, nil
}

type signedContentSettings struct{ setting.SettingService }

func (signedContentSettings) Get(string) string { return "signed-content-regression-secret" }

type deniedContentProvider struct{ storage.IStorageProvider }

func (deniedContentProvider) Get(context.Context, *model.StoragePolicy, string) (io.ReadCloser, error) {
	return nil, constant.ErrForbidden
}

func TestSignedLocalContentUsesStorageBoundary(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "sample.txt")
	if err := os.WriteFile(source, []byte("private marker"), 0600); err != nil {
		t.Fatal(err)
	}
	svc, token := signedContentFixture(t, root, source, deniedContentProvider{})
	response := httptest.NewRecorder()
	err := svc.ServeSignedContent(context.Background(), token, response, httptest.NewRequest(http.MethodGet, "/content", nil))
	if !errors.Is(err, constant.ErrForbidden) || response.Body.Len() != 0 {
		t.Fatalf("storage denial bypassed: err=%v body=%q", err, response.Body.String())
	}
}

func TestSignedLocalContentPreservesRangeRequests(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "sample.txt")
	if err := os.WriteFile(source, []byte("0123456789"), 0600); err != nil {
		t.Fatal(err)
	}
	svc, token := signedContentFixture(t, root, source, storage.NewLocalProvider("test"))
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/content", nil)
	request.Header.Set("Range", "bytes=2-4")
	if err := svc.ServeSignedContent(context.Background(), token, response, request); err != nil {
		t.Fatal(err)
	}
	if response.Code != http.StatusPartialContent || response.Body.String() != "234" {
		t.Fatalf("range request failed: status=%d body=%q", response.Code, response.Body.String())
	}
}

func signedContentFixture(t *testing.T, root, source string, provider storage.IStorageProvider) (*serviceImpl, string) {
	t.Helper()
	if err := idgen.InitSqidsEncoder(); err != nil {
		t.Fatal(err)
	}
	file := &model.File{ID: 30, Name: "sample.txt", Type: model.FileTypeFile, PrimaryEntityID: types.NullUint64{Uint64: 31, Valid: true}}
	svc := &serviceImpl{
		fileRepo:         uploadFileRepository{parent: file},
		entityRepo:       signedContentEntityRepo{entity: &model.FileStorageEntity{ID: 31, PolicyID: 7, Source: sql.NullString{String: source, Valid: true}}},
		policySvc:        signedContentPolicyService{policy: &model.StoragePolicy{ID: 7, Type: constant.PolicyTypeLocal, BasePath: root}},
		settingSvc:       signedContentSettings{},
		storageProviders: map[constant.StoragePolicyType]storage.IStorageProvider{constant.PolicyTypeLocal: provider},
	}
	signedURL, err := svc.generateSignedContentURL(context.Background(), file)
	if err != nil {
		t.Fatal(err)
	}
	return svc, strings.TrimPrefix(signedURL, "/api/file/content?sign=")
}
