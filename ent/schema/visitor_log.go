/*
 * @Description: 访问日志表，记录每次访问的详细信息
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

// VisitorLog 访问日志表，记录详细的访问信息
type VisitorLog struct {
	ent.Schema
}

// Annotations of the VisitorLog.
func (VisitorLog) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("访问日志表"),
	}
}

// Fields of the VisitorLog.
func (VisitorLog) Fields() []ent.Field {
	return []ent.Field{
		field.Uint("id"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.String("visitor_id").
			MaxLen(255).
			Comment("访客唯一标识（基于IP+UA生成的hash）"),
		field.String("session_id").
			MaxLen(255).
			Optional().
			Nillable().
			Comment("会话ID"),
		field.String("ip_address").
			MaxLen(45).
			Comment("访客IP地址"),
		field.String("user_agent").
			MaxLen(500).
			Optional().
			Nillable().
			Comment("用户代理字符串"),
		field.String("referer").
			MaxLen(500).
			Optional().
			Nillable().
			Comment("来源页面"),
		field.String("url_path").
			MaxLen(500).
			Comment("访问的URL路径"),
		field.String("country").
			MaxLen(100).
			Optional().
			Nillable().
			Comment("访客所在国家"),
		field.String("region").
			MaxLen(100).
			Optional().
			Nillable().
			Comment("访客所在地区"),
		field.String("city").
			MaxLen(100).
			Optional().
			Nillable().
			Comment("访客所在城市"),
		field.String("browser").
			MaxLen(100).
			Optional().
			Nillable().
			Comment("浏览器类型"),
		field.String("os").
			MaxLen(100).
			Optional().
			Nillable().
			Comment("操作系统"),
		field.String("device").
			MaxLen(100).
			Optional().
			Nillable().
			Comment("设备类型"),
		field.Int("duration").
			Default(0).
			Comment("页面停留时间（秒）"),
		field.Bool("is_bounce").
			Default(false).
			Comment("是否为跳出访问"),
	}
}

// Indexes of the VisitorLog.
func (VisitorLog) Indexes() []ent.Index {
	return []ent.Index{
		// 访客ID索引
		index.Fields("visitor_id"),
		// 会话ID索引
		index.Fields("session_id"),
		// IP地址索引
		index.Fields("ip_address"),
		// URL路径索引
		index.Fields("url_path"),
		// 创建时间索引，用于按时间查询
		index.Fields("created_at"),
		// 复合索引：按日期和访客ID查询
		index.Fields("created_at", "visitor_id"),
	}
}
