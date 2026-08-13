/*
 * @Description: 插件状态持久化 - 禁用列表与插件配置落盘，重启后保持
 * @Author: 安知鱼
 * @Date: 2026-08-13
 */
package plugin

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
)

// StateFileName 状态文件名（位于插件目录下）
const StateFileName = "plugins-state.json"

// stateData 状态文件结构
type stateData struct {
	// Disabled 被管理员禁用的插件 ID 列表
	Disabled []string `json:"disabled"`
	// Configs 插件配置：插件 ID -> 配置键值
	Configs map[string]map[string]string `json:"configs"`
}

// stateStore 管理状态文件的读写（并发安全，原子写入）
type stateStore struct {
	mu   sync.Mutex
	path string
	data stateData
}

// newStateStore 创建状态存储并尝试加载已有状态；文件缺失或损坏时以空状态启动
func newStateStore(pluginDir string) *stateStore {
	s := &stateStore{
		path: filepath.Join(pluginDir, StateFileName),
		data: stateData{Configs: make(map[string]map[string]string)},
	}

	raw, err := os.ReadFile(s.path)
	if err != nil {
		if !os.IsNotExist(err) {
			log.Printf("[Plugin] 读取状态文件失败，以空状态启动: %v", err)
		}
		return s
	}
	if err := json.Unmarshal(raw, &s.data); err != nil {
		log.Printf("[Plugin] 状态文件损坏，以空状态启动: %v", err)
		s.data = stateData{Configs: make(map[string]map[string]string)}
		return s
	}
	if s.data.Configs == nil {
		s.data.Configs = make(map[string]map[string]string)
	}
	return s
}

// persistLocked 原子写入状态文件（调用方必须持有锁）
func (s *stateStore) persistLocked() error {
	raw, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化插件状态失败: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(s.path), 0755); err != nil {
		return fmt.Errorf("创建插件目录失败: %w", err)
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0644); err != nil {
		return fmt.Errorf("写入插件状态临时文件失败: %w", err)
	}
	if err := os.Rename(tmp, s.path); err != nil {
		return fmt.Errorf("替换插件状态文件失败: %w", err)
	}
	return nil
}

// IsDisabled 查询插件是否被持久化禁用
func (s *stateStore) IsDisabled(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, d := range s.data.Disabled {
		if d == id {
			return true
		}
	}
	return false
}

// SetDisabled 更新插件禁用状态并落盘
func (s *stateStore) SetDisabled(id string, disabled bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	filtered := make([]string, 0, len(s.data.Disabled))
	for _, d := range s.data.Disabled {
		if d != id {
			filtered = append(filtered, d)
		}
	}
	if disabled {
		filtered = append(filtered, id)
	}
	s.data.Disabled = filtered
	return s.persistLocked()
}

// GetConfig 返回插件配置的副本
func (s *stateStore) GetConfig(id string) map[string]string {
	s.mu.Lock()
	defer s.mu.Unlock()

	cfg := s.data.Configs[id]
	result := make(map[string]string, len(cfg))
	for k, v := range cfg {
		result[k] = v
	}
	return result
}

// SetConfig 保存插件配置并落盘
func (s *stateStore) SetConfig(id string, config map[string]string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if config == nil {
		config = make(map[string]string)
	}
	s.data.Configs[id] = config
	return s.persistLocked()
}

// Remove 清理插件的全部状态（卸载时调用）
func (s *stateStore) Remove(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	filtered := make([]string, 0, len(s.data.Disabled))
	for _, d := range s.data.Disabled {
		if d != id {
			filtered = append(filtered, d)
		}
	}
	s.data.Disabled = filtered
	delete(s.data.Configs, id)
	return s.persistLocked()
}
