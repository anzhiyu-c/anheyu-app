/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-12 16:10:44
 * @LastEditTime: 2025-07-12 16:31:17
 * @LastEditors: 安知鱼
 */
package schema

import (
	"time"

	"github.com/anzhiyu-c/anheyu-app/ent/schema/mixin"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
)

// Setting holds the schema definition for the Setting entity.
type Setting struct {
	ent.Schema
}

// Annotations of the Setting.
func (Setting) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("系统设置表"),
	}
}

func (Setting) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.SoftDeleteMixin{},
	}
}

// Fields of the Setting.
func (Setting) Fields() []ent.Field {
	return []ent.Field{
		field.String("config_key").
			MaxLen(100).
			Unique().
			NotEmpty().
			Immutable().
			Comment("配置键"),

		field.Text("value").
			Comment("配置值"),

		field.String("comment").
			MaxLen(255).
			Optional().
			Comment("配置注释"),

		field.Time("created_at").
			Default(time.Now).
			Immutable(),

		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}

// Edges of the Setting.
func (Setting) Edges() []ent.Edge {
	// Setting 模型通常是独立的，没有与其他模型的关联，所以这里返回 nil
	return nil
}
