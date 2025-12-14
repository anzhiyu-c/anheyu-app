// ent/schema/comment.go
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

// Comment 定义了 Comment 实体（即数据库中的评论表）的结构。
type Comment struct {
	ent.Schema
}

// Annotations of the Comment.
func (Comment) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("评论表"),
	}
}

// Mixin 为 Comment 实体混入可重用的功能。
// 这里我们使用 SoftDeleteMixin 来实现软删除，而不是真正从数据库中删除记录。
func (Comment) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.SoftDeleteMixin{},
	}
}

// Fields 定义了 Comment 实体的所有字段。
func (Comment) Fields() []ent.Field {
	return []ent.Field{
		field.Uint("id"),
		field.Time("created_at").
			Default(time.Now).
			Immutable().
			Comment("创建时间"),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now).
			Comment("更新时间"),

		// --- 核心关联字段 ---
		field.String("target_path").
			MaxLen(255).
			Comment("评论所属的目标路径 (例如 /posts/some-slug)"),
		field.String("target_title").
			MaxLen(255).
			Optional().
			Nillable().
			Comment("目标页面的标题，用于在后台管理界面展示"),

		// --- 用户及父评论关系 ---
		field.Uint("user_id").
			Optional().
			Nillable().
			Comment("关联的用户ID (如果是登录用户)"),
		field.Uint("parent_id").
			Optional().
			Nillable().
			Comment("父评论ID (用于嵌套回复)"),
		field.Uint("reply_to_id").
			Optional().
			Nillable().
			Comment("回复目标评论ID (用于构建对话链，直接回复顶级评论时与parent_id相同)"),

		// --- 评论者信息 ---
		field.String("nickname").
			NotEmpty().
			MaxLen(50).
			Comment("评论者昵称"),
		field.String("email").
			Optional().
			Nillable().
			MaxLen(100).
			Comment("评论者邮箱 (用于接收回复通知)"),
		field.String("email_md5").
			MaxLen(32).
			Comment("邮箱的MD5哈希值 (用于Gravatar头像)"),
		field.String("website").
			Optional().
			Nillable().
			MaxLen(255).
			Comment("评论者个人网站链接"),

		// --- 评论内容 ---
		field.Text("content").
			NotEmpty().
			Comment("评论内容 (Markdown格式)"),
		field.Text("content_html").
			NotEmpty().
			Comment("经后端安全处理后的HTML格式评论内容"),

		// --- 状态与元数据 ---
		field.Int("status").
			Default(2). // 1: 已发布, 2: 待审核
			Comment("评论状态 1:已发布 2:待审核"),
		field.Bool("is_admin_comment").
			Default(false).
			Comment("是否为博主/管理员的评论"),
		field.Bool("is_anonymous").
			Default(false).
			Comment("是否为匿名评论（使用匿名邮箱发表的评论）"),

		// --- 环境信息 ---
		field.String("user_agent").
			Optional().
			Nillable().
			MaxLen(512).
			Comment("评论者的 User Agent 信息"),
		field.String("ip_address").
			MaxLen(45).
			Comment("评论者的IP地址"),
		field.String("ip_location").
			Optional().
			Nillable().
			MaxLen(255).
			Comment("IP地址归属地"),

		// --- 交互数据 ---
		field.Int("like_count").
			Default(0).
			Min(0).
			Comment("点赞数"),

		// --- 置顶 ---
		field.Time("pinned_at").
			Comment("评论置顶时间，为NULL表示未置顶").
			Optional().
			Nillable(),
	}
}

// Edges 定义了实体间的关系（边）。
func (Comment) Edges() []ent.Edge {
	return []ent.Edge{
		// 定义了与 User 的 "多对一" 关系。
		edge.From("user", User.Type).
			Ref("comments").
			Field("user_id").
			Unique(),

		// 定义了自引用关系，用于实现评论的嵌套结构。
		// 'parent' 指向这条评论所回复的评论。
		// 'children' 指向所有回复这条评论的评论。
		edge.To("parent", Comment.Type).
			From("children").
			Field("parent_id").
			Unique(),
	}
}

// Indexes 定义了数据库索引，用于优化查询性能。
func (Comment) Indexes() []ent.Index {
	return []ent.Index{
		// 核心索引：高效地查找特定路径下的所有评论。
		index.Fields("target_path", "status"),

		// 高效地查找某个评论的所有子评论。
		index.Fields("parent_id"),

		// 高效地查找某个用户的所有评论。
		index.Fields("user_id"),

		// 用于通过邮箱查找评论者（可选）。
		index.Fields("email"),
	}
}
