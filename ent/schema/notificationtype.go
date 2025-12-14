/*
 * @Description: 通知类型定义Schema
 * @Author: 安知鱼
 * @Date: 2025-10-12
 */
package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// NotificationType holds the schema definition for the NotificationType entity.
type NotificationType struct {
	ent.Schema
}

// Annotations of the NotificationType.
func (NotificationType) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("通知类型表"),
	}
}

// Fields of the NotificationType.
func (NotificationType) Fields() []ent.Field {
	return []ent.Field{
		field.Uint("id"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),

		// 通知类型标识（唯一，如: comment_reply, system_update, order_created）
		field.String("code").
			Unique().
			MaxLen(100).
			Comment("通知类型唯一标识"),

		// 显示名称
		field.String("name").
			MaxLen(100).
			Comment("通知类型显示名称"),

		// 描述
		field.String("description").
			MaxLen(500).
			Optional().
			Comment("通知类型描述"),

		// 分类（comment, system, order, marketing 等）
		field.String("category").
			MaxLen(50).
			Comment("通知类型分类"),

		// 是否启用
		field.Bool("is_active").
			Default(true).
			Comment("是否启用该通知类型"),

		// 默认是否开启（用户首次使用时的默认值）
		field.Bool("default_enabled").
			Default(true).
			Comment("默认是否为用户启用"),

		// 支持的通知渠道（JSON数组，如: ["email", "push", "sms"]）
		field.JSON("supported_channels", []string{}).
			Optional().
			Comment("支持的通知渠道"),
	}
}

// Edges of the NotificationType.
func (NotificationType) Edges() []ent.Edge {
	return []ent.Edge{
		// 一个通知类型可以有多个用户配置
		edge.To("user_configs", UserNotificationConfig.Type),
	}
}

// Indexes of the NotificationType.
func (NotificationType) Indexes() []ent.Index {
	return []ent.Index{
		// 唯一索引
		index.Fields("code").
			Unique(),
		// 分类索引
		index.Fields("category"),
	}
}
