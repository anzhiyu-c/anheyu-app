/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-25 10:47:59
 * @LastEditTime: 2025-08-14 12:12:04
 * @LastEditors: 安知鱼
 */
package model

import "time"

// --- 核心领域对象 (Domain Object) ---

// Article 是文章的核心领域模型，业务逻辑（Service层）围绕它进行。
type Article struct {
	ID                   string
	OwnerID              uint // 文章作者ID（多人共创功能）
	CreatedAt            time.Time
	UpdatedAt            time.Time
	Title                string
	ContentMd            string
	ContentHTML          string
	CoverURL             string
	Status               string
	ViewCount            int
	WordCount            int
	ReadingTime          int
	IPLocation           string
	PrimaryColor         string
	IsPrimaryColorManual bool
	ShowOnHome           bool
	PostTags             []*PostTag
	PostCategories       []*PostCategory
	HomeSort             int
	PinSort              int
	TopImgURL            string
	Summaries            []string
	Abbrlink             string
	Copyright            bool
	CopyrightAuthor      string
	CopyrightAuthorHref  string
	CopyrightURL         string
	Keywords             string

	// --- 审核相关字段（多人共创功能） ---
	ReviewStatus  string     // 审核状态：NONE-无需审核, PENDING-待审核, APPROVED-已通过, REJECTED-已拒绝
	ReviewComment string     // 审核意见
	ReviewedAt    *time.Time // 审核时间
	ReviewedBy    *uint      // 审核人ID

	// --- 下架相关字段（PRO版管理员功能） ---
	IsTakedown     bool       // 是否已下架
	TakedownReason string     // 下架原因
	TakedownAt     *time.Time // 下架时间
	TakedownBy     *uint      // 下架操作人ID
}

// --- API 数据传输对象 (Data Transfer Objects) ---

// CreateArticleRequest 定义了创建文章的请求体
type CreateArticleRequest struct {
	Title                string   `json:"title" binding:"required"`
	ContentMd            string   `json:"content_md"`
	CoverURL             string   `json:"cover_url"`
	Status               string   `json:"status" binding:"omitempty,oneof=DRAFT PUBLISHED ARCHIVED"`
	PostTagIDs           []string `json:"post_tag_ids"`
	PostCategoryIDs      []string `json:"post_category_ids"`
	IPLocation           string   `json:"ip_location,omitempty"`
	ShowOnHome           *bool    `json:"show_on_home,omitempty"`
	HomeSort             int      `json:"home_sort"`
	PinSort              int      `json:"pin_sort"`
	TopImgURL            string   `json:"top_img_url"`
	Summaries            []string `json:"summaries"`
	PrimaryColor         string   `json:"primary_color"`
	IsPrimaryColorManual *bool    `json:"is_primary_color_manual"`
	Abbrlink             string   `json:"abbrlink,omitempty"`
	Copyright            *bool    `json:"copyright,omitempty"`
	CopyrightAuthor      string   `json:"copyright_author,omitempty"`
	CopyrightAuthorHref  string   `json:"copyright_author_href,omitempty"`
	CopyrightURL         string   `json:"copyright_url,omitempty"`
	ContentHTML          string   `json:"content_html"`
	CustomPublishedAt    *string  `json:"custom_published_at,omitempty"`
	CustomUpdatedAt      *string  `json:"custom_updated_at,omitempty"`
	Keywords             string   `json:"keywords,omitempty"`
	OwnerID              uint     `json:"owner_id,omitempty"`      // 文章作者ID（多人共创功能）
	ReviewStatus         string   `json:"review_status,omitempty"` // 审核状态（多人共创功能）
}

// UpdateArticleRequest 定义了更新文章的请求体
type UpdateArticleRequest struct {
	Title                *string  `json:"title"`
	ContentMd            *string  `json:"content_md"`
	CoverURL             *string  `json:"cover_url"`
	Status               *string  `json:"status" binding:"omitempty,oneof=DRAFT PUBLISHED ARCHIVED"`
	PostTagIDs           []string `json:"post_tag_ids"`
	PostCategoryIDs      []string `json:"post_category_ids"`
	IPLocation           *string  `json:"ip_location"`
	ShowOnHome           *bool    `json:"show_on_home"`
	HomeSort             *int     `json:"home_sort"`
	PinSort              *int     `json:"pin_sort"`
	TopImgURL            *string  `json:"top_img_url"`
	Summaries            []string `json:"summaries"`
	PrimaryColor         *string  `json:"primary_color"`
	IsPrimaryColorManual *bool    `json:"is_primary_color_manual"`
	Abbrlink             *string  `json:"abbrlink"`
	Copyright            *bool    `json:"copyright"`
	CopyrightAuthor      *string  `json:"copyright_author"`
	CopyrightAuthorHref  *string  `json:"copyright_author_href"`
	CopyrightURL         *string  `json:"copyright_url"`
	ContentHTML          *string  `json:"content_html"`
	CustomPublishedAt    *string  `json:"custom_published_at,omitempty"`
	CustomUpdatedAt      *string  `json:"custom_updated_at,omitempty"`
	Keywords             *string  `json:"keywords"`
	ReviewStatus         *string  `json:"review_status,omitempty"` // 审核状态（多人共创功能）
}

// ArticleResponse 定义了文章信息的标准 API 响应结构
type ArticleResponse struct {
	ID                   string                  `json:"id"`
	CreatedAt            time.Time               `json:"created_at"`
	UpdatedAt            time.Time               `json:"updated_at"`
	Title                string                  `json:"title"`
	ContentMd            string                  `json:"content_md,omitempty"`
	ContentHTML          string                  `json:"content_html,omitempty"`
	CoverURL             string                  `json:"cover_url"`
	Status               string                  `json:"status"`
	ViewCount            int                     `json:"view_count"`
	WordCount            int                     `json:"word_count"`
	ReadingTime          int                     `json:"reading_time"`
	IPLocation           string                  `json:"ip_location"`
	PrimaryColor         string                  `json:"primary_color"`
	IsPrimaryColorManual bool                    `json:"is_primary_color_manual"`
	ShowOnHome           bool                    `json:"show_on_home"`
	PostTags             []*PostTagResponse      `json:"post_tags"`
	PostCategories       []*PostCategoryResponse `json:"post_categories"`
	HomeSort             int                     `json:"home_sort"`
	PinSort              int                     `json:"pin_sort"`
	TopImgURL            string                  `json:"top_img_url"`
	Summaries            []string                `json:"summaries"`
	Abbrlink             string                  `json:"abbrlink"`
	Copyright            bool                    `json:"copyright"`
	CopyrightAuthor      string                  `json:"copyright_author"`
	CopyrightAuthorHref  string                  `json:"copyright_author_href"`
	CopyrightURL         string                  `json:"copyright_url"`
	Keywords             string                  `json:"keywords"`
	CommentCount         int                     `json:"comment_count"`
	// 审核状态（多人共创功能）
	ReviewStatus string `json:"review_status,omitempty"` // 审核状态：NONE-无需审核, PENDING-待审核, APPROVED-已通过, REJECTED-已拒绝
	// 发布者信息（多人共创功能）
	OwnerID       uint   `json:"owner_id,omitempty"`       // 发布者ID
	OwnerName     string `json:"owner_name,omitempty"`     // 发布者名称（已废弃，使用 owner_nickname）
	OwnerNickname string `json:"owner_nickname,omitempty"` // 发布者昵称（用户个人中心的 nickname）
	OwnerAvatar   string `json:"owner_avatar,omitempty"`   // 发布者头像
	OwnerEmail    string `json:"owner_email,omitempty"`    // 发布者邮箱
	// 下架状态（PRO版管理员功能）
	IsTakedown     bool       `json:"is_takedown,omitempty"`     // 是否已下架
	TakedownReason string     `json:"takedown_reason,omitempty"` // 下架原因
	TakedownAt     *time.Time `json:"takedown_at,omitempty"`     // 下架时间
	TakedownBy     *uint      `json:"takedown_by,omitempty"`     // 下架操作人ID
}

// 用于上一篇/下一篇/相关文章的简化信息响应
type SimpleArticleResponse struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	CoverURL  string    `json:"cover_url"`
	Abbrlink  string    `json:"abbrlink"`
	CreatedAt time.Time `json:"created_at"`
}

// 用于文章详情页的完整响应，包含上下文文章
type ArticleDetailResponse struct {
	ArticleResponse
	PrevArticle     *SimpleArticleResponse   `json:"prev_article"`
	NextArticle     *SimpleArticleResponse   `json:"next_article"`
	RelatedArticles []*SimpleArticleResponse `json:"related_articles"`
}

// ArticleListResponse 定义了文章列表的 API 响应结构
type ArticleListResponse struct {
	List     []ArticleResponse `json:"list"`
	Total    int64             `json:"total"`
	Page     int               `json:"page"`
	PageSize int               `json:"pageSize"`
}

type ListArticlesOptions struct {
	Page        int
	PageSize    int
	Query       string // 用于模糊搜索标题
	Status      string // 按状态过滤
	WithContent bool   // 是否在列表中包含 ContentMd
	AuthorID    *uint  // 按作者ID过滤（多人共创功能：普通用户只能查看自己的文章）
}

type ListPublicArticlesOptions struct {
	Page         int
	PageSize     int
	CategoryName string `json:"categoryName"`
	TagName      string `json:"tagName"`
	Year         int    `json:"year"`
	Month        int    `json:"month"`
}

type SiteStats struct {
	TotalPosts int
	TotalWords int
}

// UpdateArticleComputedParams 封装了更新文章时，因内容变化而需要重新计算并持久化的数据。
type UpdateArticleComputedParams struct {
	WordCount            int
	ReadingTime          int
	PrimaryColor         *string // 使用指针以区分 "未更新" 和 "更新为空"
	IsPrimaryColorManual *bool
	ContentHTML          string
}

// CreateArticleParams 封装了创建文章时需要持久化的所有数据。
type CreateArticleParams struct {
	Title                string
	OwnerID              uint // 文章作者ID（多人共创功能）
	ContentMd            string
	ContentHTML          string
	CoverURL             string
	Status               string
	PostTagIDs           []uint
	PostCategoryIDs      []uint
	WordCount            int
	ReadingTime          int
	IPLocation           string
	PrimaryColor         string
	IsPrimaryColorManual bool
	ShowOnHome           bool
	HomeSort             int
	PinSort              int
	TopImgURL            string
	Summaries            []string
	Abbrlink             string
	Copyright            bool
	CopyrightAuthor      string
	CopyrightAuthorHref  string
	CopyrightURL         string
	CustomPublishedAt    *time.Time
	CustomUpdatedAt      *time.Time
	Keywords             string
	ReviewStatus         string // 审核状态（多人共创功能）：NONE-无需审核, PENDING-待审核
}

// 用于解析颜色 API 响应的结构体
type ColorAPIResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		RGB string `json:"RGB"`
	} `json:"data"`
}

// ArchiveItem 代表一个归档月份及其文章数量
type ArchiveItem struct {
	Year  int `json:"year"`
	Month int `json:"month"`
	Count int `json:"count"`
}

// ArchiveSummaryResponse 定义了归档摘要列表的响应
type ArchiveSummaryResponse struct {
	List []*ArchiveItem `json:"list"`
}
