// internal/app/service/file/file_query_service.go

package file

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/uri"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
)

// QueryByURI 根据给定的虚拟文件系统URI查询文件列表。
// 这是文件列表功能的核心业务逻辑，实现了以下高级特性：
//   - **游标分页**: 采用高性能的游标（`next_token`）分页模式，避免深度分页性能问题。
//   - **后端驱动的视图**: 列表的排序规则（`order`, `direction`）和分页大小（`PageSize`）
//     完全由后端根据文件夹保存的视图配置决定，API调用方无法覆盖。
//   - **智能合并上传任务**: 只在请求第一页数据时（即没有提供`next_token`），
//     才会合并正在上传的文件，并将其置于列表顶部，以提供最佳用户体验。
//   - **优雅的响应**: 当没有更多数据时，`next_token`字段会在JSON响应中被完全省略。
//
// 参数:
//   - ctx: 请求上下文
//   - ownerID: 文件夹所有者的用户ID
//   - viewerID: 当前查看者的用户ID，用于判断文件所有权等
//   - parsedURI: 已解析的URI对象，包含路径和分页令牌`next_token`
//
// 返回: (*model.FileListResponse, error) - 包含文件列表及元数据的完整响应对象，或在发生错误时返回error
func (s *serviceImpl) QueryByURI(ctx context.Context, ownerID, viewerID uint, parsedURI *uri.ParsedURI) (*model.FileListResponse, error) {
	// --- 1. 初始化和参数确定 ---
	policy, err := s.vfsSvc.FindPolicyForPath(ctx, parsedURI.Path)
	if err != nil {
		return nil, fmt.Errorf("无法为路径 '%s' 定位存储策略: %w", parsedURI.Path, err)
	}

	// 无论是访问本地路径 `/` 还是 OneDrive 路径 `/onedrive`，都会触发对应的同步。
	log.Printf("【QueryByURI】为策略 '%s' (类型: %s) 对路径 '%s' 执行同步...", policy.Name, policy.Type, parsedURI.Path)
	s.pathLocker.Lock(parsedURI.Path)
	// 使用 defer 确保无论函数如何退出（正常返回或panic），锁都会被释放
	defer func() {
		log.Printf("【LOCK】正在释放路径 '%s' 的同步锁。", parsedURI.Path)
		s.pathLocker.Unlock(parsedURI.Path)
	}()

	// 调用同步服务。syncSvc 内部会根据策略类型选择正确的 provider (local, onedrive, etc.)
	syncErr := s.syncSvc.SyncDirectory(ctx, ownerID, policy, parsedURI.Path)
	if syncErr != nil {
		// 即便同步失败，也只记录警告，并继续尝试从数据库提供可能过时的数据，保证服务的可用性。
		log.Printf("【严重警告】在查询文件列表时，同步目录 '%s' 失败: %v", parsedURI.Path, syncErr)
	} else {
		log.Printf("【QueryByURI】路径 '%s' 同步完成。", parsedURI.Path)
	}

	parentFolder, err := s.fileRepo.FindByPath(ctx, ownerID, parsedURI.Path)
	if err != nil && !errors.Is(err, constant.ErrNotFound) {
		return nil, fmt.Errorf("查询数据库中的虚拟目录失败: %w", err)
	}

	// 排序规则和分页大小的唯一来源是文件夹的视图配置
	folderViewConfig := s.GetInheritedViewConfig(ctx, parentFolder)

	effectivePageSize := folderViewConfig.PageSize
	orderBy := folderViewConfig.Order
	direction := folderViewConfig.OrderDirection

	allowedOrderBy := map[string]bool{
		"name":       true,
		"size":       true,
		"created_at": true,
		"updated_at": true,
	}
	if _, ok := allowedOrderBy[orderBy]; !ok {
		log.Printf("【WARN】检测到无效的 orderBy 参数: '%s'，已强制回退到默认排序 'updated_at'", orderBy)
		orderBy = "updated_at" // 强制使用安全的默认值
	}

	// 对 direction 也进行验证，防止非法值
	if direction != "asc" && direction != "desc" {
		log.Printf("【WARN】检测到无效的 direction 参数: '%s'，已强制回退到默认 'desc'", direction)
		direction = "desc" // 强制使用安全的默认值
	}

	// --- 2. 解析分页令牌 (Cursor) ---
	var token *repository.PaginationToken
	tokenStr := parsedURI.Query.Get("next_token")
	if tokenStr != "" {
		decoded, err := base64.StdEncoding.DecodeString(tokenStr)
		if err == nil {
			var t repository.PaginationToken
			if json.Unmarshal(decoded, &t) == nil {
				token = &t
			}
		}
	}

	var parentID uint = 0
	if parentFolder != nil {
		parentID = parentFolder.ID
	}

	// --- 3. 从数据库获取数据 ---
	// 使用一个独立的变量存储从数据库返回的结果，以便后续分页逻辑不受内存合并的影响
	dbChildren, err := s.fileRepo.ListByParentIDWithCursor(
		ctx,
		parentID,
		orderBy,             // 使用经过验证的、安全的 orderBy
		direction,           // 使用经过验证的、安全的 direction
		effectivePageSize+1, // 请求N+1条记录以判断是否有下一页
		token,
	)
	if err != nil {
		return nil, err
	}

	// 为从数据库获取的每个文件填充其元数据
	for _, child := range dbChildren {
		s.metadataService.HydrateFile(ctx, child)
	}

	// --- 4. 只在第一页合并上传中任务 ---
	finalChildren := dbChildren // 初始化最终要返回给前端的列表

	if token == nil { // 判断是否为第一页请求 (没有提供token)
		uploadingFiles := []*model.File{}
		uploadingEntities, err := s.entityRepo.FindUploadingByOwnerID(ctx, ownerID)
		if err != nil {
			fmt.Printf("警告: 查询上传中任务失败: %v\n", err)
		} else {
			for _, entity := range uploadingEntities {
				const uploadSessionCachePrefix = "upload_session:"
				sessionKey := uploadSessionCachePrefix + entity.UploadSessionID.String
				sessionJSON, cacheErr := s.cacheSvc.Get(ctx, sessionKey)
				if cacheErr != nil {
					continue
				}

				var session model.UploadSession
				if json.Unmarshal([]byte(sessionJSON), &session) != nil {
					continue
				}

				sessionURI, _ := uri.Parse(session.URI)
				if sessionURI != nil && filepath.Dir(sessionURI.Path) == parsedURI.Path {
					var pID int64
					if parentFolder != nil {
						pID = int64(parentFolder.ID)
					}

					tempFile := &model.File{
						ID: 0, OwnerID: ownerID,
						ParentID: sql.NullInt64{Int64: pID, Valid: parentFolder != nil},
						Name:     filepath.Base(sessionURI.Path),
						Size:     entity.Size, Type: model.FileTypeFile,
						UpdatedAt: entity.UpdatedAt, CreatedAt: entity.CreatedAt,
						Metas: map[string]string{
							model.MetaKeyThumbStatus: "uploading",
							"sys:upload_session_id":  entity.UploadSessionID.String,
						},
					}
					uploadingFiles = append(uploadingFiles, tempFile)
				}
			}
		}
		// 将上传中的文件放在列表最前面
		finalChildren = append(uploadingFiles, dbChildren...)
	}

	// --- 5. 判断是否有下一页并生成新令牌 ---
	// 分页逻辑依然基于从数据库获取的 `dbChildren`，不受内存合并的影响
	var nextToken string // 初始化为空字符串，如果没有下一页，它将保持此值

	if len(dbChildren) > effectivePageSize {
		// 从原始的数据库结果中获取最后一个元素来生成 token
		lastItem := dbChildren[effectivePageSize-1]

		// 调整最终列表的构成，确保它的大小正确
		if token == nil {
			// 如果是第一页且合并了上传文件，最终列表 = 上传文件 + N条数据库记录
			finalChildren = append(finalChildren[:len(finalChildren)-len(dbChildren)], dbChildren[:effectivePageSize]...)
		} else {
			// 如果是后续页，最终列表 = N条数据库记录
			finalChildren = dbChildren[:effectivePageSize]
		}

		var lastValue interface{}
		switch orderBy {
		case "name":
			lastValue = lastItem.Name
		case "size":
			lastValue = lastItem.Size
		case "created_at":
			lastValue = lastItem.CreatedAt
		default:
			lastValue = lastItem.UpdatedAt
		}

		newToken := repository.PaginationToken{
			LastID:           lastItem.ID,
			LastValue:        lastValue,
			LastPrimaryValue: lastItem.Type,
		}
		tokenBytes, _ := json.Marshal(newToken)
		nextToken = base64.StdEncoding.EncodeToString(tokenBytes)
	}

	// --- 6. 构建响应 DTO ---
	parentDTO := s.BuildFileItemDTO(parentFolder, viewerID, filepath.Dir(parsedURI.Path), "")
	filesDTO := make([]*model.FileItem, len(finalChildren))
	for i, child := range finalChildren {
		filesDTO[i] = s.BuildFileItemDTO(child, viewerID, parsedURI.Path, "")
	}
	policyInfo, err := GetPolicyInfo(policy)
	if err != nil {
		return nil, err
	}

	// --- 7. 构建 Pagination 对象 ---
	pageValue := 0
	if tokenStr == "" {
		pageValue = 1 // 标记为第一页
	}

	finalPagination := &model.Pagination{
		Page:      pageValue,
		PageSize:  effectivePageSize,
		NextToken: nextToken,
		IsCursor:  true,
	}

	return &model.FileListResponse{
		Files:         filesDTO,
		Parent:        parentDTO,
		Pagination:    finalPagination,
		Props:         &model.Props{OrderByOptions: []string{"name", "size", "updated_at", "created_at"}, OrderDirectionOptions: []string{"asc", "desc"}},
		ContextHint:   "当前目录: " + parsedURI.Path,
		StoragePolicy: policyInfo,
		View:          folderViewConfig,
	}, nil
}

// GetFileInfo 根据文件的公共ID获取单个文件或目录的详细信息。
func (s *serviceImpl) GetFileInfo(ctx context.Context, viewerID uint, publicFileID string) (*model.FileInfoResponse, error) {
	dbID, entityType, err := idgen.DecodePublicID(publicFileID)
	if err != nil || entityType != idgen.EntityTypeFile {
		return nil, errors.New("无效或格式不正确的文件ID")
	}
	file, err := s.fileRepo.FindByID(ctx, dbID)
	if err != nil {
		if errors.Is(err, constant.ErrNotFound) {
			return nil, constant.ErrNotFound
		}
		return nil, fmt.Errorf("查找文件时发生数据库错误: %w", err)
	}

	// 必须先验证属主，避免在拒绝访问前泄露元数据或签发下载链接。
	if viewerID == 0 || file.OwnerID != viewerID {
		return nil, constant.ErrForbidden
	}

	var policyInfo *model.StoragePolicyInfo
	// 仅当文件关联到物理实体时才执行
	if file.PrimaryEntityID.Valid {
		entity, err := s.entityRepo.FindByID(ctx, uint(file.PrimaryEntityID.Uint64))
		if err != nil {
			log.Printf("WARN: 获取文件(ID: %d)的实体失败: %v", file.ID, err)
		} else {
			policy, err := s.policySvc.GetPolicyByDatabaseID(ctx, entity.PolicyID)
			if err != nil {
				log.Printf("WARN: 获取文件(ID: %d)的策略失败: %v", file.ID, err)
			} else {
				// [复用] 使用 file_util.go 中的辅助函数将策略模型转换为DTO
				info, err := GetPolicyInfo(policy)
				if err != nil {
					log.Printf("WARN: 为文件(ID: %d)生成策略信息失败: %v", file.ID, err)
				} else {
					policyInfo = info
				}
			}
		}
	}

	var parentPath string
	if file.ParentID.Valid {
		parentPath, err = s.GetFolderPath(ctx, uint(file.ParentID.Int64))
		if err != nil {
			fmt.Printf("警告: 获取文件父路径失败, FileID: %d, ParentID: %d, err: %v\n", file.ID, file.ParentID.Int64, err)
			parentPath = "/?"
		}
	} else {
		parentPath = "/"
	}
	var downloadURL string
	if file.Type == model.FileTypeFile {
		url, urlErr := s.GetDownloadURLForFile(ctx, file, publicFileID)
		if urlErr != nil {
			fmt.Printf("!!! URL生成失败(GetFileInfo) !!! 文件: '%s', 错误: %v\n", file.Name, urlErr)
		} else {
			downloadURL = url
		}
	}

	s.metadataService.HydrateFile(ctx, file)

	fileItemDTO := s.BuildFileItemDTO(file, viewerID, parentPath, downloadURL)

	response := &model.FileInfoResponse{
		File:          fileItemDTO,
		StoragePolicy: policyInfo,
	}

	return response, nil
}

// GetFolderSize 计算并返回指定文件夹的逻辑大小和实际占用空间。
func (s *serviceImpl) GetFolderSize(ctx context.Context, ownerID uint, publicFolderID string) (*model.FolderSize, error) {
	// 1. 解码并验证文件夹ID
	dbID, entityType, err := idgen.DecodePublicID(publicFolderID)
	if err != nil || entityType != idgen.EntityTypeFile {
		return nil, errors.New("无效或格式不正确的文件夹ID")
	}

	// 2. 验证文件夹所有权和类型
	folder, err := s.fileRepo.FindByID(ctx, dbID)
	if err != nil {
		if errors.Is(err, constant.ErrNotFound) {
			return nil, constant.ErrNotFound
		}
		return nil, err
	}
	if folder.Type != model.FileTypeDir {
		return nil, errors.New("目标不是一个文件夹")
	}
	if folder.OwnerID != ownerID {
		return nil, constant.ErrForbidden
	}

	// 3. 调用 repository 获取所有后代文件的信息
	fileInfos, err := s.fileRepo.GetDescendantFileInfo(ctx, dbID)
	if err != nil {
		return nil, fmt.Errorf("从数据库获取文件夹内容信息失败: %w", err)
	}

	// 4. 计算逻辑大小并收集唯一的实体ID
	var logicalSize int64 = 0
	uniqueEntityIDs := make(map[uint64]bool)

	for _, info := range fileInfos {
		if info != nil {
			logicalSize += info.Size
			if info.PrimaryEntityID > 0 {
				uniqueEntityIDs[info.PrimaryEntityID] = true
			}
		}
	}

	// 5. 如果没有实体，直接返回结果
	if len(uniqueEntityIDs) == 0 {
		return &model.FolderSize{
			LogicalSize:        logicalSize,
			StorageConsumption: 0,
			FileCount:          int64(len(fileInfos)),
		}, nil
	}

	// 6. 批量查询唯一实体的真实大小
	entityIDs := make([]uint64, 0, len(uniqueEntityIDs))
	for id := range uniqueEntityIDs {
		entityIDs = append(entityIDs, id)
	}

	storageConsumption, err := s.entityRepo.SumSizeByIDs(ctx, entityIDs)
	if err != nil {
		return nil, fmt.Errorf("计算实体占用空间失败: %w", err)
	}

	return &model.FolderSize{
		LogicalSize:        logicalSize,
		StorageConsumption: storageConsumption,
		FileCount:          int64(len(fileInfos)),
	}, nil
}

// UpdateFolderViewConfig 更新指定文件夹的视图配置。
func (s *serviceImpl) UpdateFolderViewConfig(ctx context.Context, ownerID uint, req *model.UpdateViewConfigRequest) (*model.View, error) {
	folder, err := s.FindAndValidateFile(ctx, req.FolderPublicID, ownerID)
	if err != nil {
		return nil, err
	}
	if folder.Type != model.FileTypeDir {
		return nil, fmt.Errorf("目标ID '%s' 不是一个文件夹", req.FolderPublicID)
	}
	viewJSON, err := json.Marshal(req.View)
	if err != nil {
		return nil, fmt.Errorf("序列化视图配置失败: %w", err)
	}
	err = s.fileRepo.UpdateViewConfig(ctx, folder.ID, string(viewJSON))
	if err != nil {
		return nil, fmt.Errorf("更新数据库失败: %w", err)
	}
	return &req.View, nil
}

// GetPreviewURLs 根据初始文件的类型，为文件所在目录下的相应文件生成带签名的预览URL列表。
// - 如果初始文件是图片，则返回该目录下所有图片的URL列表及元信息。
// - 如果是其他可预览文件（视频、文本等），则只返回该文件自身的URL及元信息。
func (s *serviceImpl) GetPreviewURLs(ctx context.Context, viewerPublicID string, currentFilePublicID string) ([]model.PreviewURLItem, int, error) {
	// 1. 解码ID并验证权限
	viewerID, _, err := idgen.DecodePublicID(viewerPublicID)
	if err != nil {
		return nil, -1, fmt.Errorf("invalid viewer ID: %w", constant.ErrForbidden)
	}
	currentFileID, _, err := idgen.DecodePublicID(currentFilePublicID)
	if err != nil {
		return nil, -1, fmt.Errorf("invalid file ID: %w", constant.ErrNotFound)
	}
	currentFile, err := s.fileRepo.FindByID(ctx, currentFileID)
	if err != nil {
		return nil, -1, constant.ErrNotFound
	}
	if currentFile.OwnerID != uint(viewerID) {
		return nil, -1, constant.ErrForbidden
	}

	// 2. 判断初始文件类型，并执行相应的逻辑

	// 2.1. 如果是图片文件 (触发画廊模式)
	if isImageFile(currentFile.Name) {
		// 查找父目录
		if !currentFile.ParentID.Valid {
			// 如果图片在根目录，画廊里只有它自己
			url, err := s.generateSignedContentURL(ctx, currentFile)
			if err != nil {
				return nil, -1, err
			}
			publicID, _ := idgen.GeneratePublicID(currentFile.ID, idgen.EntityTypeFile)
			return []model.PreviewURLItem{{
				URL:      url,
				FileID:   publicID,
				FileName: currentFile.Name,
				FileSize: currentFile.Size,
			}}, 0, nil
		}
		parentID := uint(currentFile.ParentID.Int64)

		// 获取父目录下的所有文件
		siblings, err := s.fileRepo.ListByParentID(ctx, parentID)
		if err != nil {
			return nil, -1, fmt.Errorf("failed to list sibling files: %w", err)
		}

		// 筛选出所有图片文件并生成签名URL
		var items []model.PreviewURLItem
		initialIndex := -1
		for _, file := range siblings {
			if file.Type == model.FileTypeFile && isImageFile(file.Name) {
				url, err := s.generateSignedContentURL(ctx, file)
				if err != nil {
					log.Printf("WARN: Failed to generate signed URL for image file %d: %v", file.ID, err)
					continue
				}
				publicID, _ := idgen.GeneratePublicID(file.ID, idgen.EntityTypeFile)
				items = append(items, model.PreviewURLItem{
					URL:      url,
					FileID:   publicID,
					FileName: file.Name,
					FileSize: file.Size,
				})
				if file.ID == currentFileID {
					initialIndex = len(items) - 1
				}
			}
		}
		return items, initialIndex, nil
	}

	// 2.2. 如果是其他任何可预览的文件 (视频、文本等)，或任何其他文件类型 (单一文件预览模式)
	if isPreviewableFile(currentFile.Name) { // isPreviewableFile 应该包含视频、文本等
		url, err := s.generateSignedContentURL(ctx, currentFile)
		if err != nil {
			return nil, -1, err
		}
		publicID, _ := idgen.GeneratePublicID(currentFile.ID, idgen.EntityTypeFile)
		// 只返回当前文件的URL及元信息，索引为0
		return []model.PreviewURLItem{{
			URL:      url,
			FileID:   publicID,
			FileName: currentFile.Name,
			FileSize: currentFile.Size,
		}}, 0, nil
	}

	// 2.3. 如果文件类型完全不被支持预览
	log.Printf("INFO: GetPreviewURLs called on a non-previewable file type: %s", currentFile.Name)
	return []model.PreviewURLItem{}, -1, nil
}

func isPreviewableFile(filename string) bool {
	return isImageFile(filename) || isVideoFile(filename) || isTextFile(filename)
}

// isImageFile 是一个私有辅助函数，用于根据文件名判断是否为图片。
func isImageFile(filename string) bool {
	imageExtensions := map[string]bool{
		".jpg": true, ".jpeg": true, ".png": true, ".gif": true,
		".webp": true, ".bmp": true, ".svg": true, ".avif": true,
	}
	ext := strings.ToLower(filepath.Ext(filename))
	return imageExtensions[ext]
}

// isVideoFile 是一个私有辅助函数，用于根据文件名判断是否为视频。
func isVideoFile(filename string) bool {
	videoExtensions := map[string]bool{
		".mp4":  true,
		".webm": true,
		".mov":  true,
		".mkv":  true,
		".avi":  true,
	}
	ext := strings.ToLower(filepath.Ext(filename))
	return videoExtensions[ext]
}

// isTextFile 是一个私有辅助函数，用于判断是否为常见的可预览文本文件。
func isTextFile(filename string) bool {
	// 定义常见的、可以在浏览器中安全预览的文本文件后缀
	// 注意：避免包含潜在的服务器端脚本，如 .php, .asp 等
	textFileExtensions := map[string]bool{
		// 纯文本 & Markdown
		".txt":      true,
		".md":       true,
		".markdown": true,
		// 数据格式
		".json": true,
		".xml":  true,
		".yaml": true,
		".yml":  true,
		".csv":  true,
		// Web & 代码
		".html": true,
		".css":  true,
		".js":   true,
		".ts":   true,
		".jsx":  true,
		".tsx":  true,
		".vue":  true,
		".go":   true,
		".py":   true,
		".java": true,
		".c":    true,
		".cpp":  true,
		".h":    true,
		".cs":   true,
		".sh":   true,
		".rb":   true,
		".rs":   true,
	}
	ext := strings.ToLower(filepath.Ext(filename))
	return textFileExtensions[ext]
}

// ServeSignedContent 解析、验证并流式传输由签名令牌指定的文件内容。
// 它会为本地文件提供范围请求和缓存支持，为云文件执行重定向。
func (s *serviceImpl) ServeSignedContent(ctx context.Context, token string, writer http.ResponseWriter, request *http.Request) error {
	// 1. 解析和验证 Token
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return constant.ErrSignatureInvalid
	}
	payloadB64, signatureB64 := parts[0], parts[1]

	payloadBytes, err := base64.URLEncoding.DecodeString(payloadB64)
	if err != nil {
		return constant.ErrSignatureInvalid
	}
	signature, err := base64.URLEncoding.DecodeString(signatureB64)
	if err != nil {
		return constant.ErrSignatureInvalid
	}

	secret := []byte(s.settingSvc.Get(constant.KeyLocalFileSigningSecret.String()))
	if len(secret) == 0 {
		return errors.New("signing secret is not configured")
	}

	mac := hmac.New(sha256.New, secret)
	mac.Write(payloadBytes)
	if !hmac.Equal(signature, mac.Sum(nil)) {
		return constant.ErrSignatureInvalid
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return constant.ErrSignatureInvalid
	}

	exp, ok := payload["e"].(float64)
	if !ok || time.Now().Unix() > int64(exp) {
		return constant.ErrLinkExpired
	}

	// 2. 从 payload 获取文件ID并获取所有相关模型
	publicFileID, ok := payload["f"].(string)
	if !ok {
		return constant.ErrNotFound
	}

	dbID, _, err := idgen.DecodePublicID(publicFileID)
	if err != nil {
		return constant.ErrNotFound
	}

	file, err := s.fileRepo.FindByID(ctx, dbID)
	if err != nil {
		return constant.ErrNotFound
	}

	// 检查文件是否有实体记录
	if !file.PrimaryEntityID.Valid {
		// 对于没有实体记录的文件（如空文件），直接返回空内容
		writer.Header().Set("Content-Type", "text/plain; charset=utf-8")
		writer.Header().Set("Content-Length", "0")
		writer.WriteHeader(http.StatusOK)
		return nil
	}

	entity, err := s.entityRepo.FindByID(ctx, uint(file.PrimaryEntityID.Uint64))
	if err != nil {
		return fmt.Errorf("entity for file %d not found: %w", dbID, constant.ErrNotFound)
	}
	policy, err := s.policySvc.GetPolicyByDatabaseID(ctx, entity.PolicyID)
	if err != nil {
		return fmt.Errorf("policy for file %d not found: %w", dbID, constant.ErrNotFound)
	}

	// 3. 根据存储策略类型选择不同的服务方式
	if policy.Type == constant.PolicyTypeLocal {
		// 对于本地文件，使用 http.ServeFile 来获得全部高级功能
		// (范围请求, 缓存验证, Content-Type, etc.)
		absolutePath := entity.Source.String

		// http.ServeFile 会自己处理所有响应写入，包括错误情况。
		http.ServeFile(writer, request, absolutePath)
		return nil
	} else {
		// 对于云存储，继续使用 provider.Stream，它通常会执行重定向。
		provider, err := s.GetProviderForPolicy(policy)
		if err != nil {
			return fmt.Errorf("storage provider for file %d not found: %w", dbID, err)
		}

		// 为 provider.Stream 设置一些基本的响应头
		mimeType := "application/octet-stream"
		if entity.MimeType.Valid && entity.MimeType.String != "" {
			mimeType = entity.MimeType.String
		}
		writer.Header().Set("Content-Type", mimeType)
		writer.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, file.Name))

		// 执行流式传输或重定向
		return provider.Stream(ctx, policy, entity.Source.String, writer)
	}
}

// generateSignedContentURL 是一个私有辅助函数，用于为单个文件生成带签名的内容URL。
func (s *serviceImpl) generateSignedContentURL(_ context.Context, file *model.File) (string, error) {
	publicFileID, err := idgen.GeneratePublicID(file.ID, idgen.EntityTypeFile)
	if err != nil {
		return "", fmt.Errorf("failed to generate public ID for file %d: %w", file.ID, err)
	}

	expiresAt := time.Now().Add(1 * time.Hour)

	payload := map[string]interface{}{
		"f": publicFileID,
		"e": expiresAt.Unix(),
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payload for signing: %w", err)
	}

	secret := []byte(s.settingSvc.Get(constant.KeyLocalFileSigningSecret.String()))
	if len(secret) == 0 {
		return "", errors.New("signing secret is not configured")
	}

	mac := hmac.New(sha256.New, secret)
	mac.Write(payloadBytes)
	signature := mac.Sum(nil)

	token := fmt.Sprintf("%s.%s",
		base64.URLEncoding.EncodeToString(payloadBytes),
		base64.URLEncoding.EncodeToString(signature),
	)

	// 返回符合新路由格式的 URL
	return "/api/file/content?sign=" + token, nil
}
