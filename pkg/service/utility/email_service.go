// internal/app/service/utility/email_service.go
package utility

import (
	"bytes"
	"context"
	"crypto/md5"
	"crypto/tls"
	"fmt"
	"html/template"
	"log"
	"net"
	"net/smtp"
	"strconv"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/notification"
	parser_service "github.com/anzhiyu-c/anheyu-app/pkg/service/parser"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
)

// EmailService 定义了发送业务邮件的接口
type EmailService interface {
	SendActivationEmail(ctx context.Context, toEmail, nickname, userID, sign string) error
	SendForgotPasswordEmail(ctx context.Context, toEmail, nickname, userID, sign string) error
	// --- 修改点 1: 移除接口签名中的 targetMeta 参数 ---
	SendCommentNotification(newComment *model.Comment, parentComment *model.Comment)
	SendTestEmail(ctx context.Context, toEmail string) error
	// SendLinkApplicationNotification 发送友链申请通知邮件给站长
	SendLinkApplicationNotification(ctx context.Context, link *model.LinkDTO) error
	// SendLinkReviewNotification 发送友链审核通知
	SendLinkReviewNotification(ctx context.Context, link *model.LinkDTO, isApproved bool, rejectReason string) error
	// SendVerificationEmail 发送验证码邮件
	SendVerificationEmail(ctx context.Context, toEmail, code string) error
	// SendArticlePushEmail 发送文章更新推送邮件
	SendArticlePushEmail(ctx context.Context, toEmail, unsubscribeToken string, article *model.Article) error
}

// emailService 是 EmailService 接口的实现
type emailService struct {
	settingSvc      setting.SettingService
	notificationSvc notification.Service
	parserSvc       *parser_service.Service
}

type authEmailTemplateData map[string]interface{}

// NewEmailService 是 emailService 的构造函数
func NewEmailService(settingSvc setting.SettingService, notificationSvc notification.Service, parserSvc *parser_service.Service) EmailService {
	return &emailService{
		settingSvc:      settingSvc,
		notificationSvc: notificationSvc,
		parserSvc:       parserSvc,
	}
}

// SendTestEmail 负责发送一封测试邮件
func (s *emailService) SendTestEmail(ctx context.Context, toEmail string) error {
	appName := s.settingSvc.Get(constant.KeyAppName.String())
	siteURL := s.settingSvc.Get(constant.KeySiteURL.String())

	// 🔧 处理 siteURL，确保有效
	if siteURL == "" || siteURL == "https://" || siteURL == "http://" {
		log.Printf("[WARNING] 站点URL未正确配置（当前值: %s），使用默认值 https://anheyu.com", siteURL)
		siteURL = "https://anheyu.com"
	}
	siteURL = strings.TrimRight(siteURL, "/")

	subject := fmt.Sprintf("这是一封来自「%s」的测试邮件", appName)
	body := fmt.Sprintf(`<p>你好！</p>
	<p>这是一封来自 <a href="%s">%s</a> 的测试邮件。</p>
	<p>如果您收到了这封邮件，那么证明您的网站邮件服务配置正确。</p>`, siteURL, appName)

	return s.send(toEmail, subject, body)
}

// SendLinkApplicationNotification 发送友链申请邮件通知给站长
func (s *emailService) SendLinkApplicationNotification(ctx context.Context, link *model.LinkDTO) error {
	if link == nil {
		return fmt.Errorf("无法发送友链申请邮件通知：link 为 nil")
	}

	notifyAdmin := s.settingSvc.GetBool(constant.KeyFriendLinkNotifyAdmin.String())
	if !notifyAdmin {
		log.Printf("[DEBUG] 友链申请邮件通知未开启（notifyAdmin=false），跳过发送")
		return nil
	}

	adminEmail := strings.TrimSpace(s.settingSvc.Get(constant.KeyFrontDeskSiteOwnerEmail.String()))
	if adminEmail == "" {
		log.Printf("[WARNING] 站长邮箱未配置（frontDesk.siteOwner.email 为空），无法发送友链申请通知邮件")
		return nil
	}

	pushChannel := strings.TrimSpace(s.settingSvc.Get(constant.KeyFriendLinkPushooChannel.String()))
	scMailNotify := s.settingSvc.GetBool(constant.KeyFriendLinkScMailNotify.String())

	// 如果配置了即时通知且未开启双重通知，则跳过邮件发送
	if pushChannel != "" && !scMailNotify {
		log.Printf("[DEBUG] 已配置友链即时通知且未开启双重通知（scMailNotify=false），跳过邮件通知")
		return nil
	}

	appName := s.settingSvc.Get(constant.KeyAppName.String())
	siteURL := s.settingSvc.Get(constant.KeySiteURL.String())

	// 🔧 处理 siteURL，确保有效
	if siteURL == "" || siteURL == "https://" || siteURL == "http://" {
		log.Printf("[WARNING] 站点URL未正确配置（当前值: %s），使用默认值 https://anheyu.com", siteURL)
		siteURL = "https://anheyu.com"
	}
	siteURL = strings.TrimRight(siteURL, "/")

	adminURL := buildFriendLinkAdminURL(siteURL)

	subjectTpl := s.settingSvc.Get(constant.KeyFriendLinkMailSubjectAdmin.String())
	if subjectTpl == "" {
		subjectTpl = "{{.SITE_NAME}} 收到了来自 {{.LINK_NAME}} 的友链申请"
	}

	bodyTpl := s.settingSvc.Get(constant.KeyFriendLinkMailTemplateAdmin.String())
	if bodyTpl == "" {
		bodyTpl = `<p>您好！</p>
<p>您的网站 <strong>{{.SITE_NAME}}</strong> 收到了一个新的友链申请：</p>
<ul>
	<li>网站名称：{{.LINK_NAME}}</li>
	<li>网站地址：<a href="{{.LINK_URL}}">{{.LINK_URL}}</a></li>
	<li>网站描述：{{.LINK_DESC}}</li>
</ul>
<p>申请时间：{{.TIME}}</p>
<p><a href="{{.ADMIN_URL}}">点击前往友链管理后台查看详情</a></p>`
	}

	data := map[string]interface{}{
		"SITE_NAME":     appName,
		"SITE_URL":      siteURL,
		"ADMIN_URL":     adminURL,
		"LINK_NAME":     link.Name,
		"LINK_URL":      link.URL,
		"LINK_LOGO":     link.Logo,
		"LINK_DESC":     link.Description,
		"LINK_EMAIL":    link.Email,
		"LINK_SITESHOT": link.Siteshot,
		"APPLY_TYPE":    link.Type,
		"ORIGINAL_URL":  link.OriginalURL,
		"UPDATE_REASON": link.UpdateReason,
		"TIME":          time.Now().Format("2006-01-02 15:04:05"),
	}

	subject, err := renderTemplate(subjectTpl, data)
	if err != nil {
		return fmt.Errorf("渲染友链申请邮件主题失败: %w", err)
	}

	body, err := renderTemplate(bodyTpl, data)
	if err != nil {
		return fmt.Errorf("渲染友链申请邮件正文失败: %w", err)
	}

	go func() {
		if err := s.send(adminEmail, subject, body); err != nil {
			log.Printf("[ERROR] 发送友链申请通知邮件失败: %v", err)
		} else {
			log.Printf("[INFO] 友链申请通知邮件已发送到: %s", adminEmail)
		}
	}()

	return nil
}

// SendCommentNotification 实现了发送评论通知的逻辑
func (s *emailService) SendCommentNotification(newComment *model.Comment, parentComment *model.Comment) {
	ctx := context.Background()
	log.Printf("[DEBUG] SendCommentNotification 开始执行，评论ID: %d", newComment.ID)

	siteName := s.settingSvc.Get(constant.KeyAppName.String())
	siteURL := s.settingSvc.Get(constant.KeySiteURL.String())

	// 🔧 处理 siteURL，确保有效
	if siteURL == "" || siteURL == "https://" || siteURL == "http://" {
		log.Printf("[WARNING] 站点URL未正确配置（当前值: %s），使用默认值 https://anheyu.com", siteURL)
		siteURL = "https://anheyu.com"
	}
	// 移除末尾的斜杠，避免双斜杠
	siteURL = strings.TrimRight(siteURL, "/")

	pageURL := siteURL + newComment.TargetPath
	log.Printf("[DEBUG] 生成页面链接: %s", pageURL)

	var targetTitle string
	if newComment.TargetTitle != nil {
		targetTitle = *newComment.TargetTitle
	} else {
		targetTitle = "一个页面"
	}

	gravatarURL := s.settingSvc.Get(constant.KeyGravatarURL.String())
	// 确保 gravatarURL 包含 /avatar 路径
	gravatarURL = strings.TrimRight(gravatarURL, "/") + "/avatar/"
	defaultGravatar := s.settingSvc.Get(constant.KeyDefaultGravatarType.String())

	var newCommentHTML string
	if s.parserSvc != nil {
		var err error
		newCommentHTML, err = s.parserSvc.ToHTML(ctx, newComment.Content)
		if err != nil {
			log.Printf("[WARNING] 解析新评论内容失败，将使用原始内容: %v", err)
			newCommentHTML = newComment.Content
		}
	} else {
		// 如果 parserSvc 为空，直接使用原始内容
		newCommentHTML = newComment.Content
	}
	var newCommenterEmail string
	var newCommentEmailMD5 string
	if newComment.Author.Email != nil {
		newCommenterEmail = *newComment.Author.Email
		newCommentEmailMD5 = fmt.Sprintf("%x", md5.Sum([]byte(strings.ToLower(newCommenterEmail))))
	}

	log.Printf("[DEBUG] 新评论者邮箱: %s, 是否有父评论: %t", newCommenterEmail, parentComment != nil)

	// --- 场景一：通知博主有新评论 ---
	adminEmail := s.settingSvc.Get(constant.KeyFrontDeskSiteOwnerEmail.String())
	bloggerEmail := s.settingSvc.Get(constant.KeyCommentBloggerEmail.String())
	primaryAdminEmail := bloggerEmail
	if primaryAdminEmail == "" {
		primaryAdminEmail = adminEmail
	}
	notifyAdmin := s.settingSvc.GetBool(constant.KeyCommentNotifyAdmin.String())
	pushChannel := s.settingSvc.Get(constant.KeyPushooChannel.String())
	scMailNotify := s.settingSvc.GetBool(constant.KeyScMailNotify.String())

	log.Printf("[DEBUG] 邮件通知配置: adminEmail=%s, bloggerEmail=%s, primaryAdminEmail=%s, notifyAdmin=%t, pushChannel=%s, scMailNotify=%t",
		adminEmail, bloggerEmail, primaryAdminEmail, notifyAdmin, pushChannel, scMailNotify)

	// 邮件通知逻辑：
	// 1. 如果没有配置即时通知，按原来的逻辑发送邮件
	// 2. 如果配置了即时通知但开启了双重通知，也发送邮件
	// 3. 如果配置了即时通知但没有开启双重通知，则不发送邮件
	shouldSendEmail := notifyAdmin && (pushChannel == "" || scMailNotify)
	isAdminEmail := func(email string) bool {
		if email == "" {
			return false
		}
		if bloggerEmail != "" && strings.EqualFold(email, bloggerEmail) {
			return true
		}
		if adminEmail != "" && strings.EqualFold(email, adminEmail) {
			return true
		}
		return false
	}

	// 检查新评论是否来自管理员本人
	isAdminComment := newComment.IsAdminAuthor
	if !isAdminComment && newCommenterEmail != "" {
		isAdminComment = isAdminEmail(newCommenterEmail)
	}

	log.Printf("[DEBUG] 场景一检查: shouldSendEmail=%t, isAdminComment=%t", shouldSendEmail, isAdminComment)

	if primaryAdminEmail != "" && shouldSendEmail && !isAdminComment {
		log.Printf("[DEBUG] 准备发送博主通知邮件到: %s", primaryAdminEmail)
		adminSubjectTpl := s.settingSvc.Get(constant.KeyCommentMailSubjectAdmin.String())
		adminBodyTpl := s.settingSvc.Get(constant.KeyCommentMailTemplateAdmin.String())

		data := map[string]interface{}{
			"SITE_NAME":    siteName,
			"SITE_URL":     siteURL,
			"POST_URL":     pageURL,
			"TARGET_TITLE": targetTitle,
			"NICK":         newComment.Author.Nickname,
			"COMMENT":      template.HTML(newCommentHTML),
			"MAIL":         newCommenterEmail,
			"IP":           newComment.Author.IP,
			"IMG":          fmt.Sprintf("%s%s?d=%s", gravatarURL, newCommentEmailMD5, defaultGravatar),
		}

		subject, _ := renderTemplate(adminSubjectTpl, data)
		body, _ := renderTemplate(adminBodyTpl, data)
		go func() { _ = s.send(primaryAdminEmail, subject, body) }()
		log.Printf("[DEBUG] 博主通知邮件已分发")
	} else {
		log.Printf("[DEBUG] 跳过博主通知: primaryAdminEmail=%s, shouldSendEmail=%t, isAdminComment=%t",
			primaryAdminEmail, shouldSendEmail, isAdminComment)
	}

	// --- 场景二：通知被回复者 ---
	notifyReply := s.settingSvc.GetBool(constant.KeyCommentNotifyReply.String())

	// 邮件通知逻辑：与博主通知保持一致
	// 1. 如果没有配置即时通知，按原来的逻辑发送邮件
	// 2. 如果配置了即时通知但开启了双重通知，也发送邮件
	// 3. 如果配置了即时通知但没有开启双重通知，则不发送邮件
	shouldSendReplyEmail := notifyReply && (pushChannel == "" || scMailNotify)

	log.Printf("[DEBUG] 场景二检查: notifyReply=%t, shouldSendReplyEmail=%t", notifyReply, shouldSendReplyEmail)

	//核心修改：检查被回复用户的实时通知设置，而不是评论创建时的设置
	userAllowNotification := true // 默认允许（游客评论）
	if shouldSendReplyEmail && parentComment != nil && parentComment.Author.Email != nil && *parentComment.Author.Email != "" {
		// 如果父评论有关联的用户ID，查询该用户的实时通知设置
		if parentComment.UserID != nil {
			ctx := context.Background()
			userSettings, err := s.notificationSvc.GetUserNotificationSettings(ctx, *parentComment.UserID)
			if err != nil {
				log.Printf("警告：获取用户通知设置失败（用户ID: %d），使用默认值 true: %v", *parentComment.UserID, err)
			} else {
				userAllowNotification = userSettings.AllowCommentReplyNotification
				log.Printf("[DEBUG] 用户 %d 的实时通知偏好设置: %t", *parentComment.UserID, userAllowNotification)
			}
		}

		parentEmail := *parentComment.Author.Email
		log.Printf("[DEBUG] 父评论信息: parentEmail=%s, 用户实时通知设置=%t", parentEmail, userAllowNotification)

		// 如果用户关闭了通知，跳过
		if !userAllowNotification {
			log.Printf("[DEBUG] 用户已关闭回复通知，跳过")
			return
		}

		if newCommenterEmail != "" && newCommenterEmail == parentEmail {
			log.Printf("[DEBUG] 自己回复自己，跳过回复通知")
			return
		}
		// 如果被回复者是管理员，且管理员已经收到博主通知，避免重复
		if isAdminEmail(parentEmail) && shouldSendEmail && !isAdminComment {
			log.Printf("[DEBUG] 被回复者是管理员且已收到博主通知，跳过回复通知")
			return
		}

		log.Printf("[DEBUG] 准备发送回复通知邮件到: %s", parentEmail)

		var parentCommentHTML string
		if s.parserSvc != nil {
			var err error
			parentCommentHTML, err = s.parserSvc.ToHTML(ctx, parentComment.Content)
			if err != nil {
				log.Printf("[WARNING] 解析父评论内容失败，将使用原始内容: %v", err)
				parentCommentHTML = parentComment.Content
			}
		} else {
			parentCommentHTML = parentComment.Content
		}
		parentCommentEmailMD5 := fmt.Sprintf("%x", md5.Sum([]byte(strings.ToLower(parentEmail))))

		replySubjectTpl := s.settingSvc.Get(constant.KeyCommentMailSubject.String())
		replyBodyTpl := s.settingSvc.Get(constant.KeyCommentMailTemplate.String())

		data := map[string]interface{}{
			"SITE_NAME":      siteName,
			"SITE_URL":       siteURL,
			"POST_URL":       pageURL,
			"PARENT_NICK":    parentComment.Author.Nickname,
			"PARENT_COMMENT": template.HTML(parentCommentHTML),
			"PARENT_IMG":     fmt.Sprintf("%s%s?d=%s", gravatarURL, parentCommentEmailMD5, defaultGravatar),
			"NICK":           newComment.Author.Nickname,
			"COMMENT":        template.HTML(newCommentHTML),
			"IMG":            fmt.Sprintf("%s%s?d=%s", gravatarURL, newCommentEmailMD5, defaultGravatar),
		}

		subject, _ := renderTemplate(replySubjectTpl, data)
		body, _ := renderTemplate(replyBodyTpl, data)
		go func() { _ = s.send(parentEmail, subject, body) }()
		log.Printf("[DEBUG] 回复通知邮件已分发到: %s", parentEmail)
	}
}

// SendActivationEmail 负责发送激活邮件
func (s *emailService) SendActivationEmail(ctx context.Context, toEmail, nickname, userID, sign string) error {
	subjectTplStr := s.settingSvc.Get(constant.KeyActivateAccountSubject.String())
	bodyTplStr := s.settingSvc.Get(constant.KeyActivateAccountTemplate.String())
	appName := s.settingSvc.Get(constant.KeyAppName.String())
	siteURL := s.settingSvc.Get(constant.KeySiteURL.String())

	// 🔧 处理 siteURL，确保有效
	if siteURL == "" || siteURL == "https://" || siteURL == "http://" {
		log.Printf("[WARNING] 站点URL未正确配置（当前值: %s），使用默认值 https://anheyu.com", siteURL)
		siteURL = "https://anheyu.com"
	}
	siteURL = strings.TrimRight(siteURL, "/")

	activateLink := fmt.Sprintf("%s/activate?id=%s&sign=%s", siteURL, userID, sign)
	data := authEmailTemplateData{
		"Nickname":      nickname,
		"AppName":       appName,
		"ActivateLink":  activateLink,
		"ExpireMinutes": constant.ActivationTokenTTLMinutes,
	}

	subject, err := renderAuthEmailTemplate(subjectTplStr, data)
	if err != nil {
		return fmt.Errorf("渲染激活邮件主题失败: %w", err)
	}
	body, err := renderAuthEmailTemplate(bodyTplStr, data)
	if err != nil {
		return fmt.Errorf("渲染激活邮件正文失败: %w", err)
	}

	if err := s.send(toEmail, subject, body); err != nil {
		return fmt.Errorf("发送激活邮件失败: %w", err)
	}
	return nil
}

// SendForgotPasswordEmail 负责发送重置密码邮件
func (s *emailService) SendForgotPasswordEmail(ctx context.Context, toEmail, nickname, userID, sign string) error {
	subjectTplStr := s.settingSvc.Get(constant.KeyResetPasswordSubject.String())
	bodyTplStr := s.settingSvc.Get(constant.KeyResetPasswordTemplate.String())
	appName := s.settingSvc.Get(constant.KeyAppName.String())
	siteURL := s.settingSvc.Get(constant.KeySiteURL.String())

	// 🔧 处理 siteURL，确保有效
	if siteURL == "" || siteURL == "https://" || siteURL == "http://" {
		log.Printf("[WARNING] 站点URL未正确配置（当前值: %s），使用默认值 https://anheyu.com", siteURL)
		siteURL = "https://anheyu.com"
	}
	siteURL = strings.TrimRight(siteURL, "/")

	resetLink := buildResetPasswordLink(siteURL, userID, sign)
	data := authEmailTemplateData{
		"Nickname":      nickname,
		"AppName":       appName,
		"ResetLink":     resetLink,
		"ExpireMinutes": constant.PasswordResetTokenTTLMinutes,
	}

	subject, err := renderAuthEmailTemplate(subjectTplStr, data)
	if err != nil {
		return fmt.Errorf("渲染重置密码邮件主题失败: %w", err)
	}
	body, err := renderAuthEmailTemplate(bodyTplStr, data)
	if err != nil {
		return fmt.Errorf("渲染重置密码邮件正文失败: %w", err)
	}

	if err := s.send(toEmail, subject, body); err != nil {
		return fmt.Errorf("发送重置密码邮件失败: %w", err)
	}
	return nil
}

func buildResetPasswordLink(siteURL, userID, sign string) string {
	siteURL = strings.TrimRight(siteURL, "/")
	return fmt.Sprintf("%s/forgot-password?id=%s&sign=%s", siteURL, userID, sign)
}

func buildFriendLinkAdminURL(siteURL string) string {
	siteURL = strings.TrimRight(siteURL, "/")
	return fmt.Sprintf("%s/admin/friends", siteURL)
}

// SendLinkReviewNotification 负责发送友链审核通知邮件
func (s *emailService) SendLinkReviewNotification(ctx context.Context, link *model.LinkDTO, isApproved bool, rejectReason string) error {
	// 检查是否开启友链审核邮件通知
	mailEnabled := s.settingSvc.GetBool(constant.KeyFriendLinkReviewMailEnable.String())
	if !mailEnabled {
		log.Printf("[DEBUG] 友链审核邮件通知已关闭，跳过发送")
		return nil
	}

	// 检查友链是否有邮箱
	if link.Email == "" {
		log.Printf("[DEBUG] 友链 %s 没有填写邮箱，跳过邮件通知", link.Name)
		return nil
	}

	appName := s.settingSvc.Get(constant.KeyAppName.String())
	siteURL := s.settingSvc.Get(constant.KeySiteURL.String())

	// 🔧 处理 siteURL，确保有效
	if siteURL == "" || siteURL == "https://" || siteURL == "http://" {
		log.Printf("[WARNING] 站点URL未正确配置（当前值: %s），使用默认值 https://anheyu.com", siteURL)
		siteURL = "https://anheyu.com"
	}
	siteURL = strings.TrimRight(siteURL, "/")

	// 根据审核状态选择不同的模板
	var subjectTplStr, bodyTplStr string
	if isApproved {
		subjectTplStr = s.settingSvc.Get(constant.KeyFriendLinkReviewMailSubjectApproved.String())
		bodyTplStr = s.settingSvc.Get(constant.KeyFriendLinkReviewMailTemplateApproved.String())
		// 如果没有配置模板，使用默认模板
		if subjectTplStr == "" {
			subjectTplStr = "【{{.SITE_NAME}}】友链申请已通过"
		}
		if bodyTplStr == "" {
			bodyTplStr = `<div style="background-color:#f4f5f7;padding:30px 0;">
	<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
		<div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:30px;text-align:center;">
			<h1 style="color:#fff;margin:0;font-size:24px;">友链申请通过通知</h1>
		</div>
		<div style="padding:30px;">
			<p style="font-size:16px;line-height:1.8;color:#333;">亲爱的 <strong>{{.LINK_NAME}}</strong> 站长，您好！</p>
			<p style="font-size:14px;line-height:1.8;color:#666;">恭喜您！您在 <a href="{{.SITE_URL}}" style="color:#667eea;text-decoration:none;">{{.SITE_NAME}}</a> 提交的友链申请已通过审核。</p>
			<div style="background:#f8f9fa;padding:20px;border-radius:6px;margin:20px 0;">
				<h3 style="margin:0 0 15px 0;color:#333;font-size:16px;">友链信息</h3>
				<p style="margin:8px 0;color:#666;"><strong>网站名称：</strong>{{.LINK_NAME}}</p>
				<p style="margin:8px 0;color:#666;"><strong>网站地址：</strong><a href="{{.LINK_URL}}" style="color:#667eea;">{{.LINK_URL}}</a></p>
				<p style="margin:8px 0;color:#666;"><strong>网站描述：</strong>{{.LINK_DESCRIPTION}}</p>
			</div>
			<p style="font-size:14px;line-height:1.8;color:#666;">您的网站现已显示在我们的友链页面中，感谢您的支持与分享！</p>
			<p style="font-size:14px;line-height:1.8;color:#666;">期待与您建立长期的友好关系。</p>
		</div>
		<div style="background:#f8f9fa;padding:20px;text-align:center;color:#999;font-size:12px;">
			<p style="margin:5px 0;">本邮件由系统自动发送，请勿直接回复</p>
			<p style="margin:5px 0;">© {{.SITE_NAME}}</p>
		</div>
	</div>
</div>`
		}
	} else {
		subjectTplStr = s.settingSvc.Get(constant.KeyFriendLinkReviewMailSubjectRejected.String())
		bodyTplStr = s.settingSvc.Get(constant.KeyFriendLinkReviewMailTemplateRejected.String())
		// 如果没有配置模板，使用默认模板
		if subjectTplStr == "" {
			subjectTplStr = "【{{.SITE_NAME}}】友链申请未通过"
		}
		if bodyTplStr == "" {
			bodyTplStr = `<div style="background-color:#f4f5f7;padding:30px 0;">
	<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
		<div style="background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);padding:30px;text-align:center;">
			<h1 style="color:#fff;margin:0;font-size:24px;">友链申请未通过通知</h1>
		</div>
		<div style="padding:30px;">
			<p style="font-size:16px;line-height:1.8;color:#333;">亲爱的 <strong>{{.LINK_NAME}}</strong> 站长，您好！</p>
			<p style="font-size:14px;line-height:1.8;color:#666;">很遗憾地通知您，您在 <a href="{{.SITE_URL}}" style="color:#f5576c;text-decoration:none;">{{.SITE_NAME}}</a> 提交的友链申请未能通过审核。</p>
			<div style="background:#fff3f3;padding:20px;border-radius:6px;margin:20px 0;border-left:4px solid #f5576c;">
				<h3 style="margin:0 0 15px 0;color:#333;font-size:16px;">申请信息</h3>
				<p style="margin:8px 0;color:#666;"><strong>网站名称：</strong>{{.LINK_NAME}}</p>
				<p style="margin:8px 0;color:#666;"><strong>网站地址：</strong><a href="{{.LINK_URL}}" style="color:#f5576c;">{{.LINK_URL}}</a></p>
				<p style="margin:8px 0;color:#666;"><strong>网站描述：</strong>{{.LINK_DESCRIPTION}}</p>
			</div>
			{{if .REJECT_REASON}}
			<div style="background:#fff3f3;padding:20px;border-radius:6px;margin:20px 0;border-left:4px solid #f5576c;">
				<h3 style="margin:0 0 15px 0;color:#333;font-size:16px;">拒绝原因</h3>
				<p style="margin:8px 0;color:#666;line-height:1.6;">{{.REJECT_REASON}}</p>
			</div>
			{{else}}
			<p style="font-size:14px;line-height:1.8;color:#666;">可能的原因包括：网站内容不符合要求、网站无法正常访问、未添加本站友链等。</p>
			{{end}}
			<p style="font-size:14px;line-height:1.8;color:#666;">如有疑问，欢迎与我们联系。</p>
		</div>
		<div style="background:#f8f9fa;padding:20px;text-align:center;color:#999;font-size:12px;">
			<p style="margin:5px 0;">本邮件由系统自动发送，请勿直接回复</p>
			<p style="margin:5px 0;">© {{.SITE_NAME}}</p>
		</div>
	</div>
</div>`
		}
	}

	// 构建模板数据
	data := map[string]interface{}{
		"SITE_NAME":        appName,
		"SITE_URL":         siteURL,
		"LINK_NAME":        link.Name,
		"LINK_URL":         link.URL,
		"LINK_DESCRIPTION": link.Description,
		"LINK_LOGO":        link.Logo,
		"REJECT_REASON":    rejectReason,
	}

	subject, err := renderTemplate(subjectTplStr, data)
	if err != nil {
		return fmt.Errorf("渲染友链审核邮件主题失败: %w", err)
	}
	body, err := renderTemplate(bodyTplStr, data)
	if err != nil {
		return fmt.Errorf("渲染友链审核邮件正文失败: %w", err)
	}

	// 异步发送邮件
	go func() {
		if err := s.send(link.Email, subject, body); err != nil {
			log.Printf("[ERROR] 发送友链审核邮件失败: %v", err)
		} else {
			log.Printf("[INFO] 友链审核邮件已发送到: %s", link.Email)
		}
	}()

	return nil
}

// SendVerificationEmail 发送验证码邮件
func (s *emailService) SendVerificationEmail(ctx context.Context, toEmail, code string) error {
	appName := s.settingSvc.Get(constant.KeyAppName.String())
	siteURL := s.settingSvc.Get(constant.KeySiteURL.String())

	// 🔧 处理 siteURL，确保有效
	if siteURL == "" || siteURL == "https://" || siteURL == "http://" {
		log.Printf("[WARNING] 站点URL未正确配置（当前值: %s），使用默认值 https://anheyu.com", siteURL)
		siteURL = "https://anheyu.com"
	}
	siteURL = strings.TrimRight(siteURL, "/")

	subject := fmt.Sprintf("【%s】订阅验证码： %s", appName, code)
	body := fmt.Sprintf(`<div style="background-color:#f4f5f7;padding:30px 0;">
	<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
		<div style="background:linear-gradient(135deg,#667eea 0%%,#764ba2 100%%);padding:30px;text-align:center;">
			<h1 style="color:#fff;margin:0;font-size:24px;">订阅验证</h1>
		</div>
		<div style="padding:30px;">
			<p style="font-size:16px;line-height:1.8;color:#333;">您好！</p>
			<p style="font-size:14px;line-height:1.8;color:#666;">感谢您订阅 <strong><a href="%s" style="color:#667eea;text-decoration:none;">%s</a></strong> 的文章更新。</p>
			<p style="font-size:14px;line-height:1.8;color:#666;">您的验证码是：</p>
			<div style="background:#f8f9fa;padding:15px;text-align:center;border-radius:6px;margin:20px 0;font-size:24px;font-weight:bold;letter-spacing:4px;color:#333;">
				%s
			</div>
			<p style="font-size:14px;line-height:1.8;color:#000;">该验证码在 5 分钟内有效。</p>
			<p style="font-size:14px;line-height:1.8;color:#666;">如果您没有进行此操作，请忽略此邮件。</p>
		</div>
		<div style="background:#f8f9fa;padding:20px;text-align:center;color:#999;font-size:12px;">
			<p style="margin:5px 0;">本邮件由系统自动发送，请勿直接回复</p>
			<p style="margin:5px 0;">© %s</p>
		</div>
	</div>
</div>`, siteURL, appName, code, appName)

	// 创建30秒超时的context
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	// 在独立goroutine中发送邮件，使用channel接收结果
	errChan := make(chan error, 1)
	go func() {
		errChan <- s.send(toEmail, subject, body)
	}()

	// 等待发送完成或超时
	select {
	case err := <-errChan:
		if err != nil {
			log.Printf("[ERROR] 发送订阅验证码邮件失败: %v", err)
			return fmt.Errorf("发送验证码邮件失败: %w", err)
		}
		log.Printf("[INFO] 订阅验证码邮件已发送到: %s", toEmail)
		return nil
	case <-ctx.Done():
		log.Printf("[ERROR] 发送订阅验证码邮件超时 (30s): %s", toEmail)
		return fmt.Errorf("发送验证码邮件超时，请稍后重试")
	}
}

// SendArticlePushEmail 发送文章更新推送邮件
func (s *emailService) SendArticlePushEmail(ctx context.Context, toEmail, unsubscribeToken string, article *model.Article) error {
	appName := s.settingSvc.Get(constant.KeyAppName.String())
	siteURL := s.settingSvc.Get(constant.KeySiteURL.String())

	// 🔧 处理 siteURL，确保有效
	if siteURL == "" || siteURL == "https://" || siteURL == "http://" {
		log.Printf("[WARNING] 站点URL未正确配置（当前值: %s），使用默认值 https://anheyu.com", siteURL)
		siteURL = "https://anheyu.com"
	}
	siteURL = strings.TrimRight(siteURL, "/")

	// 构建文章链接
	articleID := article.ID
	if article.Abbrlink != "" {
		articleID = article.Abbrlink
	}
	articleURL := fmt.Sprintf("%s/post/%s.html", siteURL, articleID)

	// 构建退订链接
	unsubscribeURL := fmt.Sprintf("%s/api/public/unsubscribe/%s", siteURL, unsubscribeToken)

	// 准备模板数据
	subjectTpl := s.settingSvc.Get(constant.KeyPostSubscribeMailSubject.String())
	if subjectTpl == "" {
		subjectTpl = "【{{.SITE_NAME}}】新文章发布：{{.TITLE}}"
	}

	bodyTpl := s.settingSvc.Get(constant.KeyPostSubscribeMailTemplate.String())
	if bodyTpl == "" {
		// 默认模板
		bodyTpl = `<div style="background-color:#f4f5f7;padding:30px 0;">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
        <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:30px;text-align:center;">
             <h1 style="color:#fff;margin:0;font-size:24px;">新文章发布通知</h1>
        </div>
        <div style="padding:30px;">
            <p style="font-size:16px;line-height:1.8;color:#333;">你好！</p>
            <p style="font-size:14px;line-height:1.8;color:#666;"><strong>{{.SITE_NAME}}</strong> 发布了一篇新文章，快来看看吧：</p>
            
            <div style="margin:20px 0;border:1px solid #eee;border-radius:8px;overflow:hidden;">
                {{if .COVER}}
                <img src="{{.COVER}}" style="width:100%;height:auto;display:block;" alt="{{.TITLE}}">
                {{end}}
                <div style="padding:15px;">
                    <h2 style="font-size:18px;margin:0 0 10px;color:#333;">
                        <a href="{{.URL}}" style="text-decoration:none;color:#333;">{{.TITLE}}</a>
                    </h2>
                    {{if .SUMMARY}}
                    <p style="font-size:14px;color:#666;line-height:1.6;margin:0;">{{.SUMMARY}}</p>
                    {{end}}
                    <div style="margin-top:15px;text-align:right;">
                         <a href="{{.URL}}" style="display:inline-block;padding:8px 20px;background:#667eea;color:#fff;text-decoration:none;border-radius:4px;font-size:14px;">阅读全文</a>
                    </div>
                </div>
            </div>

            <p style="font-size:12px;color:#999;text-align:center;margin-top:30px;border-top:1px solid #eee;padding-top:20px;">
                如果您不想再收到此类邮件，可以 <a href="{{.UNSUBSCRIBE_URL}}" style="color:#999;text-decoration:underline;">点击这里退订</a>
            </p>
        </div>
        <div style="background:#f8f9fa;padding:20px;text-align:center;color:#999;font-size:12px;">
            <p style="margin:5px 0;">© {{.SITE_NAME}}</p>
        </div>
    </div>
</div>`
	}

	// 获取文章摘要（取第一个）
	summary := ""
	if len(article.Summaries) > 0 {
		summary = article.Summaries[0]
	} else if len(article.ContentMd) > 0 {
		// 如果没有摘要，尝试截取正文前100字（简单处理）
		runes := []rune(article.ContentMd)
		if len(runes) > 100 {
			summary = string(runes[:100]) + "..."
		} else {
			summary = string(runes)
		}
	}

	data := map[string]interface{}{
		"SITE_NAME":       appName,
		"SITE_URL":        siteURL,
		"TITLE":           article.Title,
		"SUMMARY":         summary,
		"URL":             articleURL,
		"COVER":           article.CoverURL,
		"UNSUBSCRIBE_URL": unsubscribeURL,
	}

	subject, err := renderTemplate(subjectTpl, data)
	if err != nil {
		return fmt.Errorf("渲染文章推送邮件主题失败: %w", err)
	}
	body, err := renderTemplate(bodyTpl, data)
	if err != nil {
		return fmt.Errorf("渲染文章推送邮件正文失败: %w", err)
	}

	// 异步发送
	go func() {
		if err := s.send(toEmail, subject, body); err != nil {
			log.Printf("[ERROR] 发送文章推送邮件失败 (Email: %s): %v", toEmail, err)
		} else {
			log.Printf("[INFO] 文章推送邮件已发送到: %s", toEmail)
		}
	}()

	return nil
}

// send 是一个底层的、私有的邮件发送函数
func (s *emailService) send(to, subject, body string) error {
	host := s.settingSvc.Get(constant.KeySmtpHost.String())
	portStr := s.settingSvc.Get(constant.KeySmtpPort.String())
	username := s.settingSvc.Get(constant.KeySmtpUsername.String())
	password := s.settingSvc.Get(constant.KeySmtpPassword.String())
	senderName := s.settingSvc.Get(constant.KeySmtpSenderName.String())
	senderEmail := s.settingSvc.Get(constant.KeySmtpSenderEmail.String())
	replyToEmail := s.settingSvc.Get(constant.KeySmtpReplyToEmail.String())
	forceSSL := s.settingSvc.GetBool(constant.KeySmtpForceSSL.String())

	// 验证端口配置是否为数字
	if _, err := strconv.Atoi(portStr); err != nil {
		msg := fmt.Sprintf("SMTP端口配置无效 '%s'", portStr)
		log.Printf("错误: %s: %v", msg, err)
		return fmt.Errorf("%s: %w", msg, err)
	}

	headers := make(map[string]string)
	headers["From"] = fmt.Sprintf("%s <%s>", senderName, senderEmail)
	headers["To"] = to
	headers["Subject"] = subject
	headers["Content-Type"] = "text/html; charset=UTF-8"
	if replyToEmail != "" {
		headers["Reply-To"] = replyToEmail
	}

	var messageBuilder strings.Builder
	for k, v := range headers {
		messageBuilder.WriteString(fmt.Sprintf("%s: %s\r\n", k, v))
	}
	messageBuilder.WriteString("\r\n")
	messageBuilder.WriteString(body)
	message := []byte(messageBuilder.String())

	auth := smtp.PlainAuth("", username, password, host)
	addr := net.JoinHostPort(host, portStr)

	if forceSSL {
		if err := sendMailSSL(addr, auth, senderEmail, []string{to}, message); err != nil {
			log.Printf("错误: [SSL] 发送邮件到 %s 失败: %v", to, err)
			return err
		}
	} else {
		// 使用带超时的拨号（15秒超时）
		conn, err := net.DialTimeout("tcp", addr, 15*time.Second)
		if err != nil {
			log.Printf("错误: [STARTTLS] Dialing failed: %v", err)
			return err
		}

		c, err := smtp.NewClient(conn, host)
		if err != nil {
			conn.Close()
			log.Printf("错误: [STARTTLS] 创建SMTP客户端失败: %v", err)
			return err
		}
		defer c.Close()

		if ok, _ := c.Extension("STARTTLS"); ok {
			tlsConfig := &tls.Config{
				ServerName:         host,
				InsecureSkipVerify: true,
			}
			if err = c.StartTLS(tlsConfig); err != nil {
				log.Printf("错误: [STARTTLS] c.StartTLS failed: %v", err)
				return err
			}
		}

		if auth != nil {
			if err = c.Auth(auth); err != nil {
				log.Printf("错误: [STARTTLS] c.Auth failed: %v", err)
				return err
			}
		}

		if err = c.Mail(senderEmail); err != nil {
			return err
		}
		if err = c.Rcpt(to); err != nil {
			return err
		}

		w, err := c.Data()
		if err != nil {
			return err
		}
		_, err = w.Write(message)
		if err != nil {
			return err
		}
		err = w.Close()
		if err != nil {
			return err
		}

		if err := c.Quit(); err != nil {
			log.Printf("警告: [STARTTLS] SMTP c.Quit() 执行失败: %v。这通常不影响邮件发送。", err)
		}

		return nil
	}
	return nil
}

// renderTemplate 是一个渲染 Go 模板的辅助函数
func renderTemplate(tplStr string, data interface{}) (string, error) {
	tpl, err := template.New("email").Parse(tplStr)
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	if err := tpl.Execute(&buf, data); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// renderAuthEmailTemplate 同时支持后台公开的变量和历史 Go 模板变量。
func renderAuthEmailTemplate(tplStr string, data authEmailTemplateData) (string, error) {
	funcs := template.FuncMap{
		"nick":           func() interface{} { return data["Nickname"] },
		"site_name":      func() interface{} { return data["AppName"] },
		"reset_link":     func() interface{} { return data["ResetLink"] },
		"activate_link":  func() interface{} { return data["ActivateLink"] },
		"expire_minutes": func() interface{} { return data["ExpireMinutes"] },
	}

	tpl, err := template.New("email").Funcs(funcs).Parse(tplStr)
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	if err := tpl.Execute(&buf, data); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// sendMailSSL 是用于处理直接SSL连接的辅助函数
func sendMailSSL(addr string, auth smtp.Auth, from string, to []string, message []byte) error {
	host, port, _ := net.SplitHostPort(addr)
	tlsConfig := &tls.Config{
		InsecureSkipVerify: true,
		ServerName:         host,
		MinVersion:         tls.VersionTLS12, // 最低支持TLS 1.2
	}

	// 设置15秒超时
	dialer := &net.Dialer{
		Timeout: 15 * time.Second,
	}

	log.Printf("[邮件发送] 尝试通过SSL连接到 %s:%s", host, port)
	conn, err := tls.DialWithDialer(dialer, "tcp", addr, tlsConfig)
	if err != nil {
		return fmt.Errorf("TLS拨号失败 (请检查端口是否正确，SSL通常使用465端口): %w", err)
	}
	defer conn.Close()
	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("创建SMTP客户端失败: %w", err)
	}
	defer client.Close()
	if auth != nil {
		if err = client.Auth(auth); err != nil {
			return fmt.Errorf("SMTP认证失败: %w", err)
		}
	}
	if err = client.Mail(from); err != nil {
		return fmt.Errorf("设置发件人失败: %w", err)
	}
	for _, recipient := range to {
		if err = client.Rcpt(recipient); err != nil {
			return fmt.Errorf("设置收件人 %s 失败: %w", recipient, err)
		}
	}
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("获取数据写入器失败: %w", err)
	}
	_, err = w.Write(message)
	if err != nil {
		return fmt.Errorf("写入邮件内容失败: %w", err)
	}
	err = w.Close()
	if err != nil {
		return fmt.Errorf("关闭写入器失败: %w", err)
	}
	if err := client.Quit(); err != nil {
		log.Printf("警告: SMTP client.Quit() 执行失败: %v。这通常不影响邮件发送。", err)
	}
	return nil
}
