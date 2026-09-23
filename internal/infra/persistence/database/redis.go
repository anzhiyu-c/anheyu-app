/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-15 11:30:55
 * @LastEditTime: 2025-08-07 14:22:55
 * @LastEditors: 安知鱼
 */
package database

import (
	"context"
	"log"
	"strconv"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/config"

	"github.com/redis/go-redis/v9"
)

// NewRedisClient 是一个新的构造函数，它接收配置并返回 Redis 客户端或 nil（用于自动降级）
// 如果 Redis 未配置或连接失败，返回 nil 而不是 error，让上层决定是否降级到内存缓存
func NewRedisClient(ctx context.Context, cfg *config.Config) (*redis.Client, error) {
	// 1. 从注入的 cfg 对象获取配置
	redisAddr := cfg.GetString(config.KeyRedisAddr)
	redisPassword := cfg.GetString(config.KeyRedisPassword)

	redisDBStr := "10"
	if cfg.GetString(config.KeyRedisDB) != "" {
		redisDBStr = cfg.GetString(config.KeyRedisDB)
	}

	// 如果 Redis 地址未配置，返回 nil（这不是错误，只是没有配置）
	if redisAddr == "" {
		log.Println("⚠️  Redis 地址未配置，将使用内存缓存")
		return nil, nil
	}

	var redisDB int
	if redisDBStr != "" {
		var err error
		redisDB, err = strconv.Atoi(redisDBStr)
		if err != nil {
			log.Printf("⚠️  无效的 REDIS_DB 值 '%s': %v，将使用内存缓存", redisDBStr, err)
			return nil, nil
		}
	}

	// 2. 创建 Redis 客户端实例
	rdb := redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: redisPassword,
		DB:       redisDB,
	})

	// 3. 检查连接
	if err := pingWithRetry(ctx, func(attemptCtx context.Context) error { return rdb.Ping(attemptCtx).Err() }, 3, time.Second); err != nil {
		log.Printf("⚠️  连接 Redis (%s, DB %d) 失败: %v，将使用内存缓存", redisAddr, redisDB, err)
		if closeErr := rdb.Close(); closeErr != nil {
			log.Printf("关闭 Redis 连接失败: %v", closeErr)
		}
		return nil, nil
	}

	log.Printf("✅ 成功连接到 Redis (%s, DB %d)", redisAddr, redisDB)
	return rdb, nil
}
