package file

import (
	"context"
	"database/sql"
	"strings"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/internal/infra/storage"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/types"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/volume"
)

type purgeFileRepository struct {
	repository.FileRepository
	files map[uint]*model.File
}

func (r *purgeFileRepository) ListByParentID(_ context.Context, parentID uint) ([]*model.File, error) {
	var result []*model.File
	for _, f := range r.files {
		if (parentID == 0 && !f.ParentID.Valid) || (parentID != 0 && f.ParentID.Valid && uint(f.ParentID.Int64) == parentID) {
			result = append(result, f)
		}
	}
	return result, nil
}

func (r *purgeFileRepository) ListByParentIDUnscoped(ctx context.Context, parentID uint) ([]repository.SyncItem, error) {
	files, err := r.ListByParentID(ctx, parentID)
	items := make([]repository.SyncItem, 0, len(files))
	for _, f := range files {
		items = append(items, repository.SyncItem{File: f})
	}
	return items, err
}

func (r *purgeFileRepository) FindByIDUnscoped(_ context.Context, id uint) (*model.File, error) {
	if f, ok := r.files[id]; ok {
		return f, nil
	}
	return nil, constant.ErrNotFound
}

func (r *purgeFileRepository) HardDelete(_ context.Context, id uint) error {
	delete(r.files, id)
	return nil
}

func (r *purgeFileRepository) FindByID(ctx context.Context, id uint) (*model.File, error) {
	return r.FindByIDUnscoped(ctx, id)
}

func (r *purgeFileRepository) FindByParentIDAndName(_ context.Context, parentID uint, name string) (*model.File, error) {
	for _, f := range r.files {
		if f.ParentID.Valid && uint(f.ParentID.Int64) == parentID && f.Name == name {
			return f, nil
		}
	}
	return nil, constant.ErrNotFound
}

func (r *purgeFileRepository) IsDescendant(context.Context, uint, uint) (bool, error) {
	return false, nil
}

func (r *purgeFileRepository) FindByPath(_ context.Context, owner uint, virtualPath string) (*model.File, error) {
	for _, f := range r.files {
		if virtualPath == "/" && f.OwnerID == owner && !f.ParentID.Valid {
			return f, nil
		}
	}
	for _, f := range r.files {
		if f.OwnerID == owner && virtualPath == "/"+f.Name && f.ParentID.Valid {
			if root, ok := r.files[uint(f.ParentID.Int64)]; ok && !root.ParentID.Valid {
				return f, nil
			}
		}
	}
	return nil, constant.ErrNotFound
}

type purgeUserRepository struct {
	repository.UserRepository
	users map[uint]*model.User
}

func (r purgeUserRepository) FindByID(_ context.Context, id uint) (*model.User, error) {
	if u, ok := r.users[id]; ok {
		return u, nil
	}
	return nil, constant.ErrNotFound
}

type purgePolicyRepository struct {
	repository.StoragePolicyRepository
}

func (purgePolicyRepository) FindByNodeID(context.Context, uint) (*model.StoragePolicy, error) {
	return nil, nil
}

type purgeEntityRepository struct {
	repository.EntityRepository
	entities map[uint]*model.FileStorageEntity
	deleted  []uint
}

func (r *purgeEntityRepository) FindByID(_ context.Context, id uint) (*model.FileStorageEntity, error) {
	if e, ok := r.entities[id]; ok {
		return e, nil
	}
	return nil, constant.ErrNotFound
}

func (r *purgeEntityRepository) HardDelete(_ context.Context, id uint) error {
	r.deleted = append(r.deleted, id)
	return nil
}

type purgeVFS struct {
	volume.IVFSService
	root, cloud *model.StoragePolicy
}

func (v purgeVFS) FindPolicyForPath(_ context.Context, virtualPath string) (*model.StoragePolicy, error) {
	if virtualPath == "/cloud" || strings.HasPrefix(virtualPath, "/cloud/") {
		return v.cloud, nil
	}
	return v.root, nil
}

type purgePolicyService struct {
	volume.IStoragePolicyService
	policies map[uint]*model.StoragePolicy
}

func (s purgePolicyService) GetPolicyByDatabaseID(_ context.Context, id uint) (*model.StoragePolicy, error) {
	return s.policies[id], nil
}

func purgeFile(id, owner, parent uint, name string, fileType model.FileType, entity uint) *model.File {
	f := &model.File{ID: id, OwnerID: owner, Name: name, Type: fileType}
	if parent != 0 {
		f.ParentID = sql.NullInt64{Int64: int64(parent), Valid: true}
	}
	if entity != 0 {
		f.PrimaryEntityID = types.NullUint64{Uint64: uint64(entity), Valid: true}
	}
	return f
}

func TestPurgeUnauthorizedStorageRecordsRemovesOnlyLeakedRecords(t *testing.T) {
	cloudNode := uint(21)
	root := sharedRootPolicy()
	cloud := &model.StoragePolicy{ID: 7, Name: "cloud", Type: constant.PolicyTypeLocal, VirtualPath: "/cloud", BasePath: "/data/cloud", NodeID: &cloudNode}
	files := &purgeFileRepository{files: map[uint]*model.File{
		// 普通用户 9：根目录、被同步进来的文件和目录、自己有权访问的挂载目录。
		10: purgeFile(10, 9, 0, "", model.FileTypeDir, 0),
		11: purgeFile(11, 9, 10, "leak.txt", model.FileTypeFile, 300),
		12: purgeFile(12, 9, 10, "docs", model.FileTypeDir, 0),
		13: purgeFile(13, 9, 12, "inner.txt", model.FileTypeFile, 301),
		21: purgeFile(21, 9, 10, "cloud", model.FileTypeDir, 0),
		22: purgeFile(22, 9, 21, "mine.txt", model.FileTypeFile, 302),
		// 管理员 1 的记录不应被处理。
		30: purgeFile(30, 1, 0, "", model.FileTypeDir, 0),
		31: purgeFile(31, 1, 30, "admin.txt", model.FileTypeFile, 303),
	}}
	entities := &purgeEntityRepository{entities: map[uint]*model.FileStorageEntity{
		300: {ID: 300, PolicyID: root.ID, Source: sql.NullString{String: "/data/leak.txt", Valid: true}},
		301: {ID: 301, PolicyID: root.ID, Source: sql.NullString{String: "/data/docs/inner.txt", Valid: true}},
	}}
	provider := &recordingDeleteProvider{}
	users := purgeUserRepository{users: map[uint]*model.User{1: {ID: 1, UserGroupID: 1}, 9: {ID: 9, UserGroupID: 2}}}
	svc := &serviceImpl{
		fileRepo:         files,
		vfsSvc:           purgeVFS{root: root, cloud: cloud},
		policySvc:        purgePolicyService{policies: map[uint]*model.StoragePolicy{root.ID: root, cloud.ID: cloud}},
		storageProviders: map[constant.StoragePolicyType]storage.IStorageProvider{constant.PolicyTypeLocal: provider},
		txManager: uploadTransactionManager{repositories: repository.Repositories{
			File: files, User: users, Entity: entities, FileEntity: accessFileEntityRepository{},
			Metadata: accessMetadataRepository{}, StoragePolicy: purgePolicyRepository{}, DirectLink: accessDirectLinkRepository{},
		}},
	}

	removed, err := svc.PurgeUnauthorizedStorageRecords(context.Background())
	if err != nil {
		t.Fatalf("PurgeUnauthorizedStorageRecords: %v", err)
	}
	if removed != 3 {
		t.Fatalf("expected 3 removed records, got %d", removed)
	}
	for _, id := range []uint{11, 12, 13} {
		if _, ok := files.files[id]; ok {
			t.Errorf("leaked record %d was not removed", id)
		}
	}
	for _, id := range []uint{10, 21, 22, 30, 31} {
		if _, ok := files.files[id]; !ok {
			t.Errorf("record %d should be kept", id)
		}
	}
	if len(provider.deleted) != 0 {
		t.Fatalf("purge must not delete physical files: %v", provider.deleted)
	}
	if len(entities.deleted) != 2 {
		t.Fatalf("leaked entity records should be removed, got %v", entities.deleted)
	}

	// 再次运行不应有任何变化。
	again, err := svc.PurgeUnauthorizedStorageRecords(context.Background())
	if err != nil || again != 0 {
		t.Fatalf("second run should be a no-op: removed=%d err=%v", again, err)
	}
}
