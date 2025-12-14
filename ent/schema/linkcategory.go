/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-08-18 15:05:01
 * @LastEditTime: 2025-12-02 18:22:51
 * @LastEditors: 安知鱼
 */
// ent/schema/linkcategory.go
package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

// LinkCategory holds the schema definition for the LinkCategory entity.
type LinkCategory struct {
	ent.Schema
}

// Annotations of the LinkCategory.
func (LinkCategory) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("友链分类表"),
	}
}

// Fields of the LinkCategory.
func (LinkCategory) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").
			Comment("分类名称").
			Unique().
			NotEmpty(),
		field.String("description").
			Comment("分类描述").
			Optional(),
		field.Enum("style").
			Comment("分类样式 (card, list)").
			Values("card", "list").
			Default("card"),
	}
}

// Edges of the LinkCategory.
func (LinkCategory) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("links", Link.Type),
	}
}
