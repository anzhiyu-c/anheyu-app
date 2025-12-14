// ent/schema/linktag.go
package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

// LinkTag holds the schema definition for the LinkTag entity.
// This will create a non-conflicting "link_tags" table.
type LinkTag struct {
	ent.Schema
}

// Annotations of the LinkTag.
func (LinkTag) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("友链标签表"),
	}
}

// Fields of the LinkTag.
func (LinkTag) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").
			Comment("标签名称").
			Unique().
			NotEmpty(),
		field.String("color").
			Comment("标签颜色 (e.g., #ff0000)").
			Default("#666666"),
	}
}

// Edges of the LinkTag.
func (LinkTag) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("links", Link.Type).
			Ref("tags"),
	}
}
