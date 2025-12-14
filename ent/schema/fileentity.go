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

// FileEntity holds the schema definition for the FileEntity entity.
type FileEntity struct {
	ent.Schema
}

// Annotations of the FileEntity.
func (FileEntity) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("文件版本关联表，关联逻辑文件和存储实体"),
	}
}

func (FileEntity) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.SoftDeleteMixin{},
	}
}

// Fields of the FileEntity.
func (FileEntity) Fields() []ent.Field {
	return []ent.Field{
		field.Uint("id"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
		field.Uint("file_id").
			Comment("关联的逻辑文件ID"),
		field.Uint("entity_id").
			Comment("关联的物理存储实体ID"),
		field.String("version").
			MaxLen(50).
			Optional().
			Nillable().
			Comment("文件版本标识"),
		field.Bool("is_current").
			Default(true).
			Comment("是否是逻辑文件的当前激活版本"),
		field.Uint64("uploaded_by_user_id").
			Optional().
			Nillable().
			Comment("此版本上传用户ID"),
	}
}

// Edges of the FileEntity.
func (FileEntity) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("file", File.Type).
			Ref("versions").
			Unique().
			Required().
			Field("file_id"),

		edge.From("entity", Entity.Type).
			Ref("file_versions").
			Unique().
			Required().
			Field("entity_id"),
	}
}
