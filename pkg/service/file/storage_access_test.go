package file

import (
	"context"
	"database/sql"
	"errors"
	"net/url"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/internal/infra/storage"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/types"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/uri"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/volume"
)

type accessVFS struct {
	volume.IVFSService
	policy *model.StoragePolicy
}

func (v accessVFS) FindPolicyForPath(context.Context, string) (*model.StoragePolicy, error) {
	return v.policy, nil
}

type recordingSync struct{ paths []string }

func (s *recordingSync) SyncDirectory(_ context.Context, _ uint, _ *model.StoragePolicy, virtualPath string) error {
	s.paths = append(s.paths, virtualPath)
	return nil
}

type accessFileRepository struct {
	repository.FileRepository
	mount      *model.File
	item       *model.File
	listCalls  int
	hardDelete []uint
}

func (r *accessFileRepository) FindByPath(_ context.Context, owner uint, path string) (*model.File, error) {
	if r.mount != nil && owner == r.mount.OwnerID && path == "/cloud" {
		return r.mount, nil
	}
	return nil, constant.ErrNotFound
}

func (r *accessFileRepository) ListByParentIDWithCursor(context.Context, uint, string, string, int, *repository.PaginationToken) ([]*model.File, error) {
	r.listCalls++
	return nil, nil
}

func (r *accessFileRepository) FindByIDUnscoped(_ context.Context, id uint) (*model.File, error) {
	if r.item == nil || r.item.ID != id {
		return nil, constant.ErrNotFound
	}
	return r.item, nil
}

func (r *accessFileRepository) HardDelete(_ context.Context, id uint) error {
	r.hardDelete = append(r.hardDelete, id)
	return nil
}

type accessEntityRepository struct {
	repository.EntityRepository
	entity     *model.FileStorageEntity
	hardDelete []uint
}

func (r *accessEntityRepository) FindUploadingByOwnerID(context.Context, uint) ([]*model.FileStorageEntity, error) {
	return nil, nil
}

func (r *accessEntityRepository) FindByID(context.Context, uint) (*model.FileStorageEntity, error) {
	return r.entity, nil
}

func (r *accessEntityRepository) HardDelete(_ context.Context, id uint) error {
	r.hardDelete = append(r.hardDelete, id)
	return nil
}

type accessFileEntityRepository struct {
	repository.FileEntityRepository
}

func (accessFileEntityRepository) DeleteByFileID(context.Context, uint) error { return nil }

type accessMetadataRepository struct{ repository.MetadataRepository }

func (accessMetadataRepository) DeleteByFileID(context.Context, uint) error { return nil }

type accessDirectLinkRepository struct {
	repository.DirectLinkRepository
}

func (accessDirectLinkRepository) DeleteByFileID(context.Context, uint) error { return nil }

type accessPolicyService struct {
	volume.IStoragePolicyService
	policy *model.StoragePolicy
}

func (s accessPolicyService) GetPolicyByDatabaseID(context.Context, uint) (*model.StoragePolicy, error) {
	return s.policy, nil
}

type recordingDeleteProvider struct {
	storage.IStorageProvider
	deleted []string
}

func (p *recordingDeleteProvider) Delete(_ context.Context, _ *model.StoragePolicy, sources []string) error {
	p.deleted = append(p.deleted, sources...)
	return nil
}

type failingUserRepository struct{ repository.UserRepository }

func (failingUserRepository) FindByID(context.Context, uint) (*model.User, error) {
	return nil, errors.New("database unavailable")
}

func sharedRootPolicy() *model.StoragePolicy {
	return &model.StoragePolicy{ID: 1, Name: "default", Type: constant.PolicyTypeLocal, VirtualPath: "/", BasePath: "/data"}
}

func newAccessService(policy *model.StoragePolicy, files *accessFileRepository, users repository.UserRepository) (*serviceImpl, *recordingSync) {
	sync := &recordingSync{}
	return &serviceImpl{
		fileRepo:   files,
		entityRepo: &accessEntityRepository{},
		vfsSvc:     accessVFS{policy: policy},
		syncSvc:    sync,
		pathLocker: utility.NewPathLocker(),
		txManager:  uploadTransactionManager{repositories: repository.Repositories{File: files, User: users}},
	}, sync
}

// 普通用户浏览自己的根目录时，不能把共享本地根目录里他人的物理文件同步进自己的文件树。
func TestQueryByURISkipsSharedRootSyncForOrdinaryUsers(t *testing.T) {
	if err := idgen.InitSqidsEncoder(); err != nil {
		t.Fatal(err)
	}
	files := &accessFileRepository{}
	svc, sync := newAccessService(sharedRootPolicy(), files, uploadUserRepository{user: &model.User{ID: 9, UserGroupID: 2}})

	result, err := svc.QueryByURI(context.Background(), 9, 9, &uri.ParsedURI{Path: "/", Query: url.Values{}})
	if err != nil {
		t.Fatalf("QueryByURI: %v", err)
	}
	if len(sync.paths) != 0 {
		t.Fatalf("ordinary user triggered shared root sync: %v", sync.paths)
	}
	if len(result.Files) != 0 {
		t.Fatalf("expected empty listing, got %+v", result.Files)
	}
	// 用户根目录不存在时不能按 parent_id 为空查询，否则会列出所有用户的根目录。
	if files.listCalls != 0 {
		t.Fatalf("listing queried root-level records without an owner folder")
	}
}

func TestQueryByURISyncsSharedRootForAdmins(t *testing.T) {
	if err := idgen.InitSqidsEncoder(); err != nil {
		t.Fatal(err)
	}
	svc, sync := newAccessService(sharedRootPolicy(), &accessFileRepository{}, uploadUserRepository{user: &model.User{ID: 1, UserGroupID: 1}})

	if _, err := svc.QueryByURI(context.Background(), 1, 1, &uri.ParsedURI{Path: "/", Query: url.Values{}}); err != nil {
		t.Fatalf("QueryByURI: %v", err)
	}
	if len(sync.paths) != 1 || sync.paths[0] != "/" {
		t.Fatalf("admin should sync shared root, got %v", sync.paths)
	}
}

func TestSyncDirectoryIfAuthorizedRequiresMountOwner(t *testing.T) {
	nodeID := uint(2)
	policy := &model.StoragePolicy{ID: 7, Name: "cloud", Type: constant.PolicyTypeLocal, VirtualPath: "/cloud", BasePath: "/data/cloud", NodeID: &nodeID}
	files := &accessFileRepository{mount: &model.File{ID: nodeID, OwnerID: 9, Name: "cloud", Type: model.FileTypeDir}}

	svc, sync := newAccessService(policy, files, uploadUserRepository{user: &model.User{ID: 10, UserGroupID: 2}})
	if err := svc.syncDirectoryIfAuthorized(context.Background(), 10, policy, "/cloud"); err != nil {
		t.Fatalf("non-owner sync: %v", err)
	}
	if len(sync.paths) != 0 {
		t.Fatalf("non-owner synced another user's mount: %v", sync.paths)
	}

	if err := svc.syncDirectoryIfAuthorized(context.Background(), 9, policy, "/cloud"); err != nil {
		t.Fatalf("owner sync: %v", err)
	}
	if len(sync.paths) != 1 {
		t.Fatalf("mount owner should sync, got %v", sync.paths)
	}
}

func TestSyncDirectoryIfAuthorizedReturnsLookupErrors(t *testing.T) {
	svc, sync := newAccessService(sharedRootPolicy(), &accessFileRepository{}, failingUserRepository{})
	if err := svc.syncDirectoryIfAuthorized(context.Background(), 9, sharedRootPolicy(), "/"); err == nil {
		t.Fatal("expected user lookup error to be returned")
	}
	if len(sync.paths) != 0 {
		t.Fatalf("sync ran despite authorization error: %v", sync.paths)
	}
}

func newDeleteFixture() (*serviceImpl, *accessFileRepository, *accessEntityRepository, *recordingDeleteProvider) {
	policy := sharedRootPolicy()
	files := &accessFileRepository{item: &model.File{
		ID: 50, OwnerID: 9, Name: "a.txt", Type: model.FileTypeFile,
		PrimaryEntityID: types.NullUint64{Uint64: 300, Valid: true},
	}}
	entities := &accessEntityRepository{entity: &model.FileStorageEntity{ID: 300, PolicyID: policy.ID, Source: sql.NullString{String: "/data/a.txt", Valid: true}}}
	provider := &recordingDeleteProvider{}
	svc := &serviceImpl{
		policySvc:        accessPolicyService{policy: policy},
		storageProviders: map[constant.StoragePolicyType]storage.IStorageProvider{constant.PolicyTypeLocal: provider},
	}
	return svc, files, entities, provider
}

func runHardDelete(t *testing.T, ownerGroup uint) (*accessFileRepository, *accessEntityRepository, *recordingDeleteProvider) {
	t.Helper()
	svc, files, entities, provider := newDeleteFixture()
	users := uploadUserRepository{user: &model.User{ID: 9, UserGroupID: ownerGroup}}
	err := svc.HardDeleteRecursively(context.Background(), 9, 50, files, entities, accessFileEntityRepository{}, accessMetadataRepository{}, nil, accessDirectLinkRepository{}, users)
	if err != nil {
		t.Fatalf("HardDeleteRecursively: %v", err)
	}
	return files, entities, provider
}

// 普通用户删除自己名下（历史同步产生）的记录时，只删除记录，不删除共享根目录中的物理文件。
func TestHardDeleteKeepsSharedPhysicalFilesForOrdinaryUsers(t *testing.T) {
	files, entities, provider := runHardDelete(t, 2)
	if len(provider.deleted) != 0 {
		t.Fatalf("ordinary user deleted shared physical files: %v", provider.deleted)
	}
	if len(files.hardDelete) != 1 || len(entities.hardDelete) != 1 {
		t.Fatalf("records should still be removed: files=%v entities=%v", files.hardDelete, entities.hardDelete)
	}
}

func TestHardDeleteRemovesPhysicalFilesForAdmins(t *testing.T) {
	_, _, provider := runHardDelete(t, 1)
	if len(provider.deleted) != 1 || provider.deleted[0] != "/data/a.txt" {
		t.Fatalf("admin delete should remove physical file, got %v", provider.deleted)
	}
}
