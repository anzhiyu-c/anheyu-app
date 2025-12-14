package schema

import (
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

// Entity holds the schema definition for the Entity entity.
type Entity struct {
	ent.Schema
}

// Annotations of the Entity.
func (Entity) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("存储实体表，存储物理文件信息"),
	}
}

// Fields of the Entity.
func (Entity) Fields() []ent.Field {
	return []ent.Field{
		field.Uint("id"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
		field.String("type").
			Comment("存储内容的类型 (文件、图片、视频等)"),
		field.Text("source").
			Optional().
			Nillable().
			Comment("文件内容的来源路径或键 (如OSS ObjectKey, 本地路径)"),
		field.Int64("size").
			Comment("物理存储的文件大小 (字节)"),
		field.String("upload_session_id").
			MaxLen(255).
			Optional().
			Nillable().
			Comment("关联的上传会话ID"),
		field.Text("recycle_options").
			Optional().
			Nillable().
			SchemaType(map[string]string{
				dialect.MySQL:    "json",
				dialect.Postgres: "jsonb",
				dialect.SQLite:   "text",
			}).
			Comment("回收选项 (如保留时间)"),
		field.Uint("policy_id").
			Comment("关联的存储策略ID"),
		field.Uint64("created_by").
			Optional().
			Nillable().
			Comment("创建此存储实体的用户ID"),
		field.String("etag").
			MaxLen(255).
			Optional().
			Nillable().
			Comment("存储实体的ETag/哈希值"),
		field.String("mime_type").
			MaxLen(100).
			Optional().
			Nillable().
			Comment("文件的MIME类型"),
		field.String("dimension").
			MaxLen(50).
			Optional().
			Nillable().
			Comment("媒体文件尺寸 (如 '1920x1080'), 非媒体文件为空"),
		field.Other("storage_metadata", model.JSONMap{}).
			SchemaType(map[string]string{
				dialect.MySQL:    "json",
				dialect.Postgres: "jsonb",
				dialect.SQLite:   "text",
			}).
			Optional().
			Comment("存储提供者特有的额外元数据"),
	}
}

// Edges of the Entity.
func (Entity) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("file_versions", FileEntity.Type),
	}
}
