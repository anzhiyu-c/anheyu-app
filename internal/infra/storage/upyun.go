package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

const defaultUpyunEndpoint = "https://v0.api.upyun.com"

type UpyunProvider struct {
	client *http.Client
}

func NewUpyunProvider() IStorageProvider {
	return &UpyunProvider{
		client: &http.Client{Timeout: 60 * time.Second},
	}
}

func (p *UpyunProvider) buildObjectKey(policy *model.StoragePolicy, virtualPath string) string {
	relativePath := strings.TrimPrefix(virtualPath, policy.VirtualPath)
	relativePath = strings.TrimPrefix(relativePath, "/")
	basePath := strings.TrimPrefix(strings.TrimSuffix(policy.BasePath, "/"), "/")
	if basePath == "" {
		return strings.TrimPrefix(relativePath, "/")
	}
	if relativePath == "" {
		return basePath
	}
	return strings.TrimPrefix(basePath+"/"+relativePath, "/")
}

func (p *UpyunProvider) endpoint(policy *model.StoragePolicy) string {
	endpoint := strings.TrimSpace(policy.Server)
	if endpoint == "" {
		endpoint = defaultUpyunEndpoint
	}
	if !strings.HasPrefix(endpoint, "http://") && !strings.HasPrefix(endpoint, "https://") {
		endpoint = "https://" + endpoint
	}
	return strings.TrimRight(endpoint, "/")
}

func (p *UpyunProvider) objectURL(policy *model.StoragePolicy, objectKey string) (string, error) {
	if policy.BucketName == "" {
		return "", errors.New("又拍云策略缺少服务名")
	}
	parts := []string{policy.BucketName}
	for _, segment := range strings.Split(strings.Trim(objectKey, "/"), "/") {
		if segment == "" {
			continue
		}
		parts = append(parts, url.PathEscape(segment))
	}
	return p.endpoint(policy) + "/" + strings.Join(parts, "/"), nil
}

func (p *UpyunProvider) request(ctx context.Context, method string, policy *model.StoragePolicy, objectKey string, body io.Reader) (*http.Response, error) {
	requestURL, err := p.objectURL(policy, objectKey)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, method, requestURL, body)
	if err != nil {
		return nil, err
	}
	if policy.AccessKey == "" || policy.SecretKey == "" {
		return nil, errors.New("又拍云策略缺少操作员或密码")
	}
	req.SetBasicAuth(policy.AccessKey, policy.SecretKey)
	return p.client.Do(req)
}

func closeBody(resp *http.Response) {
	if resp != nil && resp.Body != nil {
		resp.Body.Close()
	}
}

func ensureStatus(resp *http.Response, expected ...int) error {
	for _, status := range expected {
		if resp.StatusCode == status {
			return nil
		}
	}
	// Upstream error bodies are untrusted and may echo operator credentials or
	// authorization headers. Keep the status useful without exposing that body.
	return fmt.Errorf("又拍云请求失败: HTTP %d", resp.StatusCode)
}

func (p *UpyunProvider) Upload(ctx context.Context, file io.Reader, policy *model.StoragePolicy, virtualPath string) (*UploadResult, error) {
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("读取上传文件失败: %w", err)
	}
	objectKey := p.buildObjectKey(policy, virtualPath)
	resp, err := p.request(ctx, http.MethodPut, policy, objectKey, bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("上传文件到又拍云失败: %w", err)
	}
	defer closeBody(resp)
	if err := ensureStatus(resp, http.StatusOK, http.StatusCreated); err != nil {
		return nil, err
	}

	mimeType := mime.TypeByExtension(filepath.Ext(virtualPath))
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	return &UploadResult{
		Source:   objectKey,
		Size:     int64(len(data)),
		MimeType: mimeType,
	}, nil
}

func (p *UpyunProvider) CreateDirectory(ctx context.Context, policy *model.StoragePolicy, virtualPath string) error {
	objectKey := strings.TrimSuffix(p.buildObjectKey(policy, virtualPath), "/") + "/"
	resp, err := p.request(ctx, http.MethodPut, policy, objectKey, nil)
	if err != nil {
		return fmt.Errorf("创建又拍云目录失败: %w", err)
	}
	defer closeBody(resp)
	return ensureStatus(resp, http.StatusOK, http.StatusCreated)
}

func (p *UpyunProvider) Delete(ctx context.Context, policy *model.StoragePolicy, sources []string) error {
	for _, source := range sources {
		resp, err := p.request(ctx, http.MethodDelete, policy, source, nil)
		if err != nil {
			return fmt.Errorf("删除又拍云对象失败: %w", err)
		}
		if err := ensureStatus(resp, http.StatusOK, http.StatusNoContent, http.StatusNotFound); err != nil {
			closeBody(resp)
			return err
		}
		closeBody(resp)
	}
	return nil
}

func (p *UpyunProvider) GetDownloadURL(ctx context.Context, policy *model.StoragePolicy, source string, options DownloadURLOptions) (string, error) {
	baseURL := ""
	if policy.Settings != nil {
		if cdnDomain, ok := policy.Settings["cdn_domain"].(string); ok && cdnDomain != "" {
			baseURL = strings.TrimRight(cdnDomain, "/")
		}
	}
	if baseURL == "" {
		baseURL = p.endpoint(policy)
		if policy.BucketName != "" {
			baseURL += "/" + url.PathEscape(policy.BucketName)
		}
	}

	parts := []string{}
	for _, segment := range strings.Split(strings.Trim(source, "/"), "/") {
		if segment == "" {
			continue
		}
		parts = append(parts, url.PathEscape(segment))
	}
	downloadURL := baseURL
	if len(parts) > 0 {
		downloadURL += "/" + strings.Join(parts, "/")
	}
	if options.QueryParams != "" {
		downloadURL += "?" + strings.TrimPrefix(options.QueryParams, "?")
	}
	return downloadURL, nil
}

func (p *UpyunProvider) DeleteDirectory(ctx context.Context, policy *model.StoragePolicy, virtualPath string) error {
	objectKey := strings.TrimSuffix(p.buildObjectKey(policy, virtualPath), "/") + "/"
	resp, err := p.request(ctx, http.MethodDelete, policy, objectKey, nil)
	if err != nil {
		return fmt.Errorf("删除又拍云目录失败: %w", err)
	}
	defer closeBody(resp)
	return ensureStatus(resp, http.StatusOK, http.StatusNoContent, http.StatusNotFound)
}

func (p *UpyunProvider) Rename(ctx context.Context, policy *model.StoragePolicy, oldVirtualPath, newVirtualPath string) error {
	oldKey := p.buildObjectKey(policy, oldVirtualPath)
	newKey := p.buildObjectKey(policy, newVirtualPath)
	requestURL, err := p.objectURL(policy, newKey)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, requestURL, nil)
	if err != nil {
		return err
	}
	req.SetBasicAuth(policy.AccessKey, policy.SecretKey)
	req.Header.Set("X-Upyun-Move-Source", "/"+path.Join(policy.BucketName, oldKey))

	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("移动又拍云对象失败: %w", err)
	}
	defer closeBody(resp)
	return ensureStatus(resp, http.StatusOK, http.StatusCreated)
}

func (p *UpyunProvider) Stream(ctx context.Context, policy *model.StoragePolicy, source string, writer io.Writer) error {
	reader, err := p.Get(ctx, policy, source)
	if err != nil {
		return err
	}
	defer reader.Close()
	if _, err := io.Copy(writer, reader); err != nil {
		return fmt.Errorf("读取又拍云文件流失败: %w", err)
	}
	return nil
}

func (p *UpyunProvider) IsExist(ctx context.Context, policy *model.StoragePolicy, source string) (bool, error) {
	resp, err := p.request(ctx, http.MethodHead, policy, source, nil)
	if err != nil {
		return false, fmt.Errorf("检查又拍云对象失败: %w", err)
	}
	defer closeBody(resp)
	if resp.StatusCode == http.StatusNotFound {
		return false, nil
	}
	if err := ensureStatus(resp, http.StatusOK); err != nil {
		return false, err
	}
	return true, nil
}

func (p *UpyunProvider) Get(ctx context.Context, policy *model.StoragePolicy, source string) (io.ReadCloser, error) {
	resp, err := p.request(ctx, http.MethodGet, policy, source, nil)
	if err != nil {
		return nil, fmt.Errorf("获取又拍云文件失败: %w", err)
	}
	if err := ensureStatus(resp, http.StatusOK); err != nil {
		closeBody(resp)
		return nil, err
	}
	return resp.Body, nil
}

type upyunListItem struct {
	Name         string `json:"name"`
	Type         string `json:"type"`
	Size         int64  `json:"size"`
	LastModified any    `json:"last_modified"`
}

func (p *UpyunProvider) List(ctx context.Context, policy *model.StoragePolicy, virtualPath string) ([]FileInfo, error) {
	objectKey := strings.TrimSuffix(p.buildObjectKey(policy, virtualPath), "/")
	resp, err := p.request(ctx, http.MethodGet, policy, objectKey, nil)
	if err != nil {
		return nil, fmt.Errorf("列出又拍云目录失败: %w", err)
	}
	defer closeBody(resp)
	if err := ensureStatus(resp, http.StatusOK); err != nil {
		return nil, err
	}

	var items []upyunListItem
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		return nil, fmt.Errorf("解析又拍云目录列表失败: %w", err)
	}
	results := make([]FileInfo, 0, len(items))
	for _, item := range items {
		results = append(results, FileInfo{
			Name:    item.Name,
			Size:    item.Size,
			IsDir:   strings.EqualFold(item.Type, "folder") || strings.EqualFold(item.Type, "F"),
			ModTime: parseUpyunModTime(item.LastModified),
		})
	}
	return results, nil
}

func parseUpyunModTime(value any) time.Time {
	switch v := value.(type) {
	case float64:
		return time.Unix(int64(v), 0)
	case string:
		if unix, err := strconv.ParseInt(v, 10, 64); err == nil {
			return time.Unix(unix, 0)
		}
		if parsed, err := time.Parse(time.RFC3339, v); err == nil {
			return parsed
		}
	}
	return time.Time{}
}

func (p *UpyunProvider) GetThumbnail(ctx context.Context, policy *model.StoragePolicy, source string, size string) (*ThumbnailResult, error) {
	return nil, ErrFeatureNotSupported
}
