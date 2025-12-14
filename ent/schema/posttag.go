/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-25 11:32:06
 * @LastEditTime: 2025-08-05 10:13:00
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

// PostTag holds the schema definition for the PostTag entity.
type PostTag struct {
	ent.Schema
}

// Annotations of the PostTag.
func (PostTag) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("文章标签表"),
	}
}

// Mixin of the PostTag.
func (PostTag) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.SoftDeleteMixin{},
	}
}

// Fields of the PostTag.
func (PostTag) Fields() []ent.Field {
	return []ent.Field{
		// --- 手动定义基础字段 ---
		field.Uint("id"),

		field.Time("created_at").
			Default(time.Now).
			Immutable(),

		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),

		field.String("name").
			Comment("标签名称").
			Unique().
			NotEmpty(),

		field.Int("count").
			Comment("引用该标签的文章数量").
			Default(0).
			NonNegative(),
	}
}

// Edges of the PostTag.
func (PostTag) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("articles", Article.Type).
			Ref("post_tags"),
	}
}
