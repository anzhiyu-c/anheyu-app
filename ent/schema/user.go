/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-13 23:40:12
 * @LastEditTime: 2025-10-12 02:14:53
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
)

// User holds the schema definition for the User entity.
type User struct {
	ent.Schema
}

// Annotations of the User.
func (User) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("用户表"),
	}
}

// Mixin of the User.
func (User) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.SoftDeleteMixin{},
	}
}

// Fields of the User.
func (User) Fields() []ent.Field {
	return []ent.Field{
		field.Uint("id"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
		field.String("username").
			MaxLen(50).
			Unique().
			NotEmpty().
			Comment("用户账号"),
		field.String("password_hash").
			MaxLen(255).
			NotEmpty().
			Sensitive(),
		field.String("nickname").
			MaxLen(50).
			Optional().
			Comment("用户昵称"),
		field.String("avatar").
			MaxLen(255).
			Optional().
			Comment("用户头像URL"),
		field.String("email").
			MaxLen(100).
			Unique().
			Optional().
			Comment("用户邮箱"),
		field.String("website").
			MaxLen(255).
			Optional().
			Comment("用户个人网站"),
		field.Time("last_login_at").
			Optional().
			Nillable(),
		field.Int("status").
			Default(2).
			Comment("用户状态 1:正常 2:未激活 3:已封禁"),
	}
}

// Edges of the User.
func (User) Edges() []ent.Edge {
	return []ent.Edge{
		// 定义一个用户属于一个用户组的关系
		edge.From("user_group", UserGroup.Type).
			Ref("users").
			Unique().
			Required(),

		// 定义一个用户可以拥有多个文件的关系
		edge.To("files", File.Type),

		// 定义一个用户可以拥有多个评论的关系
		edge.To("comments", Comment.Type),

		// 定义一个用户可以安装多个主题的关系
		edge.To("installed_themes", UserInstalledTheme.Type),

		// 定义一个用户有多个通知配置的关系
		edge.To("notification_configs", UserNotificationConfig.Type),
	}
}
