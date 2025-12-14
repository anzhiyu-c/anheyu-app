// internal/app/handler/comment/dto/dto.go
package dto

import "time"

// CreateRequest 定义了创建评论的API请求体。
// 它现在使用 TargetPath 来标识评论所属的页面。
type CreateRequest struct {
	// 评论所属的目标路径，例如文章的 "/posts/my-first-article" 或关于页面的 "/about"
	TargetPath string `json:"target_path" binding:"required,max=255"`

	// 目标页面的标题，可选。前端可以传递此参数，以便在后台管理中更直观地展示。
	TargetTitle *string `json:"target_title" binding:"omitempty,max=255"`

	// 父评论的公共ID，用于实现回复功能。如果为顶级评论，则此项为 null。
	ParentID *string `json:"parent_id"`

	// 回复目标评论的公共ID，用于构建对话链。如果直接回复顶级评论，可以与 ParentID 相同或为 null。
	ReplyToID *string `json:"reply_to_id"`

	// 评论者的昵称。
	Nickname string `json:"nickname" binding:"required,min=2,max=50"`

	// 评论者的邮箱，用于接收回复通知。
	Email *string `json:"email" binding:"omitempty,email"`

	// 评论者的个人网站。
	Website *string `json:"website" binding:"omitempty,url"`

	// 评论的 Markdown 原文内容。
	Content string `json:"content" binding:"required,min=1,max=1000"`

	// 是否为匿名评论（前端明确标识）。
	IsAnonymous bool `json:"is_anonymous"`
}

// AdminListRequest 定义了管理员在后台查询评论列表时使用的参数。
type AdminListRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"pageSize"`

	// 按昵称模糊搜索。
	Nickname *string `form:"nickname"`

	// 按邮箱模糊搜索。
	Email *string `form:"email"`

	// 按评论所属的目标路径模糊搜索。
	TargetPath *string `form:"target_path"`

	// 按IP地址模糊搜索。
	IPAddress *string `form:"ip_address"`

	// 按评论内容模糊搜索。
	Content *string `form:"content"`

	// 按评论状态筛选 (1: 已发布, 2: 待审核)。
	Status *int `form:"status" binding:"omitempty,oneof=1 2"`
}

// DeleteRequest 定义了批量删除评论的API请求体。
type DeleteRequest struct {
	IDs []string `json:"ids" binding:"required"`
}

// UpdateStatusRequest 定义了更新评论状态的API请求体。
type UpdateStatusRequest struct {
	Status int `json:"status" binding:"required,oneof=1 2"` // 1: 已发布, 2: 待审核
}

// SetPinRequest 定义了设置评论置顶状态的API请求体。
type SetPinRequest struct {
	Pinned *bool `json:"pinned" binding:"required"`
}

// UpdateContentRequest 定义了更新评论内容的API请求体。
type UpdateContentRequest struct {
	Content string `json:"content" binding:"required,min=1,max=1000"` // 更新后的 Markdown 内容
}

// Response 定义了单条评论的API响应结构。
// 这个结构是为前端展示专门设计的。
type Response struct {
	ID             string      `json:"id"`
	CreatedAt      time.Time   `json:"created_at"`
	PinnedAt       *time.Time  `json:"pinned_at,omitempty"`
	Nickname       string      `json:"nickname"`
	EmailMD5       string      `json:"email_md5"`
	QQNumber       *string     `json:"qq_number,omitempty"`  // QQ号（如果邮箱是QQ邮箱格式，用于前端显示QQ头像）
	AvatarURL      *string     `json:"avatar_url,omitempty"` // 用户自定义头像URL（如果有关联用户且用户上传了头像）
	Website        *string     `json:"website,omitempty"`
	ContentHTML    string      `json:"content_html"`
	IsAdminComment bool        `json:"is_admin_comment"`
	IsAnonymous    bool        `json:"is_anonymous"`
	IPLocation     string      `json:"ip_location,omitempty"`
	UserAgent      *string     `json:"user_agent,omitempty"`
	TargetPath     string      `json:"target_path"`            // 返回评论所属的路径
	TargetTitle    *string     `json:"target_title,omitempty"` // 返回目标页面的标题
	ParentID       *string     `json:"parent_id,omitempty"`
	ReplyToID      *string     `json:"reply_to_id,omitempty"`
	ReplyToNick    *string     `json:"reply_to_nick,omitempty"`
	LikeCount      int         `json:"like_count"`
	TotalChildren  int64       `json:"total_children"`
	Children       []*Response `json:"children,omitempty"`

	// --- 仅限管理员视图的字段 ---
	Email     *string `json:"email,omitempty"`
	IPAddress *string `json:"ip_address,omitempty"`
	Content   *string `json:"content,omitempty"` // Markdown原文
	Status    *int    `json:"status,omitempty"`
}

// ListResponse 定义了评论列表的API响应结构。
type ListResponse struct {
	List              []*Response `json:"list"`
	Total             int64       `json:"total"`               // 根评论总数（用于分页）
	TotalWithChildren int64       `json:"total_with_children"` // 包含所有子评论的总数（用于前端显示）
	Page              int         `json:"page"`
	PageSize          int         `json:"pageSize"`
}

// UploadImageResponse 是评论图片上传成功后返回的数据结构。
type UploadImageResponse struct {
	ID string `json:"id"`
}
