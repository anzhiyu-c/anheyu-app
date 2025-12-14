/*
 * @Description: 腾讯云COS存储提供者实现
 * @Author: 安知鱼
 * @Date: 2025-09-28 12:00:00
 * @LastEditTime: 2025-12-02 18:30:00
 * @LastEditors: 安知鱼
 *
 * 【重要：路径转换规则说明】
 *
 * 本存储提供者中的方法接收两种类型的路径参数，必须正确区分：
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ 类型1: virtualPath（完整虚拟路径）                                           │
 * │                                                                             │
 * │ 格式: /挂载点/子目录/文件名                                                   │
 * │ 示例: /cos/aaa/123.jpg                                                      │
 * │                                                                             │
 * │ 使用此参数的方法:                                                            │
 * │   - Upload()                                                                │
 * │   - List()                                                                  │
 * │   - CreateDirectory()                                                       │
 * │   - DeleteDirectory()                                                       │
 * │   - Rename()                                                                │
 * │   - CreatePresignedUploadURL()                                              │
 * │                                                                             │
 * │ 转换逻辑: 调用 buildObjectKey() 进行转换                                      │
 * │   1. 从 virtualPath 中减去 policy.VirtualPath（挂载点）得到相对路径            │
 * │      相对路径 = "/cos/aaa/123.jpg" - "/cos" = "/aaa/123.jpg"                 │
 * │   2. 将相对路径与 policy.BasePath（云存储基础路径）拼接                         │
 * │      对象键 = "test" + "/aaa/123.jpg" = "test/aaa/123.jpg"                   │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ 类型2: source（完整对象键）                                                  │
 * │                                                                             │
 * │ 格式: 云存储上的实际路径（已包含 BasePath）                                    │
 * │ 示例: test/aaa/123.jpg                                                      │
 * │                                                                             │
 * │ 使用此参数的方法:                                                            │
 * │   - Get()                                                                   │
 * │   - Delete()                                                                │
 * │   - Stream()                                                                │
 * │   - GetDownloadURL()                                                        │
 * │   - IsExist() / IsExistWithPolicy()                                         │
 * │   - GetThumbnail()                                                          │
 * │                                                                             │
 * │ 处理逻辑: 直接使用，不需要任何转换                                             │
 * │   source 是从数据库 file_storage_entities.source 字段读取的值，                │
 * │   在文件上传时已经由 Upload() 方法生成并存储。                                 │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * 【存储策略配置说明】
 *
 * policy.VirtualPath: 策略在虚拟文件系统中的挂载点（如 "/cos"）
 * policy.BasePath:    策略在云存储上的基础目录（如 "/test"）
 *
 * 【警告】修改路径转换逻辑前请仔细阅读以上说明！
 */
package storage

import (
	"context"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/tencentyun/cos-go-sdk-v5"
)

// TencentCOSProvider 实现了 IStorageProvider 接口，用于处理与腾讯云COS的所有交互。
type TencentCOSProvider struct {
}

// NewTencentCOSProvider 是 TencentCOSProvider 的构造函数。
func NewTencentCOSProvider() IStorageProvider {
	return &TencentCOSProvider{}
}

// getCOSClient 获取腾讯云COS客户端
func (p *TencentCOSProvider) getCOSClient(policy *model.StoragePolicy) (*cos.Client, error) {
	// 添加调试日志，打印策略的关键信息
	log.Printf("[腾讯云COS] 创建客户端 - 策略名称: %s, 策略ID: %d, Server: %s", policy.Name, policy.ID, policy.Server)

	// 从策略中获取配置信息
	bucketName := policy.BucketName
	if bucketName == "" {
		log.Printf("[腾讯云COS] 错误: 存储桶名称为空")
		return nil, fmt.Errorf("腾讯云COS策略缺少存储桶名称")
	}

	secretID := policy.AccessKey
	if secretID == "" {
		return nil, fmt.Errorf("腾讯云COS策略缺少SecretID")
	}

	secretKey := policy.SecretKey
	if secretKey == "" {
		return nil, fmt.Errorf("腾讯云COS策略缺少SecretKey")
	}

	// 直接使用策略中的Server字段作为访问域名
	if policy.Server == "" {
		log.Printf("[腾讯云COS] 错误: 访问域名为空")
		return nil, fmt.Errorf("腾讯云COS策略缺少访问域名配置")
	}

	u, err := url.Parse(policy.Server)
	if err != nil {
		return nil, fmt.Errorf("解析存储桶URL失败: %w", err)
	}

	// 创建COS客户端
	b := &cos.BaseURL{BucketURL: u}
	client := cos.NewClient(b, &http.Client{
		Timeout: 100 * time.Second,
		Transport: &cos.AuthorizationTransport{
			SecretID:  secretID,
			SecretKey: secretKey,
		},
	})

	return client, nil
}

// buildObjectKey 构建对象存储路径
// virtualPath 是完整的虚拟路径（如 "/cos" 或 "/cos/subdir"）
// 需要先从 virtualPath 中减去策略的 VirtualPath（挂载点），得到相对路径，再与 BasePath 拼接
func (p *TencentCOSProvider) buildObjectKey(policy *model.StoragePolicy, virtualPath string) string {
	// 计算相对于策略挂载点的相对路径
	// 例如: virtualPath="/cos/subdir", policy.VirtualPath="/cos" -> relativePath="subdir"
	relativePath := strings.TrimPrefix(virtualPath, policy.VirtualPath)
	relativePath = strings.TrimPrefix(relativePath, "/")

	// 基础前缀路径处理（从策略的 BasePath 获取）
	basePath := strings.TrimPrefix(strings.TrimSuffix(policy.BasePath, "/"), "/")

	var objectKey string
	if basePath == "" {
		objectKey = relativePath
	} else {
		if relativePath == "" {
			objectKey = basePath
		} else {
			objectKey = basePath + "/" + relativePath
		}
	}

	// 确保不以斜杠开头
	objectKey = strings.TrimPrefix(objectKey, "/")

	log.Printf("[腾讯云COS] 路径转换 - basePath: %s, virtualPath: %s, policyVirtualPath: %s -> relativePath: %s -> objectKey: %s",
		policy.BasePath, virtualPath, policy.VirtualPath, relativePath, objectKey)
	return objectKey
}

// Upload 上传文件到腾讯云COS
//
// 【路径转换规则】
// virtualPath 是完整的虚拟路径，格式为: /挂载点/子目录/文件名
// 例如: virtualPath = "/cos/aaa/123.jpg"
//
// 转换步骤:
//  1. 从 virtualPath 中减去 policy.VirtualPath（挂载点），得到相对路径
//     相对路径 = "/cos/aaa/123.jpg" - "/cos" = "/aaa/123.jpg"
//  2. 将相对路径与 policy.BasePath（云存储基础路径）拼接
//     对象键 = "/test" + "/aaa/123.jpg" = "test/aaa/123.jpg"
//
// 数据库 files 表的 name 字段存储的是相对于挂载点的路径（不含挂载点）
func (p *TencentCOSProvider) Upload(ctx context.Context, file io.Reader, policy *model.StoragePolicy, virtualPath string) (*UploadResult, error) {
	log.Printf("[腾讯云COS] 开始上传文件: virtualPath=%s, BasePath=%s, VirtualPath=%s", virtualPath, policy.BasePath, policy.VirtualPath)

	client, err := p.getCOSClient(policy)
	if err != nil {
		log.Printf("[腾讯云COS] 创建客户端失败: %v", err)
		return nil, err
	}

	// 使用 buildObjectKey 进行路径转换，确保保留完整的子目录结构
	objectKey := p.buildObjectKey(policy, virtualPath)

	log.Printf("[腾讯云COS] 上传对象: objectKey=%s", objectKey)

	// 上传文件
	_, err = client.Object.Put(ctx, objectKey, file, nil)
	if err != nil {
		log.Printf("[腾讯云COS] 上传失败: %v", err)
		return nil, fmt.Errorf("上传文件到腾讯云COS失败: %w", err)
	}

	log.Printf("[腾讯云COS] 上传成功: objectKey=%s", objectKey)

	// 获取文件信息
	resp, err := client.Object.Head(ctx, objectKey, nil)
	if err != nil {
		return nil, fmt.Errorf("获取上传后的文件信息失败: %w", err)
	}

	// 解析文件大小
	var fileSize int64 = 0
	if contentLengthStr := resp.Header.Get("Content-Length"); contentLengthStr != "" {
		if size, parseErr := strconv.ParseInt(contentLengthStr, 10, 64); parseErr == nil {
			fileSize = size
		}
	}

	// 获取MIME类型
	mimeType := resp.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = mime.TypeByExtension(filepath.Ext(virtualPath))
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}
	}

	return &UploadResult{
		Source:   objectKey, // 返回对象键作为source
		Size:     fileSize,
		MimeType: mimeType,
	}, nil
}

// Get 从腾讯云COS获取文件流
func (p *TencentCOSProvider) Get(ctx context.Context, policy *model.StoragePolicy, source string) (io.ReadCloser, error) {
	client, err := p.getCOSClient(policy)
	if err != nil {
		return nil, err
	}

	// source 已经是完整的对象键
	resp, err := client.Object.Get(ctx, source, nil)
	if err != nil {
		return nil, fmt.Errorf("从腾讯云COS获取文件失败: %w", err)
	}

	return resp.Body, nil
}

// List 列出腾讯云COS存储桶中的对象
func (p *TencentCOSProvider) List(ctx context.Context, policy *model.StoragePolicy, virtualPath string) ([]FileInfo, error) {
	log.Printf("[腾讯云COS] List方法调用 - 策略名称: %s, virtualPath: %s, BasePath: %s, VirtualPath: %s",
		policy.Name, virtualPath, policy.BasePath, policy.VirtualPath)

	client, err := p.getCOSClient(policy)
	if err != nil {
		return nil, err
	}

	// 计算相对于策略挂载点的相对路径
	relativePath := strings.TrimPrefix(virtualPath, policy.VirtualPath)
	relativePath = strings.TrimPrefix(relativePath, "/")

	// 构建COS对象键前缀
	var prefix string
	basePath := strings.TrimPrefix(strings.TrimSuffix(policy.BasePath, "/"), "/")

	if basePath == "" {
		// BasePath为空，直接使用相对路径
		prefix = relativePath
	} else {
		// BasePath不为空，拼接basePath和相对路径
		if relativePath == "" {
			prefix = basePath
		} else {
			prefix = basePath + "/" + relativePath
		}
	}

	// 添加结尾斜杠以表示目录
	if prefix != "" && !strings.HasSuffix(prefix, "/") {
		prefix += "/"
	}

	log.Printf("[腾讯云COS] 计算的prefix: %s (relativePath: %s)", prefix, relativePath)

	opt := &cos.BucketGetOptions{
		Prefix:    prefix,
		Delimiter: "/", // 只列出直接子对象，不递归
	}

	result, _, err := client.Bucket.Get(ctx, opt)
	if err != nil {
		return nil, fmt.Errorf("列出腾讯云COS对象失败: %w", err)
	}

	var fileInfos []FileInfo

	// 处理"目录"（CommonPrefixes）
	for _, commonPrefix := range result.CommonPrefixes {
		name := strings.TrimSuffix(strings.TrimPrefix(commonPrefix, prefix), "/")
		if name != "" {
			fileInfos = append(fileInfos, FileInfo{
				Name:  name,
				Size:  0,
				IsDir: true,
			})
		}
	}

	// 处理文件
	for _, content := range result.Contents {
		// 跳过"目录"对象（以/结尾的对象）
		if strings.HasSuffix(content.Key, "/") {
			continue
		}

		name := strings.TrimPrefix(content.Key, prefix)
		if name != "" && !strings.Contains(name, "/") {
			// 解析最后修改时间
			var modTime time.Time
			if content.LastModified != "" {
				if t, parseErr := time.Parse("2006-01-02T15:04:05.000Z", content.LastModified); parseErr == nil {
					modTime = t
				}
			}

			fileInfos = append(fileInfos, FileInfo{
				Name:    name,
				Size:    int64(content.Size),
				IsDir:   false,
				ModTime: modTime,
			})
		}
	}

	return fileInfos, nil
}

// Delete 删除腾讯云COS中的文件
// sources 是完整的对象键列表（如 "article_image_cos/logo.png"），已包含 basePath，无需再拼接
func (p *TencentCOSProvider) Delete(ctx context.Context, policy *model.StoragePolicy, sources []string) error {
	if len(sources) == 0 {
		return nil
	}

	client, err := p.getCOSClient(policy)
	if err != nil {
		return err
	}

	log.Printf("[腾讯云COS] Delete方法调用 - 策略: %s, 删除文件数量: %d", policy.Name, len(sources))

	for _, source := range sources {
		// source 已经是完整的对象键，直接使用
		objectKey := source
		log.Printf("[腾讯云COS] 删除对象: %s", objectKey)
		_, err := client.Object.Delete(ctx, objectKey)
		if err != nil {
			log.Printf("[腾讯云COS] 删除对象失败: %s, 错误: %v", objectKey, err)
			return fmt.Errorf("删除腾讯云COS对象 %s 失败: %w", source, err)
		}
		log.Printf("[腾讯云COS] 成功删除对象: %s", objectKey)
	}

	return nil
}

// DeleteWithPolicy 使用策略信息删除文件（扩展方法）
func (p *TencentCOSProvider) DeleteWithPolicy(ctx context.Context, policy *model.StoragePolicy, sources []string) error {
	if len(sources) == 0 {
		return nil
	}

	client, err := p.getCOSClient(policy)
	if err != nil {
		return err
	}

	for _, source := range sources {
		// source 已经是完整的对象键
		_, err := client.Object.Delete(ctx, source)
		if err != nil {
			return fmt.Errorf("删除腾讯云COS对象 %s 失败: %w", source, err)
		}
	}

	return nil
}

// CreateDirectory 在腾讯云COS中创建"目录"
func (p *TencentCOSProvider) CreateDirectory(ctx context.Context, policy *model.StoragePolicy, virtualPath string) error {
	client, err := p.getCOSClient(policy)
	if err != nil {
		return err
	}

	objectKey := p.buildObjectKey(policy, virtualPath)
	if !strings.HasSuffix(objectKey, "/") {
		objectKey += "/"
	}

	// 上传一个空对象来表示目录
	_, err = client.Object.Put(ctx, objectKey, strings.NewReader(""), nil)
	if err != nil {
		return fmt.Errorf("在腾讯云COS中创建目录失败: %w", err)
	}

	return nil
}

// DeleteDirectory 删除腾讯云COS中的"目录"
func (p *TencentCOSProvider) DeleteDirectory(ctx context.Context, policy *model.StoragePolicy, virtualPath string) error {
	client, err := p.getCOSClient(policy)
	if err != nil {
		return err
	}

	objectKey := p.buildObjectKey(policy, virtualPath)
	if !strings.HasSuffix(objectKey, "/") {
		objectKey += "/"
	}

	_, err = client.Object.Delete(ctx, objectKey)
	if err != nil {
		return fmt.Errorf("删除腾讯云COS目录失败: %w", err)
	}

	return nil
}

// GetDownloadURL 根据存储策略权限设置生成腾讯云COS下载URL
func (p *TencentCOSProvider) GetDownloadURL(ctx context.Context, policy *model.StoragePolicy, source string, options DownloadURLOptions) (string, error) {
	log.Printf("[腾讯云COS] GetDownloadURL调用 - source: %s, policy.Server: %s, policy.IsPrivate: %v", source, policy.Server, policy.IsPrivate)

	// 检查访问域名配置
	if policy.Server == "" {
		log.Printf("[腾讯云COS] 错误: 访问域名配置为空")
		return "", fmt.Errorf("腾讯云COS策略缺少访问域名配置")
	}

	// source 已经是完整的对象键（在Upload时已经包含了basePath），不需要再次调用buildObjectKey
	objectKey := source
	if objectKey == "" {
		log.Printf("[腾讯云COS] objectKey为空，这不应该发生")
		return "", fmt.Errorf("对象键为空")
	}
	log.Printf("[腾讯云COS] 使用对象键: %s", objectKey)

	// 打印完整的 Settings 用于调试
	log.Printf("[腾讯云COS] 完整Settings: %+v", policy.Settings)

	// 检查是否配置了CDN域名
	cdnDomain := ""
	if val, ok := policy.Settings["cdn_domain"].(string); ok && val != "" {
		// 处理CDN域名的尾随斜杠
		cdnDomain = strings.TrimSuffix(val, "/")
	}
	log.Printf("[腾讯云COS] cdn_domain 原始值: %v (类型: %T)", policy.Settings["cdn_domain"], policy.Settings["cdn_domain"])

	sourceAuth := false
	if val, ok := policy.Settings["source_auth"].(bool); ok {
		sourceAuth = val
	}
	log.Printf("[腾讯云COS] source_auth 原始值: %v (类型: %T)", policy.Settings["source_auth"], policy.Settings["source_auth"])

	// 获取样式分隔符配置
	styleSeparator := ""
	if val, ok := policy.Settings["style_separator"].(string); ok {
		styleSeparator = val
	}

	log.Printf("[腾讯云COS] 配置信息 - cdnDomain: %s, sourceAuth: %v, styleSeparator: %s", cdnDomain, sourceAuth, styleSeparator)

	// 根据是否为私有存储策略决定URL类型
	if policy.IsPrivate && !sourceAuth {
		log.Printf("[腾讯云COS] 生成预签名URL (私有策略)")

		// 私有存储策略且未开启CDN回源鉴权：生成预签名URL
		client, err := p.getCOSClient(policy)
		if err != nil {
			log.Printf("[腾讯云COS] 创建客户端失败: %v", err)
			return "", err
		}

		// 设置过期时间，默认1小时
		expiresIn := options.ExpiresIn
		if expiresIn <= 0 {
			expiresIn = 3600 // 1小时
		}

		// 从策略中获取密钥信息用于签名
		secretID := policy.AccessKey
		secretKey := policy.SecretKey

		presignedURL, err := client.Object.GetPresignedURL(ctx, http.MethodGet, objectKey,
			secretID, secretKey, time.Duration(expiresIn)*time.Second, nil)
		if err != nil {
			log.Printf("[腾讯云COS] 生成预签名URL失败: %v", err)
			return "", fmt.Errorf("生成腾讯云COS预签名URL失败: %w", err)
		}

		finalURL := presignedURL.String()

		// 添加图片处理参数
		if options.QueryParams != "" {
			params := strings.TrimSpace(options.QueryParams)
			if params != "" {
				// 检查是否是样式分隔符（以 /、!、|、- 开头）
				styleSeparatorChars := []string{"/", "!", "|", "-"}
				isStyleSeparator := false
				for _, sep := range styleSeparatorChars {
					if strings.HasPrefix(params, sep) {
						isStyleSeparator = true
						break
					}
				}

				if isStyleSeparator {
					// 样式分隔符需要插入到URL路径部分，在查询参数之前
					// 将URL分为基础URL和查询参数两部分
					if idx := strings.Index(finalURL, "?"); idx > 0 {
						baseURL := finalURL[:idx]
						queryParams := finalURL[idx:]
						finalURL = baseURL + params + queryParams
						log.Printf("[腾讯云COS] 在预签名URL中插入样式分隔符: %s", params)
					} else {
						// 没有查询参数（理论上不应该发生在预签名URL中）
						finalURL += params
					}
				} else {
					// 传统查询参数，使用 & 连接
					params = strings.TrimPrefix(params, "?")
					if params != "" {
						finalURL += "&" + params
						log.Printf("[腾讯云COS] 在预签名URL后追加查询参数")
					}
				}
			}
		}

		log.Printf("[腾讯云COS] 生成的预签名URL: %s", finalURL)
		return finalURL, nil
	} else {
		log.Printf("[腾讯云COS] 生成公开URL (公开策略或CDN回源鉴权)")

		// 公开存储策略或开启CDN回源鉴权：使用配置的域名
		var finalURL string
		if cdnDomain != "" {
			// 如果配置了CDN域名，使用CDN域名替换协议和主机名
			finalURL = fmt.Sprintf("%s/%s", cdnDomain, objectKey)
			log.Printf("[腾讯云COS] 使用CDN域名生成URL: %s", finalURL)
		} else {
			// 否则使用原始Server域名
			baseURL := strings.TrimSuffix(policy.Server, "/")
			finalURL = fmt.Sprintf("%s/%s", baseURL, objectKey)
			log.Printf("[腾讯云COS] 使用Server域名生成URL: %s", finalURL)
		}

		// 添加图片处理参数
		if options.QueryParams != "" {
			finalURL = appendImageParams(finalURL, options.QueryParams, styleSeparator)
			log.Printf("[腾讯云COS] 添加图片处理参数后的公开URL: %s", finalURL)
		}

		return finalURL, nil
	}
}

// Rename 重命名或移动腾讯云COS中的对象
// Rename 重命名或移动腾讯云COS中的文件或目录
// oldVirtualPath 和 newVirtualPath 是相对于 policy.VirtualPath 的路径，需要通过 buildObjectKey 转换为完整对象键
func (p *TencentCOSProvider) Rename(ctx context.Context, policy *model.StoragePolicy, oldVirtualPath, newVirtualPath string) error {
	client, err := p.getCOSClient(policy)
	if err != nil {
		return err
	}

	// 使用 buildObjectKey 将相对路径转换为完整对象键
	oldObjectKey := p.buildObjectKey(policy, oldVirtualPath)
	newObjectKey := p.buildObjectKey(policy, newVirtualPath)

	log.Printf("[腾讯云COS] Rename: %s -> %s", oldObjectKey, newObjectKey)

	// 腾讯云COS不支持直接重命名，需要先复制后删除
	// 从Server URL提取域名部分构建源URL
	serverURL := strings.TrimSuffix(policy.Server, "/")
	// 移除协议部分，只保留域名部分用于Copy操作
	serverURL = strings.TrimPrefix(serverURL, "https://")
	serverURL = strings.TrimPrefix(serverURL, "http://")
	sourceURL := fmt.Sprintf("%s/%s", serverURL, oldObjectKey)

	_, _, err = client.Object.Copy(ctx, newObjectKey, sourceURL, nil)
	if err != nil {
		return fmt.Errorf("复制腾讯云COS对象失败: %w", err)
	}

	// 删除原对象
	_, err = client.Object.Delete(ctx, oldObjectKey)
	if err != nil {
		return fmt.Errorf("删除原腾讯云COS对象失败: %w", err)
	}

	return nil
}

// Stream 将腾讯云COS文件内容流式传输到写入器
func (p *TencentCOSProvider) Stream(ctx context.Context, policy *model.StoragePolicy, source string, writer io.Writer) error {
	// 获取样式分隔符配置
	styleSeparator := ""
	if val, ok := policy.Settings["style_separator"].(string); ok && val != "" {
		styleSeparator = val
	}

	// 生成合适的下载URL（根据权限设置）
	// 如果配置了样式分隔符，将其作为查询参数传递
	options := DownloadURLOptions{ExpiresIn: 3600}
	if styleSeparator != "" {
		options.QueryParams = styleSeparator
		log.Printf("[腾讯云COS] Stream方法应用样式分隔符: %s", styleSeparator)
	}

	downloadURL, err := p.GetDownloadURL(ctx, policy, source, options)
	if err != nil {
		return err
	}

	if w, ok := writer.(http.ResponseWriter); ok {
		w.Header().Set("Location", downloadURL)
		w.WriteHeader(http.StatusFound)
		log.Printf("[腾讯云COS] Stream方法重定向到: %s", downloadURL)
		return nil
	}

	return fmt.Errorf("腾讯云COS流式传输需要http.ResponseWriter来执行重定向")
}

// IsExist 检查腾讯云COS中的对象是否存在
func (p *TencentCOSProvider) IsExist(ctx context.Context, policy *model.StoragePolicy, source string) (bool, error) {
	client, err := p.getCOSClient(policy)
	if err != nil {
		return false, err
	}

	// source 已经是完整的对象键
	_, err = client.Object.Head(ctx, source, nil)
	if err != nil {
		// 如果是404错误，表示对象不存在
		if cosErr, ok := err.(*cos.ErrorResponse); ok && cosErr.Code == "NoSuchKey" {
			return false, nil
		}
		return false, err
	}

	return true, nil
}

// IsExistWithPolicy 使用策略信息检查对象是否存在（扩展方法）
func (p *TencentCOSProvider) IsExistWithPolicy(ctx context.Context, policy *model.StoragePolicy, source string) (bool, error) {
	client, err := p.getCOSClient(policy)
	if err != nil {
		return false, err
	}

	// source 已经是完整的对象键
	_, err = client.Object.Head(ctx, source, nil)
	if err != nil {
		// 如果是404错误，表示对象不存在
		if cosErr, ok := err.(*cos.ErrorResponse); ok && cosErr.Code == "NoSuchKey" {
			return false, nil
		}
		return false, err
	}

	return true, nil
}

// GetThumbnail 腾讯云COS的数据万象服务支持实时图片处理，可以生成缩略图
// 如果用户在腾讯云控制台开通了数据万象服务，此功能将自动可用
func (p *TencentCOSProvider) GetThumbnail(ctx context.Context, policy *model.StoragePolicy, source string, size string) (*ThumbnailResult, error) {

	// 将描述性尺寸参数转换为像素尺寸
	var width, height int
	switch strings.ToLower(size) {
	case "small":
		width, height = 200, 200
	case "medium":
		width, height = 400, 400
	case "large":
		width, height = 800, 800
	default:
		// 尝试解析像素格式（如 "300x200"）
		width, height = parseThumbnailSize(size)
		if width <= 0 || height <= 0 {
			// 如果解析失败，默认使用 medium 尺寸
			log.Printf("[腾讯云COS] 无法解析缩略图尺寸 '%s'，使用默认 medium 尺寸", size)
			width, height = 400, 400
		}
	}

	// 构建数据万象处理参数
	imageProcess := fmt.Sprintf("imageMogr2/thumbnail/%dx%d", width, height)

	var thumbnailURL string

	// 如果是私有存储桶，需要生成预签名URL
	if policy.IsPrivate {
		client, err := p.getCOSClient(policy)
		if err != nil {
			log.Printf("[腾讯云COS] 创建客户端失败: %v", err)
			return nil, err
		}

		// 从策略中获取密钥信息用于签名
		secretID := policy.AccessKey
		secretKey := policy.SecretKey

		// 设置过期时间为 10 分钟（用于下载缩略图）
		expiresIn := 600 // 10分钟

		// 生成带图片处理参数的预签名URL
		presignedURL, err := client.Object.GetPresignedURL(ctx, http.MethodGet, source,
			secretID, secretKey, time.Duration(expiresIn)*time.Second, nil)
		if err != nil {
			log.Printf("[腾讯云COS] 生成预签名URL失败: %v", err)
			return nil, fmt.Errorf("生成腾讯云COS预签名URL失败: %w", err)
		}

		// 将图片处理参数添加到预签名URL中
		// 需要在查询参数之前插入
		baseURL := presignedURL.String()
		if idx := strings.Index(baseURL, "?"); idx > 0 {
			// 将URL分为基础URL和查询参数两部分
			urlBase := baseURL[:idx]
			queryParams := baseURL[idx:]
			thumbnailURL = urlBase + "?" + imageProcess + "&" + strings.TrimPrefix(queryParams, "?")
		} else {
			thumbnailURL = baseURL + "?" + imageProcess
		}

		log.Printf("[腾讯云COS] 生成私有存储桶缩略图预签名URL")
	} else {
		// 公有存储桶，直接构建URL
		serverURL := strings.TrimSuffix(policy.Server, "/")
		thumbnailURL = fmt.Sprintf("%s/%s?%s", serverURL, source, imageProcess)
		log.Printf("[腾讯云COS] 生成公有存储桶缩略图URL")
	}

	log.Printf("[腾讯云COS] 缩略图URL: %s", thumbnailURL)

	// 下载缩略图数据
	resp, err := http.Get(thumbnailURL)
	if err != nil {
		return nil, fmt.Errorf("获取缩略图数据失败: %w", err)
	}
	defer resp.Body.Close()

	// 检查HTTP响应状态
	if resp.StatusCode != http.StatusOK {
		// 如果返回 404 或其他错误，可能是数据万象服务未开通或文件不支持缩略图
		if resp.StatusCode == http.StatusNotFound {
			log.Printf("[腾讯云COS] 缩略图生成失败: 文件不存在或数据万象服务未开通 (HTTP %d)", resp.StatusCode)
			return nil, ErrFeatureNotSupported
		}
		if resp.StatusCode == http.StatusForbidden {
			log.Printf("[腾讯云COS] 缩略图访问被拒绝: 可能是数据万象服务未授权或配置问题 (HTTP %d)", resp.StatusCode)
			return nil, ErrFeatureNotSupported
		}
		return nil, fmt.Errorf("获取缩略图失败: HTTP状态码 %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取缩略图数据失败: %w", err)
	}

	return &ThumbnailResult{
		ContentType: "image/jpeg", // 数据万象默认输出JPEG
		Data:        data,
	}, nil
}

// parseThumbnailSize 解析缩略图尺寸字符串（如"300x200"）
func parseThumbnailSize(size string) (int, int) {
	parts := strings.Split(size, "x")
	if len(parts) != 2 {
		return 0, 0
	}

	width, err1 := strconv.Atoi(parts[0])
	height, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil {
		return 0, 0
	}

	return width, height
}

// SetupCORS 为腾讯云COS存储桶配置跨域策略
// 配置允许所有来源访问，支持GET, POST, PUT, DELETE, HEAD方法
func (p *TencentCOSProvider) SetupCORS(ctx context.Context, policy *model.StoragePolicy) error {
	client, err := p.getCOSClient(policy)
	if err != nil {
		return fmt.Errorf("创建腾讯云COS客户端失败: %w", err)
	}

	// 定义CORS规则
	corsRule := &cos.BucketCORSRule{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "HEAD"},
		AllowedHeaders: []string{"*"},
		ExposeHeaders:  []string{"ETag"},
		MaxAgeSeconds:  3600,
	}

	corsConfig := &cos.BucketPutCORSOptions{
		Rules: []cos.BucketCORSRule{*corsRule},
	}

	_, err = client.Bucket.PutCORS(ctx, corsConfig)
	if err != nil {
		return fmt.Errorf("配置腾讯云COS跨域策略失败: %w", err)
	}

	return nil
}

// GetCORSConfig 获取腾讯云COS存储桶的跨域配置
func (p *TencentCOSProvider) GetCORSConfig(ctx context.Context, policy *model.StoragePolicy) (*cos.BucketGetCORSResult, error) {
	client, err := p.getCOSClient(policy)
	if err != nil {
		return nil, fmt.Errorf("创建腾讯云COS客户端失败: %w", err)
	}

	result, _, err := client.Bucket.GetCORS(ctx)
	if err != nil {
		return nil, fmt.Errorf("获取腾讯云COS跨域配置失败: %w", err)
	}

	return result, nil
}

// appendImageParams 智能地将图片处理参数附加到URL中
// 支持腾讯云COS数据万象的参数格式，如: imageMogr2/format/avif
// 也支持样式分隔符格式，如: !ArticleImage 或 /ArticleImage
// params 可能的格式：
// - "imageMogr2/format/avif" (纯查询参数)
// - "!ArticleImage" (纯样式分隔符)
// - "!ArticleImage?imageMogr2/format/avif" (样式分隔符 + 查询参数)
func appendImageParams(baseURL, params, separator string) string {
	params = strings.TrimSpace(params)
	if params == "" {
		return baseURL
	}

	// 检查是否以样式分隔符开头（!、/、|、-）
	// 如果是，直接拼接，不做任何处理
	styleSeparatorChars := []string{"!", "/", "|", "-"}
	for _, sep := range styleSeparatorChars {
		if strings.HasPrefix(params, sep) {
			// 这是一个样式分隔符或包含样式分隔符的完整参数
			// 直接拼接到URL后面
			return baseURL + params
		}
	}

	// 移除开头的 ? 如果有的话（传统的查询参数格式）
	params = strings.TrimPrefix(params, "?")
	if params == "" {
		return baseURL
	}

	// 如果没有指定分隔符，使用默认的 ? 分隔符
	if separator == "" {
		separator = "?"
	}

	// 简单的字符串拼接方式，避免URL编码
	// 腾讯云数据万象的参数格式不需要编码
	if strings.Contains(baseURL, "?") {
		return baseURL + "&" + params
	}
	return baseURL + separator + params
}

// CreatePresignedUploadURL 为客户端直传创建一个预签名的上传URL
// 客户端可以使用此URL直接PUT文件到腾讯云COS，无需经过服务器中转
//
// 【路径转换规则】
// virtualPath 是完整的虚拟路径，格式为: /挂载点/子目录/文件名
// 例如: virtualPath = "/cos/aaa/123.jpg"
//
// 转换步骤（与 Upload 方法相同）:
//  1. 从 virtualPath 中减去 policy.VirtualPath（挂载点），得到相对路径
//     相对路径 = "/cos/aaa/123.jpg" - "/cos" = "/aaa/123.jpg"
//  2. 将相对路径与 policy.BasePath（云存储基础路径）拼接
//     对象键 = "/test" + "/aaa/123.jpg" = "test/aaa/123.jpg"
func (p *TencentCOSProvider) CreatePresignedUploadURL(ctx context.Context, policy *model.StoragePolicy, virtualPath string) (*PresignedUploadResult, error) {
	log.Printf("[腾讯云COS] 创建预签名上传URL - virtualPath: %s, VirtualPath: %s, BasePath: %s", virtualPath, policy.VirtualPath, policy.BasePath)

	client, err := p.getCOSClient(policy)
	if err != nil {
		log.Printf("[腾讯云COS] 创建客户端失败: %v", err)
		return nil, err
	}

	// 使用 buildObjectKey 进行路径转换，确保保留完整的子目录结构
	objectKey := p.buildObjectKey(policy, virtualPath)

	log.Printf("[腾讯云COS] 生成预签名URL - objectKey: %s", objectKey)

	// 从策略中获取密钥信息用于签名
	secretID := policy.AccessKey
	secretKey := policy.SecretKey

	// 设置预签名URL的过期时间为1小时
	expireTime := time.Hour
	expirationDateTime := time.Now().Add(expireTime)

	// 生成预签名PUT URL
	presignedURL, err := client.Object.GetPresignedURL(ctx, http.MethodPut, objectKey,
		secretID, secretKey, expireTime, nil)
	if err != nil {
		log.Printf("[腾讯云COS] 生成预签名上传URL失败: %v", err)
		return nil, fmt.Errorf("生成腾讯云COS预签名上传URL失败: %w", err)
	}

	log.Printf("[腾讯云COS] 预签名上传URL生成成功，过期时间: %s", expirationDateTime.Format(time.RFC3339))

	return &PresignedUploadResult{
		UploadURL:          presignedURL.String(),
		ExpirationDateTime: expirationDateTime,
		ContentType:        "", // 腾讯云COS不需要指定Content-Type
	}, nil
}
