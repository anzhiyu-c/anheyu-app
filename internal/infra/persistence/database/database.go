/*
 * @Description: 数据库连接管理 (支持多种数据库)
 * @Author: 安知鱼
 * @Date: 2025-07-12 16:09:46
 * @LastEditTime: 2025-08-30 09:54:27
 * @LastEditors: 安知鱼
 */
package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/migrate"
	"github.com/anzhiyu-c/anheyu-app/pkg/config"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
	_ "github.com/ncruces/go-sqlite3/driver"
	_ "github.com/ncruces/go-sqlite3/embed"
)

// NewSQLDB 创建并返回一个标准的 *sql.DB 连接池，现在支持多种数据库。
func NewSQLDB(cfg *config.Config) (*sql.DB, error) {
	driver := cfg.GetString(config.KeyDBType)
	if driver == "" {
		log.Println("提示: 配置文件中未指定 'Database.Type'，将默认使用 'sqlite'")
		driver = "sqlite"
	}

	var dsn string
	var driverName string

	dbUser := cfg.GetString(config.KeyDBUser)
	dbPass := cfg.GetString(config.KeyDBPassword)
	dbHost := cfg.GetString(config.KeyDBHost)
	dbPort := cfg.GetString(config.KeyDBPort)
	dbName := cfg.GetString(config.KeyDBName)

	switch driver {
	case "mysql", "mariadb":
		driverName = "mysql"
		if dbUser == "" || dbHost == "" || dbPort == "" || dbName == "" {
			return nil, fmt.Errorf("MySQL 连接参数不完整 (需要 User, Host, Port, Name)")
		}
		dsn = fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
			dbUser, dbPass, dbHost, dbPort, dbName)
	case "postgres":
		driverName = "postgres"
		if dbUser == "" || dbHost == "" || dbPort == "" || dbName == "" {
			return nil, fmt.Errorf("PostgreSQL 连接参数不完整 (需要 User, Host, Port, Name)")
		}
		dsn = fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
			dbHost, dbPort, dbUser, dbPass, dbName)
	case "sqlite", "sqlite3":
		driverName = "sqlite3"

		dataDir := "./data"
		if err := os.MkdirAll(dataDir, os.ModePerm); err != nil {
			return nil, fmt.Errorf("无法创建 data 目录: %w", err)
		}

		finalDbName := dbName
		if finalDbName == "" {
			finalDbName = "anheyu_app.db" // 如果未指定数据库名，则使用默认值
		}

		finalPath := filepath.Join(dataDir, finalDbName)
		log.Printf("【提示】SQLite 数据库路径: %s\n", finalPath)

		// 使用 file: DSN 格式并启用外键约束
		dsn = fmt.Sprintf("file:%s?_fk=1&cache=shared", finalPath)
	default:
		return nil, fmt.Errorf("不支持的数据库驱动: %s (支持: mysql/mariadb, postgres, sqlite)", driver)
	}

	db, err := sql.Open(driverName, dsn)
	if err != nil {
		return nil, fmt.Errorf("打开 sql.DB 连接失败 (驱动: %s): %w", driverName, err)
	}

	// 设置连接池参数
	db.SetMaxIdleConns(10)
	db.SetMaxOpenConns(100)
	db.SetConnMaxLifetime(time.Hour)

	// 验证数据库连接
	if err := db.Ping(); err != nil {
		db.Close() // 如果 ping 失败，关闭连接以释放资源
		return nil, fmt.Errorf("无法 Ping 通数据库 (DSN: %s): %w", dsn, err)
	}

	log.Printf("✅ %s 数据库连接池创建成功！\n", strings.Title(driver))
	return db, nil
}

// NewEntClient 根据配置创建并返回一个 Ent ORM 客户端。
func NewEntClient(db *sql.DB, cfg *config.Config) (*ent.Client, error) {
	// *FIXED*: 使用 KeyDBType 来获取数据库类型，以匹配 conf.ini 的配置
	driverName := cfg.GetString(config.KeyDBType)
	if driverName == "" {
		driverName = "sqlite" // 保持与 NewSQLDB 的默认值一致
	}

	var drv dialect.Driver
	switch driverName {
	case "mysql", "mariadb":
		drv = entsql.OpenDB(dialect.MySQL, db)
	case "postgres":
		drv = entsql.OpenDB(dialect.Postgres, db)
	case "sqlite", "sqlite3":
		drv = entsql.OpenDB(dialect.SQLite, db)
	default:
		return nil, fmt.Errorf("不支持的 Ent 方言: %s", driverName)
	}

	var entOptions []ent.Option

	// 1. 始终添加 Driver 选项
	entOptions = append(entOptions, ent.Driver(drv))

	// 2. 根据配置决定是否添加 Debug 选项
	if cfg.GetBool(config.KeyDBDebug) {
		entOptions = append(entOptions, ent.Debug())
		log.Println("【数据库】Ent Debug模式已开启，将打印所有执行的SQL语句。")
	}

	// 使用所有收集到的选项创建客户端
	client := ent.NewClient(entOptions...)

	// 在启动时自动迁移数据库结构
	log.Println("⚡ 开始数据库表结构迁移...")
	if err := client.Schema.Create(context.Background(),
		migrate.WithDropIndex(true),  // 允许删除旧索引（包括唯一约束）
		migrate.WithDropColumn(true), // 允许删除旧列
	); err != nil {
		return nil, fmt.Errorf("数据库迁移失败: %w", err)
	}
	log.Println("✅ 数据库表结构迁移成功")

	// 执行 SQL 数据迁移（处理现有数据和索引）
	migrationSvc := NewMigrationService(db, driverName)
	if err := migrationSvc.RunMigrations(context.Background()); err != nil {
		log.Printf("⚠️ 警告：SQL 数据迁移失败: %v", err)
		// 不中断启动流程，但记录错误
		// 因为 Ent Schema 迁移已经完成，字段可能已经存在
	}

	log.Println("✅ Ent 客户端初始化成功！")
	return client, nil
}
