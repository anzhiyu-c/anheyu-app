/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-25 11:32:22
 * @LastEditTime: 2025-08-28 13:21:59
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

// PostCategory holds the schema definition for the PostCategory entity.
type PostCategory struct {
	ent.Schema
}

// Annotations of the PostCategory.
func (PostCategory) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("文章分类表"),
	}
}

// Mixin of the PostCategory.
func (PostCategory) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.SoftDeleteMixin{},
	}
}

// Fields of the PostCategory.
func (PostCategory) Fields() []ent.Field {
	return []ent.Field{
		// --- 手动定义基础字段 ---
		field.Uint("id"),

		field.Time("created_at").
			Default(time.Now).
			Immutable(),

		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),

		// --- PostCategory 自身的字段 ---
		field.String("name").
			Comment("分类名称").
			Unique().
			NotEmpty(),

		field.String("description").
			Comment("分类描述").
			Optional(),

		field.Int("count").
			Comment("该分类下的文章数量").
			Default(0).
			NonNegative(),

		field.Bool("is_series").
			Comment("是否为系列").
			Default(false),
	}
}

// Edges of the PostCategory.
func (PostCategory) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("articles", Article.Type).
			Ref("post_categories"),
	}
}
