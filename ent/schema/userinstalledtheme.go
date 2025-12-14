/*
 * @Description: 用户已安装主题实体定义（优化版）
 * @Author: 安知鱼
 * @Date: 2025-09-18 11:00:00
 * @LastEditTime: 2025-09-18 18:25:00
 * @LastEditors: 安知鱼
 *
 * 设计原则：
 * 1. 只存储本地必需的信息
 * 2. 主题详细信息（名称、作者、描述等）从外部API实时获取
 * 3. 减少数据冗余，确保信息一致性
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
	"entgo.io/ent/schema/index"
)

// UserInstalledTheme holds the schema definition for the UserInstalledTheme entity.
type UserInstalledTheme struct {
	ent.Schema
}

// Annotations of the UserInstalledTheme.
func (UserInstalledTheme) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("用户已安装主题表"),
	}
}

// Mixin of the UserInstalledTheme.
func (UserInstalledTheme) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.SoftDeleteMixin{},
	}
}

// Fields of the UserInstalledTheme.
func (UserInstalledTheme) Fields() []ent.Field {
	return []ent.Field{
		field.Uint("id"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
		field.Uint("user_id").
			Comment("用户ID"),
		field.String("theme_name").
			MaxLen(100).
			NotEmpty().
			Comment("主题名称（对应themes目录下的文件夹名，也是外部API的主题标识）"),
		field.Int("theme_market_id").
			Optional().
			Comment("主题商城中的ID（用于关联外部API数据）"),
		field.Bool("is_current").
			Default(false).
			Comment("是否为当前使用主题"),
		field.Time("install_time").
			Default(time.Now).
			Comment("安装时间"),
		field.JSON("user_theme_config", map[string]interface{}{}).
			Optional().
			Comment("用户个性化主题配置（覆盖默认配置）"),
		field.String("installed_version").
			MaxLen(50).
			Optional().
			Comment("安装时的版本号（用于版本检查和更新提醒）"),
	}
}

// Edges of the UserInstalledTheme.
func (UserInstalledTheme) Edges() []ent.Edge {
	return []ent.Edge{
		// 定义主题属于某个用户的关系
		edge.From("user", User.Type).
			Ref("installed_themes").
			Field("user_id").
			Unique().
			Required(),
	}
}

// Indexes of the UserInstalledTheme.
func (UserInstalledTheme) Indexes() []ent.Index {
	return []ent.Index{
		// 用户ID和是否当前主题的复合索引
		index.Fields("user_id", "is_current"),
		// 主题名称索引
		index.Fields("theme_name"),
		// 用户ID和主题名称的唯一复合索引（确保用户不会重复安装同一个主题）
		index.Fields("user_id", "theme_name").Unique(),
		// 主题商城ID索引（用于快速查找）
		index.Fields("theme_market_id"),
	}
}
