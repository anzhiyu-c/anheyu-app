package schema

import (
	"time"

	"github.com/anzhiyu-c/anheyu-app/ent/schema/mixin"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

// UserGroup holds the schema definition for the UserGroup entity.
type UserGroup struct {
	ent.Schema
}

// Annotations of the UserGroup.
func (UserGroup) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("用户组表"),
	}
}

// Mixin of the UserGroup.
func (UserGroup) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.SoftDeleteMixin{},
	}
}

// Fields of the UserGroup.
func (UserGroup) Fields() []ent.Field {
	return []ent.Field{
		field.Uint("id"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
		field.String("name").
			MaxLen(50).
			NotEmpty().
			Comment("用户组名称/角色名称"),
		field.String("description").
			MaxLen(255).
			Optional().
			Comment("用户组描述/角色描述"),
		field.Other("permissions", model.Boolset{}).
			SchemaType(map[string]string{
				dialect.MySQL:    "text",
				dialect.Postgres: "text",
				dialect.SQLite:   "text",
			}).
			Comment("权限集, Base64编码的字节"),
		field.Int64("max_storage").
			Default(0).
			Comment("用户组的最大存储容量（字节）, 0为不限制"),
		field.Int64("speed_limit").
			Default(0).
			Comment("用户组的最大上传速度（字节/秒）, 0为不限制"),
		field.Other("settings", &model.GroupSettings{}).
			Default(&model.GroupSettings{}).
			SchemaType(map[string]string{
				dialect.MySQL:    "json",
				dialect.Postgres: "jsonb",
				dialect.SQLite:   "text",
			}).
			Comment("用户组的特定JSON配置"),
		field.JSON("storage_policy_ids", []uint{}).
			Optional().
			Comment("该用户组可使用的存储策略ID列表"),
	}
}

// Edges of the UserGroup.
func (UserGroup) Edges() []ent.Edge {
	return []ent.Edge{
		// 定义一对多关系：一个用户组可以有多个用户
		edge.To("users", User.Type).
			// 在这里定义外键列名
			// 这会告诉 Ent，在 users 表中创建或使用名为 user_group_id 的列
			StorageKey(edge.Column("user_group_id")),
	}
}
