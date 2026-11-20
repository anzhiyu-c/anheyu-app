package file

import (
	"context"
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/internal/infra/storage"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
)

type recordingMutationProvider struct {
	storage.IStorageProvider
	calls []string
}

func (p *recordingMutationProvider) Rename(_ context.Context, _ *model.StoragePolicy, oldPath, newPath string) error {
	p.calls = append(p.calls, "rename "+oldPath+" -> "+newPath)
	return nil
}

func (p *recordingMutationProvider) CreateDirectory(_ context.Context, _ *model.StoragePolicy, virtualPath string) error {
	p.calls = append(p.calls, "mkdir "+virtualPath)
	return nil
}

func (p *recordingMutationProvider) Upload(_ context.Context, _ io.Reader, _ *model.StoragePolicy, virtualPath string) (*storage.UploadResult, error) {
	p.calls = append(p.calls, "upload "+virtualPath)
	return &storage.UploadResult{Source: virtualPath}, nil
}

// 普通用户名下（历史同步产生）的记录位于共享本地根策略中：
// 重命名、移动、新建目录和内容更新都必须被拒绝，且不能碰物理存储。
func newMutationFixture(t *testing.T) (*serviceImpl, *recordingMutationProvider) {
	t.Helper()
	if err := idgen.InitSqidsEncoder(); err != nil {
		t.Fatal(err)
	}
	files := &purgeFileRepository{files: map[uint]*model.File{
		10: purgeFile(10, 9, 0, "", model.FileTypeDir, 0),
		11: purgeFile(11, 9, 10, "leak.txt", model.FileTypeFile, 300),
		12: purgeFile(12, 9, 10, "docs", model.FileTypeDir, 0),
	}}
	provider := &recordingMutationProvider{}
	users := purgeUserRepository{users: map[uint]*model.User{9: {ID: 9, UserGroupID: 2}}}
	svc := &serviceImpl{
		fileRepo:         files,
		vfsSvc:           accessVFS{policy: sharedRootPolicy()},
		storageProviders: map[constant.StoragePolicyType]storage.IStorageProvider{constant.PolicyTypeLocal: provider},
		txManager:        uploadTransactionManager{repositories: repository.Repositories{File: files, User: users}},
	}
	return svc, provider
}

func publicFileID(t *testing.T, id uint) string {
	t.Helper()
	publicID, err := idgen.GeneratePublicID(id, idgen.EntityTypeFile)
	if err != nil {
		t.Fatal(err)
	}
	return publicID
}

func expectForbiddenWithoutStorage(t *testing.T, err error, provider *recordingMutationProvider) {
	t.Helper()
	if !errors.Is(err, constant.ErrForbidden) {
		t.Fatalf("expected ErrForbidden, got %v", err)
	}
	if len(provider.calls) != 0 {
		t.Fatalf("physical storage was touched: %v", provider.calls)
	}
}

func TestRenameItemRejectsSharedRootForOrdinaryUsers(t *testing.T) {
	svc, provider := newMutationFixture(t)
	_, err := svc.RenameItem(context.Background(), 9, &model.RenameItemRequest{ID: publicFileID(t, 11), NewName: "renamed.txt"})
	expectForbiddenWithoutStorage(t, err, provider)
}

func TestMoveItemsRejectsSharedRootForOrdinaryUsers(t *testing.T) {
	svc, provider := newMutationFixture(t)
	err := svc.MoveItems(context.Background(), 9, []string{publicFileID(t, 11)}, publicFileID(t, 12))
	expectForbiddenWithoutStorage(t, err, provider)
}

func TestCreateEmptyFileRejectsSharedRootForOrdinaryUsers(t *testing.T) {
	svc, provider := newMutationFixture(t)
	_, err := svc.CreateEmptyFile(context.Background(), 9, &model.CreateFileRequest{URI: "anzhiyu://my/new-dir", Type: int(model.FileTypeDir)})
	expectForbiddenWithoutStorage(t, err, provider)
}

func TestUpdateFileContentRejectsSharedRootForOrdinaryUsers(t *testing.T) {
	svc, provider := newMutationFixture(t)
	viewerID, err := idgen.GeneratePublicID(9, idgen.EntityTypeUser)
	if err != nil {
		t.Fatal(err)
	}
	_, err = svc.UpdateFileContentByIDAndURI(context.Background(), viewerID, publicFileID(t, 11), "anzhiyu://my/leak.txt", strings.NewReader("overwrite"))
	expectForbiddenWithoutStorage(t, err, provider)
}
