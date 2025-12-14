/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-08-18 15:05:27
 * @LastEditTime: 2025-10-02 00:39:21
 * @LastEditors: 安知鱼
 */
// ent/schema/link.go
package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

// Link holds the schema definition for the Link entity.
type Link struct {
	ent.Schema
}

// Annotations of the Link.
func (Link) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("友情链接表"),
	}
}

// Fields of the Link.
func (Link) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").Comment("网站名称").NotEmpty(),
		field.String("url").Comment("网站链接").NotEmpty(),
		field.String("logo").Comment("网站头像/Logo").Optional(),
		field.String("description").Comment("网站介绍").Optional(),
		field.Enum("status").
			Comment("友链状态").
			Values("PENDING", "APPROVED", "REJECTED", "INVALID").
			Default("PENDING"),
		field.String("siteshot").
			Comment("网站快照的 URL").
			Optional(),
		field.String("email").
			Comment("联系邮箱").
			Optional(),
		field.Enum("type").
			Comment("申请类型").
			Values("NEW", "UPDATE").
			Optional(),
		field.String("original_url").
			Comment("修改类型时的原友链URL").
			Optional(),
		field.Text("update_reason").
			Comment("修改类型时的修改原因").
			Optional(),
		field.Int("sort_order").
			Comment("排序权重，数字越小越靠前").
			Default(0),
		field.Bool("skip_health_check").
			Comment("是否跳过健康检查").
			Default(false),
	}
}

// Edges of the Link.
func (Link) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("category", LinkCategory.Type).
			Ref("links").
			Unique().
			Required(),

		edge.To("tags", LinkTag.Type).
			StorageKey(edge.Table("link_tag_pivot")),
	}
}
