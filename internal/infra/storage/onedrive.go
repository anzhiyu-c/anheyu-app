/*
 * @Description: OneDrive 存储驱动的具体实现
 * @Author: 安知鱼
 * @Date: 2025-07-15 17:50:00
 * @LastEditTime: 2025-12-01 12:57:00
 * @LastEditors: 安知鱼
 */
package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"path"
	"strings"
	"sync"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/microsoft"
	"golang.org/x/time/rate"
)

// --- 常量定义 ---

const (
	// 定义一个阈值，超过此大小的文件使用可续传会话
	resumableUploadThreshold = 4 * 1024 * 1024 // 4MB
	// 定义存储策略设置中的限速配置键
	settingRequestsPerSecond = "requests_per_second"
	settingBurstSize         = "burst_size"
)

// graphThumbnailsResponse 是 Graph API 返回的缩略图集合的结构
type graphThumbnailsResponse struct {
	Value []graphThumbnailSet `json:"value"`
}
type graphThumbnailSet struct {
	ID     string         `json:"id"`
	Small  graphThumbnail `json:"small"`
	Medium graphThumbnail `json:"medium"`
	Large  graphThumbnail `json:"large"`
}
type graphThumbnail struct {
	URL    string `json:"url"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

// --- API 限速器相关 ---

var (
	oneDriveLimiters      = make(map[uint]*rate.Limiter)
	oneDriveLimitersMutex = &sync.RWMutex{}
)

// rateLimitedTransport 是一个自定义的 http.RoundTripper，它在执行每个请求前会等待限速器的许可。
type rateLimitedTransport struct {
	base    http.RoundTripper
	limiter *rate.Limiter
}

// RoundTrip 实现了 http.RoundTripper 接口，并在此处插入限速逻辑。
func (t *rateLimitedTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if err := t.limiter.Wait(req.Context()); err != nil {
		return nil, err
	}
	return t.base.RoundTrip(req)
}

// getOrCreateRateLimiter 是一个辅助函数，它根据策略配置获取或创建一个限速器。
func getOrCreateRateLimiter(policy *model.StoragePolicy) *rate.Limiter {
	rpsValue, _ := policy.Settings[settingRequestsPerSecond].(float64)
	if rpsValue <= 0 {
		return nil
	}
	burstValue, _ := policy.Settings[settingBurstSize].(float64)
	burst := int(burstValue)
	if burst <= 0 {
		burst = 1
	}
	limit := rate.Limit(rpsValue)

	oneDriveLimitersMutex.RLock()
	limiter, ok := oneDriveLimiters[policy.ID]
	oneDriveLimitersMutex.RUnlock()
	if ok {
		return limiter
	}

	oneDriveLimitersMutex.Lock()
	defer oneDriveLimitersMutex.Unlock()
	limiter, ok = oneDriveLimiters[policy.ID]
	if ok {
		return limiter
	}

	limiter = rate.NewLimiter(limit, burst)
	oneDriveLimiters[policy.ID] = limiter
	return limiter
}

// --- Graph API 响应结构体定义 ---

type graphErrorResponse struct {
	Error graphError `json:"error"`
}
type graphError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
type graphListResponse struct {
	Value []graphDriveItem `json:"value"`
}
type graphDriveItem struct {
	ID              string           `json:"id"` // 用于 Rename 操作
	Name            string           `json:"name"`
	Size            int64            `json:"size"`
	LastModified    string           `json:"lastModifiedDateTime"`
	Folder          *json.RawMessage `json:"folder"`
	File            *json.RawMessage `json:"file"`
	DownloadURL     string           `json:"@microsoft.graph.downloadUrl"`
	ParentReference parentReference  `json:"parentReference"`
}
type parentReference struct {
	DriveID string `json:"driveId"`
	ID      string `json:"id"`
	Path    string `json:"path"`
}
type graphUploadSessionResponse struct {
	UploadURL          string `json:"uploadUrl"`
	ExpirationDateTime string `json:"expirationDateTime"`
}

// --- 认证端点定义 ---

var azureChinaCloudEndpoint = oauth2.Endpoint{
	AuthURL:  "https://login.chinacloudapi.cn/common/oauth2/v2.0/authorize",
	TokenURL: "https://login.chinacloudapi.cn/common/oauth2/v2.0/token",
}

// --- Provider 实现 ---

// OneDriveProvider 实现了 IStorageProvider 接口，用于处理与 Microsoft OneDrive 的所有交互。
type OneDriveProvider struct {
	policyRepo repository.StoragePolicyRepository // 注入存储策略仓库，用于解析路径
}

// NewOneDriveProvider 是 OneDriveProvider 的构造函数。
func NewOneDriveProvider(policyRepo repository.StoragePolicyRepository) IStorageProvider {
	return &OneDriveProvider{
		policyRepo: policyRepo,
	}
}

// GetThumbnail 尝试从 OneDrive 直接获取文件的缩略图。
func (p *OneDriveProvider) GetThumbnail(ctx context.Context, policy *model.StoragePolicy, source string, size string) (*ThumbnailResult, error) {
	// 1. 获取认证客户端和基础 URL
	client, err := p.getClient(ctx, policy)
	if err != nil {
		return nil, err
	}
	driveBaseURL, err := p.getDriveBaseURL(policy)
	if err != nil {
		return nil, err
	}

	// 2. 构建获取缩略图信息的 API URL
	apiPath := p.buildAPIPath(policy, source)
	thumbnailsInfoURL := fmt.Sprintf("%s%s/thumbnails", driveBaseURL, apiPath)

	// 3. 请求缩略图信息
	resp, err := client.Get(thumbnailsInfoURL)
	if err != nil {
		return nil, fmt.Errorf("请求 OneDrive 缩略图信息失败: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		var errResp graphErrorResponse
		_ = json.Unmarshal(body, &errResp) // 忽略解析错误，因为body可能为空

		// 当请求缩略图时收到 404 Not Found 或特定错误消息时，
		// 这意味着OneDrive不支持为该文件（例如 AVIF）生成原生缩略图。
		// 应返回 ErrFeatureNotSupported，以便上层服务可以回退到本地生成。
		if resp.StatusCode == http.StatusNotFound || strings.Contains(errResp.Error.Message, "does not support thumbnails") {
			return nil, ErrFeatureNotSupported
		}

		return nil, fmt.Errorf("获取 OneDrive 缩略图信息失败, 状态码: %d, 错误: %s", resp.StatusCode, errResp.Error.Message)
	}

	// 4. 解析响应并选择合适的缩略图 URL
	var thumbsResp graphThumbnailsResponse
	if err := json.Unmarshal(body, &thumbsResp); err != nil {
		return nil, fmt.Errorf("解析 OneDrive 缩略图响应失败: %w", err)
	}

	if len(thumbsResp.Value) == 0 {
		return nil, ErrFeatureNotSupported // API成功返回但没有缩略图数据
	}

	thumbSet := thumbsResp.Value[0]
	var thumbURL string
	switch strings.ToLower(size) {
	case "small":
		thumbURL = thumbSet.Small.URL
	case "large":
		thumbURL = thumbSet.Large.URL
	default: // 默认为 "medium"
		thumbURL = thumbSet.Medium.URL
	}

	if thumbURL == "" {
		// 回退逻辑
		thumbURL = thumbSet.Medium.URL
		if thumbURL == "" {
			thumbURL = thumbSet.Small.URL
		}
		if thumbURL == "" {
			return nil, ErrFeatureNotSupported
		}
	}

	// 5. 下载缩略图内容
	thumbResp, err := http.Get(thumbURL)
	if err != nil {
		return nil, fmt.Errorf("下载 OneDrive 缩略图失败: %w", err)
	}
	defer thumbResp.Body.Close()

	if thumbResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("下载 OneDrive 缩略图时状态码异常: %d", thumbResp.StatusCode)
	}

	thumbData, err := io.ReadAll(thumbResp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取 OneDrive 缩略图数据失败: %w", err)
	}

	return &ThumbnailResult{
		ContentType: thumbResp.Header.Get("Content-Type"),
		Data:        thumbData,
	}, nil
}

// Upload 将文件流上传到指定的存储策略。
// 它会根据文件大小自动选择简单上传或可续传的分片上传，并能懒创建父目录。
func (p *OneDriveProvider) Upload(ctx context.Context, file io.Reader, policy *model.StoragePolicy, virtualPath string) (*UploadResult, error) {
	parentDir := path.Dir(virtualPath)
	if parentDir != "." && parentDir != "/" {
		if err := p.CreateDirectory(ctx, policy, parentDir); err != nil {
			return nil, fmt.Errorf("上传前创建父目录失败: %w", err)
		}
	}
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("读取文件流失败: %w", err)
	}
	fileSize := int64(len(data))
	fileReader := bytes.NewReader(data)
	if fileSize < resumableUploadThreshold {
		return p.simpleUpload(ctx, fileReader, policy, virtualPath)
	} else {
		return p.resumableUpload(ctx, fileReader, fileSize, policy, virtualPath)
	}
}

// CreateDirectory 在存储中创建一个目录。
// 此实现是幂等的：如果目录已存在，不会返回错误。
func (p *OneDriveProvider) CreateDirectory(ctx context.Context, policy *model.StoragePolicy, virtualPath string) error {
	client, err := p.getClient(ctx, policy)
	if err != nil {
		return err
	}
	driveBaseURL, err := p.getDriveBaseURL(policy)
	if err != nil {
		return err
	}

	if virtualPath == "" || virtualPath == "/" || virtualPath == "." {
		return nil // 根目录无需创建
	}

	var parentAPIPath string
	var newDirName string

	isPolicyRoot := virtualPath == policy.VirtualPath

	if isPolicyRoot {
		// --- 场景1: 正在创建策略的根目录 (BasePath) ---
		// 例如，policy.BasePath 是 "/AnHeYuAlbum"
		// 此时，父目录是 OneDrive 的根，要创建的目录名是 "AnHeYuAlbum"
		parentAPIPath = "/root"
		newDirName = path.Base(policy.BasePath)
		// 如果 BasePath 是 "/" 或 ""，说明根就是根，无需创建
		if newDirName == "." || newDirName == "/" {
			return nil
		}
	} else {
		// --- 场景2: 正在创建子目录 ---
		// 这是之前的逻辑，用于在 BasePath 内部创建文件夹
		parentPath := path.Dir(virtualPath)
		newDirName = path.Base(virtualPath)
		parentAPIPath = p.buildAPIPath(policy, parentPath)
	}

	// 统一的创建逻辑
	createURL := fmt.Sprintf("%s%s/children", driveBaseURL, parentAPIPath)

	createPayload := map[string]interface{}{
		"name":                              newDirName,
		"folder":                            map[string]interface{}{},
		"@microsoft.graph.conflictBehavior": "fail",
	}
	payloadBytes, _ := json.Marshal(createPayload)

	req, err := http.NewRequestWithContext(ctx, "POST", createURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return fmt.Errorf("创建目录请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("执行创建目录请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusCreated {
		log.Printf("【STORAGE-OneDrive】成功创建目录 '%s'", newDirName)
		return nil
	}

	body, _ := io.ReadAll(resp.Body)
	var errResp graphErrorResponse
	json.Unmarshal(body, &errResp)

	// 如果错误是 "nameAlreadyExists"，说明目录已存在，也视为成功，这是幂等性的关键。
	if errResp.Error.Code == "nameAlreadyExists" {
		log.Printf("【STORAGE-OneDrive】目录 '%s' 已存在，无需创建。", newDirName)
		return nil
	}

	return fmt.Errorf("创建目录失败, 状态码: %d, 错误: %s", resp.StatusCode, errResp.Error.Message)
}

// Delete 从 OneDrive 删除一个或多个物理文件或目录。
// 注意：OneDrive的实现暂时忽略传入的policy参数，仍然使用原有的路径查找策略逻辑。
func (p *OneDriveProvider) Delete(ctx context.Context, policy *model.StoragePolicy, sources []string) error {
	client, err := p.getClient(ctx, policy)
	if err != nil {
		return err
	}
	driveBaseURL, err := p.getDriveBaseURL(policy)
	if err != nil {
		return err
	}

	// source 现在存储的是云端路径（如"OneDrive/AnHeYuComment/uuid.jpg"）
	for _, source := range sources {
		finalAPIPath := strings.Trim(source, "/")
		var apiPath string
		if finalAPIPath == "" || finalAPIPath == "." {
			apiPath = "/root"
		} else {
			apiPath = fmt.Sprintf("/root:/%s", finalAPIPath)
		}

		deleteURL := fmt.Sprintf("%s%s", driveBaseURL, apiPath)
		req, err := http.NewRequestWithContext(ctx, "DELETE", deleteURL, nil)
		if err != nil {
			log.Printf("错误: 创建删除请求失败 for '%s': %v", source, err)
			continue
		}

		resp, err := client.Do(req)
		if err != nil {
			log.Printf("错误: 执行删除请求失败 for '%s': %v", source, err)
			continue
		}
		resp.Body.Close()

		if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusNotFound {
			log.Printf("错误: 删除 OneDrive 项目 '%s' 失败, 状态码: %d", source, resp.StatusCode)
		}
	}
	return nil
}

// GetDownloadURL 为存储在 OneDrive 中的文件生成一个临时的、可公开访问的下载链接。
func (p *OneDriveProvider) GetDownloadURL(ctx context.Context, policy *model.StoragePolicy, source string, options DownloadURLOptions) (string, error) {
	client, err := p.getClient(ctx, policy)
	if err != nil {
		return "", err
	}
	driveBaseURL, err := p.getDriveBaseURL(policy)
	if err != nil {
		return "", err
	}
	// source 现在存储的是云端路径（如"OneDrive/AnHeYuComment/uuid.jpg"），直接构建API路径
	finalAPIPath := strings.Trim(source, "/")
	var apiPath string
	if finalAPIPath == "" || finalAPIPath == "." {
		apiPath = "/root"
	} else {
		apiPath = fmt.Sprintf("/root:/%s", finalAPIPath)
	}
	itemURL := fmt.Sprintf("%s%s?select=@microsoft.graph.downloadUrl", driveBaseURL, apiPath)

	resp, err := client.Get(itemURL)
	if err != nil {
		return "", fmt.Errorf("请求下载链接失败: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		var errResp graphErrorResponse
		json.Unmarshal(body, &errResp)
		return "", fmt.Errorf("获取下载链接失败, 状态码: %d, 错误: %s", resp.StatusCode, errResp.Error.Message)
	}

	var item graphDriveItem
	if err := json.Unmarshal(body, &item); err != nil {
		return "", fmt.Errorf("解析下载链接响应失败: %w", err)
	}
	if item.DownloadURL == "" {
		return "", errors.New("未能获取到下载链接")
	}
	return item.DownloadURL, nil
}

// List 列出指定虚拟路径下的所有文件和目录。
func (p *OneDriveProvider) List(ctx context.Context, policy *model.StoragePolicy, virtualPath string) ([]FileInfo, error) {
	client, err := p.getClient(ctx, policy)
	if err != nil {
		return nil, err
	}
	driveBaseURL, err := p.getDriveBaseURL(policy)
	if err != nil {
		return nil, err
	}

	// 1. 获取要列出内容的目录的 API 路径
	apiPath := p.buildAPIPath(policy, virtualPath)

	// 2. 构建获取其子项的 URL
	//    正确的语法是：对目标项目执行 'children' 操作。
	//    - 对根目录: .../root/children
	//    - 对子目录: .../root:/path/to/folder:/children
	var listURL string
	if apiPath == "/root" {
		listURL = fmt.Sprintf("%s/root/children", driveBaseURL)
	} else {
		listURL = fmt.Sprintf("%s%s:/children", driveBaseURL, apiPath)
	}

	resp, err := client.Get(listURL)
	if err != nil {
		return nil, fmt.Errorf("请求 OneDrive 列表失败: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		var errResp graphErrorResponse
		json.Unmarshal(body, &errResp)
		if resp.StatusCode == http.StatusNotFound {
			log.Printf("【STORAGE-OneDrive DEBUG】List 请求失败，URL: %s", listURL)
		}
		return nil, fmt.Errorf("获取 OneDrive 列表失败, 状态码: %d, 错误: %s", resp.StatusCode, errResp.Error.Message)
	}

	var listResp graphListResponse
	if err := json.Unmarshal(body, &listResp); err != nil {
		return nil, fmt.Errorf("解析 OneDrive 列表响应失败: %w", err)
	}

	result := make([]FileInfo, 0, len(listResp.Value))
	for _, item := range listResp.Value {
		isDir := item.Folder != nil
		modTime, _ := time.Parse(time.RFC3339, item.LastModified)
		result = append(result, FileInfo{
			Name:    item.Name,
			Size:    item.Size,
			IsDir:   isDir,
			ModTime: modTime,
		})
	}
	return result, nil
}

// DeleteDirectory 删除一个空目录或非空目录。
// 在 OneDrive 中，删除文件和目录使用相同的 API。
func (p *OneDriveProvider) DeleteDirectory(ctx context.Context, policy *model.StoragePolicy, virtualPath string) error {
	return p.deleteItem(ctx, policy, virtualPath)
}

// Rename 重命名或移动存储中的文件或目录。
// 它通过更新项目的元数据（名称和/或父目录ID）来实现。
func (p *OneDriveProvider) Rename(ctx context.Context, policy *model.StoragePolicy, oldVirtualPath, newVirtualPath string) error {
	client, err := p.getClient(ctx, policy)
	if err != nil {
		return err
	}
	driveBaseURL, err := p.getDriveBaseURL(policy)
	if err != nil {
		return err
	}

	oldAPIPath := p.buildAPIPath(policy, oldVirtualPath)
	patchURL := fmt.Sprintf("%s%s", driveBaseURL, oldAPIPath)
	payload := make(map[string]interface{})
	newName := path.Base(newVirtualPath)
	oldName := path.Base(oldVirtualPath)
	newParentDir := path.Dir(newVirtualPath)
	oldParentDir := path.Dir(oldVirtualPath)

	if oldName != newName {
		payload["name"] = newName
	}
	if oldParentDir != newParentDir {
		newParentItem, err := p.getItemInfo(ctx, policy, newParentDir)
		if err != nil {
			return fmt.Errorf("无法获取新父目录 '%s' 的信息: %w", newParentDir, err)
		}
		if newParentItem.Folder == nil {
			return fmt.Errorf("目标路径 '%s' 不是一个目录", newParentDir)
		}
		payload["parentReference"] = map[string]string{"id": newParentItem.ID}
	}

	if len(payload) == 0 {
		return nil
	}

	payloadBytes, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "PATCH", patchURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return fmt.Errorf("创建重命名请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("执行重命名请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		var errResp graphErrorResponse
		json.Unmarshal(body, &errResp)
		if resp.StatusCode == http.StatusNotFound {
			return fmt.Errorf("%w: %s", constant.ErrNotFound, errResp.Error.Message)
		}
		return fmt.Errorf("重命名失败, 状态码: %d, 错误: %s", resp.StatusCode, errResp.Error.Message)
	}
	return nil
}

// Stream 将 OneDrive 中的文件内容以流式传输到给定的写入器，通常用于直接向客户端响应。
func (p *OneDriveProvider) Stream(ctx context.Context, policy *model.StoragePolicy, source string, writer io.Writer) error {
	downloadURL, err := p.GetDownloadURL(ctx, policy, source, DownloadURLOptions{})
	if err != nil {
		return err
	}

	httpClient := &http.Client{}
	resp, err := httpClient.Get(downloadURL)
	if err != nil {
		return fmt.Errorf("请求预签名下载链接失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("下载文件失败, 状态码: %d", resp.StatusCode)
	}

	_, err = io.Copy(writer, resp.Body)
	return err
}

// IsExist 检查给定的源路径在 OneDrive 上是否存在物理文件或目录。
func (p *OneDriveProvider) IsExist(ctx context.Context, policy *model.StoragePolicy, source string) (bool, error) {
	client, err := p.getClient(ctx, policy)
	if err != nil {
		return false, err
	}
	driveBaseURL, err := p.getDriveBaseURL(policy)
	if err != nil {
		return false, err
	}

	// source 现在存储的是云端路径（如"OneDrive/AnHeYuComment/uuid.jpg"），直接构建API路径
	finalAPIPath := strings.Trim(source, "/")
	var apiPath string
	if finalAPIPath == "" || finalAPIPath == "." {
		apiPath = "/root"
	} else {
		apiPath = fmt.Sprintf("/root:/%s", finalAPIPath)
	}

	itemURL := fmt.Sprintf("%s%s", driveBaseURL, apiPath)
	req, err := http.NewRequestWithContext(ctx, "HEAD", itemURL, nil)
	if err != nil {
		return false, fmt.Errorf("创建检查存在性请求失败: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return false, fmt.Errorf("执行检查存在性请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return true, nil
	}
	if resp.StatusCode == http.StatusNotFound {
		return false, nil
	}

	return false, fmt.Errorf("检查文件是否存在时发生未知错误, 状态码: %d", resp.StatusCode)
}

// Get 返回一个可读的文件流，用于服务内部的文件处理，如元数据提取。
func (p *OneDriveProvider) Get(ctx context.Context, policy *model.StoragePolicy, source string) (io.ReadCloser, error) {
	// 直接使用传入的 policy 和 source 来获取下载链接。
	downloadURL, err := p.GetDownloadURL(ctx, policy, source, DownloadURLOptions{})
	if err != nil {
		return nil, fmt.Errorf("为文件 '%s' 获取 OneDrive 下载链接失败: %w", source, err)
	}

	httpClient := &http.Client{}
	resp, err := httpClient.Get(downloadURL)
	if err != nil {
		return nil, fmt.Errorf("请求预签名下载链接 '%s' 失败: %w", downloadURL, err)
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("下载文件 '%s' 失败, 状态码: %d", source, resp.StatusCode)
	}

	return resp.Body, nil
}

// getPolicyAndAPIPath 是一个关键的辅助函数，它将一个绝对的 source 路径
// 解析出它所属的存储策略以及在 OneDrive 中对应的 API 路径。
func (p *OneDriveProvider) getPolicyAndAPIPath(ctx context.Context, source string) (*model.StoragePolicy, string, error) {
	policy, err := p.policyRepo.FindByVirtualPath(ctx, source)
	if err != nil {
		return nil, "", fmt.Errorf("%w: 找不到路径 '%s' 对应的存储策略: %v", constant.ErrNotFound, source, err)
	}
	apiPath := p.buildAPIPath(policy, source)
	return policy, apiPath, nil
}

// deleteItem 是删除文件/目录的统一实现。
func (p *OneDriveProvider) deleteItem(ctx context.Context, policy *model.StoragePolicy, virtualPath string) error {
	client, err := p.getClient(ctx, policy)
	if err != nil {
		return err
	}
	driveBaseURL, err := p.getDriveBaseURL(policy)
	if err != nil {
		return err
	}

	apiPath := p.buildAPIPath(policy, virtualPath)
	deleteURL := fmt.Sprintf("%s%s", driveBaseURL, apiPath)

	req, err := http.NewRequestWithContext(ctx, "DELETE", deleteURL, nil)
	if err != nil {
		return fmt.Errorf("创建删除请求失败: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("执行删除请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNoContent || resp.StatusCode == http.StatusNotFound {
		return nil
	}

	body, _ := io.ReadAll(resp.Body)
	var errResp graphErrorResponse
	json.Unmarshal(body, &errResp)
	return fmt.Errorf("删除失败, 状态码: %d, 错误: %s", resp.StatusCode, errResp.Error.Message)
}

// getItemInfo 获取 OneDrive 上指定路径项目（文件或目录）的元信息。
func (p *OneDriveProvider) getItemInfo(ctx context.Context, policy *model.StoragePolicy, virtualPath string) (*graphDriveItem, error) {
	client, err := p.getClient(ctx, policy)
	if err != nil {
		return nil, err
	}
	driveBaseURL, err := p.getDriveBaseURL(policy)
	if err != nil {
		return nil, err
	}
	apiPath := p.buildAPIPath(policy, virtualPath)
	itemURL := fmt.Sprintf("%s%s", driveBaseURL, apiPath)

	resp, err := client.Get(itemURL)
	if err != nil {
		return nil, fmt.Errorf("请求项目信息失败: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		var errResp graphErrorResponse
		json.Unmarshal(body, &errResp)
		return nil, fmt.Errorf("获取项目信息失败, 状态码: %d, 错误: %s", resp.StatusCode, errResp.Error.Message)
	}

	var item graphDriveItem
	if err := json.Unmarshal(body, &item); err != nil {
		return nil, fmt.Errorf("解析项目信息响应失败: %w", err)
	}
	return &item, nil
}

// getClient 为每个请求动态创建认证过的、可能带有限速功能的HTTP客户端。
func (p *OneDriveProvider) getClient(ctx context.Context, policy *model.StoragePolicy) (*http.Client, error) {
	clientID := policy.BucketName
	clientSecret := policy.SecretKey
	refreshToken := policy.AccessKey

	if clientID == "" || clientSecret == "" || refreshToken == "" {
		return nil, errors.New("OneDrive策略凭据不完整或未授权")
	}

	var authEndpoint oauth2.Endpoint
	switch policy.Server {
	case "https://microsoftgraph.chinacloudapi.cn/v1.0":
		authEndpoint = azureChinaCloudEndpoint
	default:
		authEndpoint = microsoft.LiveConnectEndpoint
	}

	conf := &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		Endpoint:     authEndpoint,
		Scopes:       []string{"Files.ReadWrite.All", "offline_access"},
	}

	token := &oauth2.Token{
		RefreshToken: refreshToken,
	}

	baseClient := conf.Client(ctx, token)
	limiter := getOrCreateRateLimiter(policy)

	if limiter == nil {
		return baseClient, nil
	}

	baseTransport := baseClient.Transport
	if baseTransport == nil {
		baseTransport = http.DefaultTransport
	}

	baseClient.Transport = &rateLimitedTransport{
		base:    baseTransport,
		limiter: limiter,
	}

	return baseClient, nil
}

// getDriveBaseURL 用于获取正确的 Drive API 基地址。
func (p *OneDriveProvider) getDriveBaseURL(policy *model.StoragePolicy) (string, error) {
	driveType := "default"
	if dt, ok := policy.Settings["drive_type"].(string); ok {
		driveType = dt
	}

	switch driveType {
	case "sharepoint":
		driveID, ok := policy.Settings["drive_id"].(string)
		if !ok || driveID == "" {
			return "", errors.New("策略配置为SharePoint，但未提供 drive_id")
		}
		return fmt.Sprintf("%s/drives/%s", policy.Server, driveID), nil
	default:
		return fmt.Sprintf("%s/me/drive", policy.Server), nil
	}
}

// buildAPIPath 辅助函数，用于构建 OneDrive API 路径。
func (p *OneDriveProvider) buildAPIPath(policy *model.StoragePolicy, virtualPath string) string {
	// 1. 确保 policy.VirtualPath 和 policy.BasePath 都是规范的、没有尾部斜杠的路径
	//    但要特殊处理根路径 "/"
	normPolicyVirtualPath := strings.TrimRight(policy.VirtualPath, "/")
	if normPolicyVirtualPath == "" {
		normPolicyVirtualPath = "/"
	}
	normPolicyBasePath := strings.TrimRight(policy.BasePath, "/")
	if normPolicyBasePath == "" {
		normPolicyBasePath = "/"
	}

	// 2. 将 virtualPath 中代表策略挂载点的部分，直接替换为策略的云端基础路径。
	//    这是最核心、最可靠的转换逻辑。
	//    例如: virtualPath = "/onedrive/sub/folder"
	//          normPolicyVirtualPath = "/onedrive"
	//          normPolicyBasePath = "/AnHeYuAlbum"
	//    替换后 -> cloudPath = "/AnHeYuAlbum/sub/folder"
	var cloudPath string
	if virtualPath == normPolicyVirtualPath {
		cloudPath = normPolicyBasePath
	} else {
		// 使用 TrimPrefix 确保只替换开头的路径
		relativePath := strings.TrimPrefix(virtualPath, normPolicyVirtualPath)
		cloudPath = path.Join(normPolicyBasePath, relativePath)
	}

	// 3. 将计算出的云端路径格式化为 Graph API 接受的最终路径。
	finalAPIPath := strings.Trim(cloudPath, "/")
	if finalAPIPath == "" || finalAPIPath == "." {
		// 如果最终路径是云端的根目录
		return "/root"
	}

	return fmt.Sprintf("/root:/%s", finalAPIPath)
}

// simpleUpload 处理小文件上传 (< 4MB)。
func (p *OneDriveProvider) simpleUpload(ctx context.Context, file io.Reader, policy *model.StoragePolicy, virtualPath string) (*UploadResult, error) {
	client, err := p.getClient(ctx, policy)
	if err != nil {
		return nil, err
	}
	driveBaseURL, err := p.getDriveBaseURL(policy)
	if err != nil {
		return nil, err
	}
	apiPath := p.buildAPIPath(policy, virtualPath)
	uploadURL := fmt.Sprintf("%s%s:/content?@microsoft.graph.conflictBehavior=rename", driveBaseURL, apiPath)

	req, err := http.NewRequestWithContext(ctx, "PUT", uploadURL, file)
	if err != nil {
		return nil, fmt.Errorf("创建上传请求失败: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("执行上传请求失败: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var errResp graphErrorResponse
		json.Unmarshal(body, &errResp)
		return nil, fmt.Errorf("OneDrive上传失败, 状态码: %d, 错误: %s", resp.StatusCode, errResp.Error.Message)
	}
	return p.parseUploadResponse(body, policy, virtualPath)
}

// resumableUpload 处理大文件上传 (>= 4MB)。
func (p *OneDriveProvider) resumableUpload(ctx context.Context, file io.Reader, fileSize int64, policy *model.StoragePolicy, virtualPath string) (*UploadResult, error) {
	presignedResult, err := p.CreatePresignedUploadURL(ctx, policy, virtualPath)
	if err != nil {
		return nil, fmt.Errorf("为可续传创建会话失败: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, "PUT", presignedResult.UploadURL, file)
	if err != nil {
		return nil, fmt.Errorf("创建分片上传请求失败: %w", err)
	}
	req.Header.Set("Content-Length", fmt.Sprintf("%d", fileSize))
	req.Header.Set("Content-Range", fmt.Sprintf("bytes 0-%d/%d", fileSize-1, fileSize))
	httpClient := &http.Client{}
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("执行分片上传失败: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var errResp graphErrorResponse
		json.Unmarshal(body, &errResp)
		return nil, fmt.Errorf("OneDrive分片上传失败, 状态码: %d, 错误: %s", resp.StatusCode, errResp.Error.Message)
	}
	return p.parseUploadResponse(body, policy, virtualPath)
}

// CreatePresignedUploadURL 为客户端直传创建一个临时的上传会话和URL。
func (p *OneDriveProvider) CreatePresignedUploadURL(ctx context.Context, policy *model.StoragePolicy, virtualPath string) (*PresignedUploadResult, error) {
	client, err := p.getClient(ctx, policy)
	if err != nil {
		return nil, err
	}
	driveBaseURL, err := p.getDriveBaseURL(policy)
	if err != nil {
		return nil, err
	}
	apiPath := p.buildAPIPath(policy, virtualPath)
	sessionURL := fmt.Sprintf("%s%s:/createUploadSession", driveBaseURL, apiPath)
	payloadMap := map[string]string{
		"@microsoft.graph.conflictBehavior": "rename",
	}
	payload, _ := json.Marshal(payloadMap)
	req, err := http.NewRequestWithContext(ctx, "POST", sessionURL, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("创建上传会话请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("执行上传会话请求失败: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		var errResp graphErrorResponse
		json.Unmarshal(body, &errResp)
		return nil, fmt.Errorf("创建上传会话失败, 状态码: %d, 错误: %s", resp.StatusCode, errResp.Error.Message)
	}
	var sessionResp graphUploadSessionResponse
	if err := json.Unmarshal(body, &sessionResp); err != nil {
		return nil, fmt.Errorf("解析上传会话响应失败: %w", err)
	}
	expTime, _ := time.Parse(time.RFC3339, sessionResp.ExpirationDateTime)
	return &PresignedUploadResult{
		UploadURL:          sessionResp.UploadURL,
		ExpirationDateTime: expTime,
		ContentType:        "", // OneDrive不需要指定Content-Type
	}, nil
}

// parseUploadResponse 是一个辅助函数，用于解析上传成功后返回的 item 信息。
func (p *OneDriveProvider) parseUploadResponse(body []byte, policy *model.StoragePolicy, originalVirtualPath string) (*UploadResult, error) {
	var item graphDriveItem
	if err := json.Unmarshal(body, &item); err != nil {
		return nil, fmt.Errorf("解析上传响应失败: %w", err)
	}
	var mimeType string
	if item.File != nil {
		var fileInfo struct {
			MimeType string `json:"mimeType"`
		}
		json.Unmarshal(*item.File, &fileInfo)
		mimeType = fileInfo.MimeType
	}

	finalFileName := item.Name
	originalParentDir := path.Dir(originalVirtualPath)
	finalVirtualPath := path.Join(originalParentDir, finalFileName)

	// OneDrive Source应该存储云端路径（相对于BasePath），类似于OSS/COS的对象键
	// 计算相对路径
	relativeSourcePath := strings.TrimPrefix(finalVirtualPath, policy.VirtualPath)
	relativeSourcePath = strings.TrimPrefix(relativeSourcePath, "/")

	basePath := strings.TrimPrefix(strings.TrimSuffix(policy.BasePath, "/"), "/")

	var sourcePath string
	if basePath == "" {
		sourcePath = relativeSourcePath
	} else {
		if relativeSourcePath == "" {
			sourcePath = basePath
		} else {
			sourcePath = basePath + "/" + relativeSourcePath
		}
	}

	return &UploadResult{
		Source:   sourcePath,
		Size:     item.Size,
		MimeType: mimeType,
	}, nil
}
