package file

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/infra/storage"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/file_info"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/volume"
)

type finalizePolicyService struct {
	volume.IStoragePolicyService
	policy *model.StoragePolicy
}

func (s finalizePolicyService) GetPolicyByID(context.Context, string) (*model.StoragePolicy, error) {
	return s.policy, nil
}

type finalizeProvider struct {
	storage.IStorageProvider
	mu        sync.Mutex
	exists    bool
	checked   []string
	presigned []string
	uploaded  []string
}

func (p *finalizeProvider) Upload(_ context.Context, reader io.Reader, _ *model.StoragePolicy, path string) (*storage.UploadResult, error) {
	p.uploaded = append(p.uploaded, path)
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}
	return &storage.UploadResult{Source: path, Size: int64(len(data)), MimeType: "text/plain"}, nil
}

type uploadUserRepository struct {
	repository.UserRepository
	user *model.User
}

func (r uploadUserRepository) FindByID(_ context.Context, id uint) (*model.User, error) {
	if r.user == nil || r.user.ID != id {
		return nil, constant.ErrNotFound
	}
	return r.user, nil
}

type completingEntityRepository struct{ uploadEntityRepository }

func (completingEntityRepository) FindByID(context.Context, uint) (*model.FileStorageEntity, error) {
	return &model.FileStorageEntity{ID: 300}, nil
}

func (completingEntityRepository) Update(context.Context, *model.FileStorageEntity) error { return nil }

func setUploadUser(svc *uploadService, ownerID, groupID uint) {
	manager := svc.txManager.(uploadTransactionManager)
	manager.repositories.User = uploadUserRepository{user: &model.User{ID: ownerID, UserGroupID: groupID}}
	svc.txManager = manager
}

func (p *finalizeProvider) IsExist(_ context.Context, _ *model.StoragePolicy, key string) (bool, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.checked = append(p.checked, key)
	return p.exists, nil
}

func (p *finalizeProvider) CreatePresignedUploadURL(_ context.Context, _ *model.StoragePolicy, path string) (*storage.PresignedUploadResult, error) {
	p.presigned = append(p.presigned, path)
	return &storage.PresignedUploadResult{UploadURL: "https://upload.example.test", ExpirationDateTime: time.Now().Add(time.Hour)}, nil
}

type finalizeFileRepository struct {
	repository.FileRepository
	mount    *model.File
	writes   int
	writeErr error
}

func (r *finalizeFileRepository) FindByPath(_ context.Context, owner uint, path string) (*model.File, error) {
	if r.mount != nil && owner == r.mount.OwnerID && path == "/cloud" {
		return r.mount, nil
	}
	return nil, constant.ErrNotFound
}

func (r *finalizeFileRepository) FindOrCreateRootDirectory(_ context.Context, owner uint) (*model.File, error) {
	return &model.File{ID: 1, OwnerID: owner, Type: model.FileTypeDir}, nil
}

func (r *finalizeFileRepository) FindOrCreateDirectory(_ context.Context, parent uint, name string, owner uint) (*model.File, error) {
	return &model.File{ID: parent + 1, OwnerID: owner, Name: name, Type: model.FileTypeDir}, nil
}

func (r *finalizeFileRepository) FindByParentIDAndName(context.Context, uint, string) (*model.File, error) {
	return nil, constant.ErrNotFound
}

func (r *finalizeFileRepository) CreateOrUpdate(_ context.Context, file *model.File) (*model.File, repository.CreationStatus, error) {
	if r.writeErr != nil {
		return nil, repository.StatusError, r.writeErr
	}
	r.writes++
	file.ID = 20
	return file, repository.CreationStatus(0), nil
}

type finalizeVersionRepository struct {
	repository.FileEntityRepository
}

func (finalizeVersionRepository) Create(context.Context, *model.FileStorageVersion) error { return nil }

type finalizeMetadataRepository struct{ repository.MetadataRepository }

func (finalizeMetadataRepository) Set(context.Context, *model.Metadata) error { return nil }

func newFinalizeFixture(t *testing.T) (*uploadService, *model.StoragePolicy, *finalizeProvider, *finalizeFileRepository) {
	t.Helper()
	nodeID := uint(2)
	policy := &model.StoragePolicy{ID: 7, Type: constant.PolicyTypeS3, VirtualPath: "/cloud", BasePath: "bucket-prefix", NodeID: &nodeID, Settings: model.StoragePolicySettings{constant.UploadMethodSettingKey: constant.UploadMethodClient}}
	provider := &finalizeProvider{}
	files := &finalizeFileRepository{mount: &model.File{ID: nodeID, OwnerID: 9, Name: "cloud", Type: model.FileTypeDir}}
	cache := utility.NewMemoryCacheService()
	t.Cleanup(cache.(interface{ Stop() }).Stop)
	svc := &uploadService{
		policySvc:        finalizePolicyService{policy: policy},
		storageProviders: map[constant.StoragePolicyType]storage.IStorageProvider{constant.PolicyTypeS3: provider, constant.PolicyTypeLocal: provider, constant.PolicyTypeUpyun: provider},
		cacheSvc:         cache,
		settingSvc:       uploadSettingService{},
		metadataSvc:      file_info.NewMetadataService(finalizeMetadataRepository{}),
		txManager:        uploadTransactionManager{repositories: repository.Repositories{File: files, Entity: completingEntityRepository{}, FileEntity: finalizeVersionRepository{}, User: uploadUserRepository{user: &model.User{ID: 9, UserGroupID: 2}}}},
	}
	return svc, policy, provider, files
}

func TestFinalizeClientUploadRejectsUnsafeTargetsBeforeStorage(t *testing.T) {
	tests := []struct {
		name, uri  string
		policyType constant.StoragePolicyType
		method     string
		want       error
	}{
		{"local policy", "anzhiyu://my/cloud/file.txt", constant.PolicyTypeLocal, constant.UploadMethodClient, constant.ErrForbidden},
		{"server policy", "anzhiyu://my/cloud/file.txt", constant.PolicyTypeS3, constant.UploadMethodServer, constant.ErrForbidden},
		{"unsupported policy", "anzhiyu://my/cloud/file.txt", constant.PolicyTypeUpyun, constant.UploadMethodClient, constant.ErrForbidden},
		{"parent traversal", "anzhiyu://my/cloud/../../etc/passwd", constant.PolicyTypeS3, constant.UploadMethodClient, constant.ErrBadRequest},
		{"encoded traversal", "anzhiyu://my/cloud/%2e%2e/secret", constant.PolicyTypeS3, constant.UploadMethodClient, constant.ErrBadRequest},
		{"encoded separator", "anzhiyu://my/cloud/%2e%2e%2fsecret", constant.PolicyTypeS3, constant.UploadMethodClient, constant.ErrBadRequest},
		{"double encoded traversal", "anzhiyu://my/cloud/%252e%252e/secret", constant.PolicyTypeS3, constant.UploadMethodClient, constant.ErrBadRequest},
		{"backslash", "anzhiyu://my/cloud/..%5csecret", constant.PolicyTypeS3, constant.UploadMethodClient, constant.ErrBadRequest},
		{"dot segment", "anzhiyu://my/cloud/./file.txt", constant.PolicyTypeS3, constant.UploadMethodClient, constant.ErrBadRequest},
		{"empty segment", "anzhiyu://my/cloud//file.txt", constant.PolicyTypeS3, constant.UploadMethodClient, constant.ErrBadRequest},
		{"nul", "anzhiyu://my/cloud/file%00.txt", constant.PolicyTypeS3, constant.UploadMethodClient, constant.ErrBadRequest},
		{"directory", "anzhiyu://my/cloud/folder/", constant.PolicyTypeS3, constant.UploadMethodClient, constant.ErrBadRequest},
		{"wrong filesystem", "anzhiyu://trash/cloud/file.txt", constant.PolicyTypeS3, constant.UploadMethodClient, constant.ErrBadRequest},
		{"userinfo", "anzhiyu://other@my/cloud/file.txt", constant.PolicyTypeS3, constant.UploadMethodClient, constant.ErrBadRequest},
		{"query", "anzhiyu://my/cloud/file.txt?x=y", constant.PolicyTypeS3, constant.UploadMethodClient, constant.ErrBadRequest},
		{"fragment", "anzhiyu://my/cloud/file.txt#x", constant.PolicyTypeS3, constant.UploadMethodClient, constant.ErrBadRequest},
		{"mount prefix collision", "anzhiyu://my/cloud-other/file.txt", constant.PolicyTypeS3, constant.UploadMethodClient, constant.ErrForbidden},
		{"other mount", "anzhiyu://my/other/file.txt", constant.PolicyTypeS3, constant.UploadMethodClient, constant.ErrForbidden},
		{"mount itself", "anzhiyu://my/cloud", constant.PolicyTypeS3, constant.UploadMethodClient, constant.ErrForbidden},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc, policy, provider, files := newFinalizeFixture(t)
			policy.Type, policy.Settings[constant.UploadMethodSettingKey] = tt.policyType, tt.method
			got, err := svc.FinalizeClientUpload(context.Background(), 9, &model.FinalizeUploadRequest{URI: tt.uri, PolicyID: "policy", Size: 1})
			if got != nil || !errors.Is(err, tt.want) {
				t.Errorf("got=%v err=%v; want %v", got, err, tt.want)
			}
			if len(provider.checked) != 0 || files.writes != 0 {
				t.Errorf("rejected target reached storage/database: keys=%v writes=%d", provider.checked, files.writes)
			}
		})
	}
}

func TestCreateUploadSessionRejectsAnotherUsersMount(t *testing.T) {
	svc, _, provider, _ := newFinalizeFixture(t)
	got, err := svc.CreateUploadSession(context.Background(), 10, &model.CreateUploadRequest{URI: "anzhiyu://my/cloud/file.txt", PolicyID: "policy", Size: 1})
	if got != nil || !errors.Is(err, constant.ErrForbidden) {
		t.Errorf("another user obtained upload authorization: got=%v err=%v", got, err)
	}
	if len(provider.presigned) != 0 {
		t.Errorf("unauthorized request issued signed URL: %v", provider.presigned)
	}
}

func TestFinalizeClientUploadRequiresIssuedAuthorization(t *testing.T) {
	svc, _, provider, files := newFinalizeFixture(t)
	provider.exists = true
	got, err := svc.FinalizeClientUpload(context.Background(), 9, &model.FinalizeUploadRequest{URI: "anzhiyu://my/cloud/file.txt", PolicyID: "policy", Size: 1})
	if got != nil || !errors.Is(err, constant.ErrForbidden) {
		t.Errorf("unissued upload was finalized: got=%v err=%v", got, err)
	}
	if len(provider.checked) != 0 || files.writes != 0 {
		t.Errorf("unissued upload reached storage/database: keys=%v writes=%d", provider.checked, files.writes)
	}
}

func TestFinalizeClientUploadAcceptsIssuedCloudUploadOnce(t *testing.T) {
	svc, _, provider, files := newFinalizeFixture(t)
	ctx := context.Background()
	const target = "anzhiyu://my/cloud/sub/file.txt"
	if _, err := svc.CreateUploadSession(ctx, 9, &model.CreateUploadRequest{URI: target, PolicyID: "policy", Size: 3}); err != nil {
		t.Fatal(err)
	}
	provider.exists = true
	got, err := svc.FinalizeClientUpload(ctx, 9, &model.FinalizeUploadRequest{URI: target, PolicyID: "policy", Size: 3})
	if err != nil || got == nil || got.OwnerID != 9 || got.Name != "file.txt" {
		t.Fatalf("valid cloud upload failed: got=%v err=%v", got, err)
	}
	if len(provider.checked) != 1 || provider.checked[0] != "bucket-prefix/sub/file.txt" {
		t.Errorf("wrong cloud object: %v", provider.checked)
	}
	if _, err := svc.FinalizeClientUpload(ctx, 9, &model.FinalizeUploadRequest{URI: target, PolicyID: "policy", Size: 3}); !errors.Is(err, constant.ErrForbidden) {
		t.Errorf("authorization replay accepted: %v", err)
	}
	if files.writes != 1 {
		t.Errorf("created %d records, want 1", files.writes)
	}
}

func TestCreateUploadSessionPreservesDefaultLocalServerUpload(t *testing.T) {
	svc, policy, provider, _ := newFinalizeFixture(t)
	setUploadUser(svc, 9, 1)
	// Bootstrap creates this shared fallback before users and mount nodes exist.
	policy.Type, policy.VirtualPath, policy.NodeID = constant.PolicyTypeLocal, "/", nil
	const target = "anzhiyu://my/photos/file.txt"
	got, err := svc.CreateUploadSession(context.Background(), 9, &model.CreateUploadRequest{URI: target, PolicyID: "policy", Size: 3})
	if err != nil || got == nil || got.UploadMethod != constant.UploadMethodServer || got.SessionID == "" {
		t.Fatalf("default local upload failed: got=%v err=%v", got, err)
	}
	data, err := svc.cacheSvc.Get(context.Background(), uploadSessionCachePrefix+got.SessionID)
	if err != nil {
		t.Fatal(err)
	}
	var session model.UploadSession
	if err := json.Unmarshal([]byte(data), &session); err != nil {
		t.Fatal(err)
	}
	if session.OwnerID != 9 || session.URI != target || session.FileSize != 3 {
		t.Errorf("wrong server session: %+v", session)
	}
	if len(provider.presigned) != 0 {
		t.Errorf("local upload issued cloud URL")
	}
}

func TestCreateUploadSessionRejectsOrdinaryUsersOnSharedRootPolicy(t *testing.T) {
	for _, owner := range []uint{1, 9} {
		for _, target := range []string{"anzhiyu://my/user_avatar/victim.txt", "anzhiyu://my/article_image/victim.txt"} {
			t.Run(fmt.Sprintf("owner-%d/%s", owner, target), func(t *testing.T) {
				svc, policy, provider, files := newFinalizeFixture(t)
				policy.Type, policy.VirtualPath, policy.NodeID = constant.PolicyTypeLocal, "/", nil
				setUploadUser(svc, owner, 2)
				got, err := svc.CreateUploadSession(context.Background(), owner, &model.CreateUploadRequest{URI: target, PolicyID: "policy", Size: 3})
				if got != nil || !errors.Is(err, constant.ErrForbidden) {
					t.Errorf("ordinary user obtained root upload: got=%v err=%v", got, err)
				}
				if len(provider.uploaded) != 0 || files.writes != 0 {
					t.Errorf("rejected root upload wrote data")
				}
			})
		}
	}
}

func prepareCompletionSession(t *testing.T, svc *uploadService, target string, owner uint) *model.UploadSession {
	t.Helper()
	svc.uploadTempDir = t.TempDir()
	session := &model.UploadSession{SessionID: "legacy-session", OwnerID: owner, PolicyID: "policy", URI: target, FileSize: 3, ChunkSize: 3, TempEntityID: 300}
	dir := filepath.Join(svc.uploadTempDir, session.SessionID)
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "0"), []byte("abc"), 0600); err != nil {
		t.Fatal(err)
	}
	return session
}

func TestCompleteFileUploadRevalidatesLegacySession(t *testing.T) {
	for _, tc := range []struct {
		name, target string
		owner        uint
		root         bool
		want         error
	}{
		{"root ordinary user", "anzhiyu://my/user_avatar/victim.txt", 9, true, constant.ErrForbidden},
		{"root user ID is not admin proof", "anzhiyu://my/article_image/victim.txt", 1, true, constant.ErrForbidden},
		{"revoked mount owner", "anzhiyu://my/cloud/file.txt", 10, false, constant.ErrForbidden},
		{"traversal", "anzhiyu://my/cloud/../../victim.txt", 9, false, constant.ErrBadRequest},
		{"wrong mount", "anzhiyu://my/other/file.txt", 9, false, constant.ErrForbidden},
	} {
		t.Run(tc.name, func(t *testing.T) {
			svc, policy, provider, files := newFinalizeFixture(t)
			policy.Type = constant.PolicyTypeLocal
			if tc.root {
				policy.VirtualPath, policy.NodeID = "/", nil
			}
			setUploadUser(svc, tc.owner, 2)
			session := prepareCompletionSession(t, svc, tc.target, tc.owner)
			if err := svc.completeFileUpload(context.Background(), session); !errors.Is(err, tc.want) {
				t.Errorf("unsafe cached session error=%v; want %v", err, tc.want)
			}
			if len(provider.uploaded) != 0 || files.writes != 0 {
				t.Errorf("unsafe cached session wrote storage/database: paths=%v writes=%d", provider.uploaded, files.writes)
			}
		})
	}
}

func TestCompleteFileUploadPreservesAuthorizedLocalUploads(t *testing.T) {
	for _, root := range []bool{false, true} {
		t.Run(fmt.Sprintf("shared-root-%v", root), func(t *testing.T) {
			svc, policy, provider, files := newFinalizeFixture(t)
			policy.Type = constant.PolicyTypeLocal
			if root {
				policy.VirtualPath, policy.NodeID = "/", nil
				setUploadUser(svc, 9, 1)
			}
			session := prepareCompletionSession(t, svc, "anzhiyu://my/cloud/file.txt", 9)
			if err := svc.completeFileUpload(context.Background(), session); err != nil {
				t.Fatalf("authorized completion failed: %v", err)
			}
			if len(provider.uploaded) != 1 || provider.uploaded[0] != "/cloud/file.txt" || files.writes != 1 {
				t.Errorf("authorized upload missing: paths=%v writes=%d", provider.uploaded, files.writes)
			}
		})
	}
}

func TestCreateUploadSessionRejectsUnboundNonDefaultPolicy(t *testing.T) {
	for _, kind := range []constant.StoragePolicyType{constant.PolicyTypeLocal, constant.PolicyTypeS3} {
		t.Run(string(kind), func(t *testing.T) {
			svc, policy, provider, _ := newFinalizeFixture(t)
			policy.Type, policy.NodeID = kind, nil
			if _, err := svc.CreateUploadSession(context.Background(), 9, &model.CreateUploadRequest{URI: "anzhiyu://my/cloud/file.txt", PolicyID: "policy", Size: 3}); !errors.Is(err, constant.ErrForbidden) {
				t.Errorf("unbound policy accepted: %v", err)
			}
			if len(provider.presigned) != 0 {
				t.Errorf("unbound policy issued URL")
			}
		})
	}
}

func TestFinalizeClientUploadBindsAuthorizationToRequest(t *testing.T) {
	for _, change := range []string{"owner", "path", "policy", "size", "object key", "expired"} {
		t.Run(change, func(t *testing.T) {
			svc, policy, provider, files := newFinalizeFixture(t)
			ctx := context.Background()
			const target = "anzhiyu://my/cloud/file.txt"
			if _, err := svc.CreateUploadSession(ctx, 9, &model.CreateUploadRequest{URI: target, PolicyID: "policy", Size: 3}); err != nil {
				t.Fatal(err)
			}
			owner := uint(9)
			req := &model.FinalizeUploadRequest{URI: target, PolicyID: "policy", Size: 3}
			switch change {
			case "owner":
				owner = 10
			case "path":
				req.URI = "anzhiyu://my/cloud/other.txt"
			case "policy":
				policy.ID = 8
			case "size":
				req.Size = 4
			case "object key":
				policy.BasePath = "other-prefix"
			case "expired":
				key := clientUploadKey(owner, policy.ID, "/cloud/file.txt")
				data, err := svc.cacheSvc.Get(ctx, key)
				if err != nil {
					t.Fatal(err)
				}
				var authorization clientUploadAuthorization
				if err := json.Unmarshal([]byte(data), &authorization); err != nil {
					t.Fatal(err)
				}
				authorization.ExpiresAt = time.Now().Add(-time.Hour)
				dataBytes, err := json.Marshal(authorization)
				if err != nil {
					t.Fatal(err)
				}
				if err := svc.cacheSvc.Set(ctx, key, string(dataBytes), time.Hour); err != nil {
					t.Fatal(err)
				}
			}
			provider.exists = true
			if got, err := svc.FinalizeClientUpload(ctx, owner, req); got != nil || !errors.Is(err, constant.ErrForbidden) {
				t.Errorf("mismatched authorization accepted: got=%v err=%v", got, err)
			}
			if len(provider.checked) != 0 || files.writes != 0 {
				t.Errorf("mismatched authorization reached storage/database")
			}
		})
	}
}

func TestFinalizeClientUploadConcurrentReplayCreatesOneFile(t *testing.T) {
	svc, _, provider, files := newFinalizeFixture(t)
	ctx := context.Background()
	const target = "anzhiyu://my/cloud/file.txt"
	if _, err := svc.CreateUploadSession(ctx, 9, &model.CreateUploadRequest{URI: target, PolicyID: "policy", Size: 3}); err != nil {
		t.Fatal(err)
	}
	provider.exists = true
	var wg sync.WaitGroup
	results := make(chan error, 8)
	for i := 0; i < cap(results); i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := svc.FinalizeClientUpload(ctx, 9, &model.FinalizeUploadRequest{URI: target, PolicyID: "policy", Size: 3})
			results <- err
		}()
	}
	wg.Wait()
	close(results)
	successes := 0
	for err := range results {
		if err == nil {
			successes++
		} else if !errors.Is(err, constant.ErrForbidden) {
			t.Errorf("unexpected replay error: %v", err)
		}
	}
	if successes != 1 || files.writes != 1 {
		t.Errorf("successes=%d writes=%d; want one", successes, files.writes)
	}
}

func TestFinalizeClientUploadMissingObjectCanRetry(t *testing.T) {
	svc, _, provider, files := newFinalizeFixture(t)
	ctx := context.Background()
	const target = "anzhiyu://my/cloud/file.txt"
	if _, err := svc.CreateUploadSession(ctx, 9, &model.CreateUploadRequest{URI: target, PolicyID: "policy", Size: 3}); err != nil {
		t.Fatal(err)
	}
	req := &model.FinalizeUploadRequest{URI: target, PolicyID: "policy", Size: 3}
	if got, err := svc.FinalizeClientUpload(ctx, 9, req); got != nil || err == nil {
		t.Errorf("missing object accepted: got=%v err=%v", got, err)
	}
	provider.exists = true
	if got, err := svc.FinalizeClientUpload(ctx, 9, req); err != nil || got == nil {
		t.Errorf("retry after object becomes available failed: got=%v err=%v", got, err)
	}
	if files.writes != 1 {
		t.Errorf("writes=%d; want 1", files.writes)
	}
}

func TestFinalizeClientUploadTransactionFailureRequiresNewAuthorization(t *testing.T) {
	svc, _, provider, files := newFinalizeFixture(t)
	ctx := context.Background()
	const target = "anzhiyu://my/cloud/file.txt"
	create := &model.CreateUploadRequest{URI: target, PolicyID: "policy", Size: 3}
	if _, err := svc.CreateUploadSession(ctx, 9, create); err != nil {
		t.Fatal(err)
	}
	provider.exists = true
	files.writeErr = errors.New("database unavailable")
	req := &model.FinalizeUploadRequest{URI: target, PolicyID: "policy", Size: 3}
	if _, err := svc.FinalizeClientUpload(ctx, 9, req); !errors.Is(err, files.writeErr) {
		t.Errorf("expected write failure, got %v", err)
	}
	files.writeErr = nil
	if _, err := svc.FinalizeClientUpload(ctx, 9, req); !errors.Is(err, constant.ErrForbidden) {
		t.Errorf("consumed authorization was restored: %v", err)
	}
	if _, err := svc.CreateUploadSession(ctx, 9, create); err != nil {
		t.Fatal(err)
	}
	if got, err := svc.FinalizeClientUpload(ctx, 9, req); got == nil || err != nil {
		t.Errorf("new authorization did not recover: got=%v err=%v", got, err)
	}
}

func TestCreateUploadSessionPreservesMountedLocalServerUpload(t *testing.T) {
	svc, policy, provider, _ := newFinalizeFixture(t)
	policy.Type = constant.PolicyTypeLocal
	got, err := svc.CreateUploadSession(context.Background(), 9, &model.CreateUploadRequest{URI: "anzhiyu://my/cloud/中文%20name..txt", PolicyID: "policy", Size: 3})
	if err != nil || got == nil || got.UploadMethod != constant.UploadMethodServer || got.SessionID == "" {
		t.Fatalf("mounted local upload failed: got=%v err=%v", got, err)
	}
	if len(provider.presigned) != 0 {
		t.Errorf("local upload issued cloud URL")
	}
}
