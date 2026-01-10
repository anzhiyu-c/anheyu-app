package file

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strconv"
	"strings" // 确保导入
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/infra/storage"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
)

// getContentTypeFromFilename 根据文件名推断正确的 Content-Type
// 如果数据库中的 MimeType 为空或无效，使用此函数来推断
func getContentTypeFromFilename(filename string) string {
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(filename), "."))

	// MIME 类型映射表
	mimeTypes := map[string]string{
		// 图片
		"svg":  "image/svg+xml",
		"png":  "image/png",
		"jpg":  "image/jpeg",
		"jpeg": "image/jpeg",
		"gif":  "image/gif",
		"webp": "image/webp",
		"bmp":  "image/bmp",
		"ico":  "image/x-icon",
		"avif": "image/avif",
		// 其他常见类型
		"pdf":  "application/pdf",
		"json": "application/json",
		"xml":  "application/xml",
		"txt":  "text/plain",
		"html": "text/html",
		"css":  "text/css",
		"js":   "application/javascript",
	}

	if mimeType, ok := mimeTypes[ext]; ok {
		return mimeType
	}

	// 默认返回 application/octet-stream
	return "application/octet-stream"
}

// DownloadResult 封装了下载操作成功后返回的元数据。
type DownloadResult struct {
	Name string
	Size int64
}

// DownloadInfo 封装了下载信息，告诉前端如何下载文件
type DownloadInfo struct {
	Type        string `json:"type"`                   // "local" 或 "cloud"
	URL         string `json:"url,omitempty"`          // 如果是云存储，提供直接下载链接
	StorageType string `json:"storage_type,omitempty"` // 存储类型：local, onedrive, tencent_cos等
	FileName    string `json:"file_name"`
	FileSize    int64  `json:"file_size"`
}

// Download 是核心的文件下载业务逻辑。
// 这个版本保持了它的纯粹性，只负责根据权限获取文件并写入io.Writer。
func (s *serviceImpl) Download(ctx context.Context, viewerID uint, publicFileID string, writer io.Writer) (*DownloadResult, error) {
	dbID, entityType, err := idgen.DecodePublicID(publicFileID)
	if err != nil || entityType != idgen.EntityTypeFile {
		return nil, constant.ErrNotFound
	}
	file, err := s.fileRepo.FindByID(ctx, dbID)
	if err != nil {
		return nil, constant.ErrNotFound
	}
	if viewerID != 0 && file.OwnerID != viewerID {
		return nil, constant.ErrForbidden
	}
	if file.Type != model.FileTypeFile {
		return nil, fmt.Errorf("目标不是一个文件: %w", constant.ErrInvalidOperation)
	}
	if !file.PrimaryEntityID.Valid {
		return nil, errors.New("文件没有关联的物理实体")
	}

	entity, err := s.entityRepo.FindByID(ctx, uint(file.PrimaryEntityID.Uint64))
	if err != nil {
		return nil, fmt.Errorf("找不到物理实体: %w", err)
	}
	policy, err := s.policySvc.GetPolicyByDatabaseID(ctx, entity.PolicyID)
	if err != nil {
		return nil, fmt.Errorf("找不到存储策略: %w", err)
	}
	provider, err := s.GetProviderForPolicy(policy)
	if err != nil {
		return nil, err
	}

	if policy.Type == constant.PolicyTypeLocal {
		// 在流式传输前，设置Content-Type和Content-Length
		if w, ok := writer.(http.ResponseWriter); ok {
			// 确定 Content-Type：优先使用数据库中的 MimeType，如果为空或无效则根据文件扩展名推断
			contentType := "application/octet-stream"
			if entity.MimeType.Valid && entity.MimeType.String != "" && entity.MimeType.String != "text/plain" {
				contentType = entity.MimeType.String
			} else {
				// 如果 MimeType 为空或是 text/plain，根据文件扩展名推断
				contentType = getContentTypeFromFilename(file.Name)
			}
			w.Header().Set("Content-Type", contentType)
			w.Header().Set("Content-Length", strconv.FormatInt(file.Size, 10))
		}
		err = provider.Stream(ctx, policy, entity.Source.String, writer)
		if err != nil {
			return nil, err
		}
	} else {
		options := storage.DownloadURLOptions{ExpiresIn: 3600}
		downloadURL, err := provider.GetDownloadURL(ctx, policy, entity.Source.String, options)
		if err != nil {
			return nil, fmt.Errorf("无法从云存储获取下载链接: %w", err)
		}
		if w, ok := writer.(http.ResponseWriter); ok {
			w.Header().Set("Location", downloadURL)
			w.WriteHeader(http.StatusFound)
		} else {
			return nil, errors.New("云存储下载需要一个 http.ResponseWriter 来执行重定向")
		}
	}

	return &DownloadResult{
		Name: file.Name,
		Size: file.Size,
	}, nil
}

// ProcessSignedDownload 处理带签名的下载请求，验证签名并提供文件。
func (s *serviceImpl) ProcessSignedDownload(c context.Context, w http.ResponseWriter, r *http.Request, publicFileID string) error {
	// 1. 验证签名和过期时间
	expiresStr := r.URL.Query().Get("expires")
	signatureB64 := r.URL.Query().Get("sign")
	if expiresStr == "" || signatureB64 == "" {
		return constant.ErrSignatureInvalid
	}
	expires, err := strconv.ParseInt(expiresStr, 10, 64)
	if err != nil {
		return constant.ErrSignatureInvalid
	}
	if time.Now().Unix() > expires {
		return constant.ErrLinkExpired
	}
	signature, err := base64.URLEncoding.DecodeString(signatureB64)
	if err != nil {
		return constant.ErrSignatureInvalid
	}

	secret := s.settingSvc.Get(constant.KeyLocalFileSigningSecret.String())
	stringToSign := fmt.Sprintf("%s:%d", publicFileID, expires)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(stringToSign))
	expectedSignature := mac.Sum(nil)

	if !hmac.Equal(signature, expectedSignature) {
		return constant.ErrSignatureInvalid
	}

	// 2. 签名验证通过，获取文件元数据以进行缓存检查
	dbID, _, err := idgen.DecodePublicID(publicFileID)
	if err != nil {
		return constant.ErrNotFound
	}
	file, err := s.fileRepo.FindByID(c, dbID)
	if err != nil {
		return constant.ErrNotFound
	}

	// 生成 ETag
	etag := fmt.Sprintf(`"%s-%d"`, publicFileID, file.UpdatedAt.Unix())
	w.Header().Set("ETag", etag)

	// 设置 Cache-Control 头
	w.Header().Set("Cache-Control", "public, max-age=604800, immutable")

	// 检查浏览器是否已缓存 (If-None-Match)
	if match := r.Header.Get("If-None-Match"); match != "" {
		if strings.Contains(match, etag) {
			// ETag匹配，浏览器缓存有效，返回304 Not Modified
			w.WriteHeader(http.StatusNotModified)
			log.Printf("【CACHE HIT】文件(ID: %s) ETag 匹配，返回 304 Not Modified。", publicFileID)
			return nil // 成功处理，无需后续操作
		}
	}
	log.Printf("【CACHE MISS】文件(ID: %s) ETag 不匹配或不存在，将提供完整内容。", publicFileID)

	// 4. 缓存未命中，调用 Download 方法传输文件内容
	log.Printf("【DOWNLOAD INFO】签名验证通过，准备下载文件. PublicID=%s, ViewerID=0", publicFileID)
	_, err = s.Download(c, 0, publicFileID, w)

	if err != nil {
		log.Printf("【DOWNLOAD ERROR】在执行下载时发生错误. PublicID=%s, 错误: %v", publicFileID, err)
	}

	return err
}

// GetDownloadInfo 获取文件的下载信息，告诉前端应该如何下载文件
func (s *serviceImpl) GetDownloadInfo(ctx context.Context, viewerID uint, publicFileID string) (*DownloadInfo, error) {
	dbID, entityType, err := idgen.DecodePublicID(publicFileID)
	if err != nil || entityType != idgen.EntityTypeFile {
		return nil, constant.ErrNotFound
	}

	file, err := s.fileRepo.FindByID(ctx, dbID)
	if err != nil {
		return nil, constant.ErrNotFound
	}

	if viewerID != 0 && file.OwnerID != viewerID {
		return nil, constant.ErrForbidden
	}

	if file.Type != model.FileTypeFile {
		return nil, fmt.Errorf("目标不是一个文件: %w", constant.ErrInvalidOperation)
	}

	if !file.PrimaryEntityID.Valid {
		return nil, errors.New("文件没有关联的物理实体")
	}

	entity, err := s.entityRepo.FindByID(ctx, uint(file.PrimaryEntityID.Uint64))
	if err != nil {
		return nil, fmt.Errorf("找不到物理实体: %w", err)
	}

	policy, err := s.policySvc.GetPolicyByDatabaseID(ctx, entity.PolicyID)
	if err != nil {
		return nil, fmt.Errorf("找不到存储策略: %w", err)
	}

	downloadInfo := &DownloadInfo{
		FileName: file.Name,
		FileSize: file.Size,
	}

	if policy.Type == constant.PolicyTypeLocal {
		// 本地存储，前端需要通过API下载
		downloadInfo.Type = "local"
		downloadInfo.StorageType = "local"
	} else {
		// 云存储，可以提供直接下载链接
		downloadInfo.Type = "cloud"
		downloadInfo.StorageType = string(policy.Type)

		// 获取云存储的直接下载链接
		provider, err := s.GetProviderForPolicy(policy)
		if err != nil {
			return nil, err
		}

		options := storage.DownloadURLOptions{ExpiresIn: 3600}
		downloadURL, err := provider.GetDownloadURL(ctx, policy, entity.Source.String, options)
		if err != nil {
			return nil, fmt.Errorf("无法从云存储获取下载链接: %w", err)
		}

		downloadInfo.URL = downloadURL
	}

	return downloadInfo, nil
}
