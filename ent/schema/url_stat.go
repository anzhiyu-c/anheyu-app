/*
 * @Description: URL访问统计表
 * @Author: 安知鱼
 * @Date: 2025-01-20 15:30:00
 * @LastEditTime: 2025-01-20 15:30:00
 * @LastEditors: 安知鱼
 */
package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// URLStat URL访问统计表，记录每个URL的访问统计
type URLStat struct {
	ent.Schema
}

// Annotations of the URLStat.
func (URLStat) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("URL访问统计表"),
	}
}

// Fields of the URLStat.
func (URLStat) Fields() []ent.Field {
	return []ent.Field{
		field.Uint("id"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
		field.String("url_path").
			MaxLen(500).
			Comment("URL路径"),
		field.String("page_title").
			MaxLen(255).
			Optional().
			Nillable().
			Comment("页面标题"),
		field.Int64("total_views").
			Default(0).
			Comment("总访问量"),
		field.Int64("unique_views").
			Default(0).
			Comment("独立访问量"),
		field.Int64("bounce_count").
			Default(0).
			Comment("跳出次数"),
		field.Float("avg_duration").
			Default(0).
			Comment("平均停留时间（秒）"),
		field.Time("last_visited_at").
			Optional().
			Nillable().
			Comment("最后访问时间"),
	}
}

// Indexes of the URLStat.
func (URLStat) Indexes() []ent.Index {
	return []ent.Index{
		// URL路径唯一索引
		index.Fields("url_path").Unique(),
		// 总访问量索引，用于排序
		index.Fields("total_views"),
		// 最后访问时间索引
		index.Fields("last_visited_at"),
	}
}
