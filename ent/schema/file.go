package schema

import (
	"time"

	"github.com/anzhiyu-c/anheyu-app/ent/schema/mixin"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// File holds the schema definition for the File entity.
type File struct {
	ent.Schema
}

// Annotations of the File.
func (File) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("文件表，存储逻辑文件和目录信息"),
	}
}

// Mixin of the File.
func (File) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.SoftDeleteMixin{},
	}
}

// Fields of the File.
func (File) Fields() []ent.Field {
	return []ent.Field{
		field.Uint("id"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
		field.Int("type").
			Comment("文件类型 (1: 文件, 2: 目录)"),
		field.Uint("owner_id").
			Comment("文件所有者的用户ID (外键)"),
		field.Uint("parent_id").
			Optional().
			Nillable().
			Comment("父目录ID (外键，自引用), NULL表示根目录"),
		field.String("name").
			MaxLen(255).
			Comment("文件或目录的名称"),
		field.Int64("size").
			Default(0).
			Comment("文件大小 (单位: 字节)，目录大小为0"),
		field.Uint("primary_entity_id").
			Optional().
			Nillable().
			Comment("关联的物理存储实体ID"),
		field.Int64("children_count").
			Default(0).
			Comment("直属子文件/子目录数量"),
		field.Text("view_config").
			Optional().
			Nillable().
			SchemaType(map[string]string{
				dialect.MySQL:    "json",
				dialect.Postgres: "jsonb",
				dialect.SQLite:   "text",
			}).
			Comment("文件夹视图配置的JSON对象"),
	}
}

// Edges of the File.
func (File) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("owner", User.Type).
			Ref("files").
			Unique().
			Required().
			Field("owner_id"),
		edge.To("parent", File.Type).
			Unique().
			Field("parent_id"),
		edge.From("children", File.Type).
			Ref("parent"),
		edge.To("primary_entity", Entity.Type).
			Unique().
			Field("primary_entity_id"),
		edge.To("versions", FileEntity.Type),
		edge.To("direct_link", DirectLink.Type).
			Unique(),
		edge.To("metadata", Metadata.Type),
	}
}

// Indexes of the File.
func (File) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("parent_id", "name", "owner_id").
			Unique(),
	}
}
