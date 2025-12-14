/*
 * @Description: 访问统计数据表
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

// VisitorStat 访问统计表，记录每天的访问数据
type VisitorStat struct {
	ent.Schema
}

// Annotations of the VisitorStat.
func (VisitorStat) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("每日访问统计表"),
	}
}

// Fields of the VisitorStat.
func (VisitorStat) Fields() []ent.Field {
	return []ent.Field{
		field.Uint("id"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
		field.Time("date").
			Comment("统计日期（只到天）"),
		field.Int64("unique_visitors").
			Default(0).
			Comment("当日独立访客数"),
		field.Int64("total_views").
			Default(0).
			Comment("当日总访问量"),
		field.Int64("page_views").
			Default(0).
			Comment("当日页面浏览量"),
		field.Int64("bounce_count").
			Default(0).
			Comment("当日跳出次数"),
	}
}

// Indexes of the VisitorStat.
func (VisitorStat) Indexes() []ent.Index {
	return []ent.Index{
		// 日期唯一索引，确保每天只有一条记录，同时用于快速查询
		index.Fields("date").Unique(),
	}
}
