/*
 * @Description: 用户通知配置Schema
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

// UserNotificationConfig holds the schema definition for the UserNotificationConfig entity.
type UserNotificationConfig struct {
	ent.Schema
}

// Annotations of the UserNotificationConfig.
func (UserNotificationConfig) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("用户通知配置表"),
	}
}

// Fields of the UserNotificationConfig.
func (UserNotificationConfig) Fields() []ent.Field {
	return []ent.Field{
		field.Uint("id"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),

		// 用户ID
		field.Uint("user_id").
			Comment("用户ID"),

		// 通知类型ID
		field.Uint("notification_type_id").
			Comment("通知类型ID"),

		// 是否启用该类型通知
		field.Bool("is_enabled").
			Default(true).
			Comment("是否启用该类型通知"),

		// 启用的通知渠道（JSON数组，如: ["email", "push"]）
		field.JSON("enabled_channels", []string{}).
			Optional().
			Comment("启用的通知渠道"),

		// 通知邮箱（可选，为空则使用用户邮箱）
		field.String("notification_email").
			MaxLen(100).
			Optional().
			Comment("接收通知的邮箱地址"),

		// 自定义配置（JSON对象，存储特定通知类型的额外配置）
		field.JSON("custom_settings", map[string]interface{}{}).
			Optional().
			Comment("自定义配置"),
	}
}

// Edges of the UserNotificationConfig.
func (UserNotificationConfig) Edges() []ent.Edge {
	return []ent.Edge{
		// 每个配置属于一个用户
		edge.From("user", User.Type).
			Ref("notification_configs").
			Field("user_id").
			Unique().
			Required(),

		// 每个配置关联一个通知类型
		edge.From("notification_type", NotificationType.Type).
			Ref("user_configs").
			Field("notification_type_id").
			Unique().
			Required(),
	}
}

// Indexes of the UserNotificationConfig.
func (UserNotificationConfig) Indexes() []ent.Index {
	return []ent.Index{
		// 用户+通知类型唯一索引
		index.Fields("user_id", "notification_type_id").
			Unique(),
		// 用户ID索引（用于查询用户的所有通知配置）
		index.Fields("user_id"),
	}
}
