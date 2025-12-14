/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-13 01:44:31
 * @LastEditTime: 2025-08-17 03:11:16
 * @LastEditors: 安知鱼
 */
package schema

import (
	"time"

	"github.com/anzhiyu-c/anheyu-app/ent/schema/mixin"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
)

// StoragePolicy holds the schema definition for the StoragePolicy entity.
type StoragePolicy struct {
	ent.Schema
}

// Annotations of the StoragePolicy.
func (StoragePolicy) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("存储策略表"),
	}
}

// Mixin of the StoragePolicy.
func (StoragePolicy) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.SoftDeleteMixin{},
	}
}

// Fields of the StoragePolicy.
func (StoragePolicy) Fields() []ent.Field {
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
			NotEmpty().
			Comment("策略名称，在未删除的策略中必须唯一"),
		field.String("type").
			MaxLen(255).
			NotEmpty().
			Comment("存储类型, 如 local, onedrive"),
		field.String("flag").
			MaxLen(255).
			Optional().
			Unique().
			Comment("策略标志，如 article_image, comment_image"),
		field.String("server").
			MaxLen(255).
			Optional().
			Comment("S3 Endpoint 或 Onedrive API URL"),
		field.String("bucket_name").
			MaxLen(255).
			Optional().
			Comment("存储桶名称或 Onedrive Drive ID"),
		field.Bool("is_private").
			Optional().
			Comment("存储空间是否为私有"),
		field.Text("access_key").
			Optional().
			Comment("访问密钥 (Access Key)"),
		field.Text("secret_key").
			Optional().
			Comment("私有密钥 (Secret Key)"),
		field.Int64("max_size").
			Optional().
			Comment("允许上传的最大文件尺寸 (Bytes)，0为不限制"),
		field.String("base_path").
			MaxLen(255).
			Optional().
			Comment("物理基础路径 (本地路径、云存储前缀等)"),
		field.String("virtual_path").
			MaxLen(255).
			Optional().
			Comment("系统内的虚拟挂载路径"),
		field.Other("settings", model.StoragePolicySettings{}).
			SchemaType(map[string]string{
				dialect.MySQL:    "json",
				dialect.Postgres: "jsonb",
				dialect.SQLite:   "text",
			}).
			Optional().
			Comment("其他设置，以 JSON 格式存储"),
		field.Uint("node_id").
			Optional().
			Nillable().
			Comment("关联的挂载点 ID"),
	}
}
