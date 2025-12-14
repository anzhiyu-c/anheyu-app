/*
 * @Description: 自定义页面实体
 * @Author: 安知鱼
 * @Date: 2025-01-27 10:00:00
 * @LastEditTime: 2025-01-27 10:00:00
 * @LastEditors: 安知鱼
 */
package schema

import (
	"time"

	"github.com/anzhiyu-c/anheyu-app/ent/schema/mixin"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
)

// Page holds the schema definition for the Page entity.
type Page struct {
	ent.Schema
}

// Annotations of the Page.
func (Page) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("自定义页面表"),
	}
}

func (Page) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.SoftDeleteMixin{},
	}
}

// Fields of the Page.
func (Page) Fields() []ent.Field {
	return []ent.Field{
		field.Uint("id"),
		field.String("title").
			MaxLen(255).
			NotEmpty().
			Comment("页面标题"),

		field.String("path").
			MaxLen(255).
			Unique().
			NotEmpty().
			Comment("页面路径"),

		field.Text("content").
			Comment("HTML内容"),

		field.Text("markdown_content").
			Default("").
			Comment("Markdown原始内容"),

		field.String("description").
			MaxLen(500).
			Optional().
			Comment("页面描述"),

		field.Bool("is_published").
			Default(true).
			Comment("是否发布"),

		field.Bool("show_comment").
			Default(false).
			Comment("是否显示评论"),

		field.Int("sort").
			Default(0).
			Comment("排序"),

		field.Time("created_at").
			Default(time.Now).
			Immutable().
			Comment("创建时间"),

		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now).
			Comment("更新时间"),
	}
}

// Edges of the Page.
func (Page) Edges() []ent.Edge {
	// Page 模型通常是独立的，没有与其他模型的关联，所以这里返回 nil
	return nil
}
