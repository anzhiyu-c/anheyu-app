/*
 * @Description: 数据库迁移服务（处理 SQL 迁移和数据更新）
 * @Author: 安知鱼
 * @Date: 2025-12-08
 */
package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strings"
)

// MigrationService 数据库迁移服务
type MigrationService struct {
	db     *sql.DB
	dbType string
}

// NewMigrationService 创建迁移服务
func NewMigrationService(db *sql.DB, dbType string) *MigrationService {
	return &MigrationService{
		db:     db,
		dbType: dbType,
	}
}

// RunMigrations 执行所有迁移
func (m *MigrationService) RunMigrations(ctx context.Context) error {
	log.Println("📋 开始执行数据库迁移...")

	// 检查并执行 owner_id 字段迁移
	if err := m.migrateOwnerID(ctx); err != nil {
		return fmt.Errorf("owner_id 字段迁移失败: %w", err)
	}

	// 检查并执行审核字段迁移
	if err := m.migrateReviewFields(ctx); err != nil {
		return fmt.Errorf("审核字段迁移失败: %w", err)
	}

	log.Println("✅ 数据库迁移完成")
	return nil
}

// migrateOwnerID 迁移 owner_id 字段
func (m *MigrationService) migrateOwnerID(ctx context.Context) error {
	// 检查字段是否已存在
	exists, err := m.columnExists(ctx, "articles", "owner_id")
	if err != nil {
		return err
	}

	if exists {
		log.Println("  ✓ owner_id 字段已存在，跳过迁移")
		return nil
	}

	log.Println("  → 添加 owner_id 字段...")

	switch m.dbType {
	case "mysql", "mariadb":
		// MySQL/MariaDB 语法
		_, err = m.db.ExecContext(ctx, `
			ALTER TABLE articles
			ADD COLUMN owner_id INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '文章作者ID，关联到users表' AFTER id
		`)
		if err != nil {
			return fmt.Errorf("添加 owner_id 字段失败: %w", err)
		}

		// 为现有文章设置默认作者
		_, err = m.db.ExecContext(ctx, `
			UPDATE articles SET owner_id = 1 WHERE owner_id IS NULL OR owner_id = 0
		`)
		if err != nil {
			return fmt.Errorf("更新现有文章 owner_id 失败: %w", err)
		}

		// 创建索引
		_, err = m.db.ExecContext(ctx, `
			CREATE INDEX idx_articles_owner_id ON articles(owner_id)
		`)
		if err != nil && !strings.Contains(err.Error(), "Duplicate key name") {
			return fmt.Errorf("创建 owner_id 索引失败: %w", err)
		}

	case "postgres":
		// PostgreSQL 语法
		_, err = m.db.ExecContext(ctx, `
			ALTER TABLE articles
			ADD COLUMN IF NOT EXISTS owner_id INTEGER NOT NULL DEFAULT 1
		`)
		if err != nil {
			return fmt.Errorf("添加 owner_id 字段失败: %w", err)
		}

		// 添加注释
		_, err = m.db.ExecContext(ctx, `
			COMMENT ON COLUMN articles.owner_id IS '文章作者ID，关联到users表'
		`)
		if err != nil {
			// 注释失败不影响功能，只记录警告
			log.Printf("  ⚠️ 添加 owner_id 注释失败: %v", err)
		}

		// 为现有文章设置默认作者
		_, err = m.db.ExecContext(ctx, `
			UPDATE articles SET owner_id = 1 WHERE owner_id IS NULL OR owner_id = 0
		`)
		if err != nil {
			return fmt.Errorf("更新现有文章 owner_id 失败: %w", err)
		}

		// 创建索引（如果不存在）
		_, err = m.db.ExecContext(ctx, `
			CREATE INDEX IF NOT EXISTS idx_articles_owner_id ON articles(owner_id)
		`)
		if err != nil {
			return fmt.Errorf("创建 owner_id 索引失败: %w", err)
		}

	case "sqlite", "sqlite3":
		// SQLite 语法
		_, err = m.db.ExecContext(ctx, `
			ALTER TABLE articles
			ADD COLUMN owner_id INTEGER NOT NULL DEFAULT 1
		`)
		if err != nil {
			return fmt.Errorf("添加 owner_id 字段失败: %w", err)
		}

		// 为现有文章设置默认作者
		_, err = m.db.ExecContext(ctx, `
			UPDATE articles SET owner_id = 1 WHERE owner_id IS NULL OR owner_id = 0
		`)
		if err != nil {
			return fmt.Errorf("更新现有文章 owner_id 失败: %w", err)
		}

		// 创建索引
		_, err = m.db.ExecContext(ctx, `
			CREATE INDEX IF NOT EXISTS idx_articles_owner_id ON articles(owner_id)
		`)
		if err != nil {
			return fmt.Errorf("创建 owner_id 索引失败: %w", err)
		}
	}

	log.Println("  ✓ owner_id 字段迁移完成")
	return nil
}

// migrateReviewFields 迁移审核相关字段
func (m *MigrationService) migrateReviewFields(ctx context.Context) error {
	// 检查 review_status 字段是否已存在
	exists, err := m.columnExists(ctx, "articles", "review_status")
	if err != nil {
		return err
	}

	if exists {
		log.Println("  ✓ 审核字段已存在，跳过迁移")
		return nil
	}

	log.Println("  → 添加审核相关字段...")

	switch m.dbType {
	case "mysql", "mariadb":
		// MySQL/MariaDB 语法
		_, err = m.db.ExecContext(ctx, `
			ALTER TABLE articles
			ADD COLUMN review_status ENUM('NONE', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'NONE' COMMENT '审核状态' AFTER keywords
		`)
		if err != nil {
			return fmt.Errorf("添加 review_status 字段失败: %w", err)
		}

		_, err = m.db.ExecContext(ctx, `
			ALTER TABLE articles
			ADD COLUMN review_comment VARCHAR(500) NULL COMMENT '审核意见' AFTER review_status
		`)
		if err != nil {
			return fmt.Errorf("添加 review_comment 字段失败: %w", err)
		}

		_, err = m.db.ExecContext(ctx, `
			ALTER TABLE articles
			ADD COLUMN reviewed_at TIMESTAMP NULL COMMENT '审核时间' AFTER review_comment
		`)
		if err != nil {
			return fmt.Errorf("添加 reviewed_at 字段失败: %w", err)
		}

		_, err = m.db.ExecContext(ctx, `
			ALTER TABLE articles
			ADD COLUMN reviewed_by INT UNSIGNED NULL COMMENT '审核人ID' AFTER reviewed_at
		`)
		if err != nil {
			return fmt.Errorf("添加 reviewed_by 字段失败: %w", err)
		}

		// 创建索引
		_, err = m.db.ExecContext(ctx, `
			CREATE INDEX idx_articles_review_status ON articles(review_status)
		`)
		if err != nil && !strings.Contains(err.Error(), "Duplicate key name") {
			return fmt.Errorf("创建 review_status 索引失败: %w", err)
		}

	case "postgres":
		// PostgreSQL 语法
		// 创建 ENUM 类型（如果不存在）
		_, err = m.db.ExecContext(ctx, `
			DO $$ BEGIN
				CREATE TYPE review_status_enum AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');
			EXCEPTION
				WHEN duplicate_object THEN null;
			END $$;
		`)
		if err != nil {
			return fmt.Errorf("创建 review_status_enum 类型失败: %w", err)
		}

		_, err = m.db.ExecContext(ctx, `
			ALTER TABLE articles
			ADD COLUMN IF NOT EXISTS review_status review_status_enum NOT NULL DEFAULT 'NONE'
		`)
		if err != nil {
			return fmt.Errorf("添加 review_status 字段失败: %w", err)
		}

		_, err = m.db.ExecContext(ctx, `
			COMMENT ON COLUMN articles.review_status IS '审核状态'
		`)
		if err != nil {
			log.Printf("  ⚠️ 添加 review_status 注释失败: %v", err)
		}

		_, err = m.db.ExecContext(ctx, `
			ALTER TABLE articles
			ADD COLUMN IF NOT EXISTS review_comment VARCHAR(500) NULL
		`)
		if err != nil {
			return fmt.Errorf("添加 review_comment 字段失败: %w", err)
		}

		_, err = m.db.ExecContext(ctx, `
			COMMENT ON COLUMN articles.review_comment IS '审核意见'
		`)
		if err != nil {
			log.Printf("  ⚠️ 添加 review_comment 注释失败: %v", err)
		}

		_, err = m.db.ExecContext(ctx, `
			ALTER TABLE articles
			ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP NULL
		`)
		if err != nil {
			return fmt.Errorf("添加 reviewed_at 字段失败: %w", err)
		}

		_, err = m.db.ExecContext(ctx, `
			COMMENT ON COLUMN articles.reviewed_at IS '审核时间'
		`)
		if err != nil {
			log.Printf("  ⚠️ 添加 reviewed_at 注释失败: %v", err)
		}

		_, err = m.db.ExecContext(ctx, `
			ALTER TABLE articles
			ADD COLUMN IF NOT EXISTS reviewed_by INTEGER NULL
		`)
		if err != nil {
			return fmt.Errorf("添加 reviewed_by 字段失败: %w", err)
		}

		_, err = m.db.ExecContext(ctx, `
			COMMENT ON COLUMN articles.reviewed_by IS '审核人ID'
		`)
		if err != nil {
			log.Printf("  ⚠️ 添加 reviewed_by 注释失败: %v", err)
		}

		// 创建索引
		_, err = m.db.ExecContext(ctx, `
			CREATE INDEX IF NOT EXISTS idx_articles_review_status ON articles(review_status)
		`)
		if err != nil {
			return fmt.Errorf("创建 review_status 索引失败: %w", err)
		}

	case "sqlite", "sqlite3":
		// SQLite 语法（SQLite 不支持 ENUM，使用 TEXT）
		_, err = m.db.ExecContext(ctx, `
			ALTER TABLE articles
			ADD COLUMN review_status TEXT NOT NULL DEFAULT 'NONE'
		`)
		if err != nil {
			return fmt.Errorf("添加 review_status 字段失败: %w", err)
		}

		_, err = m.db.ExecContext(ctx, `
			ALTER TABLE articles
			ADD COLUMN review_comment TEXT NULL
		`)
		if err != nil {
			return fmt.Errorf("添加 review_comment 字段失败: %w", err)
		}

		_, err = m.db.ExecContext(ctx, `
			ALTER TABLE articles
			ADD COLUMN reviewed_at TIMESTAMP NULL
		`)
		if err != nil {
			return fmt.Errorf("添加 reviewed_at 字段失败: %w", err)
		}

		_, err = m.db.ExecContext(ctx, `
			ALTER TABLE articles
			ADD COLUMN reviewed_by INTEGER NULL
		`)
		if err != nil {
			return fmt.Errorf("添加 reviewed_by 字段失败: %w", err)
		}

		// 创建索引
		_, err = m.db.ExecContext(ctx, `
			CREATE INDEX IF NOT EXISTS idx_articles_review_status ON articles(review_status)
		`)
		if err != nil {
			return fmt.Errorf("创建 review_status 索引失败: %w", err)
		}
	}

	log.Println("  ✓ 审核字段迁移完成")
	return nil
}

// columnExists 检查列是否存在
func (m *MigrationService) columnExists(ctx context.Context, tableName, columnName string) (bool, error) {
	var query string
	var args []interface{}

	switch m.dbType {
	case "mysql", "mariadb":
		query = `
			SELECT COUNT(*) 
			FROM INFORMATION_SCHEMA.COLUMNS 
			WHERE TABLE_SCHEMA = DATABASE() 
			AND TABLE_NAME = ? 
			AND COLUMN_NAME = ?
		`
		args = []interface{}{tableName, columnName}

	case "postgres":
		query = `
			SELECT COUNT(*) 
			FROM information_schema.columns 
			WHERE table_name = $1 
			AND column_name = $2
		`
		args = []interface{}{tableName, columnName}

	case "sqlite", "sqlite3":
		query = `
			SELECT COUNT(*) 
			FROM pragma_table_info(?)
			WHERE name = ?
		`
		args = []interface{}{tableName, columnName}

	default:
		return false, fmt.Errorf("不支持的数据库类型: %s", m.dbType)
	}

	var count int
	err := m.db.QueryRowContext(ctx, query, args...).Scan(&count)
	if err != nil {
		return false, err
	}

	return count > 0, nil
}
