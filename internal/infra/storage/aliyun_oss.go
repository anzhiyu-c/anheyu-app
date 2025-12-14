/*
 * @Description: 阿里云OSS存储提供者实现
 * @Author: 安知鱼
 * @Date: 2025-09-28 18:00:00
 * @LastEditTime: 2025-12-02 18:22:36
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
 * │ 示例: /oss/aaa/123.jpg                                                      │
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
 * │      相对路径 = "/oss/aaa/123.jpg" - "/oss" = "/aaa/123.jpg"                 │
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
 * │   - DeleteSingle()                                                          │
 * │   - Stream()                                                                │
 * │   - GetDownloadURL()                                                        │
 * │   - IsExist() / Exists()                                                    │
 * │   - GetThumbnail()                                                          │
 * │                                                                             │
 * │ 处理逻辑: 直接使用，不需要任何转换                                             │
 * │   source 是从数据库 file_storage_entities.source 字段读取的值，                │
 * │   在文件上传时已经由 Upload() 方法生成并存储。                                 │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * 【存储策略配置说明】
 *
 * policy.VirtualPath: 策略在虚拟文件系统中的挂载点（如 "/oss"）
 * policy.BasePath:    策略在云存储上的基础目录（如 "/test"）
 *
 * 【数据库存储说明】
 *
 * files 表:
 *   - name 字段存储相对于挂载点的路径（不含挂载点本身）
 *   - 例如: 文件 "/oss/aaa/123.jpg" 的 name 字段值为 "123.jpg"（文件名）
 *
 * file_storage_entities 表:
 *   - source 字段存储云存储上的完整对象键
 *   - 例如: "test/aaa/123.jpg"
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

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// AliOSSProvider 实现了 IStorageProvider 接口，用于处理与阿里云OSS的所有交互。
type AliOSSProvider struct {
}

// NewAliOSSProvider 是 AliOSSProvider 的构造函数。
func NewAliOSSProvider() IStorageProvider {
	return &AliOSSProvider{}
}

// getOSSClient 获取阿里云OSS客户端
func (p *AliOSSProvider) getOSSClient(policy *model.StoragePolicy) (*oss.Client, *oss.Bucket, error) {
	// 添加调试日志，打印策略的关键信息
	log.Printf("[阿里云OSS] 创建客户端 - 策略名称: %s, 策略ID: %d, Server: %s", policy.Name, policy.ID, policy.Server)

	// 从策略中获取配置信息
	bucketName := policy.BucketName
	if bucketName == "" {
		log.Printf("[阿里云OSS] 错误: 存储桶名称为空")
		return nil, nil, fmt.Errorf("阿里云OSS策略缺少存储桶名称")
	}

	accessKeyID := policy.AccessKey
	if accessKeyID == "" {
		return nil, nil, fmt.Errorf("阿里云OSS策略缺少AccessKey")
	}

	accessKeySecret := policy.SecretKey
	if accessKeySecret == "" {
		return nil, nil, fmt.Errorf("阿里云OSS策略缺少SecretKey")
	}

	// 从Server字段获取Endpoint，格式如: https://oss-cn-shanghai.aliyuncs.com
	endpoint := policy.Server
	if endpoint == "" {
		return nil, nil, fmt.Errorf("阿里云OSS策略缺少Endpoint配置")
	}

	// 创建OSS客户端
	client, err := oss.New(endpoint, accessKeyID, accessKeySecret)
	if err != nil {
		log.Printf("[阿里云OSS] 创建客户端失败: %v", err)
		return nil, nil, fmt.Errorf("创建阿里云OSS客户端失败: %w", err)
	}

	// 获取存储桶
	bucket, err := client.Bucket(bucketName)
	if err != nil {
		log.Printf("[阿里云OSS] 获取存储桶失败: %v", err)
		return nil, nil, fmt.Errorf("获取阿里云OSS存储桶失败: %w", err)
	}

	log.Printf("[阿里云OSS] 成功创建客户端和存储桶")
	return client, bucket, nil
}

// buildObjectKey 构建OSS对象键
// virtualPath 是完整的虚拟路径（如 "/oss" 或 "/oss/subdir"）
// 需要先从 virtualPath 中减去策略的 VirtualPath（挂载点），得到相对路径，再与 BasePath 拼接
func (p *AliOSSProvider) buildObjectKey(policy *model.StoragePolicy, virtualPath string) string {
	// 计算相对于策略挂载点的相对路径
	// 例如: virtualPath="/oss/subdir", policy.VirtualPath="/oss" -> relativePath="subdir"
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

	// 确保不以斜杠开头（OSS对象键不应该以/开头）
	objectKey = strings.TrimPrefix(objectKey, "/")

	log.Printf("[阿里云OSS] 路径转换 - basePath: %s, virtualPath: %s, policyVirtualPath: %s -> relativePath: %s -> objectKey: %s",
		policy.BasePath, virtualPath, policy.VirtualPath, relativePath, objectKey)
	return objectKey
}

// Upload 上传文件到阿里云OSS
//
// 【路径转换规则】
// virtualPath 是完整的虚拟路径，格式为: /挂载点/子目录/文件名
// 例如: virtualPath = "/oss/aaa/123.jpg"
//
// 转换步骤:
//  1. 从 virtualPath 中减去 policy.VirtualPath（挂载点），得到相对路径
//     相对路径 = "/oss/aaa/123.jpg" - "/oss" = "/aaa/123.jpg"
//  2. 将相对路径与 policy.BasePath（云存储基础路径）拼接
//     对象键 = "/test" + "/aaa/123.jpg" = "test/aaa/123.jpg"
//
// 数据库 files 表的 name 字段存储的是相对于挂载点的路径（不含挂载点）
func (p *AliOSSProvider) Upload(ctx context.Context, file io.Reader, policy *model.StoragePolicy, virtualPath string) (*UploadResult, error) {
	log.Printf("[阿里云OSS] 开始上传文件: virtualPath=%s, BasePath=%s, VirtualPath=%s", virtualPath, policy.BasePath, policy.VirtualPath)

	_, bucket, err := p.getOSSClient(policy)
	if err != nil {
		log.Printf("[阿里云OSS] 创建客户端失败: %v", err)
		return nil, err
	}

	// 使用 buildObjectKey 进行路径转换，确保保留完整的子目录结构
	objectKey := p.buildObjectKey(policy, virtualPath)

	log.Printf("[阿里云OSS] 上传对象: objectKey=%s", objectKey)

	// 上传文件
	err = bucket.PutObject(objectKey, file)
	if err != nil {
		log.Printf("[阿里云OSS] 上传失败: %v", err)
		return nil, fmt.Errorf("上传文件到阿里云OSS失败: %w", err)
	}

	log.Printf("[阿里云OSS] 上传成功: objectKey=%s", objectKey)

	// 获取文件信息
	headers, err := bucket.GetObjectMeta(objectKey)
	if err != nil {
		return nil, fmt.Errorf("获取上传后的文件信息失败: %w", err)
	}

	// 解析文件大小
	var fileSize int64 = 0
	if contentLengthStr := headers.Get("Content-Length"); contentLengthStr != "" {
		if size, parseErr := strconv.ParseInt(contentLengthStr, 10, 64); parseErr == nil {
			fileSize = size
		}
	}

	// 获取MIME类型
	mimeType := headers.Get("Content-Type")
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

// Get 从阿里云OSS获取文件流
func (p *AliOSSProvider) Get(ctx context.Context, policy *model.StoragePolicy, source string) (io.ReadCloser, error) {
	_, bucket, err := p.getOSSClient(policy)
	if err != nil {
		return nil, err
	}

	body, err := bucket.GetObject(source)
	if err != nil {
		return nil, fmt.Errorf("从阿里云OSS获取文件失败: %w", err)
	}

	return body, nil
}

// List 列出阿里云OSS存储桶中的对象
func (p *AliOSSProvider) List(ctx context.Context, policy *model.StoragePolicy, virtualPath string) ([]FileInfo, error) {
	log.Printf("[阿里云OSS] List方法调用 - 策略名称: %s, virtualPath: %s", policy.Name, virtualPath)

	_, bucket, err := p.getOSSClient(policy)
	if err != nil {
		return nil, err
	}

	prefix := p.buildObjectKey(policy, virtualPath)
	if prefix != "" && !strings.HasSuffix(prefix, "/") {
		prefix += "/"
	}

	result, err := bucket.ListObjects(oss.Prefix(prefix), oss.Delimiter("/"))
	if err != nil {
		return nil, fmt.Errorf("列出阿里云OSS对象失败: %w", err)
	}

	var fileInfos []FileInfo

	// 处理文件对象
	for _, obj := range result.Objects {
		// 跳过目录本身
		if strings.HasSuffix(obj.Key, "/") {
			continue
		}

		// 移除前缀，获取相对路径
		name := strings.TrimPrefix(obj.Key, prefix)
		if name == "" {
			continue
		}

		// 只显示直接子文件，不显示子目录中的文件
		if strings.Contains(name, "/") {
			continue
		}

		fileInfo := FileInfo{
			Name:    name,
			Size:    obj.Size,
			ModTime: obj.LastModified,
			IsDir:   false,
		}
		fileInfos = append(fileInfos, fileInfo)
	}

	// 处理公共前缀（目录）
	for _, commonPrefix := range result.CommonPrefixes {
		// 移除前缀和尾随的斜杠，获取目录名
		dirName := strings.TrimSuffix(strings.TrimPrefix(commonPrefix, prefix), "/")
		if dirName == "" {
			continue
		}

		fileInfo := FileInfo{
			Name:    dirName,
			Size:    0,
			ModTime: time.Time{}, // 目录没有修改时间
			IsDir:   true,
		}
		fileInfos = append(fileInfos, fileInfo)
	}

	log.Printf("[阿里云OSS] List完成 - 返回 %d 个项目", len(fileInfos))
	return fileInfos, nil
}

// Delete 从阿里云OSS删除多个文件
// Delete 从阿里云OSS删除多个文件
// sources 是完整的对象键列表（如 "article_image_cos/logo.png"），已包含 basePath，无需再拼接
func (p *AliOSSProvider) Delete(ctx context.Context, policy *model.StoragePolicy, sources []string) error {
	if len(sources) == 0 {
		return nil
	}

	_, bucket, err := p.getOSSClient(policy)
	if err != nil {
		return err
	}

	log.Printf("[阿里云OSS] Delete方法调用 - 策略: %s, 删除文件数量: %d", policy.Name, len(sources))

	for _, source := range sources {
		// source 已经是完整的对象键，直接使用
		objectKey := source
		log.Printf("[阿里云OSS] 删除对象: %s", objectKey)
		err := bucket.DeleteObject(objectKey)
		if err != nil {
			log.Printf("[阿里云OSS] 删除对象失败: %s, 错误: %v", objectKey, err)
			return fmt.Errorf("删除阿里云OSS对象 %s 失败: %w", source, err)
		}
		log.Printf("[阿里云OSS] 成功删除对象: %s", objectKey)
	}

	return nil
}

// DeleteSingle 从阿里云OSS删除单个文件（内部使用）
func (p *AliOSSProvider) DeleteSingle(ctx context.Context, policy *model.StoragePolicy, source string) error {
	_, bucket, err := p.getOSSClient(policy)
	if err != nil {
		return err
	}

	err = bucket.DeleteObject(source)
	if err != nil {
		return fmt.Errorf("从阿里云OSS删除文件失败: %w", err)
	}

	return nil
}

// Stream 从阿里云OSS流式传输文件到writer
func (p *AliOSSProvider) Stream(ctx context.Context, policy *model.StoragePolicy, source string, writer io.Writer) error {
	_, bucket, err := p.getOSSClient(policy)
	if err != nil {
		return err
	}

	body, err := bucket.GetObject(source)
	if err != nil {
		return fmt.Errorf("从阿里云OSS获取文件失败: %w", err)
	}
	defer body.Close()

	_, err = io.Copy(writer, body)
	if err != nil {
		return fmt.Errorf("流式传输文件失败: %w", err)
	}

	return nil
}

// GetDownloadURL 根据存储策略权限设置生成阿里云OSS下载URL
// source 是完整的对象键（如 "article_image_cos/logo.png"），已包含 basePath，无需再拼接
func (p *AliOSSProvider) GetDownloadURL(ctx context.Context, policy *model.StoragePolicy, source string, options DownloadURLOptions) (string, error) {
	log.Printf("[阿里云OSS] GetDownloadURL调用 - source: %s, policy.Server: %s, policy.IsPrivate: %v", source, policy.Server, policy.IsPrivate)

	// 检查访问域名配置
	if policy.Server == "" {
		log.Printf("[阿里云OSS] 错误: 访问域名配置为空")
		return "", fmt.Errorf("阿里云OSS策略缺少访问域名配置")
	}

	// source 已经是完整的对象键，直接使用
	objectKey := source
	log.Printf("[阿里云OSS] 使用对象键: %s", objectKey)

	// 检查是否配置了CDN域名
	cdnDomain := ""
	if val, ok := policy.Settings["cdn_domain"].(string); ok && val != "" {
		// 处理CDN域名的尾随斜杠
		cdnDomain = strings.TrimSuffix(val, "/")
	}

	sourceAuth := false
	if val, ok := policy.Settings["source_auth"].(bool); ok {
		sourceAuth = val
	}

	// 获取样式分隔符配置
	styleSeparator := ""
	if val, ok := policy.Settings["style_separator"].(string); ok {
		styleSeparator = val
	}

	log.Printf("[阿里云OSS] 配置信息 - cdnDomain: %s, sourceAuth: %v, styleSeparator: %s", cdnDomain, sourceAuth, styleSeparator)

	// 根据是否为私有存储策略决定URL类型
	if policy.IsPrivate && !sourceAuth {
		log.Printf("[阿里云OSS] 生成预签名URL (私有策略)")

		// 私有存储策略且未开启CDN回源鉴权：生成预签名URL
		_, bucket, err := p.getOSSClient(policy)
		if err != nil {
			log.Printf("[阿里云OSS] 创建客户端失败: %v", err)
			return "", err
		}

		// 设置过期时间，默认1小时
		expiresIn := options.ExpiresIn
		if expiresIn <= 0 {
			expiresIn = 3600 // 1小时
		}

		// 处理图片处理参数
		var signOptions []oss.Option
		if options.QueryParams != "" {
			// 阿里云OSS的图片处理参数格式: x-oss-process=image/format,webp
			params := strings.TrimSpace(options.QueryParams)
			params = strings.TrimPrefix(params, "?")
			if params != "" {
				signOptions = append(signOptions, oss.Process(params))
			}
		}

		// 生成预签名URL
		signedURL, err := bucket.SignURL(objectKey, oss.HTTPGet, int64(expiresIn), signOptions...)
		if err != nil {
			log.Printf("[阿里云OSS] 生成预签名URL失败: %v", err)
			return "", fmt.Errorf("生成阿里云OSS预签名URL失败: %w", err)
		}

		log.Printf("[阿里云OSS] 预签名URL生成成功: %s", signedURL)
		return signedURL, nil
	} else {
		log.Printf("[阿里云OSS] 生成公共访问URL")

		// 公共访问策略或开启了CDN回源鉴权：生成公共访问URL
		var baseURL string
		if cdnDomain != "" {
			// 使用CDN域名
			baseURL = cdnDomain
			if !strings.HasPrefix(baseURL, "http://") && !strings.HasPrefix(baseURL, "https://") {
				baseURL = "https://" + baseURL
			}
		} else {
			// 使用OSS直接访问域名
			// policy.Server应该是完整的endpoint，如: https://oss-cn-shanghai.aliyuncs.com
			// 需要转换为bucket域名：https://bucket-name.oss-cn-shanghai.aliyuncs.com
			endpoint := policy.Server
			bucketName := policy.BucketName

			if strings.Contains(endpoint, "://") {
				// 解析endpoint
				parsedURL, err := url.Parse(endpoint)
				if err != nil {
					return "", fmt.Errorf("解析OSS endpoint失败: %w", err)
				}
				// 构建bucket域名
				baseURL = fmt.Sprintf("%s://%s.%s", parsedURL.Scheme, bucketName, parsedURL.Host)
			} else {
				// 如果没有协议，默认使用https
				baseURL = fmt.Sprintf("https://%s.%s", bucketName, endpoint)
			}
		}

		// 构建完整的访问URL
		fullURL := fmt.Sprintf("%s/%s", baseURL, objectKey)

		// 添加图片处理参数
		if options.QueryParams != "" {
			fullURL = appendOSSImageParams(fullURL, options.QueryParams, styleSeparator)
			log.Printf("[阿里云OSS] 添加图片处理参数后的URL: %s", fullURL)
		}

		log.Printf("[阿里云OSS] 公共访问URL: %s", fullURL)
		return fullURL, nil
	}
}

// CreateDirectory 在阿里云OSS中创建目录（通过创建空对象模拟）
func (p *AliOSSProvider) CreateDirectory(ctx context.Context, policy *model.StoragePolicy, virtualPath string) error {
	_, bucket, err := p.getOSSClient(policy)
	if err != nil {
		return err
	}

	objectKey := p.buildObjectKey(policy, virtualPath)
	if !strings.HasSuffix(objectKey, "/") {
		objectKey += "/"
	}

	// OSS通过创建一个以"/"结尾的空对象来模拟目录
	err = bucket.PutObject(objectKey, strings.NewReader(""))
	if err != nil {
		return fmt.Errorf("在阿里云OSS中创建目录失败: %w", err)
	}

	return nil
}

// DeleteDirectory 删除阿里云OSS中的空目录
func (p *AliOSSProvider) DeleteDirectory(ctx context.Context, policy *model.StoragePolicy, virtualPath string) error {
	_, bucket, err := p.getOSSClient(policy)
	if err != nil {
		return err
	}

	objectKey := p.buildObjectKey(policy, virtualPath)
	if !strings.HasSuffix(objectKey, "/") {
		objectKey += "/"
	}

	err = bucket.DeleteObject(objectKey)
	if err != nil {
		return fmt.Errorf("删除阿里云OSS目录失败: %w", err)
	}

	return nil
}

// Rename 重命名或移动阿里云OSS中的文件或目录
// Rename 重命名或移动阿里云OSS中的文件或目录
// oldVirtualPath 和 newVirtualPath 是相对于 policy.VirtualPath 的路径，需要通过 buildObjectKey 转换为完整对象键
func (p *AliOSSProvider) Rename(ctx context.Context, policy *model.StoragePolicy, oldVirtualPath, newVirtualPath string) error {
	_, bucket, err := p.getOSSClient(policy)
	if err != nil {
		return err
	}

	// 使用 buildObjectKey 将相对路径转换为完整对象键
	oldObjectKey := p.buildObjectKey(policy, oldVirtualPath)
	newObjectKey := p.buildObjectKey(policy, newVirtualPath)

	log.Printf("[阿里云OSS] Rename: %s -> %s", oldObjectKey, newObjectKey)

	// 复制对象到新位置
	_, err = bucket.CopyObject(oldObjectKey, newObjectKey)
	if err != nil {
		return fmt.Errorf("复制阿里云OSS对象失败: %w", err)
	}

	// 删除原对象
	err = bucket.DeleteObject(oldObjectKey)
	if err != nil {
		return fmt.Errorf("删除原阿里云OSS对象失败: %w", err)
	}

	return nil
}

// IsExist 检查文件是否存在于阿里云OSS中
// IsExist 检查文件是否存在于阿里云OSS中
// source 是完整的对象键（如 "article_image_cos/logo.png"），已包含 basePath，无需再拼接
func (p *AliOSSProvider) IsExist(ctx context.Context, policy *model.StoragePolicy, source string) (bool, error) {
	_, bucket, err := p.getOSSClient(policy)
	if err != nil {
		return false, err
	}

	// source 已经是完整的对象键，直接使用
	exist, err := bucket.IsObjectExist(source)
	if err != nil {
		return false, err
	}

	return exist, nil
}

// GetThumbnail 阿里云OSS的图片处理（IMG）服务支持实时图片处理，可以生成缩略图
// 如果用户在阿里云控制台开通了图片处理服务，此功能将自动可用
func (p *AliOSSProvider) GetThumbnail(ctx context.Context, policy *model.StoragePolicy, source string, size string) (*ThumbnailResult, error) {

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
		// 如果是其他格式，默认使用 medium 尺寸
		log.Printf("[阿里云OSS] 无法解析缩略图尺寸 '%s'，使用默认 medium 尺寸", size)
		width, height = 400, 400
	}

	// 构建阿里云OSS图片处理参数
	// 阿里云OSS图片处理格式: image/resize,m_fill,w_400,h_400
	// m_fill: 固定宽高，裁剪并缩放
	imageProcess := fmt.Sprintf("image/resize,m_fill,w_%d,h_%d", width, height)

	var thumbnailURL string

	// 如果是私有存储桶，需要生成预签名URL
	if policy.IsPrivate {
		_, bucket, err := p.getOSSClient(policy)
		if err != nil {
			log.Printf("[阿里云OSS] 创建客户端失败: %v", err)
			return nil, err
		}

		// 设置过期时间为 10 分钟（用于下载缩略图）
		expiresIn := int64(600) // 10分钟

		// 生成带图片处理参数的预签名URL
		signedURL, err := bucket.SignURL(source, oss.HTTPGet, expiresIn, oss.Process(imageProcess))
		if err != nil {
			log.Printf("[阿里云OSS] 生成预签名URL失败: %v", err)
			return nil, fmt.Errorf("生成阿里云OSS预签名URL失败: %w", err)
		}

		thumbnailURL = signedURL
		log.Printf("[阿里云OSS] 生成私有存储桶缩略图预签名URL")
	} else {
		// 公有存储桶，直接构建URL
		serverURL := strings.TrimSuffix(policy.Server, "/")
		thumbnailURL = fmt.Sprintf("%s/%s?x-oss-process=%s", serverURL, source, imageProcess)
		log.Printf("[阿里云OSS] 生成公有存储桶缩略图URL")
	}

	log.Printf("[阿里云OSS] 缩略图URL: %s", thumbnailURL)

	// 下载缩略图数据
	resp, err := http.Get(thumbnailURL)
	if err != nil {
		return nil, fmt.Errorf("获取缩略图数据失败: %w", err)
	}
	defer resp.Body.Close()

	// 检查HTTP响应状态
	if resp.StatusCode != http.StatusOK {
		// 如果返回 404 或其他错误，可能是图片处理服务未开通或文件不支持缩略图
		if resp.StatusCode == http.StatusNotFound {
			log.Printf("[阿里云OSS] 缩略图生成失败: 文件不存在或图片处理服务未开通 (HTTP %d)", resp.StatusCode)
			return nil, ErrFeatureNotSupported
		}
		if resp.StatusCode == http.StatusBadRequest {
			log.Printf("[阿里云OSS] 缩略图生成失败: 图片处理参数错误或文件格式不支持 (HTTP %d)", resp.StatusCode)
			return nil, ErrFeatureNotSupported
		}
		if resp.StatusCode == http.StatusForbidden {
			log.Printf("[阿里云OSS] 缩略图访问被拒绝: 可能是图片处理服务未授权或配置问题 (HTTP %d)", resp.StatusCode)
			return nil, ErrFeatureNotSupported
		}
		return nil, fmt.Errorf("获取缩略图失败: HTTP状态码 %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取缩略图数据失败: %w", err)
	}

	return &ThumbnailResult{
		ContentType: "image/jpeg", // 阿里云OSS图片处理默认输出JPEG
		Data:        data,
	}, nil
}

// Exists 检查文件是否存在于阿里云OSS中（带policy参数的版本）
func (p *AliOSSProvider) Exists(ctx context.Context, policy *model.StoragePolicy, source string) (bool, error) {
	_, bucket, err := p.getOSSClient(policy)
	if err != nil {
		return false, err
	}

	exists, err := bucket.IsObjectExist(source)
	if err != nil {
		return false, fmt.Errorf("检查阿里云OSS文件是否存在失败: %w", err)
	}

	return exists, nil
}

// appendOSSImageParams 智能地将图片处理参数附加到URL中
// 支持阿里云OSS的图片处理参数格式，如: x-oss-process=image/format,webp
// 也支持样式分隔符格式，如: !ArticleImage 或 /ArticleImage
// params 可能的格式：
// - "x-oss-process=image/format,webp" (纯查询参数)
// - "!ArticleImage" (纯样式分隔符)
// - "!ArticleImage?x-oss-process=image/format,webp" (样式分隔符 + 查询参数)
func appendOSSImageParams(baseURL, params, separator string) string {
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

	// 解析URL
	parsedURL, err := url.Parse(baseURL)
	if err != nil {
		// 如果解析失败，直接拼接
		if strings.Contains(baseURL, "?") {
			return baseURL + "&" + params
		}
		return baseURL + separator + params
	}

	// 阿里云OSS图片处理参数格式检测
	// 支持两种格式：
	// 1. x-oss-process=image/format,webp (标准格式)
	// 2. image/format,webp (简化格式，自动添加x-oss-process=)
	if !strings.Contains(params, "x-oss-process=") && !strings.Contains(params, "=") {
		// 简化格式，需要添加 x-oss-process= 前缀
		params = "x-oss-process=" + params
	}

	// 将参数添加到URL中
	if parsedURL.RawQuery != "" {
		parsedURL.RawQuery += "&" + params
	} else {
		// 使用配置的样式分隔符
		// 注意：如果使用了非标准分隔符（如!），需要构建特殊的URL格式
		if separator != "?" {
			// 对于非标准分隔符，直接拼接字符串
			return baseURL + separator + params
		}
		parsedURL.RawQuery = params
	}

	return parsedURL.String()
}

// CreatePresignedUploadURL 为客户端直传创建一个预签名的上传URL
// 客户端可以使用此URL直接PUT文件到阿里云OSS，无需经过服务器中转
//
// 【路径转换规则】
// virtualPath 是完整的虚拟路径，格式为: /挂载点/子目录/文件名
// 例如: virtualPath = "/oss/aaa/123.jpg"
//
// 转换步骤（与 Upload 方法相同）:
//  1. 从 virtualPath 中减去 policy.VirtualPath（挂载点），得到相对路径
//     相对路径 = "/oss/aaa/123.jpg" - "/oss" = "/aaa/123.jpg"
//  2. 将相对路径与 policy.BasePath（云存储基础路径）拼接
//     对象键 = "/test" + "/aaa/123.jpg" = "test/aaa/123.jpg"
func (p *AliOSSProvider) CreatePresignedUploadURL(ctx context.Context, policy *model.StoragePolicy, virtualPath string) (*PresignedUploadResult, error) {
	log.Printf("[阿里云OSS] 创建预签名上传URL - virtualPath: %s, VirtualPath: %s, BasePath: %s", virtualPath, policy.VirtualPath, policy.BasePath)

	_, bucket, err := p.getOSSClient(policy)
	if err != nil {
		log.Printf("[阿里云OSS] 创建客户端失败: %v", err)
		return nil, err
	}

	// 使用 buildObjectKey 进行路径转换，确保保留完整的子目录结构
	objectKey := p.buildObjectKey(policy, virtualPath)

	log.Printf("[阿里云OSS] 生成预签名URL - objectKey: %s", objectKey)

	// 设置预签名URL的过期时间为1小时（3600秒）
	expiresIn := int64(3600)
	expirationDateTime := time.Now().Add(time.Duration(expiresIn) * time.Second)

	// 根据文件扩展名推断 Content-Type
	// 使用 mime 包来推断，如果无法推断则使用 application/octet-stream
	ext := strings.ToLower(filepath.Ext(objectKey))
	contentType := mime.TypeByExtension(ext)
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	// 生成预签名PUT URL，包含 Content-Type 以确保签名匹配
	// 注意：客户端上传时必须使用相同的 Content-Type，否则会返回 403
	signedURL, err := bucket.SignURL(objectKey, oss.HTTPPut, expiresIn, oss.ContentType(contentType))
	if err != nil {
		log.Printf("[阿里云OSS] 生成预签名上传URL失败: %v", err)
		return nil, fmt.Errorf("生成阿里云OSS预签名上传URL失败: %w", err)
	}

	log.Printf("[阿里云OSS] 预签名上传URL生成成功，Content-Type: %s，过期时间: %s", contentType, expirationDateTime.Format(time.RFC3339))

	return &PresignedUploadResult{
		UploadURL:          signedURL,
		ExpirationDateTime: expirationDateTime,
		ContentType:        contentType,
	}, nil
}

// SetupCORS 为阿里云OSS存储桶配置跨域策略
// 配置允许所有来源访问，支持GET, POST, PUT, DELETE, HEAD方法
func (p *AliOSSProvider) SetupCORS(ctx context.Context, policy *model.StoragePolicy) error {
	client, _, err := p.getOSSClient(policy)
	if err != nil {
		return fmt.Errorf("创建阿里云OSS客户端失败: %w", err)
	}

	// 定义CORS规则
	corsRule := oss.CORSRule{
		AllowedOrigin: []string{"*"},
		AllowedMethod: []string{"GET", "POST", "PUT", "DELETE", "HEAD"},
		AllowedHeader: []string{"*"},
		ExposeHeader:  []string{"ETag"},
		MaxAgeSeconds: 3600,
	}

	// 使用client的方法配置CORS，需要传入规则数组
	err = client.SetBucketCORS(policy.BucketName, []oss.CORSRule{corsRule})
	if err != nil {
		return fmt.Errorf("配置阿里云OSS跨域策略失败: %w", err)
	}

	log.Printf("[阿里云OSS] 成功配置CORS规则")
	return nil
}

// GetCORSConfig 获取阿里云OSS存储桶的跨域配置
func (p *AliOSSProvider) GetCORSConfig(ctx context.Context, policy *model.StoragePolicy) ([]oss.CORSRule, error) {
	client, _, err := p.getOSSClient(policy)
	if err != nil {
		return nil, fmt.Errorf("创建阿里云OSS客户端失败: %w", err)
	}

	result, err := client.GetBucketCORS(policy.BucketName)
	if err != nil {
		return nil, fmt.Errorf("获取阿里云OSS跨域配置失败: %w", err)
	}

	return result.CORSRules, nil
}
