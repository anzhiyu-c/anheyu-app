// internal/infra/storage/local.go
package storage

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// LocalProvider 实现了 IStorageProvider 接口，用于处理与本机磁盘文件系统的所有交互。
type LocalProvider struct {
	signingSecret string
}

// NewLocalProvider 是 LocalProvider 的构造函数，接收一个用于URL签名的密钥。
func NewLocalProvider(secret string) IStorageProvider {
	return &LocalProvider{
		signingSecret: secret,
	}
}

// copyFile 复制文件从 src 到 dst，用于跨文件系统的文件移动
func copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("无法打开源文件: %w", err)
	}
	defer sourceFile.Close()

	destFile, err := os.Create(dst)
	if err != nil {
		return fmt.Errorf("无法创建目标文件: %w", err)
	}
	defer destFile.Close()

	if _, err := io.Copy(destFile, sourceFile); err != nil {
		return fmt.Errorf("复制文件内容失败: %w", err)
	}

	// 确保数据写入磁盘
	if err := destFile.Sync(); err != nil {
		return fmt.Errorf("同步文件到磁盘失败: %w", err)
	}

	return nil
}

// List 实现了为本地文件系统列出目录内容的功能。
func (p *LocalProvider) List(ctx context.Context, policy *model.StoragePolicy, virtualPath string) ([]FileInfo, error) {
	relativePath := strings.TrimPrefix(virtualPath, policy.VirtualPath)
	physicalPath := filepath.Join(policy.BasePath, relativePath)

	log.Printf("[LocalProvider.List-DEBUG] Attempting to read directory at physical path: '%s'", physicalPath)

	entries, err := os.ReadDir(physicalPath)
	if err != nil {
		// 如果目录不存在，返回一个空列表和 nil 错误，这符合 List 的语义
		if os.IsNotExist(err) {
			return []FileInfo{}, nil
		}
		return nil, fmt.Errorf("无法读取本地目录 '%s': %w", physicalPath, err)
	}

	result := make([]FileInfo, 0, len(entries))
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			log.Printf("警告: 无法获取文件 '%s' 的信息: %v", entry.Name(), err)
			continue
		}
		result = append(result, FileInfo{
			Name:    info.Name(),
			Size:    info.Size(),
			IsDir:   info.IsDir(),
			ModTime: info.ModTime(),
		})
	}

	return result, nil
}

// Get 实现了从本机磁盘获取文件读取器的逻辑。
func (p *LocalProvider) Get(ctx context.Context, policy *model.StoragePolicy, source string) (io.ReadCloser, error) {
	// 数据库中存储的是绝对路径，因此 `source` 参数本身就是要打开的完整路径。
	// 不需要使用 policy.BasePath 进行拼接。
	// policy 参数在这里是为了满足接口统一性，但在此实现中可以不使用。

	log.Printf("[LocalProvider.Get-DEBUG] 收到 Get 请求，将直接使用 source 作为绝对路径: '%s'", source)

	file, err := os.Open(source)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("物理文件不存在: %s", source)
		}
		return nil, fmt.Errorf("无法打开物理文件 '%s': %w", source, err)
	}
	return file, nil
}

// GetDownloadURL 为本地文件生成一个带签名的、有时间限制的临时下载链接。
func (p *LocalProvider) GetDownloadURL(ctx context.Context, policy *model.StoragePolicy, source string, options DownloadURLOptions) (string, error) {
	if options.PublicID == "" {
		return "", errors.New("生成本地下载链接需要文件公共ID")
	}
	if p.signingSecret == "" {
		return "", errors.New("签名密钥未提供给LocalProvider")
	}
	expiresIn := options.ExpiresIn
	if expiresIn <= 0 {
		expiresIn = 3600 // 默认1小时
	}
	expires := time.Now().Add(time.Duration(expiresIn) * time.Second).Unix()
	stringToSign := fmt.Sprintf("%s:%d", options.PublicID, expires)
	mac := hmac.New(sha256.New, []byte(p.signingSecret))
	mac.Write([]byte(stringToSign))
	signature := base64.URLEncoding.EncodeToString(mac.Sum(nil))
	downloadURL := fmt.Sprintf(
		"/api/download/local/%s?expires=%d&sign=%s",
		url.PathEscape(options.PublicID),
		expires,
		url.QueryEscape(signature),
	)
	return downloadURL, nil
}

// Stream 实现了从本机磁盘流式读取文件并将其内容写入给定的 io.Writer。
func (p *LocalProvider) Stream(ctx context.Context, policy *model.StoragePolicy, source string, writer io.Writer) error {
	file, err := os.Open(source)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("物理文件不存在: %s", source)
		}
		return fmt.Errorf("无法打开物理文件 '%s': %w", source, err)
	}
	defer file.Close()
	_, err = io.Copy(writer, file)
	if err != nil {
		return fmt.Errorf("流式传输文件内容时发生错误: %w", err)
	}
	return nil
}

// CreateDirectory 实现了在本机创建物理目录的逻辑。
func (p *LocalProvider) CreateDirectory(ctx context.Context, policy *model.StoragePolicy, virtualPath string) error {
	relativePath := strings.TrimPrefix(virtualPath, policy.VirtualPath)
	physicalPath := filepath.Join(policy.BasePath, relativePath)
	if err := os.MkdirAll(physicalPath, os.ModePerm); err != nil {
		return fmt.Errorf("无法创建物理目录 '%s': %w", physicalPath, err)
	}
	return nil
}

// Upload 实现了将文件流保存到本机磁盘的逻辑。
func (p *LocalProvider) Upload(ctx context.Context, file io.Reader, policy *model.StoragePolicy, virtualPath string) (*UploadResult, error) {
	processingTempDir := "data/temp"
	if err := os.MkdirAll(processingTempDir, os.ModePerm); err != nil {
		return nil, fmt.Errorf("无法创建用于处理的临时目录 '%s': %w", processingTempDir, err)
	}

	tempFile, err := os.CreateTemp(processingTempDir, "anheyu-app-processing-*.tmp")
	if err != nil {
		return nil, fmt.Errorf("无法在 '%s' 目录创建临时文件: %w", processingTempDir, err)
	}
	defer os.Remove(tempFile.Name())
	defer tempFile.Close()

	size, err := io.Copy(tempFile, file)
	if err != nil {
		return nil, fmt.Errorf("写入处理临时文件失败: %w", err)
	}

	if _, err := tempFile.Seek(0, io.SeekStart); err != nil {
		return nil, fmt.Errorf("无法重置临时文件指针以检测MIME类型: %w", err)
	}
	buffer := make([]byte, 512)
	n, err := tempFile.Read(buffer)
	if err != nil && err != io.EOF {
		return nil, fmt.Errorf("读取文件头以检测MIME类型失败: %w", err)
	}
	mimeType := http.DetectContentType(buffer[:n])

	// 修正 SVG 文件的 MIME 类型：http.DetectContentType 会将 SVG 识别为 text/plain 或 text/xml
	// 需要根据文件扩展名来正确识别
	ext := strings.ToLower(filepath.Ext(virtualPath))
	if ext == ".svg" {
		mimeType = "image/svg+xml"
	}

	if _, err := tempFile.Seek(0, io.SeekStart); err != nil {
		return nil, fmt.Errorf("无法重置临时文件指针以检测图片尺寸: %w", err)
	}
	imgConfig, _, err := image.DecodeConfig(tempFile)
	var dimension string
	if err == nil {
		dimension = fmt.Sprintf("%dx%d", imgConfig.Width, imgConfig.Height)
	}

	relativePath := strings.TrimPrefix(virtualPath, policy.VirtualPath)
	finalPath := filepath.Join(policy.BasePath, relativePath)
	finalDir := filepath.Dir(finalPath)
	if err := os.MkdirAll(finalDir, os.ModePerm); err != nil {
		return nil, fmt.Errorf("无法创建挂载子目录 '%s': %w", finalDir, err)
	}

	// 关闭文件句柄，准备移动
	tempFileName := tempFile.Name()
	tempFile.Close()

	// 尝试使用 os.Rename (高效)，如果失败则使用 copy + delete (兼容跨文件系统)
	if err := os.Rename(tempFileName, finalPath); err != nil {
		// os.Rename 失败，可能是跨文件系统，使用 copy + delete 方式
		if err := copyFile(tempFileName, finalPath); err != nil {
			os.Remove(tempFileName) // 清理临时文件
			return nil, fmt.Errorf("复制文件到最终存储位置 '%s' 失败: %w", finalPath, err)
		}
		// 复制成功，删除临时文件
		os.Remove(tempFileName)
	}

	result := &UploadResult{
		Source:    finalPath,
		Size:      size,
		MimeType:  mimeType,
		Dimension: dimension,
	}
	return result, nil
}

// Delete 实现了删除本机上一个或多个物理文件或目录的逻辑。
func (p *LocalProvider) Delete(ctx context.Context, policy *model.StoragePolicy, sources []string) error {
	for _, source := range sources {
		info, err := os.Stat(source)
		if err != nil {
			if os.IsNotExist(err) {
				// 文件或目录已经不存在，静默处理
				continue
			}
			log.Printf("警告: 无法获取 '%s' 的信息，跳过删除: %v\n", source, err)
			continue
		}

		var removeErr error
		if info.IsDir() {
			// 如果是目录，使用 RemoveAll 保证能删除（即使里面有意外残留文件）
			removeErr = os.RemoveAll(source)
		} else {
			// 如果是文件，使用 Remove
			removeErr = os.Remove(source)
		}

		if removeErr != nil {
			// 只记录错误，不中断整个批量删除过程
			log.Printf("警告: 删除本地资源 '%s' 失败: %v\n", source, removeErr)
		}
	}
	return nil
}

// DeleteDirectory 实现了删除本机上一个空目录的逻辑。
func (p *LocalProvider) DeleteDirectory(ctx context.Context, policy *model.StoragePolicy, virtualPath string) error {
	relativePath := strings.TrimPrefix(virtualPath, policy.VirtualPath)
	physicalPath := filepath.Join(policy.BasePath, relativePath)
	err := os.Remove(physicalPath)
	if os.IsNotExist(err) {
		return nil
	}
	return err
}

// Rename 重命名本地文件系统上的文件或目录。
func (p *LocalProvider) Rename(ctx context.Context, policy *model.StoragePolicy, oldVirtualPath, newVirtualPath string) error {
	oldRelativePath := strings.TrimPrefix(oldVirtualPath, policy.VirtualPath)
	newRelativePath := strings.TrimPrefix(newVirtualPath, policy.VirtualPath)
	oldAbsPath := filepath.Join(policy.BasePath, oldRelativePath)
	newAbsPath := filepath.Join(policy.BasePath, newRelativePath)

	destDir := filepath.Dir(newAbsPath)
	if err := os.MkdirAll(destDir, os.ModePerm); err != nil {
		return fmt.Errorf("无法创建目标目录 '%s': %w", destDir, err)
	}

	err := os.Rename(oldAbsPath, newAbsPath)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("%w: %s", constant.ErrNotFound, err.Error())
		}
		return fmt.Errorf("使用 os.Rename 从 '%s' 到 '%s' 失败: %w", oldAbsPath, newAbsPath, err)
	}
	return nil
}

// IsExist 检查本地文件系统中指定路径的文件或目录是否存在。
func (p *LocalProvider) IsExist(ctx context.Context, policy *model.StoragePolicy, source string) (bool, error) {
	_, err := os.Stat(source)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, err
}

// GetThumbnail 实现了 IStorageProvider 接口。
// 对于本地存储，它不提供原生缩略图功能，因此总是返回 ErrFeatureNotSupported。
func (p *LocalProvider) GetThumbnail(ctx context.Context, policy *model.StoragePolicy, source string, size string) (*ThumbnailResult, error) {
	return nil, ErrFeatureNotSupported
}
