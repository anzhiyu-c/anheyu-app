package file

import (
	"context"
	"io"
	"net/http"
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/infra/storage"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/event"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/uri"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/file_info"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/process"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/volume"
)

// FileService 定义了所有与文件和目录相关的核心业务逻辑。
// 它是连接上层 handler 和底层 repository 的桥梁，负责处理权限、业务规则和多个数据源的协调。
type FileService interface {
	// QueryByURI 根据给定的虚拟文件系统URI查询文件列表。
	QueryByURI(ctx context.Context, ownerID, viewerID uint, parsedURI *uri.ParsedURI) (*model.FileListResponse, error)
	// CreateEmptyFile 在指定的虚拟路径下创建一个空文件或目录。
	CreateEmptyFile(ctx context.Context, ownerID uint, req *model.CreateFileRequest) (*model.FileItem, error)
	// UpdateFolderViewConfig 更新指定文件夹的视图配置。
	UpdateFolderViewConfig(ctx context.Context, ownerID uint, req *model.UpdateViewConfigRequest) (*model.View, error)
	// GetFileInfo 根据文件的公共ID获取单个文件或目录的详细信息。
	GetFileInfo(ctx context.Context, viewerID uint, publicFileID string) (*model.FileInfoResponse, error)
	// UpdateFileContent 更新一个已存在的文件的内容
	UpdateFileContentByIDAndURI(ctx context.Context, viewerPublicID, filePublicID, uriStr string, contentReader io.Reader) (*model.UpdateResult, error)

	// DeleteItems 根据一个或多个公共ID，批量永久删除文件或目录。
	DeleteItems(ctx context.Context, ownerID uint, publicIDs []string) error
	// RenameItem 重命名一个文件或目录。
	RenameItem(ctx context.Context, ownerID uint, req *model.RenameItemRequest) (*model.FileInfoResponse, error)
	// Download 提供一个流式下载文件的服务。
	Download(ctx context.Context, viewerID uint, publicFileID string, writer io.Writer) (*DownloadResult, error)
	// GetDownloadInfo 获取文件的下载信息，告诉前端应该如何下载文件。
	GetDownloadInfo(ctx context.Context, viewerID uint, publicFileID string) (*DownloadInfo, error)
	// GetFolderTree 获取一个文件夹下所有子文件的树状结构列表，用于打包下载。
	GetFolderTree(ctx context.Context, viewerID uint, publicFolderID string) (*model.FolderTreeResponse, error)
	// ProcessSignedDownload 验证并处理一个带签名的下载请求。
	ProcessSignedDownload(c context.Context, w http.ResponseWriter, r *http.Request, publicFileID string) error
	// GetFolderSize 计算并返回指定文件夹的逻辑大小和实际占用空间。
	GetFolderSize(ctx context.Context, ownerID uint, publicFolderID string) (*model.FolderSize, error)
	// MoveItems 将指定的文件或目录从一个位置移动到另一个位置。
	MoveItems(ctx context.Context, ownerID uint, sourcePublicIDs []string, destPublicFolderID string) error
	// CopyItems 将一个或多个源文件/文件夹复制到目标文件夹。
	CopyItems(ctx context.Context, ownerID uint, sourcePublicIDs []string, destPublicFolderID string) error
	// FindAndValidateFile 根据公共ID和查看者ID查找并验证文件。
	FindAndValidateFile(ctx context.Context, publicID string, viewerID uint) (*model.File, error)
	// GetFolderPath 根据文件夹的数据库ID获取其完整的虚拟路径。
	GetFolderPath(ctx context.Context, folderID uint) (string, error)
	// GetDownloadURLForFile 为指定的文件生成一个带签名的下载链接 (默认1小时过期)。
	GetDownloadURLForFile(ctx context.Context, file *model.File, publicFileID string) (string, error)
	// GetDownloadURLForFileWithExpiration 为指定的文件生成一个具有自定义过期时间的带签名下载链接。
	GetDownloadURLForFileWithExpiration(ctx context.Context, file *model.File, publicFileID string, expiresAt time.Time) (string, error)
	// GetPreviewURLs 获取指定文件的预览链接列表及元信息。
	GetPreviewURLs(ctx context.Context, viewerPublicID string, currentFilePublicID string) ([]model.PreviewURLItem, int, error)
	// GetFileDownloadURLForViewer 为指定文件生成一个供查看者下载的链接。
	ServeSignedContent(ctx context.Context, token string, writer http.ResponseWriter, request *http.Request) error
	// ListAllDescendantFiles 递归获取目录下所有文件的方法
	ListAllDescendantFiles(ctx context.Context, folderID uint) ([]*model.File, error)

	// 只根据公共ID查找文件，不进行所有权验证。用于系统内部渲染等已确认安全的场景。
	FindFileByPublicID(ctx context.Context, publicID string) (*model.File, error)

	// UploadFileByPolicyFlag 根据策略标志（如 article_image）上传文件。
	UploadFileByPolicyFlag(ctx context.Context, viewerID uint, fileReader io.Reader, policyFlag, filename string) (*model.FileItem, error)

	// UploadFileByPolicyFlagWithGroup 根据策略标志上传文件，并检查用户组权限。
	// userGroupID 为 0 表示不检查用户组权限（仅适用于系统内部调用）。
	UploadFileByPolicyFlagWithGroup(ctx context.Context, viewerID, userGroupID uint, fileReader io.Reader, policyFlag, filename string) (*model.FileItem, error)

	// GetProviderForPolicy 根据存储策略获取对应的存储提供者实例
	GetProviderForPolicy(policy *model.StoragePolicy) (storage.IStorageProvider, error)

	// GetPolicyByFlag 根据策略标志（如 article_image）获取存储策略
	GetPolicyByFlag(ctx context.Context, policyFlag string) (*model.StoragePolicy, error)
}

// serviceImpl 是 FileService 接口的实现。
type serviceImpl struct {
	fileRepo          repository.FileRepository
	storagePolicyRepo repository.StoragePolicyRepository
	txManager         repository.TransactionManager
	entityRepo        repository.EntityRepository
	fileEntityRepo    repository.FileEntityRepository
	userGroupRepo     repository.UserGroupRepository
	metadataService   *file_info.MetadataService
	extractionSvc     *file_info.ExtractionService
	cacheSvc          utility.CacheService
	policySvc         volume.IStoragePolicyService
	settingSvc        setting.SettingService
	syncSvc           process.ISyncService
	vfsSvc            volume.IVFSService
	storageProviders  map[constant.StoragePolicyType]storage.IStorageProvider
	eventBus          *event.EventBus
	pathLocker        *utility.PathLocker
}

// NewService 是 serviceImpl 的构造函数，通过依赖注入接收所有必要的依赖项。
func NewService(
	fileRepo repository.FileRepository,
	storagePolicyRepo repository.StoragePolicyRepository,
	txManager repository.TransactionManager,
	entityRepo repository.EntityRepository,
	fileEntityRepo repository.FileEntityRepository,
	userGroupRepo repository.UserGroupRepository,
	metadataService *file_info.MetadataService,
	extractionSvc *file_info.ExtractionService,
	cacheSvc utility.CacheService,
	policySvc volume.IStoragePolicyService,
	settingSvc setting.SettingService,
	syncSvc process.ISyncService,
	vfsSvc volume.IVFSService,
	providers map[constant.StoragePolicyType]storage.IStorageProvider,
	eventBus *event.EventBus,
	pathLocker *utility.PathLocker,
) FileService {
	return &serviceImpl{
		fileRepo:          fileRepo,
		storagePolicyRepo: storagePolicyRepo,
		txManager:         txManager,
		entityRepo:        entityRepo,
		fileEntityRepo:    fileEntityRepo,
		userGroupRepo:     userGroupRepo,
		metadataService:   metadataService,
		extractionSvc:     extractionSvc,
		cacheSvc:          cacheSvc,
		policySvc:         policySvc,
		settingSvc:        settingSvc,
		syncSvc:           syncSvc,
		vfsSvc:            vfsSvc,
		storageProviders:  providers,
		eventBus:          eventBus,
		pathLocker:        pathLocker,
	}
}
