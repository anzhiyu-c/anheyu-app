// ent/schema/article.go

/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-25 09:51:07
 * @LastEditTime: 2025-08-13 19:01:58
 * @LastEditors: 安知鱼
 */
package schema

import (
	"time"

	"github.com/anzhiyu-c/anheyu-app/ent/schema/mixin"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// Article holds the schema definition for the Article entity.
type Article struct {
	ent.Schema
}

// Annotations of the Article.
func (Article) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("文章表"),
	}
}

// Mixin of the Article.
func (Article) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.SoftDeleteMixin{},
	}
}

// Fields of the Article.
func (Article) Fields() []ent.Field {
	return []ent.Field{
		// --- 基础字段 ---
		field.Uint("id"),
		field.Uint("owner_id").
			Comment("文章作者ID，关联到users表").
			Default(1), // 默认值为管理员ID(1)
		field.Time("created_at").Default(time.Now),
		field.Time("updated_at").Default(time.Now),
		field.String("title").Default("").Comment("文章标题"),
		field.Text("content_md").Comment("文章的 Markdown 原文").Optional(),
		field.Text("content_html").Comment("由 content_md 解析和净化后的 HTML").Optional(),
		field.String("cover_url").Comment("封面图URL").Optional(),
		field.Enum("status").Values("DRAFT", "PUBLISHED", "ARCHIVED", "SCHEDULED").Default("DRAFT"),
		field.Int("view_count").Comment("浏览次数").Default(0).NonNegative(),
		field.Int("word_count").Comment("总字数").Default(0).NonNegative(),
		field.Int("reading_time").Comment("阅读时长(分钟)").Default(0).NonNegative(),
		field.String("ip_location").Comment("作者IP属地").Optional(),
		field.String("primary_color").
			Comment("主色调，取自 top_img_url 或 cover_url").
			Optional().
			Default("#b4bfe2"),
		field.Bool("is_primary_color_manual").
			Comment("主色调是否为手动设置").
			Default(false),
		field.Bool("show_on_home").
			Comment("是否在首页显示，发布后默认显示在首页").
			Default(true),
		field.Int("home_sort").
			Comment("首页推荐文章排序，0 表示不展示，>0 表示展示，数值越小越靠前").
			Default(0).
			NonNegative(),
		field.Int("pin_sort").
			Comment("置顶排序，0 表示不置顶，>0 表示置顶，数值越小越靠前").
			Default(0).
			NonNegative(),
		field.String("top_img_url").
			Comment("顶部图URL，可选。若不填，则在保存时自动使用封面图URL").
			Optional(),
		field.JSON("summaries", []string{}).
			Comment("文章摘要列表，用于随机摘要功能").
			Optional(),
		field.String("abbrlink").
			Comment("永久链接，用于替换ID，需要保证唯一性").
			Optional().
			Unique().
			Nillable(),
		field.Bool("copyright").
			Comment("是否显示版权信息").
			Default(true),
		field.Bool("is_reprint").
			Comment("是否为转载文章").
			Default(false),
		field.String("copyright_author").
			Comment("版权作者").
			Optional(),
		field.String("copyright_author_href").
			Comment("版权作者链接").
			Optional(),
		field.String("copyright_url").
			Comment("版权来源链接").
			Optional(),
		field.String("keywords").
			Comment("文章关键词，用于SEO优化").
			Optional(),

		// --- 定时发布相关字段 ---
		field.Time("scheduled_at").
			Comment("定时发布时间，当status为SCHEDULED时有效").
			Optional().
			Nillable(),

		// --- 审核相关字段（多人共创功能） ---
		field.Enum("review_status").
			Values("NONE", "PENDING", "APPROVED", "REJECTED").
			Comment("审核状态：NONE-无需审核, PENDING-待审核, APPROVED-已通过, REJECTED-已拒绝").
			Default("NONE"),
		field.String("review_comment").
			Comment("审核意见").
			Optional(),
		field.Time("reviewed_at").
			Comment("审核时间").
			Optional().
			Nillable(),
		field.Uint("reviewed_by").
			Comment("审核人ID").
			Optional().
			Nillable(),

		// --- 下架相关字段（PRO版管理员功能） ---
		field.Bool("is_takedown").
			Comment("是否已下架：下架后前台不显示，后台可见").
			Default(false),
		field.String("takedown_reason").
			Comment("下架原因").
			Optional(),
		field.Time("takedown_at").
			Comment("下架时间").
			Optional().
			Nillable(),
		field.Uint("takedown_by").
			Comment("下架操作人ID").
			Optional().
			Nillable(),

		// --- 扩展配置字段 ---
		field.JSON("extra_config", map[string]interface{}{}).
			Optional().
			Comment("文章扩展配置（JSON格式，用于存储各种可选功能配置，如 enable_ai_podcast 等）"),

		// --- 会员权益相关字段 ---
		field.Bool("exclude_from_membership").
			Comment("是否排除在会员权益外：true表示会员也需要单独购买此文章").
			Default(false),

		// --- 文档模式相关字段 ---
		field.Bool("is_doc").
			Comment("是否为文档模式：文档模式的文章会在文档页面展示").
			Default(false),
		field.Uint("doc_series_id").
			Comment("文档系列ID，关联到doc_series表").
			Optional().
			Nillable(),
		field.Int("doc_sort").
			Comment("文档在系列中的排序，数值越小越靠前").
			Default(0).
			NonNegative(),

		// --- 版权区域按钮显示控制字段 ---
		field.Bool("show_reward_button").
			Comment("是否显示打赏作者按钮").
			Default(true),
		field.Bool("show_share_button").
			Comment("是否显示分享按钮").
			Default(true),
		field.Bool("show_subscribe_button").
			Comment("是否显示订阅按钮").
			Default(true),
	}
}

// Indexes of the Article.
func (Article) Indexes() []ent.Index {
	return []ent.Index{
		// 前台列表查询：已发布+未删除+未下架+审核状态+首页显示
		index.Fields("deleted_at", "status", "is_takedown", "review_status", "show_on_home"),
		// 排序索引
		index.Fields("deleted_at", "status", "pin_sort", "created_at"),
		// 归档查询
		index.Fields("deleted_at", "status", "created_at"),
		// 文档模式查询
		index.Fields("deleted_at", "is_doc", "doc_series_id", "doc_sort"),
		// 作者查询
		index.Fields("deleted_at", "owner_id", "status"),
	}
}

// Edges of the Article.
func (Article) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("post_tags", PostTag.Type),
		edge.To("post_categories", PostCategory.Type),
		edge.To("comments", Comment.Type),
		edge.To("histories", ArticleHistory.Type),
		edge.From("doc_series", DocSeries.Type).
			Ref("articles").
			Field("doc_series_id").
			Unique(),
	}
}
