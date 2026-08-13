/*
 * @Description: 插件 manifest（plugin.json）定义、解析与校验
 * @Author: 安知鱼
 * @Date: 2026-08-13
 */
package plugin

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
)

// ManifestFileName 插件清单文件名
const ManifestFileName = "plugin.json"

// CurrentManifestVersion 当前支持的 manifest 版本
const CurrentManifestVersion = 1

var pluginIDPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{1,63}$`)

// ConfigField 插件配置项声明（用于管理后台渲染配置表单）
type ConfigField struct {
	Key         string   `json:"key"`
	Label       string   `json:"label"`
	Type        string   `json:"type"` // string / number / boolean / select
	Required    bool     `json:"required,omitempty"`
	Secret      bool     `json:"secret,omitempty"`
	Default     string   `json:"default,omitempty"`
	Description string   `json:"description,omitempty"`
	Options     []string `json:"options,omitempty"` // 仅 type=select 时有效
}

// Manifest 插件清单（plugin.json）
type Manifest struct {
	ManifestVersion int    `json:"manifest_version"`
	ID              string `json:"id"`
	Name            string `json:"name"`
	Version         string `json:"version"`
	Description     string `json:"description,omitempty"`
	Author          string `json:"author,omitempty"`
	Homepage        string `json:"homepage,omitempty"`
	// Types 声明插件提供的能力类型（"searcher" / "eventhook"），仅作展示参考，
	// 实际能力以运行时 Dispense 结果为准
	Types []string `json:"types"`
	// Entry 平台标识（如 "linux-amd64"）到包内二进制相对路径的映射
	Entry map[string]string `json:"entry"`
	// MinAppVersion 要求的最低主程序版本（仅提示用途）
	MinAppVersion string        `json:"min_app_version,omitempty"`
	ConfigSchema  []ConfigField `json:"config_schema,omitempty"`
}

// validConfigFieldTypes 配置项允许的类型
var validConfigFieldTypes = map[string]bool{
	"string": true, "number": true, "boolean": true, "select": true,
}

// CurrentPlatform 返回当前平台标识（如 "linux-amd64"）
func CurrentPlatform() string {
	return runtime.GOOS + "-" + runtime.GOARCH
}

// Validate 校验 manifest 的完整性与合法性
func (m *Manifest) Validate() error {
	if m.ManifestVersion != CurrentManifestVersion {
		return fmt.Errorf("不支持的 manifest_version: %d（当前支持 %d）", m.ManifestVersion, CurrentManifestVersion)
	}
	if !pluginIDPattern.MatchString(m.ID) {
		return fmt.Errorf("插件 id %q 非法：必须为 2-64 位小写字母/数字/中划线/下划线，且以字母或数字开头", m.ID)
	}
	if strings.TrimSpace(m.Name) == "" {
		return fmt.Errorf("插件 name 不能为空")
	}
	if strings.TrimSpace(m.Version) == "" {
		return fmt.Errorf("插件 version 不能为空")
	}
	if len(m.Entry) == 0 {
		return fmt.Errorf("entry 不能为空：至少提供一个平台的二进制路径")
	}
	for platform, rel := range m.Entry {
		if rel == "" {
			return fmt.Errorf("entry[%s] 的二进制路径不能为空", platform)
		}
		if filepath.IsAbs(rel) || !filepath.IsLocal(rel) {
			return fmt.Errorf("entry[%s] 的二进制路径 %q 非法：必须为包内相对路径", platform, rel)
		}
	}
	for _, field := range m.ConfigSchema {
		if strings.TrimSpace(field.Key) == "" {
			return fmt.Errorf("config_schema 存在空 key 的配置项")
		}
		if !validConfigFieldTypes[field.Type] {
			return fmt.Errorf("config_schema[%s] 的 type %q 非法：仅支持 string/number/boolean/select", field.Key, field.Type)
		}
		if field.Type == "select" && len(field.Options) == 0 {
			return fmt.Errorf("config_schema[%s] 为 select 类型时必须提供 options", field.Key)
		}
	}
	return nil
}

// EntryForCurrentPlatform 返回当前平台的二进制相对路径
func (m *Manifest) EntryForCurrentPlatform() (string, error) {
	platform := CurrentPlatform()
	rel, ok := m.Entry[platform]
	if !ok {
		supported := make([]string, 0, len(m.Entry))
		for p := range m.Entry {
			supported = append(supported, p)
		}
		return "", fmt.Errorf("插件不支持当前平台 %s（支持: %s）", platform, strings.Join(supported, ", "))
	}
	return rel, nil
}

// ParseManifest 解析 manifest JSON 内容并校验
func ParseManifest(data []byte) (*Manifest, error) {
	var m Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("解析 %s 失败: %w", ManifestFileName, err)
	}
	if err := m.Validate(); err != nil {
		return nil, err
	}
	return &m, nil
}

// LoadManifestFromDir 从插件目录读取并解析 manifest
func LoadManifestFromDir(dir string) (*Manifest, error) {
	data, err := os.ReadFile(filepath.Join(dir, ManifestFileName))
	if err != nil {
		return nil, fmt.Errorf("读取 %s 失败: %w", ManifestFileName, err)
	}
	return ParseManifest(data)
}

// ToMetadata 将 manifest 转换为运行时元信息（目录式插件以 manifest 为准）
func (m *Manifest) ToMetadata() Metadata {
	primaryType := ""
	if len(m.Types) > 0 {
		primaryType = m.Types[0]
	}
	return Metadata{
		ID:          m.ID,
		Name:        m.Name,
		Version:     m.Version,
		Description: m.Description,
		Author:      m.Author,
		Type:        primaryType,
		Types:       m.Types,
		Homepage:    m.Homepage,
	}
}
