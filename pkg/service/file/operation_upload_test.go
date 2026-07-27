package file

import (
	"bytes"
	"context"
	"io"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/internal/infra/storage"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/event"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
)

type uploadCaptureProvider struct {
	storage.IStorageProvider
	data  []byte
	calls int
}

func (p *uploadCaptureProvider) Upload(
	_ context.Context,
	reader io.Reader,
	_ *model.StoragePolicy,
	_ string,
) (*storage.UploadResult, error) {
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}
	p.data = append([]byte(nil), data...)
	p.calls++
	return &storage.UploadResult{
		Source:   "/article-images/original.jpg",
		Size:     int64(len(data)),
		MimeType: "image/jpeg",
	}, nil
}

type uploadPolicyRepository struct {
	repository.StoragePolicyRepository
	policy *model.StoragePolicy
}

func (r uploadPolicyRepository) FindByFlag(context.Context, string) (*model.StoragePolicy, error) {
	return r.policy, nil
}

type uploadFileRepository struct {
	repository.FileRepository
	parent *model.File
}

func (r uploadFileRepository) FindByID(context.Context, uint) (*model.File, error) {
	return r.parent, nil
}

func (r uploadFileRepository) FindByIDUnscoped(context.Context, uint) (*model.File, error) {
	return r.parent, nil
}

func (uploadFileRepository) Create(_ context.Context, file *model.File) error {
	file.ID = 200
	return nil
}

type uploadEntityRepository struct {
	repository.EntityRepository
}

func (uploadEntityRepository) Create(_ context.Context, entity *model.FileStorageEntity) error {
	entity.ID = 300
	return nil
}

type uploadTransactionManager struct {
	repositories repository.Repositories
}

func (m uploadTransactionManager) Do(
	ctx context.Context,
	fn func(repository.Repositories) error,
) error {
	return fn(m.repositories)
}

type uploadSettingService struct {
	setting.SettingService
}

func (uploadSettingService) Get(string) string { return "" }

func TestUploadFileByPolicyFlag_AutoCompressPreservesOriginalBytes(t *testing.T) {
	nodeID := uint(10)
	policy := &model.StoragePolicy{
		ID:     7,
		Flag:   "article_image",
		Type:   constant.PolicyTypeLocal,
		NodeID: &nodeID,
		Settings: model.StoragePolicySettings{
			constant.ImageProcessSettingsKey: map[string]any{
				"enabled": true,
				"auto_compress": map[string]any{
					"enabled":    true,
					"format":     "webp",
					"quality":    70,
					"max_width":  1600,
					"max_height": 1600,
				},
			},
		},
	}
	parent := &model.File{
		ID:   nodeID,
		Name: "article-images",
		Type: model.FileTypeDir,
	}
	fileRepo := uploadFileRepository{parent: parent}
	entityRepo := uploadEntityRepository{}
	provider := &uploadCaptureProvider{}
	bus := event.NewEventBus()
	t.Cleanup(bus.Shutdown)

	service := &serviceImpl{
		storagePolicyRepo: uploadPolicyRepository{policy: policy},
		txManager: uploadTransactionManager{repositories: repository.Repositories{
			File:   fileRepo,
			Entity: entityRepo,
		}},
		settingSvc: uploadSettingService{},
		storageProviders: map[constant.StoragePolicyType]storage.IStorageProvider{
			constant.PolicyTypeLocal: provider,
		},
		eventBus: bus,
	}

	original := []byte{
		0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 'J', 'F', 'I', 'F',
		0x00, 0x01, 0x02, 0x03, 0xff, 0xd9,
	}
	item, err := service.UploadFileByPolicyFlag(
		context.Background(),
		1,
		bytes.NewReader(original),
		"article_image",
		"original.jpg",
	)
	if err != nil {
		t.Fatalf("UploadFileByPolicyFlag: %v", err)
	}
	if provider.calls != 1 {
		t.Fatalf("Provider.Upload 调用次数=%d，期望 1", provider.calls)
	}
	if !bytes.Equal(provider.data, original) {
		t.Fatalf("开启自动压缩后上传字节发生变化：got=%x want=%x", provider.data, original)
	}
	if item == nil || item.Size != int64(len(original)) {
		t.Fatalf("上传结果大小=%v，期望 %d", item, len(original))
	}
}
