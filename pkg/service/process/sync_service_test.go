package process

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/internal/infra/storage"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/types"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/volume"
)

type syncTestProvider struct {
	storage.IStorageProvider
	items       []storage.FileInfo
	err         error
	createCalls int
}

func (p *syncTestProvider) List(context.Context, *model.StoragePolicy, string) ([]storage.FileInfo, error) {
	return p.items, p.err
}

func (p *syncTestProvider) CreateDirectory(context.Context, *model.StoragePolicy, string) error {
	p.createCalls++
	return errors.New("unexpected directory creation")
}

type syncTestFiles struct {
	repository.FileRepository
	items     []repository.SyncItem
	findCalls int
	deleted   []uint
}

func (r *syncTestFiles) FindByPath(context.Context, uint, string) (*model.File, error) {
	r.findCalls++
	return &model.File{ID: 1, Type: model.FileTypeDir}, nil
}

func (r *syncTestFiles) ListByParentIDUnscoped(context.Context, uint) ([]repository.SyncItem, error) {
	return r.items, nil
}

func (r *syncTestFiles) FindByIDUnscoped(_ context.Context, id uint) (*model.File, error) {
	for _, item := range r.items {
		if item.File.ID == id {
			return item.File, nil
		}
	}
	return nil, constant.ErrNotFound
}

func (r *syncTestFiles) HardDelete(_ context.Context, id uint) error {
	r.deleted = append(r.deleted, id)
	for i, item := range r.items {
		if item.File.ID == id {
			r.items = append(r.items[:i], r.items[i+1:]...)
			break
		}
	}
	return nil
}

type syncTestEntities struct {
	repository.EntityRepository
	deleted []uint
}

func (r *syncTestEntities) HardDelete(_ context.Context, id uint) error {
	r.deleted = append(r.deleted, id)
	return nil
}

type syncTestFileEntities struct {
	repository.FileEntityRepository
	deleted []uint
}

func (r *syncTestFileEntities) DeleteByFileID(_ context.Context, id uint) error {
	r.deleted = append(r.deleted, id)
	return nil
}

type syncTestMetadata struct {
	repository.MetadataRepository
	deleted []uint
}

func (r *syncTestMetadata) DeleteByFileID(_ context.Context, id uint) error {
	r.deleted = append(r.deleted, id)
	return nil
}

type syncTestDirectLinks struct {
	repository.DirectLinkRepository
	deleted []uint
}

func (r *syncTestDirectLinks) DeleteByFileID(_ context.Context, id uint) error {
	r.deleted = append(r.deleted, id)
	return nil
}

type syncTestPolicies struct{ volume.IStoragePolicyService }

func (syncTestPolicies) ListAll(context.Context) ([]*model.StoragePolicy, error) {
	return nil, nil
}

// 记录服务是否调度写事务；本组测试不执行任何真实数据库操作。
type syncTestTransactions struct {
	calls int
	repos *repository.Repositories
}

func (tx *syncTestTransactions) Do(_ context.Context, fn func(repository.Repositories) error) error {
	tx.calls++
	if tx.repos != nil {
		return fn(*tx.repos)
	}
	return nil
}

func TestSyncDirectorySkipsFailedListings(t *testing.T) {
	for _, tc := range []struct {
		name string
		err  error
	}{
		{"request failure", errors.New("access denied")},
		{"cancelled", context.Canceled},
		{"incomplete pagination", fmt.Errorf("%w: missing cursor", storage.ErrIncompleteListing)},
		{"later page not found", fmt.Errorf("%w: 404 item does not exist", storage.ErrIncompleteListing)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			provider := &syncTestProvider{items: []storage.FileInfo{{Name: "first.png"}}, err: tc.err}
			files := &syncTestFiles{}
			tx := &syncTestTransactions{}
			policy := &model.StoragePolicy{Type: constant.PolicyTypeOneDrive, VirtualPath: "/mount"}
			svc := &syncService{
				fileRepo: files, txManager: tx,
				storageProviders: map[constant.StoragePolicyType]storage.IStorageProvider{policy.Type: provider},
			}
			if err := svc.SyncDirectory(context.Background(), 1, policy, "/mount"); err != nil {
				t.Fatalf("failed listing should skip reconciliation: %v", err)
			}
			if files.findCalls != 0 || tx.calls != 0 || provider.createCalls != 0 {
				t.Fatalf("incomplete listing touched state: find=%d transactions=%d createDirectory=%d", files.findCalls, tx.calls, provider.createCalls)
			}
		})
	}
}

func TestSyncDirectoryKeepsFilesOnLaterStoragePages(t *testing.T) {
	var requests int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		var body string
		switch r.URL.Query().Get("continuation-token") {
		case "":
			body = `<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>page2</NextContinuationToken><Contents><Key>first.png</Key><Size>1</Size></Contents></ListBucketResult>`
		case "page2":
			body = `<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>later.png</Key><Size>1</Size></Contents></ListBucketResult>`
		default:
			t.Errorf("unexpected token: %s", r.URL.Query().Get("continuation-token"))
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/xml")
		if _, err := fmt.Fprint(w, body); err != nil {
			t.Errorf("write response: %v", err)
		}
	}))
	defer server.Close()
	files := &syncTestFiles{items: []repository.SyncItem{
		{File: &model.File{ID: 2, Name: "first.png", Type: model.FileTypeFile, PrimaryEntityID: types.NullUint64{Uint64: 2, Valid: true}}},
		{File: &model.File{ID: 3, Name: "later.png", Type: model.FileTypeFile, PrimaryEntityID: types.NullUint64{Uint64: 3, Valid: true}}},
	}}
	tx := &syncTestTransactions{}
	policy := &model.StoragePolicy{
		Type: constant.PolicyTypeS3, VirtualPath: "/mount", Server: server.URL,
		BucketName: "bucket", AccessKey: "test-key", SecretKey: "test-secret",
	}
	svc := &syncService{
		fileRepo: files, txManager: tx, storagePolicySvc: syncTestPolicies{},
		storageProviders: map[constant.StoragePolicyType]storage.IStorageProvider{policy.Type: storage.NewAWSS3Provider()},
	}
	if err := svc.SyncDirectory(context.Background(), 1, policy, "/mount"); err != nil {
		t.Fatal(err)
	}
	if tx.calls != 0 {
		t.Fatalf("existing later-page file triggered %d write transactions", tx.calls)
	}
	if requests != 2 {
		t.Fatalf("listing requests = %d, want 2", requests)
	}
}

func TestSyncDirectoryCompleteEmptyListingStillReconciles(t *testing.T) {
	files := &syncTestFiles{items: []repository.SyncItem{{File: &model.File{
		ID: 2, OwnerID: 1, Name: "removed.png", Type: model.FileTypeFile,
		PrimaryEntityID: types.NullUint64{Uint64: 9, Valid: true},
	}}}}
	entities := &syncTestEntities{}
	fileEntities := &syncTestFileEntities{}
	metadata := &syncTestMetadata{}
	directLinks := &syncTestDirectLinks{}
	tx := &syncTestTransactions{repos: &repository.Repositories{
		File: files, Entity: entities, FileEntity: fileEntities, Metadata: metadata, DirectLink: directLinks,
	}}
	policy := &model.StoragePolicy{Type: constant.PolicyTypeS3, VirtualPath: "/mount"}
	svc := &syncService{
		fileRepo: files, txManager: tx, storagePolicySvc: syncTestPolicies{},
		storageProviders: map[constant.StoragePolicyType]storage.IStorageProvider{policy.Type: &syncTestProvider{}},
	}
	if err := svc.SyncDirectory(context.Background(), 1, policy, "/mount"); err != nil {
		t.Fatal(err)
	}
	if tx.calls != 1 {
		t.Fatalf("complete empty listing scheduled %d cleanup transactions, want 1", tx.calls)
	}
	for name, ids := range map[string][]uint{
		"file": files.deleted, "file entities": fileEntities.deleted,
		"metadata": metadata.deleted, "direct links": directLinks.deleted,
	} {
		if len(ids) != 1 || ids[0] != 2 {
			t.Errorf("%s cleanup IDs = %v, want [2]", name, ids)
		}
	}
	if len(entities.deleted) != 1 || entities.deleted[0] != 9 {
		t.Errorf("entity cleanup IDs = %v, want [9]", entities.deleted)
	}
	if len(files.items) != 0 {
		t.Errorf("missing file was not removed: %+v", files.items)
	}
}
