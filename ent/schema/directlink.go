/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-12 18:36:17
 * @LastEditTime: 2025-07-12 18:36:21
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

// DirectLink holds the schema definition for the DirectLink entity.
type DirectLink struct {
	ent.Schema
}

// Annotations of the DirectLink.
func (DirectLink) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("文件直链表"),
	}
}

// Mixin of the DirectLink.
func (DirectLink) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.SoftDeleteMixin{}, // 它也支持软删除
	}
}

// Fields of the DirectLink.
func (DirectLink) Fields() []ent.Field {
	return []ent.Field{
		field.Uint("id"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
		field.Uint("file_id").
			Unique(). // 确保一个文件只有一个直链
			Comment("关联的文件ID"),
		field.String("file_name").
			MaxLen(255).
			NotEmpty().
			Comment("快照的文件名"),
		field.Int64("speed_limit").
			Default(0).
			Comment("速度限制(B/s), 0为不限制"),
		field.Int64("downloads").
			Default(0).
			Comment("下载次数"),
	}
}

// Edges of the DirectLink.
func (DirectLink) Edges() []ent.Edge {
	return []ent.Edge{
		// 定义一个直链属于一个文件的关系
		edge.From("file", File.Type).
			Ref("direct_link").
			Unique().         // 一个直链只对应一个文件
			Required().       // 必须有关联的文件
			Field("file_id"), // 使用 file_id 作为外键
	}
}
