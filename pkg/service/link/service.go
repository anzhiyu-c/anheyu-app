package link

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"
)

// TaskBroker 定义任务调度器的接口，用于解耦循环依赖。
type TaskBroker interface {
	DispatchLinkCleanup()
}

// Service 定义了友链相关的业务逻辑接口。
type Service interface {
	// --- 前台接口 ---
	ApplyLink(ctx context.Context, req *model.ApplyLinkRequest) (*model.LinkDTO, error)
	ListPublicLinks(ctx context.Context, req *model.ListPublicLinksRequest) (*model.LinkListResponse, error)
	ListAllApplications(ctx context.Context, req *model.ListPublicLinksRequest) (*model.LinkListResponse, error) // 获取所有友链申请列表（公开）
	ListCategories(ctx context.Context) ([]*model.LinkCategoryDTO, error)
	ListPublicCategories(ctx context.Context) ([]*model.LinkCategoryDTO, error) // 只返回有已审核通过友链的分类
	GetRandomLinks(ctx context.Context, num int) ([]*model.LinkDTO, error)
	CheckLinkExistsByURL(ctx context.Context, url string) (*model.CheckLinkExistsResponse, error) // 检查友链URL是否已存在

	// --- 后台接口 ---
	AdminCreateLink(ctx context.Context, req *model.AdminCreateLinkRequest) (*model.LinkDTO, error)
	AdminUpdateLink(ctx context.Context, id int, req *model.AdminUpdateLinkRequest) (*model.LinkDTO, error)
	AdminDeleteLink(ctx context.Context, id int) error
	ReviewLink(ctx context.Context, id int, req *model.ReviewLinkRequest) error
	UpdateCategory(ctx context.Context, id int, req *model.UpdateLinkCategoryRequest) (*model.LinkCategoryDTO, error)
	UpdateTag(ctx context.Context, id int, req *model.UpdateLinkTagRequest) (*model.LinkTagDTO, error)
	CreateCategory(ctx context.Context, req *model.CreateLinkCategoryRequest) (*model.LinkCategoryDTO, error)
	CreateTag(ctx context.Context, req *model.CreateLinkTagRequest) (*model.LinkTagDTO, error)
	DeleteCategory(ctx context.Context, id int) error
	DeleteTag(ctx context.Context, id int) error
	ListLinks(ctx context.Context, req *model.ListLinksRequest) (*model.LinkListResponse, error)
	AdminListAllTags(ctx context.Context) ([]*model.LinkTagDTO, error)
	ImportLinks(ctx context.Context, req *model.ImportLinksRequest) (*model.ImportLinksResponse, error)
	ExportLinks(ctx context.Context, req *model.ExportLinksRequest) (*model.ExportLinksResponse, error)
	CheckLinksHealth(ctx context.Context) (*model.LinkHealthCheckResponse, error)
	BatchUpdateLinkSort(ctx context.Context, req *model.BatchUpdateLinkSortRequest) error
}

type service struct {
	// 用于数据库操作的 Repositories
	linkRepo         repository.LinkRepository
	linkCategoryRepo repository.LinkCategoryRepository
	linkTagRepo      repository.LinkTagRepository
	// 用于派发异步任务的 Broker
	broker TaskBroker
	// 保留事务管理器以备将来使用
	txManager repository.TransactionManager
	// 用于获取系统配置
	settingSvc setting.SettingService
	// 用于发送即时通知
	pushooSvc utility.PushooService
	// 用于发送邮件通知
	emailSvc utility.EmailService
}

// NewService 是 service 的构造函数，注入所有依赖。
func NewService(
	linkRepo repository.LinkRepository,
	linkCategoryRepo repository.LinkCategoryRepository,
	linkTagRepo repository.LinkTagRepository,
	txManager repository.TransactionManager,
	broker TaskBroker,
	settingSvc setting.SettingService,
	pushooSvc utility.PushooService,
	emailSvc utility.EmailService,
) Service {
	return &service{
		linkRepo:         linkRepo,
		linkCategoryRepo: linkCategoryRepo,
		linkTagRepo:      linkTagRepo,
		txManager:        txManager,
		broker:           broker,
		settingSvc:       settingSvc,
		pushooSvc:        pushooSvc,
		emailSvc:         emailSvc,
	}
}

// AdminListAllTags 获取所有友链标签，供后台使用。
func (s *service) AdminListAllTags(ctx context.Context) ([]*model.LinkTagDTO, error) {
	return s.linkTagRepo.FindAll(ctx)
}

func (s *service) UpdateCategory(ctx context.Context, id int, req *model.UpdateLinkCategoryRequest) (*model.LinkCategoryDTO, error) {
	return s.linkCategoryRepo.Update(ctx, id, req)
}

func (s *service) UpdateTag(ctx context.Context, id int, req *model.UpdateLinkTagRequest) (*model.LinkTagDTO, error) {
	return s.linkTagRepo.Update(ctx, id, req)
}

func (s *service) GetRandomLinks(ctx context.Context, num int) ([]*model.LinkDTO, error) {
	// 业务逻辑：设置默认值和最大值，防止恶意请求
	if num <= 0 {
		num = 5 // 默认获取 5 条
	}
	const maxNum = 20 // 最多一次获取 20 条
	if num > maxNum {
		num = maxNum
	}

	return s.linkRepo.GetRandomPublic(ctx, num)
}

// ApplyLink 处理前台友链申请。
func (s *service) ApplyLink(ctx context.Context, req *model.ApplyLinkRequest) (*model.LinkDTO, error) {
	// 检查URL是否已存在
	exists, err := s.linkRepo.ExistsByURL(ctx, req.URL)
	if err != nil {
		return nil, fmt.Errorf("检查友链URL失败: %w", err)
	}

	// 如果URL已存在且申请类型是"新增"，则返回错误
	if exists && req.Type == "NEW" {
		return nil, errors.New("该网站已申请过友链，请选择「修改友链」类型进行申请")
	}

	// 从配置中获取默认分类ID
	defaultCategoryIDStr := s.settingSvc.Get(constant.KeyFriendLinkDefaultCategory.String())
	defaultCategoryID := 2 // 默认值，如果配置获取失败
	if defaultCategoryIDStr != "" {
		if id, err := strconv.Atoi(defaultCategoryIDStr); err == nil && id > 0 {
			defaultCategoryID = id
		}
	}

	// 获取默认分类信息，用于验证样式要求
	defaultCategory, err := s.linkCategoryRepo.GetByID(ctx, defaultCategoryID)
	if err != nil {
		return nil, fmt.Errorf("获取默认分类失败: %w", err)
	}

	// 如果是卡片样式，则要求必须提供网站快照
	if defaultCategory.Style == "card" && req.Siteshot == "" {
		return nil, errors.New("卡片样式的友链申请时必须提供网站快照(siteshot)")
	}

	newLink, err := s.linkRepo.Create(ctx, req, defaultCategoryID)
	if err != nil {
		return nil, err
	}

	// 发送友链申请通知
	log.Printf("[DEBUG] 友链申请成功，开始处理通知逻辑，友链名称: %s", newLink.Name)

	pushChannel := s.settingSvc.Get(constant.KeyFriendLinkPushooChannel.String())
	notifyAdmin := s.settingSvc.GetBool(constant.KeyFriendLinkNotifyAdmin.String())
	scMailNotify := s.settingSvc.GetBool(constant.KeyFriendLinkScMailNotify.String())

	log.Printf("[DEBUG] 友链通知配置检查:")
	log.Printf("[DEBUG]   - pushChannel: '%s'", pushChannel)
	log.Printf("[DEBUG]   - notifyAdmin: %t", notifyAdmin)
	log.Printf("[DEBUG]   - scMailNotify: %t", scMailNotify)

	// 发送即时通知
	if s.pushooSvc != nil {
		go func() {
			log.Printf("[DEBUG] 开始处理友链申请即时通知逻辑")
			if pushChannel != "" && notifyAdmin {
				log.Printf("[DEBUG] 满足通知条件，开始发送友链申请即时通知")
				if err := s.pushooSvc.SendLinkApplicationNotification(ctx, newLink); err != nil {
					log.Printf("[ERROR] 发送友链申请即时通知失败: %v", err)
				} else {
					log.Printf("[DEBUG] 友链申请即时通知发送成功")
				}
			} else {
				log.Printf("[DEBUG] 不满足通知条件，跳过友链申请即时通知")
			}
		}()
	} else {
		log.Printf("[DEBUG] pushooSvc 为 nil，跳过友链申请即时通知")
	}

	// 发送邮件通知
	if s.emailSvc != nil {
		shouldSendEmail := notifyAdmin && (pushChannel == "" || scMailNotify)
		if shouldSendEmail {
			if err := s.emailSvc.SendLinkApplicationNotification(ctx, newLink); err != nil {
				log.Printf("[ERROR] 发送友链申请通知邮件失败: %v", err)
			}
		} else {
			log.Printf("[DEBUG] 跳过友链申请邮件通知：notifyAdmin=%t, pushChannel='%s', scMailNotify=%t", notifyAdmin, pushChannel, scMailNotify)
		}
	} else {
		log.Printf("[DEBUG] emailSvc 为 nil，跳过友链申请邮件通知")
	}

	return newLink, nil
}

// ListPublicLinks 获取公开的友链列表。
func (s *service) ListPublicLinks(ctx context.Context, req *model.ListPublicLinksRequest) (*model.LinkListResponse, error) {
	links, total, err := s.linkRepo.ListPublic(ctx, req)
	if err != nil {
		return nil, err
	}

	return &model.LinkListResponse{
		List:     links,
		Total:    int64(total),
		Page:     req.GetPage(),
		PageSize: req.GetPageSize(),
	}, nil
}

// ListAllApplications 获取所有友链申请列表（公开接口，显示所有状态）
func (s *service) ListAllApplications(ctx context.Context, req *model.ListPublicLinksRequest) (*model.LinkListResponse, error) {
	links, total, err := s.linkRepo.ListAllApplications(ctx, req)
	if err != nil {
		return nil, err
	}

	return &model.LinkListResponse{
		List:     links,
		Total:    int64(total),
		Page:     req.GetPage(),
		PageSize: req.GetPageSize(),
	}, nil
}

// ListCategories 获取所有友链分类。
func (s *service) ListCategories(ctx context.Context) ([]*model.LinkCategoryDTO, error) {
	return s.linkCategoryRepo.FindAll(ctx)
}

// ListPublicCategories 获取有已审核通过友链的分类，用于前台公开接口。
func (s *service) ListPublicCategories(ctx context.Context) ([]*model.LinkCategoryDTO, error) {
	return s.linkCategoryRepo.FindAllWithLinks(ctx)
}

// AdminCreateLink 处理后台创建友链，并在成功后派发一个异步清理任务。
func (s *service) AdminCreateLink(ctx context.Context, req *model.AdminCreateLinkRequest) (*model.LinkDTO, error) {
	link, err := s.linkRepo.AdminCreate(ctx, req)
	if err != nil {
		return nil, err
	}
	// 操作成功后，派发清理任务，API 无需等待
	s.broker.DispatchLinkCleanup()
	return link, nil
}

// AdminUpdateLink 处理后台更新友链，并在成功后派发一个异步清理任务。
func (s *service) AdminUpdateLink(ctx context.Context, id int, req *model.AdminUpdateLinkRequest) (*model.LinkDTO, error) {
	link, err := s.linkRepo.Update(ctx, id, req)
	if err != nil {
		return nil, err
	}
	// 操作成功后，派发清理任务
	s.broker.DispatchLinkCleanup()
	return link, nil
}

// AdminDeleteLink 处理后台删除友链，并在成功后派发一个异步清理任务。
func (s *service) AdminDeleteLink(ctx context.Context, id int) error {
	err := s.linkRepo.Delete(ctx, id)
	if err != nil {
		return err
	}
	// 操作成功后，派发清理任务
	s.broker.DispatchLinkCleanup()
	return nil
}

// ReviewLink 处理友链审核，这是一个简单操作，无需清理。
func (s *service) ReviewLink(ctx context.Context, id int, req *model.ReviewLinkRequest) error {
	// 1. 获取友链信息（用于后续发送邮件通知）
	linkToReview, err := s.linkRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("获取友链信息失败: %w", err)
	}

	// 2. 根据审核状态进行相应的校验
	if req.Status == "APPROVED" {
		if linkToReview.Category == nil {
			return errors.New("无法审核：该友链未关联任何分类")
		}

		// 检查分类样式是否为 'card'
		if linkToReview.Category.Style == "card" {
			// 如果是 card 样式，则 siteshot 必须存在且不为空
			if req.Siteshot == nil || *req.Siteshot == "" {
				return errors.New("卡片样式的友链在审核通过时必须提供网站快照(siteshot)")
			}
		}
	} else if req.Status == "REJECTED" {
		// 拒绝原因是可选的，无字符长度限制
	}

	// 3. 执行更新状态操作
	if err := s.linkRepo.UpdateStatus(ctx, id, req.Status, req.Siteshot); err != nil {
		return err
	}

	// 4. 发送邮件通知（异步，不影响主流程）
	// 只在审核通过或拒绝时发送通知
	if req.Status == "APPROVED" || req.Status == "REJECTED" {
		// 重新获取更新后的友链信息（包含最新的 siteshot）
		updatedLink, err := s.linkRepo.GetByID(ctx, id)
		if err != nil {
			log.Printf("[WARNING] 获取更新后的友链信息失败，无法发送邮件通知: %v", err)
		} else if s.emailSvc != nil {
			// 异步发送邮件通知
			go func() {
				isApproved := req.Status == "APPROVED"
				rejectReason := ""
				if req.RejectReason != nil {
					rejectReason = *req.RejectReason
				}
				if err := s.emailSvc.SendLinkReviewNotification(context.Background(), updatedLink, isApproved, rejectReason); err != nil {
					log.Printf("[ERROR] 发送友链审核邮件通知失败: %v", err)
				}
			}()
		} else {
			log.Printf("[DEBUG] 邮件服务未初始化，跳过友链审核邮件通知")
		}
	}

	return nil
}

// CreateCategory 处理创建分类。
func (s *service) CreateCategory(ctx context.Context, req *model.CreateLinkCategoryRequest) (*model.LinkCategoryDTO, error) {
	return s.linkCategoryRepo.Create(ctx, req)
}

// CreateTag 处理创建标签。
func (s *service) CreateTag(ctx context.Context, req *model.CreateLinkTagRequest) (*model.LinkTagDTO, error) {
	return s.linkTagRepo.Create(ctx, req)
}

// DeleteCategory 删除分类。
func (s *service) DeleteCategory(ctx context.Context, id int) error {
	// 使用已有的 DeleteIfUnused 方法，它会检查是否有友链在使用
	deleted, err := s.linkCategoryRepo.DeleteIfUnused(ctx, id)
	if err != nil {
		return err
	}
	if !deleted {
		return errors.New("该分类正在被友链使用，无法删除")
	}
	return nil
}

// DeleteTag 删除标签。
func (s *service) DeleteTag(ctx context.Context, id int) error {
	// 使用已有的 DeleteIfUnused 方法，它会检查是否有友链在使用
	deletedCount, err := s.linkTagRepo.DeleteIfUnused(ctx, []int{id})
	if err != nil {
		return err
	}
	if deletedCount == 0 {
		return errors.New("该标签正在被友链使用，无法删除")
	}
	return nil
}

// ListLinks 获取后台友链列表。
func (s *service) ListLinks(ctx context.Context, req *model.ListLinksRequest) (*model.LinkListResponse, error) {
	links, total, err := s.linkRepo.List(ctx, req)
	if err != nil {
		return nil, err
	}
	return &model.LinkListResponse{
		List:     links,
		Total:    int64(total),
		Page:     req.GetPage(),
		PageSize: req.GetPageSize(),
	}, nil
}

// ImportLinks 批量导入友链，支持重复检查、自动创建分类和标签等功能。
func (s *service) ImportLinks(ctx context.Context, req *model.ImportLinksRequest) (*model.ImportLinksResponse, error) {
	response := &model.ImportLinksResponse{
		Total:       len(req.Links),
		Success:     0,
		Failed:      0,
		Skipped:     0,
		SuccessList: make([]*model.LinkDTO, 0),
		FailedList:  make([]model.ImportLinkFailure, 0),
		SkippedList: make([]model.ImportLinkSkipped, 0),
	}

	// 创建分类和标签的缓存映射，避免重复查询
	categoryCache := make(map[string]*model.LinkCategoryDTO)
	tagCache := make(map[string]*model.LinkTagDTO)

	// 获取默认分类ID，如果没有指定或指定的分类不存在
	defaultCategoryID := 2 // 系统默认值
	if req.DefaultCategoryID != nil && *req.DefaultCategoryID > 0 {
		defaultCategoryID = *req.DefaultCategoryID
	} else {
		// 从配置中获取默认分类ID
		defaultCategoryIDStr := s.settingSvc.Get(constant.KeyFriendLinkDefaultCategory.String())
		if defaultCategoryIDStr != "" {
			if id, err := strconv.Atoi(defaultCategoryIDStr); err == nil && id > 0 {
				defaultCategoryID = id
			}
		}
	}

	// 用于追踪本次导入已处理的 URL，支持合并同一 URL 不同分类的记录
	processedURLs := make(map[string]*model.LinkDTO)

	// 逐个处理导入的友链
	for _, linkItem := range req.Links {
		// 1. 检查是否是本次导入中已处理过的 URL（同一 URL 不同分类的情况）
		if existingLink, alreadyProcessed := processedURLs[linkItem.URL]; alreadyProcessed {
			// 本次导入中已经处理过这个 URL，需要更新分类
			// 先处理新的分类
			var newCategoryID int
			if linkItem.CategoryName != "" {
				if cachedCategory, exists := categoryCache[linkItem.CategoryName]; exists {
					newCategoryID = cachedCategory.ID
				} else {
					category, err := s.linkCategoryRepo.GetByName(ctx, linkItem.CategoryName)
					if err != nil {
						if req.CreateCategories {
							createReq := &model.CreateLinkCategoryRequest{
								Name:        linkItem.CategoryName,
								Style:       "list",
								Description: fmt.Sprintf("导入时自动创建的分类：%s", linkItem.CategoryName),
							}
							newCategory, err := s.linkCategoryRepo.Create(ctx, createReq)
							if err != nil {
								response.Failed++
								response.FailedList = append(response.FailedList, model.ImportLinkFailure{
									Link:   linkItem,
									Reason: fmt.Errorf("创建分类失败: %w", err).Error(),
								})
								continue
							}
							newCategoryID = newCategory.ID
							categoryCache[linkItem.CategoryName] = newCategory
						} else {
							newCategoryID = defaultCategoryID
						}
					} else {
						newCategoryID = category.ID
						categoryCache[linkItem.CategoryName] = category
					}
				}
			} else {
				newCategoryID = defaultCategoryID
			}

			// 更新已存在友链的分类
			updateReq := &model.AdminUpdateLinkRequest{
				CategoryID: newCategoryID,
			}
			updatedLink, err := s.linkRepo.Update(ctx, existingLink.ID, updateReq)
			if err != nil {
				response.Failed++
				response.FailedList = append(response.FailedList, model.ImportLinkFailure{
					Link:   linkItem,
					Reason: fmt.Errorf("更新友链分类失败: %w", err).Error(),
				})
				continue
			}

			// 更新成功，记录到成功列表（作为更新操作）
			response.Success++
			response.SuccessList = append(response.SuccessList, updatedLink)
			processedURLs[linkItem.URL] = updatedLink
			continue
		}

		// 2. 重复检查（检查数据库中是否已存在）
		if req.SkipDuplicates {
			existingLink, err := s.linkRepo.GetByURL(ctx, linkItem.URL)
			if err == nil && existingLink != nil {
				// 数据库中已存在该 URL，更新其分类而不是跳过
				var newCategoryID int
				if linkItem.CategoryName != "" {
					if cachedCategory, exists := categoryCache[linkItem.CategoryName]; exists {
						newCategoryID = cachedCategory.ID
					} else {
						category, err := s.linkCategoryRepo.GetByName(ctx, linkItem.CategoryName)
						if err != nil {
							if req.CreateCategories {
								createReq := &model.CreateLinkCategoryRequest{
									Name:        linkItem.CategoryName,
									Style:       "list",
									Description: fmt.Sprintf("导入时自动创建的分类：%s", linkItem.CategoryName),
								}
								newCategory, err := s.linkCategoryRepo.Create(ctx, createReq)
								if err != nil {
									response.Failed++
									response.FailedList = append(response.FailedList, model.ImportLinkFailure{
										Link:   linkItem,
										Reason: fmt.Errorf("创建分类失败: %w", err).Error(),
									})
									continue
								}
								newCategoryID = newCategory.ID
								categoryCache[linkItem.CategoryName] = newCategory
							} else {
								newCategoryID = defaultCategoryID
							}
						} else {
							newCategoryID = category.ID
							categoryCache[linkItem.CategoryName] = category
						}
					}
				} else {
					newCategoryID = defaultCategoryID
				}

				// 更新已存在友链的分类
				updateReq := &model.AdminUpdateLinkRequest{
					CategoryID: newCategoryID,
				}
				updatedLink, err := s.linkRepo.Update(ctx, existingLink.ID, updateReq)
				if err != nil {
					response.Failed++
					response.FailedList = append(response.FailedList, model.ImportLinkFailure{
						Link:   linkItem,
						Reason: fmt.Errorf("更新友链分类失败: %w", err).Error(),
					})
					continue
				}

				// 更新成功
				response.Success++
				response.SuccessList = append(response.SuccessList, updatedLink)
				processedURLs[linkItem.URL] = updatedLink
				continue
			}
		}

		// 4. 处理分类（新创建友链的情况）
		var categoryID int
		if linkItem.CategoryName != "" {
			// 先从缓存查找
			if cachedCategory, exists := categoryCache[linkItem.CategoryName]; exists {
				categoryID = cachedCategory.ID
			} else {
				// 尝试查找现有分类
				category, err := s.linkCategoryRepo.GetByName(ctx, linkItem.CategoryName)
				if err != nil {
					// 分类不存在
					if req.CreateCategories {
						// 自动创建分类
						createReq := &model.CreateLinkCategoryRequest{
							Name:        linkItem.CategoryName,
							Style:       "list", // 默认为列表样式
							Description: fmt.Sprintf("导入时自动创建的分类：%s", linkItem.CategoryName),
						}
						newCategory, err := s.linkCategoryRepo.Create(ctx, createReq)
						if err != nil {
							response.Failed++
							response.FailedList = append(response.FailedList, model.ImportLinkFailure{
								Link:   linkItem,
								Reason: fmt.Errorf("创建分类失败: %w", err).Error(),
							})
							continue
						}
						categoryID = newCategory.ID
						categoryCache[linkItem.CategoryName] = newCategory
					} else {
						// 使用默认分类
						categoryID = defaultCategoryID
					}
				} else {
					categoryID = category.ID
					categoryCache[linkItem.CategoryName] = category
				}
			}
		} else {
			// 没有指定分类名称，使用默认分类
			categoryID = defaultCategoryID
		}

		// 5. 处理标签（可选）
		var tagID *int
		if linkItem.TagName != "" {
			// 先从缓存查找
			if cachedTag, exists := tagCache[linkItem.TagName]; exists {
				tagID = &cachedTag.ID
			} else {
				// 尝试查找现有标签
				tag, err := s.linkTagRepo.GetByName(ctx, linkItem.TagName)
				if err != nil {
					// 标签不存在
					if req.CreateTags {
						// 自动创建标签
						createReq := &model.CreateLinkTagRequest{
							Name:  linkItem.TagName,
							Color: "#409EFF", // 默认颜色
						}
						newTag, err := s.linkTagRepo.Create(ctx, createReq)
						if err != nil {
							response.Failed++
							response.FailedList = append(response.FailedList, model.ImportLinkFailure{
								Link:   linkItem,
								Reason: fmt.Errorf("创建标签失败: %w", err).Error(),
							})
							continue
						}
						tagID = &newTag.ID
						tagCache[linkItem.TagName] = newTag
					}
					// 如果不允许创建标签，就不设置标签（tagID 保持为 nil）
				} else {
					tagID = &tag.ID
					tagCache[linkItem.TagName] = tag
				}
			}
		}

		// 6. 设置默认状态
		status := linkItem.Status
		if status == "" {
			status = "PENDING" // 默认为待审核状态
		}

		// 7. 创建友链
		adminCreateReq := &model.AdminCreateLinkRequest{
			Name:        linkItem.Name,
			URL:         linkItem.URL,
			Logo:        linkItem.Logo,
			Description: linkItem.Description,
			CategoryID:  categoryID,
			TagID:       tagID,
			Status:      status,
			Siteshot:    linkItem.Siteshot,
			Email:       linkItem.Email,
		}

		createdLink, err := s.linkRepo.AdminCreate(ctx, adminCreateReq)
		if err != nil {
			response.Failed++
			response.FailedList = append(response.FailedList, model.ImportLinkFailure{
				Link:   linkItem,
				Reason: fmt.Errorf("创建友链失败: %w", err).Error(),
			})
			continue
		}

		// 成功创建，记录到已处理映射
		response.Success++
		response.SuccessList = append(response.SuccessList, createdLink)
		processedURLs[linkItem.URL] = createdLink
	}

	// 如果有成功创建的友链，派发清理任务
	if response.Success > 0 {
		s.broker.DispatchLinkCleanup()
	}

	return response, nil
}

// ExportLinks 导出友链数据，支持根据筛选条件导出特定的友链。
func (s *service) ExportLinks(ctx context.Context, req *model.ExportLinksRequest) (*model.ExportLinksResponse, error) {
	// 构建查询请求（复用 ListLinksRequest 的筛选逻辑）
	listReq := &model.ListLinksRequest{
		PaginationInput: model.PaginationInput{
			Page:     1,
			PageSize: 10000, // 设置一个足够大的数字以导出所有符合条件的友链
		},
		Name:        req.Name,
		URL:         req.URL,
		Description: req.Description,
		Status:      req.Status,
		CategoryID:  req.CategoryID,
		TagID:       req.TagID,
	}

	// 获取友链列表
	links, total, err := s.linkRepo.List(ctx, listReq)
	if err != nil {
		return nil, fmt.Errorf("获取友链列表失败: %w", err)
	}

	// 转换为导出格式（与导入格式兼容）
	exportLinks := make([]model.ImportLinkItem, 0, len(links))
	for _, link := range links {
		exportItem := model.ImportLinkItem{
			Name:        link.Name,
			URL:         link.URL,
			Logo:        link.Logo,
			Description: link.Description,
			Siteshot:    link.Siteshot,
			Email:       link.Email,
			Status:      link.Status,
		}

		// 添加分类名称
		if link.Category != nil {
			exportItem.CategoryName = link.Category.Name
		}

		// 添加标签名称
		if link.Tag != nil {
			exportItem.TagName = link.Tag.Name
		}

		exportLinks = append(exportLinks, exportItem)
	}

	return &model.ExportLinksResponse{
		Links: exportLinks,
		Total: total,
	}, nil
}

// CheckLinksHealth 检查所有友链的健康状态，将无法访问的友链标记为 INVALID，将恢复的友链标记为 APPROVED。
func (s *service) CheckLinksHealth(ctx context.Context) (*model.LinkHealthCheckResponse, error) {
	// 1. 获取所有已审核通过的友链
	approvedLinks, err := s.linkRepo.GetAllApprovedLinks(ctx)
	if err != nil {
		return nil, fmt.Errorf("获取已审核友链列表失败: %w", err)
	}

	// 2. 获取所有失联的友链（用于检查是否恢复）
	invalidLinks, err := s.linkRepo.GetAllInvalidLinks(ctx)
	if err != nil {
		return nil, fmt.Errorf("获取失联友链列表失败: %w", err)
	}

	response := &model.LinkHealthCheckResponse{
		Total:        len(approvedLinks) + len(invalidLinks),
		Healthy:      0,
		Unhealthy:    0,
		UnhealthyIDs: make([]int, 0),
	}

	if response.Total == 0 {
		return response, nil
	}

	// 3. 创建 HTTP 客户端，设置超时时间
	client := &http.Client{
		Timeout: 10 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			// 最多跟随 5 次重定向
			if len(via) >= 5 {
				return fmt.Errorf("重定向次数过多")
			}
			return nil
		},
	}

	// 4. 使用 WaitGroup 和互斥锁来并发检查友链
	var wg sync.WaitGroup
	var mu sync.Mutex
	toInvalidIDs := make([]int, 0)  // 需要标记为失联的友链ID
	toApprovedIDs := make([]int, 0) // 需要恢复的友链ID

	// 创建一个带缓冲的通道来限制并发数
	semaphore := make(chan struct{}, 10) // 最多同时检查 10 个友链

	// 5. 检查已审核通过的友链
	for _, link := range approvedLinks {
		wg.Add(1)
		go func(l *model.LinkDTO) {
			defer wg.Done()
			semaphore <- struct{}{}        // 获取信号量
			defer func() { <-semaphore }() // 释放信号量

			isHealthy := checkLinkHealth(client, l.URL)
			mu.Lock()
			if isHealthy {
				response.Healthy++
			} else {
				response.Unhealthy++
				toInvalidIDs = append(toInvalidIDs, l.ID)
			}
			mu.Unlock()
		}(link)
	}

	// 6. 检查失联的友链（检查是否恢复）
	for _, link := range invalidLinks {
		wg.Add(1)
		go func(l *model.LinkDTO) {
			defer wg.Done()
			semaphore <- struct{}{}        // 获取信号量
			defer func() { <-semaphore }() // 释放信号量

			isHealthy := checkLinkHealth(client, l.URL)
			mu.Lock()
			if isHealthy {
				response.Healthy++
				toApprovedIDs = append(toApprovedIDs, l.ID)
			} else {
				response.Unhealthy++
			}
			mu.Unlock()
		}(link)
	}

	wg.Wait()

	// 7. 批量更新失联友链的状态为 INVALID
	if len(toInvalidIDs) > 0 {
		if err := s.linkRepo.BatchUpdateStatus(ctx, toInvalidIDs, "INVALID"); err != nil {
			return nil, fmt.Errorf("更新失联友链状态失败: %w", err)
		}
		response.UnhealthyIDs = append(response.UnhealthyIDs, toInvalidIDs...)
	}

	// 8. 批量恢复健康友链的状态为 APPROVED
	if len(toApprovedIDs) > 0 {
		if err := s.linkRepo.BatchUpdateStatus(ctx, toApprovedIDs, "APPROVED"); err != nil {
			return nil, fmt.Errorf("恢复友链状态失败: %w", err)
		}
		// 恢复的友链也算在健康的友链中，但不放入 UnhealthyIDs
	}

	return response, nil
}

// BatchUpdateLinkSort 批量更新友链排序
func (s *service) BatchUpdateLinkSort(ctx context.Context, req *model.BatchUpdateLinkSortRequest) error {
	return s.linkRepo.BatchUpdateSortOrder(ctx, req.Items)
}

// CheckLinkExistsByURL 检查指定URL的友链是否已存在
func (s *service) CheckLinkExistsByURL(ctx context.Context, url string) (*model.CheckLinkExistsResponse, error) {
	exists, err := s.linkRepo.ExistsByURL(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("检查友链URL失败: %w", err)
	}
	return &model.CheckLinkExistsResponse{
		Exists: exists,
		URL:    url,
	}, nil
}

// checkLinkHealth 检查单个友链的健康状态。
func checkLinkHealth(client *http.Client, url string) bool {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return false
	}

	// 设置 User-Agent 避免被网站屏蔽
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; LinkHealthChecker/1.0)")

	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	// 认为 2xx 和 3xx 状态码为健康
	return resp.StatusCode >= 200 && resp.StatusCode < 400
}
