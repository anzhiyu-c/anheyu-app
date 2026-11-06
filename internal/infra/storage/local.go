// internal/infra/storage/local.go
package storage

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"io/fs"
	"log"
	"net/http"
	"net/url"
	"os"
	"path"
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

// localStorageError 保留错误类型，但不向调用方暴露真实物理路径。
func localStorageError(operation string, err error) error {
	var pathErr *os.PathError
	var linkErr *os.LinkError
	if errors.As(err, &pathErr) {
		err = pathErr.Err
	} else if errors.As(err, &linkErr) {
		err = linkErr.Err
	}
	return fmt.Errorf("%s: %w", operation, err)
}

func closeLocalResource(resource io.Closer) {
	if err := resource.Close(); err != nil {
		log.Printf("警告: %v", localStorageError("关闭本地存储资源失败", err))
	}
}

func isLocalUploadTemporary(name string) bool {
	const prefix = ".anheyu-upload-"
	const suffix = ".tmp"
	if !strings.HasPrefix(name, prefix) || !strings.HasSuffix(name, suffix) {
		return false
	}
	token := strings.TrimSuffix(strings.TrimPrefix(name, prefix), suffix)
	// crypto/rand.Text 使用至少 26 位 RFC 4648 base32 字符。
	if len(token) < 26 {
		return false
	}
	for _, char := range token {
		if (char < 'A' || char > 'Z') && (char < '2' || char > '7') {
			return false
		}
	}
	return true
}

// localSourceRelativePath 保留历史 source 相对于工作目录的语义，不能将它直接拼到 BasePath。
// 词法校验只负责路径映射；实际访问必须继续通过 os.Root，才能阻止符号链接逃逸。
func localSourceRelativePath(policy *model.StoragePolicy, source string) (string, error) {
	if policy == nil || policy.BasePath == "" || source == "" {
		return "", errors.New("本地存储路径不能为空")
	}
	base, err := filepath.Abs(policy.BasePath)
	if err != nil {
		return "", localStorageError("无法解析存储根目录", err)
	}
	absoluteSource, err := filepath.Abs(source)
	if err != nil {
		return "", localStorageError("无法解析本地文件路径", err)
	}
	relative, err := filepath.Rel(base, absoluteSource)
	if err != nil || !filepath.IsLocal(relative) {
		return "", errors.New("本地文件路径超出存储根目录")
	}
	return relative, nil
}

func openLocalRoot(policy *model.StoragePolicy, create bool) (*os.Root, error) {
	if policy == nil || policy.BasePath == "" {
		return nil, errors.New("本地存储根目录不能为空")
	}
	if create {
		// BasePath 来自存储策略；仅创建受信任的根目录，子路径必须使用 Root 操作。
		if err := os.MkdirAll(policy.BasePath, os.ModePerm); err != nil {
			return nil, localStorageError("无法创建存储根目录", err)
		}
	}
	root, err := os.OpenRoot(policy.BasePath)
	if err != nil {
		return nil, localStorageError("无法打开存储根目录", err)
	}
	return root, nil
}

// LocalPhysicalPathFromVirtual 将完整虚拟路径映射到策略挂载点内。
// 返回值仅用于 source 记录和路径映射，文件系统访问仍须通过 os.Root。
func LocalPhysicalPathFromVirtual(policy *model.StoragePolicy, virtualPath string) (string, error) {
	if policy == nil || policy.BasePath == "" {
		return "", errors.New("本地存储根目录不能为空")
	}
	for _, value := range []string{policy.VirtualPath, virtualPath} {
		if !strings.HasPrefix(value, "/") || strings.ContainsAny(value, "\\\x00") {
			return "", errors.New("本地存储虚拟路径无效")
		}
		for _, segment := range strings.Split(value, "/") {
			if segment == ".." {
				return "", errors.New("本地存储虚拟路径不能包含父目录")
			}
		}
	}
	mount := path.Clean(policy.VirtualPath)
	cleanVirtual := path.Clean(virtualPath)
	if mount != "/" && cleanVirtual != mount && !strings.HasPrefix(cleanVirtual, mount+"/") {
		return "", errors.New("虚拟路径不属于当前存储挂载点")
	}
	relative := strings.TrimPrefix(strings.TrimPrefix(cleanVirtual, mount), "/")
	return filepath.Join(policy.BasePath, filepath.FromSlash(relative)), nil
}

// LocalEntitySourcePath 返回本地策略下应写入 file_storage_entity.source 的路径：与 Upload 落盘一致，并尽量转为绝对路径以减少历史数据中的「相对路径 + 绝对 BasePath」混用。
func LocalEntitySourcePath(policy *model.StoragePolicy, virtualPath string) (string, error) {
	physical, err := LocalPhysicalPathFromVirtual(policy, virtualPath)
	if err != nil {
		return "", err
	}
	if filepath.IsAbs(physical) {
		return physical, nil
	}
	abs, err := filepath.Abs(physical)
	if err != nil {
		return "", localStorageError("无法解析本地文件路径", err)
	}
	return filepath.Clean(abs), nil
}

// List 实现了为本地文件系统列出目录内容的功能。
func (p *LocalProvider) List(ctx context.Context, policy *model.StoragePolicy, virtualPath string) ([]FileInfo, error) {
	physicalPath, err := LocalPhysicalPathFromVirtual(policy, virtualPath)
	if err != nil {
		return nil, err
	}

	relative, err := localSourceRelativePath(policy, physicalPath)
	if err != nil {
		return nil, err
	}
	root, err := openLocalRoot(policy, false)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []FileInfo{}, nil
		}
		return nil, err
	}
	defer closeLocalResource(root)
	entries, err := fs.ReadDir(root.FS(), filepath.ToSlash(relative))
	if err != nil {
		// 如果目录不存在，返回一个空列表和 nil 错误，这符合 List 的语义
		if os.IsNotExist(err) {
			return []FileInfo{}, nil
		}
		return nil, localStorageError("无法读取本地目录", err)
	}

	result := make([]FileInfo, 0, len(entries))
	for _, entry := range entries {
		if isLocalUploadTemporary(entry.Name()) {
			continue
		}
		info, err := root.Lstat(filepath.Join(relative, entry.Name()))
		if err != nil {
			return nil, localStorageError("无法读取本地目录项", err)
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
	relative, err := localSourceRelativePath(policy, source)
	if err != nil {
		return nil, err
	}
	root, err := openLocalRoot(policy, false)
	if err != nil {
		return nil, err
	}
	defer closeLocalResource(root)
	info, err := root.Stat(relative)
	if err != nil {
		return nil, localStorageError("无法检查本地文件", err)
	}
	if !info.Mode().IsRegular() {
		return nil, errors.New("本地存储仅支持读取普通文件")
	}
	file, err := root.Open(relative)
	if err != nil {
		return nil, localStorageError("无法打开本地文件", err)
	}
	info, err = file.Stat()
	if err != nil {
		closeLocalResource(file)
		return nil, localStorageError("无法检查已打开的本地文件", err)
	}
	if !info.Mode().IsRegular() {
		closeLocalResource(file)
		return nil, errors.New("本地存储仅支持读取普通文件")
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
	file, err := p.Get(ctx, policy, source)
	if err != nil {
		return err
	}
	defer closeLocalResource(file)
	_, err = io.Copy(writer, file)
	if err != nil {
		return localStorageError("流式传输文件内容时发生错误", err)
	}
	return nil
}

// CreateDirectory 实现了在本机创建物理目录的逻辑。
func (p *LocalProvider) CreateDirectory(ctx context.Context, policy *model.StoragePolicy, virtualPath string) error {
	physicalPath, err := LocalPhysicalPathFromVirtual(policy, virtualPath)
	if err != nil {
		return err
	}
	relative, err := localSourceRelativePath(policy, physicalPath)
	if err != nil {
		return err
	}
	root, err := openLocalRoot(policy, true)
	if err != nil {
		return err
	}
	defer closeLocalResource(root)
	if err := root.MkdirAll(relative, os.ModePerm); err != nil {
		return localStorageError("无法创建本地目录", err)
	}
	return nil
}

// Upload 实现了将文件流保存到本机磁盘的逻辑。
func (p *LocalProvider) Upload(ctx context.Context, file io.Reader, policy *model.StoragePolicy, virtualPath string) (*UploadResult, error) {
	finalPath, err := LocalEntitySourcePath(policy, virtualPath)
	if err != nil {
		return nil, err
	}
	relative, err := localSourceRelativePath(policy, finalPath)
	if err != nil {
		return nil, err
	}
	if relative == "." {
		return nil, errors.New("不能将文件上传到存储根目录")
	}
	root, err := openLocalRoot(policy, true)
	if err != nil {
		return nil, err
	}
	defer closeLocalResource(root)
	if err := root.MkdirAll(filepath.Dir(relative), os.ModePerm); err != nil {
		return nil, localStorageError("无法创建挂载子目录", err)
	}

	// 临时文件和最终文件都通过同一个 Root 操作，避免符号链接竞态及跨文件系统移动。
	tempName := filepath.Join(filepath.Dir(relative), ".anheyu-upload-"+rand.Text()+".tmp")
	tempFile, err := root.OpenFile(tempName, os.O_RDWR|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return nil, localStorageError("无法创建上传临时文件", err)
	}
	defer func() {
		if err := root.Remove(tempName); err != nil && !os.IsNotExist(err) {
			log.Printf("警告: %v", localStorageError("清理上传临时文件失败", err))
		}
	}()
	tempClosed := false
	defer func() {
		if !tempClosed {
			closeLocalResource(tempFile)
		}
	}()

	size, err := io.Copy(tempFile, file)
	if err != nil {
		return nil, localStorageError("写入处理临时文件失败", err)
	}

	if _, err := tempFile.Seek(0, io.SeekStart); err != nil {
		return nil, localStorageError("无法重置临时文件指针以检测MIME类型", err)
	}
	buffer := make([]byte, 512)
	n, err := tempFile.Read(buffer)
	if err != nil && err != io.EOF {
		return nil, localStorageError("读取文件头以检测MIME类型失败", err)
	}
	mimeType := http.DetectContentType(buffer[:n])

	// 修正 SVG 文件的 MIME 类型：http.DetectContentType 会将 SVG 识别为 text/plain 或 text/xml
	// 需要根据文件扩展名来正确识别
	ext := strings.ToLower(filepath.Ext(virtualPath))
	if ext == ".svg" {
		mimeType = "image/svg+xml"
	}

	if _, err := tempFile.Seek(0, io.SeekStart); err != nil {
		return nil, localStorageError("无法重置临时文件指针以检测图片尺寸", err)
	}
	imgConfig, _, err := image.DecodeConfig(tempFile)
	var dimension string
	if err == nil {
		dimension = fmt.Sprintf("%dx%d", imgConfig.Width, imgConfig.Height)
	}

	if err := tempFile.Close(); err != nil {
		tempClosed = true
		return nil, localStorageError("关闭上传临时文件失败", err)
	}
	tempClosed = true
	if err := root.Rename(tempName, relative); err != nil {
		return nil, localStorageError("移动文件到最终存储位置失败", err)
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
	relatives := make([]string, 0, len(sources))
	for _, source := range sources {
		relative, err := localSourceRelativePath(policy, source)
		if err != nil {
			return err
		}
		if relative == "." {
			return errors.New("不能删除存储根目录")
		}
		relatives = append(relatives, relative)
	}
	root, err := openLocalRoot(policy, false)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}
	defer closeLocalResource(root)
	for _, relative := range relatives {
		info, err := root.Stat(relative)
		if err != nil {
			if os.IsNotExist(err) {
				// 文件或目录已经不存在，静默处理
				continue
			}
			return localStorageError("无法检查待删除本地资源", err)
		}

		var removeErr error
		if info.IsDir() {
			// 如果是目录，使用 RemoveAll 保证能删除（即使里面有意外残留文件）
			removeErr = root.RemoveAll(relative)
		} else {
			// 如果是文件，使用 Remove
			removeErr = root.Remove(relative)
		}

		if removeErr != nil {
			return localStorageError("删除本地资源失败", removeErr)
		}
	}
	return nil
}

// DeleteDirectory 实现了删除本机上一个空目录的逻辑。
func (p *LocalProvider) DeleteDirectory(ctx context.Context, policy *model.StoragePolicy, virtualPath string) error {
	physicalPath, err := LocalPhysicalPathFromVirtual(policy, virtualPath)
	if err != nil {
		return err
	}
	relative, err := localSourceRelativePath(policy, physicalPath)
	if err != nil {
		return err
	}
	if relative == "." {
		return errors.New("不能删除存储根目录")
	}
	root, err := openLocalRoot(policy, false)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}
	defer closeLocalResource(root)
	err = root.Remove(relative)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return localStorageError("删除本地目录失败", err)
	}
	return nil
}

// Rename 重命名本地文件系统上的文件或目录。
func (p *LocalProvider) Rename(ctx context.Context, policy *model.StoragePolicy, oldVirtualPath, newVirtualPath string) error {
	oldAbsPath, err := LocalPhysicalPathFromVirtual(policy, oldVirtualPath)
	if err != nil {
		return err
	}
	newAbsPath, err := LocalPhysicalPathFromVirtual(policy, newVirtualPath)
	if err != nil {
		return err
	}
	oldRelative, err := localSourceRelativePath(policy, oldAbsPath)
	if err != nil {
		return err
	}
	newRelative, err := localSourceRelativePath(policy, newAbsPath)
	if err != nil {
		return err
	}
	if oldRelative == "." || newRelative == "." {
		return errors.New("不能移动存储根目录")
	}
	root, err := openLocalRoot(policy, false)
	if err != nil {
		return err
	}
	defer closeLocalResource(root)
	if _, err := root.Stat(oldRelative); err != nil {
		if os.IsNotExist(err) {
			return constant.ErrNotFound
		}
		return localStorageError("无法检查待移动本地资源", err)
	}
	if err := root.MkdirAll(filepath.Dir(newRelative), os.ModePerm); err != nil {
		return localStorageError("无法创建目标目录", err)
	}

	err = root.Rename(oldRelative, newRelative)
	if err != nil {
		if os.IsNotExist(err) {
			return constant.ErrNotFound
		}
		return localStorageError("移动本地资源失败", err)
	}
	return nil
}

// IsExist 检查本地文件系统中指定路径的文件或目录是否存在。
func (p *LocalProvider) IsExist(ctx context.Context, policy *model.StoragePolicy, source string) (bool, error) {
	relative, err := localSourceRelativePath(policy, source)
	if err != nil {
		return false, err
	}
	root, err := openLocalRoot(policy, false)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return false, nil
		}
		return false, err
	}
	defer closeLocalResource(root)
	_, err = root.Stat(relative)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, localStorageError("无法检查本地资源", err)
}

// GetThumbnail 实现了 IStorageProvider 接口。
// 对于本地存储，它不提供原生缩略图功能，因此总是返回 ErrFeatureNotSupported。
func (p *LocalProvider) GetThumbnail(ctx context.Context, policy *model.StoragePolicy, source string, size string) (*ThumbnailResult, error) {
	return nil, ErrFeatureNotSupported
}
