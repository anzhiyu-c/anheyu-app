// internal/app/service/comment/service.go
package comment

import (
	"context"
	"crypto/md5"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/app/task"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/auth"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/handler/comment/dto"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	filesvc "github.com/anzhiyu-c/anheyu-app/pkg/service/file"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/notification"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/parser"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"

	"github.com/google/uuid"
)

// htmlInternalURIRegex 匹配HTML中的 src="anzhiyu://file/ID"
var htmlInternalURIRegex = regexp.MustCompile(`src="anzhiyu://file/([a-zA-Z0-9_-]+)"`)

// Service 评论服务的核心业务逻辑。
type Service struct {
	repo            repository.CommentRepository
	userRepo        repository.UserRepository
	txManager       repository.TransactionManager
	geoService      utility.GeoIPService
	settingSvc      setting.SettingService
	cacheSvc        utility.CacheService
	broker          *task.Broker
	fileSvc         filesvc.FileService
	parserSvc       *parser.Service
	pushooSvc       utility.PushooService
	notificationSvc notification.Service
}

// NewService 创建一个新的评论服务实例。
func NewService(
	repo repository.CommentRepository,
	userRepo repository.UserRepository,
	txManager repository.TransactionManager,
	geoService utility.GeoIPService,
	settingSvc setting.SettingService,
	cacheSvc utility.CacheService,
	broker *task.Broker,
	fileSvc filesvc.FileService,
	parserSvc *parser.Service,
	pushooSvc utility.PushooService,
	notificationSvc notification.Service,
) *Service {
	return &Service{
		repo:            repo,
		userRepo:        userRepo,
		txManager:       txManager,
		geoService:      geoService,
		settingSvc:      settingSvc,
		cacheSvc:        cacheSvc,
		broker:          broker,
		fileSvc:         fileSvc,
		parserSvc:       parserSvc,
		pushooSvc:       pushooSvc,
		notificationSvc: notificationSvc,
	}
}

// UploadImage 负责处理评论图片的上传业务逻辑。
func (s *Service) UploadImage(ctx context.Context, viewerID uint, originalFilename string, fileReader io.Reader) (*model.FileItem, error) {
	newFileName := uuid.New().String() + filepath.Ext(originalFilename)
	fileItem, err := s.fileSvc.UploadFileByPolicyFlag(ctx, viewerID, fileReader, constant.PolicyFlagCommentImage, newFileName)
	if err != nil {
		return nil, fmt.Errorf("上传评论图片失败: %w", err)
	}
	return fileItem, nil
}

// ListLatest 获取全站最新的已发布评论列表（分页）。
func (s *Service) ListLatest(ctx context.Context, page, pageSize int) (*dto.ListResponse, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	comments, total, err := s.repo.FindAllPublishedPaginated(ctx, page, pageSize)
	if err != nil {
		return nil, fmt.Errorf("获取最新评论列表失败: %w", err)
	}

	// 收集所有需要查询的父评论ID
	parentIDs := make(map[uint]struct{})
	for _, comment := range comments {
		if comment.ParentID != nil {
			parentIDs[*comment.ParentID] = struct{}{}
		}
	}

	// 收集所有需要查询的评论ID（父评论 + 回复目标评论）
	allNeededIDs := make(map[uint]bool)
	for id := range parentIDs {
		allNeededIDs[id] = true
	}

	// 收集所有 reply_to_id
	for _, comment := range comments {
		if comment.ReplyToID != nil {
			allNeededIDs[*comment.ReplyToID] = true
		}
	}

	// 批量查询所有需要的评论
	commentMap := make(map[uint]*model.Comment)
	if len(allNeededIDs) > 0 {
		ids := make([]uint, 0, len(allNeededIDs))
		for id := range allNeededIDs {
			ids = append(ids, id)
		}

		comments_batch, err := s.repo.FindManyByIDs(ctx, ids)
		if err != nil {
			log.Printf("警告：批量获取评论失败: %v", err)
		} else {
			for _, c := range comments_batch {
				commentMap[c.ID] = c
			}
		}
	}

	responses := make([]*dto.Response, len(comments))
	for i, comment := range comments {
		var parent *model.Comment
		var replyTo *model.Comment

		if comment.ParentID != nil {
			parent = commentMap[*comment.ParentID]
		}

		// 优先使用 reply_to_id，如果没有则向后兼容使用 parent
		if comment.ReplyToID != nil {
			replyTo = commentMap[*comment.ReplyToID]
		} else if parent != nil {
			replyTo = parent // 向后兼容旧数据
		}

		responses[i] = s.toResponseDTO(ctx, comment, parent, replyTo, false)
	}

	return &dto.ListResponse{
		List:              responses,
		Total:             total,
		TotalWithChildren: total, // 对于最新评论列表，total 和 totalWithChildren 相同（因为返回的是扁平列表）
		Page:              page,
		PageSize:          pageSize,
	}, nil
}

func (s *Service) Create(ctx context.Context, req *dto.CreateRequest, ip, ua string, claims *auth.CustomClaims) (*dto.Response, error) {
	limitStr := s.settingSvc.Get(constant.KeyCommentLimitPerMinute.String())
	limit, err := strconv.Atoi(limitStr)
	if err == nil && limit > 0 {
		redisKey := fmt.Sprintf("comment:rate_limit:%s:%s", ip, time.Now().Format("200601021504"))
		count, err := s.cacheSvc.Increment(ctx, redisKey)
		if err != nil {
			log.Printf("警告：Redis速率限制检查失败: %v", err)
		} else {
			if count == 1 {
				s.cacheSvc.Expire(ctx, redisKey, 70*time.Second)
			}
			if count > int64(limit) {
				return nil, errors.New("您的评论太频繁了，请稍后再试")
			}
		}
	}

	var parentDBID *uint
	var parentComment *model.Comment
	if req.ParentID != nil && *req.ParentID != "" {
		pID, _, err := idgen.DecodePublicID(*req.ParentID)
		if err != nil {
			return nil, errors.New("无效的父评论ID")
		}
		parentComment, err = s.repo.FindByID(ctx, pID)
		if err != nil {
			return nil, errors.New("回复的父评论不存在")
		}
		if parentComment.TargetPath != req.TargetPath {
			return nil, errors.New("回复的评论与当前页面不匹配")
		}
		parentDBID = &pID
	}

	// 处理回复目标评论（用于构建对话链）
	var replyToComment *model.Comment
	if req.ReplyToID != nil && *req.ReplyToID != "" {
		rID, _, err := idgen.DecodePublicID(*req.ReplyToID)
		if err != nil {
			return nil, errors.New("无效的回复目标评论ID")
		}
		replyToComment, err = s.repo.FindByID(ctx, rID)
		if err != nil {
			return nil, errors.New("回复目标评论不存在")
		}
		if replyToComment.TargetPath != req.TargetPath {
			return nil, errors.New("回复目标评论与当前页面不匹配")
		}
		// 匿名评论不允许被回复
		if replyToComment.IsAnonymous {
			return nil, errors.New("匿名评论不允许被回复")
		}
	}

	// 检查父评论是否为匿名评论（用于直接回复顶级评论的场景）
	if parentComment != nil && parentComment.IsAnonymous {
		return nil, errors.New("匿名评论不允许被回复")
	}

	// 从 Markdown 内容生成 HTML
	safeHTML, err := s.parserSvc.ToHTML(ctx, req.Content)
	if err != nil {
		return nil, fmt.Errorf("markdown内容解析失败: %w", err)
	}
	var emailMD5 string
	if req.Email != nil {
		emailMD5 = fmt.Sprintf("%x", md5.Sum([]byte(strings.ToLower(*req.Email))))
	}
	ipLocation := "未知"
	if ip != "" && s.geoService != nil {
		location, err := s.geoService.Lookup(ip)
		if err == nil {
			ipLocation = location
		}
	}
	status := model.StatusPublished
	// 1. 本地违禁词检测
	forbiddenWords := s.settingSvc.Get(constant.KeyCommentForbiddenWords.String())
	if forbiddenWords != "" {
		for _, word := range strings.Split(forbiddenWords, ",") {
			trimmedWord := strings.TrimSpace(word)
			if trimmedWord != "" && strings.Contains(req.Content, trimmedWord) {
				status = model.StatusPending
				break
			}
		}
	}
	// 2. AI敏感词检测（如果启用且本地检测未命中）
	if status == model.StatusPublished && s.settingSvc.Get(constant.KeyCommentAIDetectEnable.String()) == "true" {
		if isViolation := s.checkAIDetect(req.Content); isViolation {
			status = model.StatusPending
		}
	}
	var isAdmin bool
	var userID *uint
	if claims != nil {
		userDBID, _, _ := idgen.DecodePublicID(claims.UserID)
		user, err := s.userRepo.FindByID(ctx, userDBID)
		if err == nil && user != nil {
			uid := user.ID
			userID = &uid
			if user.UserGroup.ID == 1 && req.Email != nil && user.Email == *req.Email {
				isAdmin = true
			}
		}
	} else {
		if req.Email != nil && *req.Email != "" {
			admins, err := s.userRepo.FindByGroupID(ctx, 1)
			if err != nil {
				log.Printf("警告：查询管理员列表失败: %v", err)
			} else {
				for _, admin := range admins {
					if admin.Email == *req.Email {
						return nil, constant.ErrAdminEmailUsedByGuest
					}
				}
			}
		}
	}

	// 使用前端传递的匿名标识，并在后端进行双重验证
	isAnonymous := req.IsAnonymous

	// 如果前端标记为匿名评论，且配置了匿名邮箱，则验证邮箱是否匹配
	if isAnonymous {
		anonymousEmail := s.settingSvc.Get(constant.KeyCommentAnonymousEmail.String())
		if anonymousEmail != "" {
			// 如果配置了匿名邮箱，但用户邮箱不匹配，拒绝请求
			if req.Email == nil || *req.Email != anonymousEmail {
				log.Printf("警告：前端标记为匿名评论，但邮箱不匹配。前端邮箱: %v, 配置的匿名邮箱: %s", req.Email, anonymousEmail)
				return nil, fmt.Errorf("匿名评论邮箱验证失败")
			}
		}
	}

	// 获取 replyToComment 的数据库ID
	var replyToDBID *uint
	if replyToComment != nil {
		rid := replyToComment.ID
		replyToDBID = &rid
	}

	params := &repository.CreateCommentParams{
		TargetPath:     req.TargetPath,
		TargetTitle:    req.TargetTitle,
		UserID:         userID,
		ParentID:       parentDBID,
		ReplyToID:      replyToDBID, // 保存回复目标评论ID到数据库
		Nickname:       req.Nickname,
		Email:          req.Email,
		EmailMD5:       emailMD5,
		Website:        req.Website,
		Content:        req.Content,
		ContentHTML:    safeHTML,
		UserAgent:      &ua,
		IPAddress:      ip,
		IPLocation:     ipLocation,
		Status:         int(status),
		IsAdminComment: isAdmin,
		IsAnonymous:    isAnonymous,
	}

	newComment, err := s.repo.Create(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("保存评论失败: %w", err)
	}

	if newComment.IsPublished() {
		log.Printf("[DEBUG] 评论已发布，开始处理通知逻辑，评论ID: %d", newComment.ID)

		// 发送邮件通知
		if s.broker != nil {
			log.Printf("[DEBUG] 邮件通知任务已分发，评论ID: %d", newComment.ID)
			go s.broker.DispatchCommentNotification(newComment.ID)
		} else {
			log.Printf("[DEBUG] broker 为 nil，跳过邮件通知")
		}

		// 发送即时通知
		log.Printf("[DEBUG] 检查即时通知服务，pushooSvc 是否为 nil: %t", s.pushooSvc == nil)
		if s.pushooSvc != nil {
			go func() {
				log.Printf("[DEBUG] 开始处理即时通知逻辑")
				pushChannel := s.settingSvc.Get(constant.KeyPushooChannel.String())
				notifyAdmin := s.settingSvc.GetBool(constant.KeyCommentNotifyAdmin.String())
				scMailNotify := s.settingSvc.GetBool(constant.KeyScMailNotify.String())
				notifyReply := s.settingSvc.GetBool(constant.KeyCommentNotifyReply.String())
				adminEmail := s.settingSvc.Get(constant.KeyFrontDeskSiteOwnerEmail.String())

				log.Printf("[DEBUG] 即时通知配置检查:")
				log.Printf("[DEBUG]   - pushChannel: '%s'", pushChannel)
				log.Printf("[DEBUG]   - notifyAdmin: %t", notifyAdmin)
				log.Printf("[DEBUG]   - scMailNotify: %t", scMailNotify)
				log.Printf("[DEBUG]   - notifyReply: %t", notifyReply)

				if pushChannel == "" {
					log.Printf("[DEBUG] pushChannel 为空，跳过即时通知")
					return
				}

				log.Printf("[DEBUG] pushChannel 不为空，继续检查通知条件")

				// 获取新评论者的邮箱
				var newCommenterEmail string
				if newComment.Author.Email != nil {
					newCommenterEmail = *newComment.Author.Email
				}

				// 🔥 核心逻辑：即时通知的接收者是固定的（通常是管理员的设备）
				// 如果发送评论的人的邮箱与即时通知接收者的邮箱相同，则不应发送即时通知
				// 这样可以避免用户收到自己操作的通知
				if newCommenterEmail != "" && newCommenterEmail == adminEmail {
					log.Printf("[DEBUG] 跳过即时通知：发送评论的人（%s）就是即时通知接收者本人，不发送通知", newCommenterEmail)
					return
				}

				// 检查新评论者是否是管理员（使用评论的 IsAdminAuthor 字段）
				isAdminComment := newComment.IsAdminAuthor
				hasParentComment := parentComment != nil
				var parentEmail string
				var parentIsAdmin bool

				// 处理父评论相关信息
				if hasParentComment {
					parentIsAdmin = parentComment.IsAdminAuthor
					if parentComment.Author.Email != nil {
						parentEmail = *parentComment.Author.Email
					}
				}

				// 场景一：通知博主有新评论（顶级评论或回复普通用户的评论）
				// 条件：开启了博主通知、不是管理员自己评论、且没有父评论（或父评论作者不是管理员）
				if (notifyAdmin || scMailNotify) && !isAdminComment {
					// 如果有父评论且父评论作者是管理员，跳过博主通知（会在场景二中通知）
					if !parentIsAdmin {
						log.Printf("[DEBUG] 满足博主通知条件，开始发送即时通知")
						if err := s.pushooSvc.SendCommentNotification(ctx, newComment, nil); err != nil {
							log.Printf("[ERROR] 发送博主即时通知失败: %v", err)
						} else {
							log.Printf("[DEBUG] 博主即时通知发送成功")
						}
					} else {
						log.Printf("[DEBUG] 被回复者是管理员，将在场景二统一通知，跳过场景一")
					}
				}

				// 场景二：通知被回复者有新回复
				// 条件：开启了回复通知、有父评论、被回复者是管理员、且不是自己回复自己
				if notifyReply && hasParentComment && parentIsAdmin {
					// 如果新评论者不是父评论作者本人（避免自己回复自己）
					if parentEmail != "" && newCommenterEmail != parentEmail {
						// 查询被回复用户的实时通知设置
						userAllowNotification := true // 默认允许
						if parentComment.UserID != nil {
							userSettings, err := s.notificationSvc.GetUserNotificationSettings(ctx, *parentComment.UserID)
							if err != nil {
								log.Printf("[WARNING] 获取用户通知设置失败（用户ID: %d），使用默认值 true: %v", *parentComment.UserID, err)
							} else {
								userAllowNotification = userSettings.AllowCommentReplyNotification
								log.Printf("[DEBUG] 即时通知 - 用户 %d 的实时通知偏好设置: %t", *parentComment.UserID, userAllowNotification)
							}
						}

						if userAllowNotification {
							log.Printf("[DEBUG] 满足被回复者通知条件（用户回复管理员），开始发送即时通知")
							if err := s.pushooSvc.SendCommentNotification(ctx, newComment, parentComment); err != nil {
								log.Printf("[ERROR] 发送被回复者即时通知失败: %v", err)
							} else {
								log.Printf("[DEBUG] 被回复者即时通知发送成功")
							}
						} else {
							log.Printf("[DEBUG] 用户关闭了评论回复即时通知，跳过通知")
						}
					} else {
						log.Printf("[DEBUG] 自己回复自己，跳过被回复者通知")
					}
				} else {
					if hasParentComment && !parentIsAdmin {
						log.Printf("[DEBUG] 用户回复用户，跳过即时通知（被回复者不是管理员）")
					}
				}
			}()
		} else {
			log.Printf("[DEBUG] pushooSvc 为 nil，跳过即时通知")
		}
	} else {
		log.Printf("[DEBUG] 评论未发布，跳过所有通知逻辑")
	}

	return s.toResponseDTO(ctx, newComment, parentComment, replyToComment, false), nil
}

// ListByPath
func (s *Service) ListByPath(ctx context.Context, path string, page, pageSize int) (*dto.ListResponse, error) {
	// 1. 一次性获取该路径下的所有已发布评论
	allComments, err := s.repo.FindAllPublishedByPath(ctx, path)
	if err != nil {
		return nil, err
	}

	// 2. 在内存中构建评论树和关系图
	commentMap := make(map[uint]*model.Comment, len(allComments))
	var rootComments []*model.Comment
	descendantsMap := make(map[uint][]*model.Comment)

	for _, c := range allComments {
		comment := c
		commentMap[comment.ID] = comment
		if comment.IsTopLevel() {
			rootComments = append(rootComments, comment)
		}
	}

	for _, c := range allComments {
		if !c.IsTopLevel() {
			ancestor := c
			visited := make(map[uint]bool)
			for ancestor.ParentID != nil {
				if visited[ancestor.ID] {
					break
				}
				visited[ancestor.ID] = true

				parent, ok := commentMap[*ancestor.ParentID]
				if !ok {
					ancestor = nil
					break
				}
				ancestor = parent
			}

			if ancestor != nil && ancestor.IsTopLevel() {
				rootID := ancestor.ID
				descendantsMap[rootID] = append(descendantsMap[rootID], c)
			}
		}
	}

	// 3. 对根评论进行排序
	sort.Slice(rootComments, func(i, j int) bool {
		iPinned := rootComments[i].PinnedAt != nil
		jPinned := rootComments[j].PinnedAt != nil
		if iPinned != jPinned {
			return iPinned
		}
		if iPinned && jPinned {
			return rootComments[i].PinnedAt.After(*rootComments[j].PinnedAt)
		}
		return rootComments[i].CreatedAt.After(rootComments[j].CreatedAt)
	})

	// 4. 对根评论进行分页
	totalRootComments := int64(len(rootComments)) // 根评论总数（用于分页）
	totalWithChildren := int64(len(allComments))  // 包含所有子评论的总数（用于前端显示）
	start := (page - 1) * pageSize
	end := start + pageSize
	if start >= len(rootComments) {
		return &dto.ListResponse{
			List:              []*dto.Response{},
			Total:             totalRootComments,
			TotalWithChildren: totalWithChildren,
			Page:              page,
			PageSize:          pageSize,
		}, nil
	}
	if end > len(rootComments) {
		end = len(rootComments)
	}
	paginatedRootComments := rootComments[start:end]

	// 5. 组装最终响应
	const previewLimit = 3
	rootResponses := make([]*dto.Response, len(paginatedRootComments))
	for i, root := range paginatedRootComments {
		rootResp := s.toResponseDTO(ctx, root, nil, nil, false)
		descendants := descendantsMap[root.ID]

		rootResp.TotalChildren = int64(len(descendants))

		// 预览逻辑：只返回前 N 个链头（直接回复顶级评论的评论）
		// 而不是简单地取前 N 条评论（可能会导致前端找不到父评论）
		var chainHeads []*model.Comment
		for _, child := range descendants {
			// 链头：reply_to_id 指向顶级评论（或为空，向后兼容）
			if child.ReplyToID == nil || *child.ReplyToID == root.ID {
				chainHeads = append(chainHeads, child)
			}
		}

		// 取前 N 个链头
		var previewChainHeads []*model.Comment
		if len(chainHeads) > previewLimit {
			previewChainHeads = chainHeads[:previewLimit]
		} else {
			previewChainHeads = chainHeads
		}

		// 将这些链头及其回复链都返回
		var previewChildren []*model.Comment
		selectedIDs := make(map[uint]bool)

		// 递归添加链头及其所有回复
		var collectChain func(commentID uint)
		collectChain = func(commentID uint) {
			if selectedIDs[commentID] {
				return // 已添加
			}
			selectedIDs[commentID] = true

			// 找到这个评论
			var comment *model.Comment
			for _, c := range descendants {
				if c.ID == commentID {
					comment = c
					break
				}
			}
			if comment != nil {
				previewChildren = append(previewChildren, comment)
			}

			// 递归添加所有回复它的评论
			for _, child := range descendants {
				if child.ReplyToID != nil && *child.ReplyToID == commentID {
					collectChain(child.ID)
				}
			}
		}

		// 收集每个链头的完整对话链
		for _, head := range previewChainHeads {
			collectChain(head.ID)
		}

		childResponses := make([]*dto.Response, len(previewChildren))
		for j, child := range previewChildren {
			var parent *model.Comment
			var replyTo *model.Comment

			if child.ParentID != nil {
				parent = commentMap[*child.ParentID]
			}

			// 优先使用 reply_to_id，如果没有则向后兼容使用 parent
			if child.ReplyToID != nil {
				replyTo = commentMap[*child.ReplyToID]
			} else if parent != nil {
				replyTo = parent // 向后兼容旧数据
			}

			childResponses[j] = s.toResponseDTO(ctx, child, parent, replyTo, false)
		}
		rootResp.Children = childResponses
		rootResponses[i] = rootResp
	}

	return &dto.ListResponse{
		List:              rootResponses,
		Total:             totalRootComments,
		TotalWithChildren: totalWithChildren,
		Page:              page,
		PageSize:          pageSize,
	}, nil
}

// ListChildren - 最终正确版本
func (s *Service) ListChildren(ctx context.Context, parentPublicID string, page, pageSize int) (*dto.ListResponse, error) {
	parentDBID, _, err := idgen.DecodePublicID(parentPublicID)
	if err != nil {
		return nil, errors.New("无效的父评论ID")
	}

	// 1. 查找父评论，并获取其所属的页面路径
	parentComment, err := s.repo.FindByID(ctx, parentDBID)
	if err != nil {
		return nil, fmt.Errorf("查找父评论失败: %w", err)
	}

	// 2. 获取该路径下的所有评论，以便构建完整的关系树
	allComments, err := s.repo.FindAllPublishedByPath(ctx, parentComment.TargetPath)
	if err != nil {
		return nil, err
	}

	commentMap := make(map[uint]*model.Comment, len(allComments))
	for _, c := range allComments {
		commentMap[c.ID] = c
	}

	// 3. 递归查找指定父评论的所有后代
	var allDescendants []*model.Comment
	var findChildren func(pID uint)

	findChildren = func(pID uint) {
		for _, comment := range allComments {
			if comment.ParentID != nil && *comment.ParentID == pID {
				allDescendants = append(allDescendants, comment)
				findChildren(comment.ID)
			}
		}
	}
	findChildren(parentDBID)

	// 4. 实现预览逻辑：返回前N个链头+完整对话链
	total := int64(len(allDescendants))

	// 预览模式（第一页且 pageSize 较小，如 3）
	const previewLimit = 3
	isPreviewMode := page == 1 && pageSize <= previewLimit

	var paginatedDescendants []*model.Comment

	if isPreviewMode {
		// 预览逻辑：只返回前 N 个链头（直接回复顶级评论的评论）
		var chainHeads []*model.Comment
		for _, child := range allDescendants {
			// 链头：reply_to_id 指向顶级评论（或为空，向后兼容）
			if child.ReplyToID == nil || *child.ReplyToID == parentDBID {
				chainHeads = append(chainHeads, child)
			}
		}

		// 对链头按时间倒序排序（最新的在前）
		sort.Slice(chainHeads, func(i, j int) bool {
			return chainHeads[i].CreatedAt.After(chainHeads[j].CreatedAt)
		})

		// 取前 N 个链头
		var previewChainHeads []*model.Comment
		if len(chainHeads) > previewLimit {
			previewChainHeads = chainHeads[:previewLimit]
		} else {
			previewChainHeads = chainHeads
		}

		// 将这些链头及其回复链都返回
		selectedIDs := make(map[uint]bool)

		// 递归添加链头及其所有回复
		var collectChain func(commentID uint)
		collectChain = func(commentID uint) {
			if selectedIDs[commentID] {
				return // 已添加
			}
			selectedIDs[commentID] = true

			// 找到这个评论
			var comment *model.Comment
			for _, c := range allDescendants {
				if c.ID == commentID {
					comment = c
					break
				}
			}
			if comment != nil {
				paginatedDescendants = append(paginatedDescendants, comment)
			}

			// 递归添加所有回复它的评论
			for _, child := range allDescendants {
				if child.ReplyToID != nil && *child.ReplyToID == commentID {
					collectChain(child.ID)
				}
			}
		}

		// 收集每个链头的完整对话链
		for _, head := range previewChainHeads {
			collectChain(head.ID)
		}
	} else {
		// 正常分页模式：按时间倒序，返回所有评论
		sort.Slice(allDescendants, func(i, j int) bool {
			return allDescendants[i].CreatedAt.After(allDescendants[j].CreatedAt)
		})

		start := (page - 1) * pageSize
		end := start + pageSize
		if start >= len(allDescendants) {
			return &dto.ListResponse{
				List:              []*dto.Response{},
				Total:             total,
				TotalWithChildren: total,
				Page:              page,
				PageSize:          pageSize,
			}, nil
		}
		if end > len(allDescendants) {
			end = len(allDescendants)
		}
		paginatedDescendants = allDescendants[start:end]
	}

	// 6. 组装响应
	childResponses := make([]*dto.Response, len(paginatedDescendants))
	for i, child := range paginatedDescendants {
		var parent *model.Comment
		var replyTo *model.Comment

		if child.ParentID != nil {
			parent = commentMap[*child.ParentID]
		}

		// 优先使用 reply_to_id，如果没有则向后兼容使用 parent
		if child.ReplyToID != nil {
			replyTo = commentMap[*child.ReplyToID]
		} else if parent != nil {
			replyTo = parent // 向后兼容旧数据
		}

		childResponses[i] = s.toResponseDTO(ctx, child, parent, replyTo, false)
	}

	return &dto.ListResponse{
		List:              childResponses,
		Total:             total,
		TotalWithChildren: total, // 对于子评论列表，total 和 totalWithChildren 相同（因为返回的是扁平列表）
		Page:              page,
		PageSize:          pageSize,
	}, nil
}

// qqEmailRegex 用于匹配QQ邮箱格式并提取QQ号
var qqEmailRegex = regexp.MustCompile(`^([1-9]\d{4,10})@qq\.com$`)

// toResponseDTO 将领域模型 comment 转换为API响应的DTO。
// parent: 父评论（用于设置 ParentID）
// replyTo: 回复目标评论（用于设置 ReplyToID 和 ReplyToNick）
func (s *Service) toResponseDTO(ctx context.Context, c *model.Comment, parent *model.Comment, replyTo *model.Comment, isAdminView bool) *dto.Response {
	if c == nil {
		return nil
	}
	publicID, _ := idgen.GeneratePublicID(c.ID, idgen.EntityTypeComment)

	// 统一使用解析后的HTML，确保表情包正确显示
	parsedHTML, err := s.parserSvc.ToHTML(ctx, c.Content)
	var renderedContentHTML string
	if err != nil {
		log.Printf("【WARN】解析评论 %s 的表情包失败: %v", publicID, err)
		renderedContentHTML = c.ContentHTML
	} else {
		renderedContentHTML = parsedHTML
	}

	// 渲染图片URL
	log.Printf("【DEBUG】评论 %s 渲染前HTML: %s", publicID, renderedContentHTML)
	renderedContentHTML, err = s.renderHTMLURLs(ctx, renderedContentHTML)
	if err != nil {
		log.Printf("【WARN】渲染评论 %s 的HTML链接失败: %v", publicID, err)
		renderedContentHTML = c.ContentHTML
	}
	log.Printf("【DEBUG】评论 %s 渲染后HTML: %s", publicID, renderedContentHTML)

	var emailMD5 string
	var qqNumber *string
	if c.Author.Email != nil {
		emailLower := strings.ToLower(*c.Author.Email)
		emailMD5 = fmt.Sprintf("%x", md5.Sum([]byte(emailLower)))

		// 检测QQ邮箱格式并提取QQ号
		if matches := qqEmailRegex.FindStringSubmatch(emailLower); len(matches) > 1 {
			qqNumber = &matches[1]
		}
	}
	var parentPublicID *string
	if parent != nil {
		pID, _ := idgen.GeneratePublicID(parent.ID, idgen.EntityTypeComment)
		parentPublicID = &pID
	}

	var replyToPublicID *string
	var replyToNick *string
	if replyTo != nil {
		rID, _ := idgen.GeneratePublicID(replyTo.ID, idgen.EntityTypeComment)
		replyToPublicID = &rID
		replyToNick = &replyTo.Author.Nickname
	}

	showUA := s.settingSvc.GetBool(constant.KeyCommentShowUA.String())
	showRegion := s.settingSvc.GetBool(constant.KeyCommentShowRegion.String())

	// 获取用户自定义头像URL（如果有关联用户且用户上传了头像）
	var avatarURL *string
	if c.User != nil && c.User.Avatar != "" {
		avatarURL = &c.User.Avatar
	}

	resp := &dto.Response{
		ID:             publicID,
		CreatedAt:      c.CreatedAt,
		PinnedAt:       c.PinnedAt,
		Nickname:       c.Author.Nickname,
		EmailMD5:       emailMD5,
		QQNumber:       qqNumber,  // QQ号（如果是QQ邮箱）
		AvatarURL:      avatarURL, // 添加用户自定义头像URL
		Website:        c.Author.Website,
		ContentHTML:    renderedContentHTML,
		IsAdminComment: c.IsAdminAuthor,
		IsAnonymous:    c.IsAnonymous, // 匿名评论标识
		TargetPath:     c.TargetPath,
		TargetTitle:    c.TargetTitle,
		ParentID:       parentPublicID,
		ReplyToID:      replyToPublicID,
		ReplyToNick:    replyToNick,
		LikeCount:      c.LikeCount,
		Children:       []*dto.Response{},
	}

	if showUA {
		ua := c.Author.UserAgent
		resp.UserAgent = &ua
	}
	if showRegion {
		loc := c.Author.Location
		resp.IPLocation = loc
	}

	if isAdminView {
		resp.Email = c.Author.Email
		resp.IPAddress = &c.Author.IP
		resp.Content = &c.Content
		status := int(c.Status)
		resp.Status = &status
	}

	return resp
}

// renderHTMLURLs 将HTML内容中的内部URI（anzhiyu://file/...）替换为可访问的临时URL。
func (s *Service) renderHTMLURLs(ctx context.Context, htmlContent string) (string, error) {
	log.Printf("【DEBUG】开始渲染HTML中的图片链接，原始HTML长度: %d", len(htmlContent))

	// 检查是否包含需要替换的内部URI
	matches := htmlInternalURIRegex.FindAllString(htmlContent, -1)
	log.Printf("【DEBUG】找到 %d 个需要替换的内部URI: %v", len(matches), matches)

	var firstError error
	replacer := func(match string) string {
		log.Printf("【DEBUG】正在处理匹配项: %s", match)
		parts := htmlInternalURIRegex.FindStringSubmatch(match)
		if len(parts) < 2 {
			log.Printf("【DEBUG】正则匹配失败，parts长度: %d", len(parts))
			return match
		}
		publicID := parts[1]
		log.Printf("【DEBUG】提取到文件公共ID: %s", publicID)

		fileModel, err := s.fileSvc.FindFileByPublicID(ctx, publicID)
		if err != nil {
			log.Printf("【ERROR】渲染图片失败：找不到文件, PublicID=%s, 错误: %v", publicID, err)
			return `src=""`
		}
		log.Printf("【DEBUG】找到文件模型: Name=%s, Size=%d", fileModel.Name, fileModel.Size)

		// 评论图片URL有效期：1小时
		expiresAt := time.Now().Add(1 * time.Hour)
		url, err := s.fileSvc.GetDownloadURLForFileWithExpiration(ctx, fileModel, publicID, expiresAt)
		if err != nil {
			if firstError == nil {
				firstError = err
			}
			log.Printf("【ERROR】渲染图片失败：为文件 %s 生成URL时出错: %v", publicID, err)
			return `src=""`
		}
		log.Printf("【DEBUG】成功生成URL: %s", url)
		return `src="` + url + `"`
	}
	result := htmlInternalURIRegex.ReplaceAllStringFunc(htmlContent, replacer)
	log.Printf("【DEBUG】渲染完成，结果HTML长度: %d", len(result))
	return result, firstError
}

// LikeComment 为评论增加点赞数。
func (s *Service) LikeComment(ctx context.Context, publicID string) (int, error) {
	dbID, _, err := idgen.DecodePublicID(publicID)
	if err != nil {
		return 0, errors.New("无效的评论ID")
	}
	updatedComment, err := s.repo.IncrementLikeCount(ctx, dbID)
	if err != nil {
		return 0, fmt.Errorf("点赞失败: %w", err)
	}
	return updatedComment.LikeCount, nil
}

// UnlikeComment 为评论减少点赞数。
func (s *Service) UnlikeComment(ctx context.Context, publicID string) (int, error) {
	dbID, _, err := idgen.DecodePublicID(publicID)
	if err != nil {
		return 0, errors.New("无效的评论ID")
	}
	updatedComment, err := s.repo.DecrementLikeCount(ctx, dbID)
	if err != nil {
		return 0, fmt.Errorf("取消点赞失败: %w", err)
	}
	return updatedComment.LikeCount, nil
}

// AdminList 管理员根据条件查询评论列表。
func (s *Service) AdminList(ctx context.Context, req *dto.AdminListRequest) (*dto.ListResponse, error) {
	if req.Page < 1 {
		req.Page = 1
	}
	if req.PageSize < 1 || req.PageSize > 100 {
		req.PageSize = 10
	}

	params := repository.AdminListParams{
		Page:       req.Page,
		PageSize:   req.PageSize,
		Nickname:   req.Nickname,
		Email:      req.Email,
		IPAddress:  req.IPAddress,
		Content:    req.Content,
		TargetPath: req.TargetPath,
		Status:     req.Status,
	}
	comments, total, err := s.repo.FindWithConditions(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("获取评论列表失败: %w", err)
	}

	responses := make([]*dto.Response, len(comments))
	for i, comment := range comments {
		responses[i] = s.toResponseDTO(ctx, comment, nil, nil, true)
	}

	return &dto.ListResponse{
		List:              responses,
		Total:             total,
		TotalWithChildren: total, // 对于管理员列表，total 和 totalWithChildren 相同（因为返回的是扁平列表）
		Page:              req.Page,
		PageSize:          req.PageSize,
	}, nil
}

// Delete 批量删除评论。
func (s *Service) Delete(ctx context.Context, ids []string) (int, error) {
	if len(ids) == 0 {
		return 0, errors.New("必须提供至少一个评论ID")
	}
	dbIDs := make([]uint, 0, len(ids))
	for _, publicID := range ids {
		dbID, entityType, err := idgen.DecodePublicID(publicID)
		if err != nil || entityType != idgen.EntityTypeComment {
			log.Printf("警告：跳过无效的评论ID '%s' 进行删除", publicID)
			continue
		}
		dbIDs = append(dbIDs, dbID)
	}
	if len(dbIDs) == 0 {
		return 0, errors.New("未提供任何有效的评论ID")
	}
	return s.repo.DeleteByIDs(ctx, dbIDs)
}

// UpdateStatus 更新评论的状态。
func (s *Service) UpdateStatus(ctx context.Context, publicID string, status int) (*dto.Response, error) {
	s_ := model.Status(status)
	if s_ != model.StatusPublished && s_ != model.StatusPending {
		return nil, errors.New("无效的状态值，必须是 1 (已发布) 或 2 (待审核)")
	}
	dbID, entityType, err := idgen.DecodePublicID(publicID)
	if err != nil || entityType != idgen.EntityTypeComment {
		return nil, errors.New("无效的评论ID")
	}
	updatedComment, err := s.repo.UpdateStatus(ctx, dbID, s_)
	if err != nil {
		return nil, fmt.Errorf("更新评论状态失败: %w", err)
	}
	return s.toResponseDTO(ctx, updatedComment, nil, nil, true), nil
}

// SetPin 设置或取消评论的置顶状态。
func (s *Service) SetPin(ctx context.Context, publicID string, isPinned bool) (*dto.Response, error) {
	dbID, _, err := idgen.DecodePublicID(publicID)
	if err != nil {
		return nil, errors.New("无效的评论ID")
	}
	var pinTime *time.Time
	if isPinned {
		now := time.Now()
		pinTime = &now
	}
	updatedComment, err := s.repo.SetPin(ctx, dbID, pinTime)
	if err != nil {
		return nil, fmt.Errorf("设置评论置顶状态失败: %w", err)
	}
	return s.toResponseDTO(ctx, updatedComment, nil, nil, true), nil
}

// UpdateContent 更新评论的内容（仅限管理员）。
func (s *Service) UpdateContent(ctx context.Context, publicID string, newContent string) (*dto.Response, error) {
	dbID, entityType, err := idgen.DecodePublicID(publicID)
	if err != nil || entityType != idgen.EntityTypeComment {
		return nil, errors.New("无效的评论ID")
	}

	// 验证内容长度
	if len(newContent) < 1 || len(newContent) > 1000 {
		return nil, errors.New("评论内容长度必须在 1-1000 字符之间")
	}

	// 解析 Markdown 为 HTML（处理表情包和内部图片链接）
	contentHTML, err := s.parserSvc.ToHTML(ctx, newContent)
	if err != nil {
		return nil, fmt.Errorf("解析评论内容失败: %w", err)
	}

	// 更新评论内容
	updatedComment, err := s.repo.UpdateContent(ctx, dbID, newContent, contentHTML)
	if err != nil {
		return nil, fmt.Errorf("更新评论内容失败: %w", err)
	}

	return s.toResponseDTO(ctx, updatedComment, nil, nil, true), nil
}

// UpdatePath 是一项内部服务，用于在文章或页面的路径（slug）变更时，同步更新所有相关评论的路径。
// 这个方法通常由其他服务（如ArticleService）通过事件或直接调用的方式触发。
func (s *Service) UpdatePath(ctx context.Context, oldPath, newPath string) (int, error) {
	if oldPath == "" || newPath == "" || oldPath == newPath {
		return 0, errors.New("无效的旧路径或新路径")
	}
	return s.repo.UpdatePath(ctx, oldPath, newPath)
}

// QQInfoResponse QQ信息API的响应结构
type QQInfoResponse struct {
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
}

// GetQQInfo 根据QQ号获取QQ昵称和头像
// 该方法在后端调用第三方API，避免将API密钥暴露给前端
func (s *Service) GetQQInfo(ctx context.Context, qqNumber string) (*QQInfoResponse, error) {
	// 验证QQ号格式
	if !regexp.MustCompile(`^[1-9]\d{4,10}$`).MatchString(qqNumber) {
		return nil, errors.New("无效的QQ号格式")
	}

	// 获取配置
	apiURL := s.settingSvc.Get(constant.KeyCommentQQAPIURL.String())
	apiKey := s.settingSvc.Get(constant.KeyCommentQQAPIKey.String())

	// 如果没有配置API，返回空结果
	if apiURL == "" || apiKey == "" {
		return nil, errors.New("QQ信息查询API未配置")
	}

	// 调用第三方API
	resp, err := httpGetQQInfo(apiURL, apiKey, qqNumber)
	if err != nil {
		log.Printf("获取QQ信息失败: %v", err)
		return nil, fmt.Errorf("获取QQ信息失败: %w", err)
	}

	return resp, nil
}

// httpGetQQInfo 调用第三方QQ信息API
func httpGetQQInfo(apiURL, apiKey, qqNumber string) (*QQInfoResponse, error) {
	// 构建请求URL
	url := fmt.Sprintf("%s?key=%s&qq=%s", apiURL, apiKey, qqNumber)

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API返回状态码: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// 解析API响应
	// API返回格式: { code: 200, msg: "Success", data: { nick: "昵称", ... }, ... }
	var apiResp struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
		Data struct {
			Nick   string `json:"nick"`
			Avatar string `json:"avatar"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("解析API响应失败: %w", err)
	}

	if apiResp.Code != 200 {
		return nil, fmt.Errorf("API返回错误: %s", apiResp.Msg)
	}

	// 构建QQ头像URL
	avatarURL := fmt.Sprintf("https://q.qlogo.cn/headimg_dl?dst_uin=%s&spec=100", qqNumber)

	return &QQInfoResponse{
		Nickname: apiResp.Data.Nick,
		Avatar:   avatarURL,
	}, nil
}

// aiDetectData AI敏感词检测API的data字段结构
type aiDetectData struct {
	Categories  []string `json:"categories"`
	Explanation string   `json:"explanation"`
	IsViolation bool     `json:"is_violation"`
	Keywords    []string `json:"keywords"`
	RiskLevel   string   `json:"risk_level"`
}

// checkAIDetect 调用AI敏感词检测API检查文本内容
// 返回 true 表示检测到违规内容，false 表示正常
func (s *Service) checkAIDetect(content string) bool {
	apiURL := s.settingSvc.Get(constant.KeyCommentAIDetectAPIURL.String())
	if apiURL == "" {
		return false
	}

	// 构建请求URL（该API不需要对msg进行URL编码）
	apiKey := s.settingSvc.Get(constant.KeyCommentAIDetectAPIKey.String())
	reqURL := fmt.Sprintf("%s?msg=%s", apiURL, content)
	// 如果配置了API密钥，添加到URL参数
	if apiKey != "" {
		reqURL = fmt.Sprintf("%s&key=%s", reqURL, apiKey)
	}
	log.Printf("AI敏感词检测: 请求URL: %s, 密钥已配置: %v", reqURL, apiKey != "")

	// 创建HTTP请求
	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		log.Printf("AI敏感词检测: 创建请求失败: %v", err)
		return false
	}
	req.Header.Set("User-Agent", "anheyu-app/1.0.0")
	// 同时在请求头中添加密钥（兼容不同API）
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}

	// 发送请求
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("AI敏感词检测: 请求失败: %v", err)
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("AI敏感词检测: API返回状态码: %d", resp.StatusCode)
		return false
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("AI敏感词检测: 读取响应失败: %v", err)
		return false
	}
	log.Printf("AI敏感词检测: API返回值: %s", string(body))

	// 使用 json.RawMessage 处理 data 字段可能是字符串或对象的情况
	var rawResp struct {
		Code int             `json:"code"`
		Msg  string          `json:"msg"`
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(body, &rawResp); err != nil {
		log.Printf("AI敏感词检测: 解析响应失败: %v", err)
		return false
	}

	if rawResp.Code != 200 {
		log.Printf("AI敏感词检测: API返回错误: code=%d, msg=%s, body=%s", rawResp.Code, rawResp.Msg, string(body))
		return false
	}

	// 尝试将 data 解析为对象
	var data aiDetectData
	if err := json.Unmarshal(rawResp.Data, &data); err != nil {
		// data 可能是字符串（错误信息），记录日志并返回
		log.Printf("AI敏感词检测: data字段解析失败（可能是字符串）: %s", string(rawResp.Data))
		return false
	}

	if data.IsViolation {
		log.Printf("AI敏感词检测: 检测到违规内容, 风险等级: %s, 关键词: %v, 说明: %s",
			data.RiskLevel, data.Keywords, data.Explanation)
	}

	return data.IsViolation
}
