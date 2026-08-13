/*
 * @Description: 插件配置读取 - 解析宿主注入的配置环境变量
 * @Author: 安知鱼
 * @Date: 2026-08-13
 */
package sdk

import (
	"encoding/json"
	"os"
	"strconv"
)

// Config 插件配置（由宿主在插件进程启动时通过环境变量注入）
type Config map[string]string

// LoadConfig 读取宿主注入的插件配置
// 宿主通过 ANHEYU_PLUGIN_CONFIG 环境变量传入配置 JSON；未注入时返回空配置
func LoadConfig() Config {
	raw := os.Getenv("ANHEYU_PLUGIN_CONFIG")
	if raw == "" {
		return Config{}
	}
	var cfg Config
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		return Config{}
	}
	if cfg == nil {
		return Config{}
	}
	return cfg
}

// String 返回字符串配置值，缺失时返回空字符串
func (c Config) String(key string) string {
	return c[key]
}

// StringDefault 返回字符串配置值，缺失或为空时返回默认值
func (c Config) StringDefault(key, def string) string {
	if v, ok := c[key]; ok && v != "" {
		return v
	}
	return def
}

// Int 返回整数配置值，缺失或解析失败时返回默认值
func (c Config) Int(key string, def int) int {
	v, ok := c[key]
	if !ok {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}

// Bool 返回布尔配置值（"true"/"1"/"yes"/"on" 视为 true），缺失时返回默认值
func (c Config) Bool(key string, def bool) bool {
	v, ok := c[key]
	if !ok {
		return def
	}
	switch v {
	case "true", "1", "yes", "on":
		return true
	case "false", "0", "no", "off":
		return false
	default:
		return def
	}
}
