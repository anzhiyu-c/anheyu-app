/*
 * @Description: 定义了所有存储驱动需要遵守的接口和公共结构
 * @Author: 安知鱼
 * @Date: 2025-06-28 00:21:55
 * @LastEditTime: 2025-07-23 11:26:38
 * @LastEditors: 安知鱼
 */
package storage

import (
	"context"
	"errors"
	"io"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// FileInfo 封装了 List 操作返回的单个文件或目录的信息。
// 这是为了统一本地和云端存储的列表返回结构，让上层服务（如 SyncService）可以透明处理。
type FileInfo struct {
	Name    string
	Size    int64
	IsDir   bool
	ModTime time.Time
}

// UploadResult 封装了上传操作成功后的文件信息。
type UploadResult struct {
	Source    string
	Size      int64
	MimeType  string
	Dimension string
}

// DownloadURLOptions 包含了生成下载链接时可能需要的额外参数
type DownloadURLOptions struct {
	PublicID    string // 文件的公共ID，用于本地存储签名
	ExpiresIn   int64  // 链接的有效时长（秒）
	QueryParams string // 图片处理参数（如 imageMogr2/format/avif 或 x-oss-process=image/format,webp）
}

// 定义一个错误，用于表示某个功能不被当前 Provider 支持
var ErrFeatureNotSupported = errors.New("feature not supported by this provider")

// ThumbnailResult 封装了获取缩略图的结果
type ThumbnailResult struct {
	ContentType string
	Data        []byte
}

// PresignedUploadResult 封装了客户端直传所需的预签名信息
type PresignedUploadResult struct {
	UploadURL          string    `json:"uploadUrl"`          // 预签名上传URL
	ExpirationDateTime time.Time `json:"expirationDateTime"` // URL过期时间
	ContentType        string    `json:"contentType"`        // 期望的 Content-Type，客户端上传时必须使用此值
}

// IStorageProvider 定义了所有存储提供者必须实现的接口。
type IStorageProvider interface {
	// Upload 将文件流上传到指定的存储策略。
	Upload(ctx context.Context, file io.Reader, policy *model.StoragePolicy, virtualPath string) (*UploadResult, error)
	// CreateDirectory 在存储中创建一个目录。
	CreateDirectory(ctx context.Context, policy *model.StoragePolicy, virtualPath string) error
	// Delete 删除一个或多个物理文件，需要处理空文件夹情况。
	Delete(ctx context.Context, policy *model.StoragePolicy, sources []string) error
	// GetDownloadURL 为存储中的文件生成一个临时的、可公开访问的下载链接。
	GetDownloadURL(ctx context.Context, policy *model.StoragePolicy, source string, options DownloadURLOptions) (string, error)
	// DeleteDirectory 删除一个空目录。
	DeleteDirectory(ctx context.Context, policy *model.StoragePolicy, virtualPath string) error
	// Rename 重命名或移动存储中的文件或目录。
	Rename(ctx context.Context, policy *model.StoragePolicy, oldVirtualPath, newVirtualPath string) error
	// Stream 将文件内容以流式传输到给定的写入器。
	Stream(ctx context.Context, policy *model.StoragePolicy, source string, writer io.Writer) error
	// IsExist 检查给定的源路径是否存在物理文件。
	IsExist(ctx context.Context, policy *model.StoragePolicy, source string) (bool, error)
	// Get 返回一个可读的文件流，用于服务内部的文件处理，如元数据提取。
	Get(ctx context.Context, policy *model.StoragePolicy, source string) (io.ReadCloser, error)
	// List 列出指定虚拟路径下的所有文件和目录。
	List(ctx context.Context, policy *model.StoragePolicy, virtualPath string) ([]FileInfo, error)
	// GetThumbnail 获取指定文件的缩略图。
	GetThumbnail(ctx context.Context, policy *model.StoragePolicy, source string, size string) (*ThumbnailResult, error)
}
