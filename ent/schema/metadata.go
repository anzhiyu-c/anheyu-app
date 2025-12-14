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

// Metadata holds the schema definition for the Metadata entity.
type Metadata struct {
	ent.Schema
}

// Annotations of the Metadata.
func (Metadata) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("文件元数据表"),
	}
}

// Mixin of the Metadata.
func (Metadata) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.SoftDeleteMixin{}, // 它也支持软删除
	}
}

// Fields of the Metadata.
func (Metadata) Fields() []ent.Field {
	return []ent.Field{
		field.Uint("id"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
		field.String("name").
			MaxLen(255).
			NotEmpty(),
		field.Text("value").
			Optional(),
		field.Uint("file_id"),
	}
}

// Edges of the Metadata.
func (Metadata) Edges() []ent.Edge {
	return []ent.Edge{
		// 定义一个元数据项属于一个文件的关系
		edge.From("file", File.Type).
			Ref("metadata").
			Unique().
			Required().
			Field("file_id"),
	}
}

// Indexes of the Metadata.
func (Metadata) Indexes() []ent.Index {
	return []ent.Index{
		// 对应 idx_file_meta_name 唯一索引
		index.Fields("file_id", "name").
			Unique(),
	}
}
