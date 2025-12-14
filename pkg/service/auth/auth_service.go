/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-08-22 12:41:16
 * @LastEditTime: 2025-08-26 11:11:58
 * @LastEditors: 安知鱼
 */
package auth

import (
	"context"
	"crypto/md5"
	"database/sql"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/security"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	articleSvc "github.com/anzhiyu-c/anheyu-app/pkg/service/article"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"
)

// AuthService 定义了所有认证授权相关的业务逻辑接口
type AuthService interface {
	Login(ctx context.Context, email, password string) (*model.User, error)
	Register(ctx context.Context, email, nickname, password string) (activationRequired bool, err error)
	// ActivateUser 现在接收内部数据库 ID (uint)
	ActivateUser(ctx context.Context, userID uint, sign string) error
	RequestPasswordReset(ctx context.Context, email string) error
	// PerformPasswordReset 现在接收内部数据库 ID (uint)
	PerformPasswordReset(ctx context.Context, userID uint, sign, newPassword string) error
	CheckEmailExists(ctx context.Context, email string) (bool, error)
	// GetUserByID 通过用户ID获取用户信息
	GetUserByID(ctx context.Context, userID uint) (*model.User, error)
}

// authService 是 AuthService 接口的实现
type authService struct {
	userRepo   repository.UserRepository
	settingSvc setting.SettingService
	tokenSvc   TokenService
	emailSvc   utility.EmailService
	txManager  repository.TransactionManager
	articleSvc articleSvc.Service
}

// NewAuthService 是 authService 的构造函数
func NewAuthService(
	userRepo repository.UserRepository,
	settingSvc setting.SettingService,
	tokenSvc TokenService,
	emailSvc utility.EmailService,
	txManager repository.TransactionManager,
	articleSvc articleSvc.Service,
) AuthService {
	return &authService{
		userRepo:   userRepo,
		settingSvc: settingSvc,
		tokenSvc:   tokenSvc,
		emailSvc:   emailSvc,
		txManager:  txManager,
		articleSvc: articleSvc,
	}
}

// createDefaultArticle 为新用户创建一篇默认的欢迎文章。
// 它在一个独立的 goroutine 中运行，以避免阻塞注册流程。
func (s *authService) createDefaultArticle(ctx context.Context) {
	log.Println("[INFO] Starting to create default article for new user.")

	// 步骤 1: 读取默认文章的 Markdown 内容
	mdBytes, err := os.ReadFile("data/DefaultArticle.md")
	if err != nil {
		log.Printf("[ERROR] Failed to read default article file 'data/DefaultArticle.md': %v", err)
		return
	}
	content := string(mdBytes)

	// 步骤 2: 准备创建文章的请求体
	// 注意：由于文章服务期望 content_html 字段由上游提供，
	// 我们将文件内容同时赋给 ContentMd 和 ContentHTML。
	// article.Service 中的 SanitizeHTML 会处理其中的 HTML 标签。
	req := &model.CreateArticleRequest{
		Title:       "欢迎使用 Anheyu-App！",
		ContentMd:   content,
		ContentHTML: content,     // 将原始内容传递给HTML字段以进行净化
		Status:      "PUBLISHED", // 默认发布
		Summaries:   []string{"这是一篇系统生成的默认文章", "你可以编辑或删除它"},
	}

	// 步骤 3: 调用文章服务创建文章
	// 使用 "system" 作为 IP 地址标识
	article, err := s.articleSvc.Create(ctx, req, "system")
	if err != nil {
		log.Printf("[ERROR] Failed to create default article: %v", err)
		return
	}

	log.Printf("[INFO] Successfully created default article with ID: %s", article.ID)
}

// Login 实现了用户登录的完整业务逻辑
func (s *authService) Login(ctx context.Context, email, password string) (*model.User, error) {
	// 统一将email转换为小写
	email = strings.ToLower(strings.TrimSpace(email))

	user, err := s.userRepo.FindByEmail(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("数据库查询失败: %w", err)
	}
	if user == nil {
		return nil, fmt.Errorf("账号或密码错误")
	}

	if user.Status == model.UserStatusInactive {
		return nil, fmt.Errorf("您的账户尚未激活，请检查您的邮箱以完成激活流程")
	}
	if user.Status == model.UserStatusBanned {
		return nil, fmt.Errorf("您的账户已被封禁，请联系管理员")
	}

	if !security.CheckPasswordHash(password, user.PasswordHash) {
		return nil, fmt.Errorf("密码错误，请核对后登录。")
	}

	now := time.Now()
	user.LastLoginAt = &now
	if err := s.userRepo.Update(ctx, user); err != nil {
		fmt.Printf("警告: 更新用户 '%s' 的最后登录时间失败: %v\n", user.Username, err)
	}

	return user, nil
}

// Register 实现了最终的用户注册逻辑
// 它会为新用户创建根目录，并在首次注册时初始化系统内置的存储策略及其关联的虚拟目录。
func (s *authService) Register(ctx context.Context, email, nickname, password string) (bool, error) {
	// email转为小写
	email = strings.ToLower(strings.TrimSpace(email))
	// nickname去除首尾空格
	nickname = strings.TrimSpace(nickname)

	if existing, err := s.userRepo.FindByEmail(ctx, email); err != nil {
		return false, fmt.Errorf("查询邮箱时数据库出错: %w", err)
	} else if existing != nil {
		return false, fmt.Errorf("该邮箱已被注册")
	}
	userCount, err := s.userRepo.Count(ctx)
	if err != nil {
		return false, fmt.Errorf("获取用户总数失败: %w", err)
	}
	isFirstUser := userCount == 0
	assignedUserGroupID := uint(2)
	if isFirstUser {
		assignedUserGroupID = 1
	}
	activationEnabled := s.settingSvc.Get(constant.KeyEnableUserActivation.String()) == "true"
	hashedPassword, _ := security.HashPassword(password)
	// 如果昵称为空，则使用邮箱前缀作为默认昵称
	if nickname == "" {
		nickname = strings.Split(email, "@")[0]
	}
	hasher := md5.New()
	hasher.Write([]byte(email))
	avatarURL := "avatar/" + hex.EncodeToString(hasher.Sum(nil)) + "?d=identicon"
	newUser := &model.User{
		Username:     email,
		PasswordHash: hashedPassword,
		Nickname:     nickname,
		Avatar:       avatarURL,
		Email:        email,
		UserGroupID:  assignedUserGroupID,
		Status:       model.UserStatusActive,
	}
	if activationEnabled {
		newUser.Status = model.UserStatusInactive
	}

	// --- 步骤3：在单个事务中执行所有数据库写操作 ---
	err = s.txManager.Do(ctx, func(repos repository.Repositories) error {
		userRepo := repos.User
		fileRepo := repos.File
		policyRepo := repos.StoragePolicy
		userGroupRepo := repos.UserGroup

		// 3a: 创建用户记录
		if err := userRepo.Create(ctx, newUser); err != nil {
			return fmt.Errorf("创建用户失败: %w", err)
		}

		// 3b: 为新用户创建个人根目录File记录 (ParentID为NULL)
		userRootDir := &model.File{
			OwnerID: newUser.ID,
			Name:    "", // 根目录的名称约定为空字符串
			Type:    model.FileTypeDir,
		}
		if err := fileRepo.Create(ctx, userRootDir); err != nil {
			return fmt.Errorf("为用户创建根目录失败: %w", err)
		}

		// 3c: 如果是第一个用户注册，则创建系统内置的存储策略和关联的虚拟目录
		if isFirstUser {
			log.Println("检测到是第一个用户注册，正在创建内置存储策略及关联目录...")
			articleAbsPath, err := filepath.Abs(constant.DefaultArticlePolicyPath)
			if err != nil {
				return fmt.Errorf("无法解析文章策略的绝对路径: %w", err)
			}
			commentAbsPath, err := filepath.Abs(constant.DefaultCommentPolicyPath)
			if err != nil {
				return fmt.Errorf("无法解析评论策略的绝对路径: %w", err)
			}

			// --- 创建文章图片策略和目录 ---
			// 1. 先创建 VFS 目录
			articleDir := &model.File{
				OwnerID:  newUser.ID, // 系统目录的所有者是第一个用户（管理员）
				ParentID: sql.NullInt64{Int64: int64(userRootDir.ID), Valid: true},
				Name:     constant.PolicyFlagArticleImage,
				Type:     model.FileTypeDir,
			}
			if err := fileRepo.Create(ctx, articleDir); err != nil {
				return fmt.Errorf("创建文章图片 VFS 目录失败: %w", err)
			}
			log.Printf("VFS 目录 '/article_images' 创建成功。")

			// 2. 再创建策略，并关联 NodeID
			// 文章图片存储策略：权限通过用户组的 StoragePolicyIDs 控制
			articlePolicy := &model.StoragePolicy{
				Name:        constant.DefaultArticlePolicyName,
				Type:        constant.PolicyTypeLocal,
				Flag:        constant.PolicyFlagArticleImage,
				BasePath:    articleAbsPath,
				VirtualPath: "/" + constant.PolicyFlagArticleImage,
				NodeID:      &articleDir.ID,
			}
			if err := policyRepo.Create(ctx, articlePolicy); err != nil {
				return fmt.Errorf("创建文章图片存储策略失败: %w", err)
			}
			log.Printf("内置存储策略 '%s' 创建成功。", articlePolicy.Name)

			// --- 创建评论图片策略和目录 ---
			// 1. 先创建 VFS 目录
			commentDir := &model.File{
				OwnerID:  newUser.ID,
				ParentID: sql.NullInt64{Int64: int64(userRootDir.ID), Valid: true},
				Name:     constant.PolicyFlagCommentImage,
				Type:     model.FileTypeDir,
			}
			if err := fileRepo.Create(ctx, commentDir); err != nil {
				return fmt.Errorf("创建评论图片 VFS 目录失败: %w", err)
			}
			log.Printf("VFS 目录 '/comment_images' 创建成功。")

			// 2. 再创建策略，并关联 NodeID
			maxSize := int64(10 * 1024 * 1024) // 10MB 限制
			// 评论图片存储策略：权限通过用户组的 StoragePolicyIDs 控制
			commentPolicy := &model.StoragePolicy{
				Name:        constant.DefaultCommentPolicyName,
				Type:        constant.PolicyTypeLocal,
				Flag:        constant.PolicyFlagCommentImage,
				BasePath:    commentAbsPath,
				VirtualPath: "/" + constant.PolicyFlagCommentImage,
				NodeID:      &commentDir.ID,
				MaxSize:     maxSize,
			}
			if err := policyRepo.Create(ctx, commentPolicy); err != nil {
				return fmt.Errorf("创建评论图片存储策略失败: %w", err)
			}
			log.Printf("内置存储策略 '%s' 创建成功。", commentPolicy.Name)

			// --- 创建用户头像策略和目录 ---
			avatarAbsPath, err := filepath.Abs(constant.DefaultAvatarPolicyPath)
			if err != nil {
				return fmt.Errorf("无法解析头像策略的绝对路径: %w", err)
			}

			// 1. 先创建 VFS 目录
			avatarDir := &model.File{
				OwnerID:  newUser.ID,
				ParentID: sql.NullInt64{Int64: int64(userRootDir.ID), Valid: true},
				Name:     constant.PolicyFlagUserAvatar,
				Type:     model.FileTypeDir,
			}
			if err := fileRepo.Create(ctx, avatarDir); err != nil {
				return fmt.Errorf("创建用户头像 VFS 目录失败: %w", err)
			}
			log.Printf("VFS 目录 '/user_avatar' 创建成功。")

			// 2. 再创建策略，并关联 NodeID
			avatarMaxSize := int64(5 * 1024 * 1024) // 5MB 限制
			// 用户头像存储策略：权限通过用户组的 StoragePolicyIDs 控制
			avatarPolicy := &model.StoragePolicy{
				Name:        constant.DefaultAvatarPolicyName,
				Type:        constant.PolicyTypeLocal,
				Flag:        constant.PolicyFlagUserAvatar,
				BasePath:    avatarAbsPath,
				VirtualPath: "/" + constant.PolicyFlagUserAvatar,
				NodeID:      &avatarDir.ID,
				MaxSize:     avatarMaxSize,
			}
			if err := policyRepo.Create(ctx, avatarPolicy); err != nil {
				return fmt.Errorf("创建用户头像存储策略失败: %w", err)
			}
			log.Printf("内置存储策略 '%s' 创建成功。", avatarPolicy.Name)
		}

		// 3d: 获取用户组的配置
		userGroup, err := userGroupRepo.FindByID(ctx, newUser.UserGroupID)
		if err != nil {
			return fmt.Errorf("查找用户组配置失败 (ID: %d): %w", newUser.UserGroupID, err)
		}

		// 3e: 将除第一个策略外的其他策略，创建为根目录下的子目录
		if len(userGroup.Settings.PolicyOrdering) > 1 {
			remainingPolicyIDs := userGroup.Settings.PolicyOrdering[1:]
			for _, policyID := range remainingPolicyIDs {
				policy, err := policyRepo.FindByID(ctx, policyID)
				if err != nil {
					log.Printf("警告: 注册用户'%s'时，找不到ID为%d的策略，已跳过。", newUser.Email, policyID)
					continue
				}

				mountPointDir := &model.File{
					OwnerID:  newUser.ID,
					ParentID: sql.NullInt64{Int64: int64(userRootDir.ID), Valid: true},
					Name:     policy.Name, // 使用策略名作为目录名
					Type:     model.FileTypeDir,
				}
				if err := fileRepo.Create(ctx, mountPointDir); err != nil {
					return fmt.Errorf("为策略'%s'创建挂载点目录失败: %w", policy.Name, err)
				}
			}
		}

		return nil // 事务成功
	})

	if err != nil {
		return false, err
	}

	// 异步为第一个用户（管理员）创建一篇默认文章
	if isFirstUser {
		go s.createDefaultArticle(context.Background())
	}

	// --- 步骤4：事务成功后，发送激活邮件 ---
	if activationEnabled {
		publicUserID, err := idgen.GeneratePublicID(newUser.ID, idgen.EntityTypeUser)
		if err != nil {
			return false, fmt.Errorf("用户已创建，但生成激活邮件公共ID失败: %w", err)
		}

		sign, err := s.tokenSvc.GenerateSignedToken(publicUserID, 24*time.Hour)
		if err != nil {
			return false, fmt.Errorf("用户已创建，但生成激活令牌失败: %w", err)
		}
		go s.emailSvc.SendActivationEmail(context.Background(), newUser.Email, newUser.Nickname, publicUserID, sign)
	}

	return activationEnabled, nil
}

// ActivateUser 实现了激活用户的业务逻辑
// userID 参数现在是内部数据库主键 ID (uint)
func (s *authService) ActivateUser(ctx context.Context, userID uint, sign string) error {
	// 在此处，tokenSvc.VerifySignedToken 应该能够接收公共 ID 并验证其签名。
	publicUserID, err := idgen.GeneratePublicID(userID, idgen.EntityTypeUser)
	if err != nil {
		return fmt.Errorf("无法为激活验证生成公共用户ID: %w", err)
	}

	if err := s.tokenSvc.VerifySignedToken(publicUserID, sign); err != nil {
		return fmt.Errorf("链接无效或已过期: %w", err)
	}

	// 使用 FindByID 通过内部数据库 ID 查询用户
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("数据库查询失败: %w", err)
	}
	if user == nil || user.Status != model.UserStatusInactive {
		return fmt.Errorf("激活失败：用户不存在或已被激活")
	}

	user.Status = model.UserStatusActive
	return s.userRepo.Update(ctx, user)
}

// RequestPasswordReset 实现了请求重置密码的业务逻辑
func (s *authService) RequestPasswordReset(ctx context.Context, email string) error {
	user, err := s.userRepo.FindByEmail(ctx, email)
	if err != nil {
		fmt.Printf("请求重置密码时查询用户失败: %v\n", err)
		return nil // 故意不返回错误，防止邮箱枚举攻击
	}
	if user == nil {
		return nil // 用户不存在，静默处理
	}

	// 生成用于邮件链接的公共用户 ID，统一使用 GeneratePublicID
	publicUserID, err := idgen.GeneratePublicID(user.ID, idgen.EntityTypeUser)
	if err != nil {
		return fmt.Errorf("生成重置密码邮件公共ID失败: %w", err)
	}

	sign, err := s.tokenSvc.GenerateSignedToken(publicUserID, 1*time.Hour) // 令牌使用公共 ID
	if err != nil {
		return fmt.Errorf("生成重置令牌失败: %w", err)
	}
	go s.emailSvc.SendForgotPasswordEmail(context.Background(), user.Email, user.Nickname, publicUserID, sign)

	return nil
}

// PerformPasswordReset 实现了执行密码重置的业务逻辑
// userID 参数现在是内部数据库主键 ID (uint)
func (s *authService) PerformPasswordReset(ctx context.Context, userID uint, sign, newPassword string) error {
	// 在此处，tokenSvc.VerifySignedToken 应该能够接收公共 ID 并验证其签名。
	publicUserID, err := idgen.GeneratePublicID(userID, idgen.EntityTypeUser)
	if err != nil {
		return fmt.Errorf("无法为重置密码验证生成公共用户ID: %w", err)
	}

	if err := s.tokenSvc.VerifySignedToken(publicUserID, sign); err != nil {
		return fmt.Errorf("链接无效或已过期: %w", err)
	}
	// 使用 FindByID 通过内部数据库 ID 查询用户
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("数据库查询失败: %w", err)
	}
	if user == nil {
		return fmt.Errorf("用户不存在")
	}

	newHashedPassword, _ := security.HashPassword(newPassword)
	user.PasswordHash = newHashedPassword

	return s.userRepo.Update(ctx, user)
}

// CheckEmailExists 实现了检查邮箱是否存在的业务逻辑
func (s *authService) CheckEmailExists(ctx context.Context, email string) (bool, error) {
	user, err := s.userRepo.FindByEmail(ctx, email)
	if err != nil {
		return false, fmt.Errorf("查询邮箱时数据库出错: %w", err)
	}
	return user != nil, nil
}

// GetUserByID 通过用户ID获取用户信息
func (s *authService) GetUserByID(ctx context.Context, userID uint) (*model.User, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("查询用户信息失败: %w", err)
	}
	if user == nil {
		return nil, fmt.Errorf("用户不存在")
	}
	return user, nil
}
