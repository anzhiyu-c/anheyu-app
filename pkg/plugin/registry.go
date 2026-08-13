/*
 * @Description: 插件管理器 - 发现、加载、热重载、安装卸载和管理运行时插件进程
 * @Author: 安知鱼
 * @Date: 2026-04-09
 * @LastEditTime: 2026-08-13
 * @LastEditors: 安知鱼
 */
package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/fsnotify/fsnotify"
	goplugin "github.com/hashicorp/go-plugin"
)

// PluginStatus 描述插件运行状态
type PluginStatus string

const (
	StatusRunning  PluginStatus = "running"
	StatusStopped  PluginStatus = "stopped"
	StatusError    PluginStatus = "error"
	StatusDisabled PluginStatus = "disabled"
)

// 插件来源形态
const (
	SourceDirectory = "directory" // 目录式插件（plugin.json + 二进制）
	SourceBinary    = "binary"    // 旧式裸二进制插件
)

// PluginInfo 包含插件元信息和运行时状态
type PluginInfo struct {
	Metadata Metadata     `json:"metadata"`
	Status   PluginStatus `json:"status"`
	FileName string       `json:"file_name"`
	FilePath string       `json:"-"` // 二进制路径，内部使用，不序列化（避免暴露服务器路径）
	Dir      string       `json:"-"` // 目录式插件的插件目录，内部使用
	// Source 插件来源形态：directory（目录式）或 binary（裸二进制）
	Source string `json:"source"`
	// Capabilities 运行时实际提供的能力类型（Dispense 成功的类型）
	Capabilities []string `json:"capabilities,omitempty"`
	// Subscriptions 事件钩子插件的订阅列表
	Subscriptions []string `json:"subscriptions,omitempty"`
	// ConfigSchema 配置项声明（来自 manifest）
	ConfigSchema []ConfigField `json:"config_schema,omitempty"`
	// Config 当前配置值（仅在管理列表接口中填充）
	Config   map[string]string `json:"config,omitempty"`
	Error    string            `json:"error,omitempty"`
	LoadedAt time.Time         `json:"loaded_at,omitempty"`
}

// hookEntry 缓存事件钩子客户端与订阅列表
type hookEntry struct {
	hook EventHook
	subs []string
}

// Manager 管理所有运行时加载的插件
type Manager struct {
	mu         sync.RWMutex
	clients    map[string]*goplugin.Client
	searchers  map[string]model.Searcher // 缓存已初始化的搜索器引用
	hooks      map[string]*hookEntry     // 缓存事件钩子引用与订阅
	info       map[string]*PluginInfo
	disabled   map[string]bool
	installing map[string]bool // 安装接口处理中的插件目录（抑制文件监听重复加载）
	pluginDir  string
	watcher    *fsnotify.Watcher
	stopCh     chan struct{}
	stopped    bool
	state      *stateStore

	onSearcherChange func(model.Searcher)
}

// NewManager 创建插件管理器
func NewManager(pluginDir string) *Manager {
	m := &Manager{
		clients:    make(map[string]*goplugin.Client),
		searchers:  make(map[string]model.Searcher),
		hooks:      make(map[string]*hookEntry),
		info:       make(map[string]*PluginInfo),
		disabled:   make(map[string]bool),
		installing: make(map[string]bool),
		pluginDir:  pluginDir,
		stopCh:     make(chan struct{}),
	}
	if pluginDir != "" {
		m.state = newStateStore(pluginDir)
	}
	return m
}

// markInstalling 标记/取消插件目录的安装中状态
func (m *Manager) markInstalling(dir string, v bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if v {
		m.installing[dir] = true
	} else {
		delete(m.installing, dir)
	}
}

// isInstalling 查询插件目录是否处于安装接口处理中
func (m *Manager) isInstalling(dir string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.installing[dir]
}

// SetSearcherChangeCallback 设置搜索引擎切换回调（插件加载/卸载时通知主程序）
func (m *Manager) SetSearcherChangeCallback(cb func(model.Searcher)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.onSearcherChange = cb
}

// DiscoverAndLoad 扫描插件目录，加载所有插件（目录式与裸二进制）
func (m *Manager) DiscoverAndLoad() error {
	if m.pluginDir == "" {
		log.Println("[Plugin] 未配置插件目录，跳过插件发现")
		return nil
	}

	if err := os.MkdirAll(m.pluginDir, 0755); err != nil {
		return fmt.Errorf("创建插件目录失败: %w", err)
	}

	entries, err := os.ReadDir(m.pluginDir)
	if err != nil {
		return fmt.Errorf("读取插件目录失败: %w", err)
	}

	for _, entry := range entries {
		name := entry.Name()
		if strings.HasPrefix(name, ".") {
			continue
		}
		fullPath := filepath.Join(m.pluginDir, name)

		if entry.IsDir() {
			if _, err := os.Stat(filepath.Join(fullPath, ManifestFileName)); err != nil {
				continue // 无 manifest 的目录不是插件
			}
			if err := m.loadDirectoryPlugin(fullPath); err != nil {
				log.Printf("[Plugin] ⚠️ 加载目录式插件 %s 失败: %v", name, err)
			}
			continue
		}

		if !isExecutable(name) {
			continue
		}
		if err := m.loadPlugin(fullPath); err != nil {
			log.Printf("[Plugin] ⚠️ 加载插件 %s 失败: %v", name, err)
		}
	}

	return nil
}

// StartWatcher 启动文件监听，实现插件热重载
func (m *Manager) StartWatcher() error {
	if m.pluginDir == "" {
		return nil
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return fmt.Errorf("创建文件监听器失败: %w", err)
	}
	m.watcher = watcher

	if err := watcher.Add(m.pluginDir); err != nil {
		watcher.Close()
		return fmt.Errorf("监听插件目录失败: %w", err)
	}

	go m.watchLoop()
	log.Printf("[Plugin] 🔄 已启动插件目录热监听: %s", m.pluginDir)
	return nil
}

func (m *Manager) watchLoop() {
	const debounceInterval = 2 * time.Second
	const loadDelay = 500 * time.Millisecond

	debounce := make(map[string]time.Time)

	for {
		select {
		case event, ok := <-m.watcher.Events:
			if !ok {
				return
			}

			base := filepath.Base(event.Name)
			if strings.HasPrefix(base, ".") {
				continue
			}

			now := time.Now()
			if last, exists := debounce[event.Name]; exists && now.Sub(last) < debounceInterval {
				continue
			}
			debounce[event.Name] = now

			// 定期清理 debounce map，避免内存泄漏
			if len(debounce) > 100 {
				for k, v := range debounce {
					if now.Sub(v) > 30*time.Second {
						delete(debounce, k)
					}
				}
			}

			switch {
			case event.Has(fsnotify.Create):
				if fi, err := os.Stat(event.Name); err == nil && fi.IsDir() {
					log.Printf("[Plugin] 检测到新插件目录: %s", base)
					go m.delayedLoadDir(event.Name, loadDelay)
					continue
				}
				if !isExecutable(base) {
					continue
				}
				log.Printf("[Plugin] 检测到新插件: %s", base)
				go m.delayedLoad(event.Name, loadDelay)

			case event.Has(fsnotify.Write):
				if !isExecutable(base) {
					continue
				}
				log.Printf("[Plugin] 检测到插件更新: %s", base)
				go m.delayedReload(event.Name, loadDelay)

			case event.Has(fsnotify.Remove), event.Has(fsnotify.Rename):
				log.Printf("[Plugin] 检测到插件移除: %s", base)
				m.unloadPluginByPath(event.Name)
				m.notifySearcherChange()
			}

		case err, ok := <-m.watcher.Errors:
			if !ok {
				return
			}
			log.Printf("[Plugin] 文件监听错误: %v", err)

		case <-m.stopCh:
			return
		}
	}
}

// delayedLoad 延迟加载新插件（等待文件写入完成）
func (m *Manager) delayedLoad(path string, delay time.Duration) {
	time.Sleep(delay)
	if err := m.loadPlugin(path); err != nil {
		log.Printf("[Plugin] 加载新插件失败: %v", err)
	} else {
		m.notifySearcherChange()
	}
}

// delayedLoadDir 延迟加载目录式插件（等待解压/拷贝完成）
func (m *Manager) delayedLoadDir(dir string, delay time.Duration) {
	time.Sleep(delay)
	if _, err := os.Stat(filepath.Join(dir, ManifestFileName)); err != nil {
		return // 不是插件目录
	}
	if m.isInstalling(dir) {
		return // 安装接口正在处理该目录，由其负责加载
	}
	if m.recentlyLoadedFromDir(dir) {
		return // 刚由安装接口显式加载过，避免重复启动进程
	}
	if err := m.loadDirectoryPlugin(dir); err != nil {
		log.Printf("[Plugin] 加载目录式插件失败: %v", err)
	} else {
		m.notifySearcherChange()
	}
}

// recentlyLoadedFromDir 判断该目录的插件是否在近几秒内刚被加载（避免安装接口与文件监听重复加载）
func (m *Manager) recentlyLoadedFromDir(dir string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, info := range m.info {
		if info.Dir == dir && time.Since(info.LoadedAt) < 3*time.Second {
			return true
		}
	}
	return false
}

// delayedReload 延迟重载插件（等待文件写入完成）
func (m *Manager) delayedReload(path string, delay time.Duration) {
	time.Sleep(delay)
	m.reloadPlugin(path)
	m.notifySearcherChange()
}

func (m *Manager) notifySearcherChange() {
	m.mu.RLock()
	cb := m.onSearcherChange
	m.mu.RUnlock()

	if cb != nil {
		cb(m.BestSearcher())
	}
}

// loadDirectoryPlugin 加载目录式插件（读取 manifest，按当前平台选择二进制）
func (m *Manager) loadDirectoryPlugin(dir string) error {
	manifest, err := LoadManifestFromDir(dir)
	if err != nil {
		m.setPluginError(dir, err)
		return err
	}

	binRel, err := manifest.EntryForCurrentPlatform()
	if err != nil {
		m.setDirectoryPluginError(dir, manifest, err)
		return err
	}
	binPath := filepath.Join(dir, binRel)
	if _, err := os.Stat(binPath); err != nil {
		err = fmt.Errorf("插件二进制不存在: %s", binRel)
		m.setDirectoryPluginError(dir, manifest, err)
		return err
	}
	if runtime.GOOS != "windows" {
		if err := os.Chmod(binPath, 0755); err != nil {
			log.Printf("[Plugin] 设置插件二进制可执行权限失败: %v", err)
		}
	}

	// 持久化禁用的插件：登记信息但不启动进程
	if m.state != nil && m.state.IsDisabled(manifest.ID) {
		m.registerDisabledInfo(manifest, dir, binPath)
		log.Printf("[Plugin] 插件 %s 处于禁用状态，跳过启动", manifest.ID)
		return nil
	}

	return m.spawnAndRegister(binPath, dir, manifest)
}

// registerDisabledInfo 登记禁用状态的目录式插件信息
func (m *Manager) registerDisabledInfo(manifest *Manifest, dir, binPath string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.disabled[manifest.ID] = true
	m.info[manifest.ID] = &PluginInfo{
		Metadata:     manifest.ToMetadata(),
		Status:       StatusDisabled,
		FileName:     filepath.Base(dir),
		FilePath:     binPath,
		Dir:          dir,
		Source:       SourceDirectory,
		ConfigSchema: manifest.ConfigSchema,
	}
}

// loadPlugin 加载旧式裸二进制插件
func (m *Manager) loadPlugin(path string) error {
	return m.spawnAndRegister(path, "", nil)
}

// spawnAndRegister 启动插件进程，探测其提供的能力接口并注册
// dir 与 manifest 仅目录式插件提供；裸二进制插件二者为空
func (m *Manager) spawnAndRegister(binPath, dir string, manifest *Manifest) error {
	// exec.Cmd 的相对 Path 会相对 cmd.Dir 解析，插件目录为相对路径（如 data/plugins）时会解析错误，
	// 因此启动进程前统一转为绝对路径（info 中仍保存原路径，与文件监听事件路径保持可比）
	execPath := binPath
	if abs, err := filepath.Abs(binPath); err == nil {
		execPath = abs
	}
	cmd := exec.Command(execPath)
	if dir != "" {
		if absDir, err := filepath.Abs(dir); err == nil {
			cmd.Dir = absDir
		} else {
			cmd.Dir = dir
		}
	}
	// 目录式插件注入持久化配置（裸二进制插件保持继承主进程环境变量的旧行为）
	if manifest != nil && m.state != nil {
		cmd.Env = append(os.Environ(), buildConfigEnv(m.state.GetConfig(manifest.ID))...)
	}

	client := goplugin.NewClient(&goplugin.ClientConfig{
		HandshakeConfig:  Handshake,
		Plugins:          PluginMap,
		Cmd:              cmd,
		AllowedProtocols: []goplugin.Protocol{goplugin.ProtocolNetRPC},
	})

	rpcClient, err := client.Client()
	if err != nil {
		client.Kill()
		m.recordLoadError(binPath, dir, manifest, err)
		return fmt.Errorf("连接插件进程失败: %w", err)
	}

	// 逐个探测能力接口：未实现的类型静默跳过
	var (
		searcher     model.Searcher
		searcherMeta Metadata
		hook         *hookEntry
		hookMeta     Metadata
		capabilities []string
	)

	if raw, err := rpcClient.Dispense(TypeSearcher); err == nil {
		if sc, ok := raw.(*SearcherRPCClient); ok {
			searcher = sc
			searcherMeta = sc.GetMetadata()
			capabilities = append(capabilities, TypeSearcher)
		}
	}
	if raw, err := rpcClient.Dispense(TypeEventHook); err == nil {
		if hc, ok := raw.(*EventHookRPCClient); ok {
			hook = &hookEntry{hook: hc, subs: hc.Subscriptions()}
			hookMeta = hc.GetMetadata()
			capabilities = append(capabilities, TypeEventHook)
		}
	}

	if len(capabilities) == 0 {
		client.Kill()
		err := fmt.Errorf("插件未实现任何已知能力接口（searcher/eventhook）")
		m.recordLoadError(binPath, dir, manifest, err)
		return err
	}

	// 元信息优先级：manifest > searcher 元信息 > eventhook 元信息 > 文件名兜底
	var meta Metadata
	switch {
	case manifest != nil:
		meta = manifest.ToMetadata()
	case searcherMeta.ID != "":
		meta = searcherMeta
	case hookMeta.ID != "":
		meta = hookMeta
	default:
		meta = Metadata{ID: filepath.Base(binPath), Name: filepath.Base(binPath)}
	}
	if len(meta.Types) == 0 {
		meta.Types = capabilities
	}

	// 裸二进制插件在拿到 ID 后才能判断持久化禁用状态
	if manifest == nil && m.state != nil && m.state.IsDisabled(meta.ID) {
		client.Kill()
		m.mu.Lock()
		m.disabled[meta.ID] = true
		m.info[meta.ID] = &PluginInfo{
			Metadata: meta,
			Status:   StatusDisabled,
			FileName: filepath.Base(binPath),
			FilePath: binPath,
			Source:   SourceBinary,
		}
		m.mu.Unlock()
		log.Printf("[Plugin] 插件 %s 处于禁用状态，跳过启动", meta.ID)
		return nil
	}

	source := SourceBinary
	fileName := filepath.Base(binPath)
	var configSchema []ConfigField
	if manifest != nil {
		source = SourceDirectory
		fileName = filepath.Base(dir)
		configSchema = manifest.ConfigSchema
	}

	info := &PluginInfo{
		Metadata:     meta,
		Status:       StatusRunning,
		FileName:     fileName,
		FilePath:     binPath,
		Dir:          dir,
		Source:       source,
		Capabilities: capabilities,
		ConfigSchema: configSchema,
		LoadedAt:     time.Now(),
	}
	if hook != nil {
		info.Subscriptions = hook.subs
	}

	m.mu.Lock()
	if old, exists := m.clients[meta.ID]; exists {
		old.Kill()
	}
	m.clients[meta.ID] = client
	if searcher != nil {
		m.searchers[meta.ID] = searcher
	} else {
		delete(m.searchers, meta.ID)
	}
	if hook != nil {
		m.hooks[meta.ID] = hook
	} else {
		delete(m.hooks, meta.ID)
	}
	delete(m.disabled, meta.ID)
	m.info[meta.ID] = info
	m.mu.Unlock()

	log.Printf("[Plugin] ✅ 已加载: %s v%s [%s] - %s", meta.Name, meta.Version, strings.Join(capabilities, ","), meta.Description)
	return nil
}

// recordLoadError 记录插件加载错误
func (m *Manager) recordLoadError(binPath, dir string, manifest *Manifest, err error) {
	if manifest != nil {
		m.setDirectoryPluginError(dir, manifest, err)
		return
	}
	m.setPluginError(binPath, err)
}

func (m *Manager) setPluginError(path string, err error) {
	id := filepath.Base(path)
	m.mu.Lock()
	defer m.mu.Unlock()
	m.info[id] = &PluginInfo{
		Metadata: Metadata{ID: id, Name: id},
		Status:   StatusError,
		FileName: filepath.Base(path),
		FilePath: path,
		Error:    err.Error(),
	}
}

func (m *Manager) setDirectoryPluginError(dir string, manifest *Manifest, err error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.info[manifest.ID] = &PluginInfo{
		Metadata:     manifest.ToMetadata(),
		Status:       StatusError,
		FileName:     filepath.Base(dir),
		Dir:          dir,
		Source:       SourceDirectory,
		ConfigSchema: manifest.ConfigSchema,
		Error:        err.Error(),
	}
}

// reloadPlugin 重新加载指定路径的裸二进制插件
// spawnAndRegister 内部会自动替换同 ID 的旧客户端（先启动新进程再 Kill 旧进程），
// 因此无需手动先卸载再加载
func (m *Manager) reloadPlugin(path string) {
	if err := m.loadPlugin(path); err != nil {
		log.Printf("[Plugin] 重新加载插件失败: %v", err)
	}
}

// unloadPluginByPath 按文件/目录路径卸载插件（文件监听 Remove 事件触发）
func (m *Manager) unloadPluginByPath(path string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, info := range m.info {
		if info.FilePath == path || (info.Dir != "" && info.Dir == path) {
			if client, exists := m.clients[id]; exists {
				client.Kill()
				delete(m.clients, id)
			}
			delete(m.searchers, id)
			delete(m.hooks, id)
			info.Status = StatusStopped
			log.Printf("[Plugin] 已卸载: %s", id)
			return
		}
	}
}

// ReloadByID 按 ID 重新加载插件（供管理 API 调用）
func (m *Manager) ReloadByID(id string) error {
	m.mu.RLock()
	info, exists := m.info[id]
	m.mu.RUnlock()

	if !exists {
		return fmt.Errorf("插件 %s 不存在", id)
	}

	var err error
	if info.Dir != "" {
		err = m.loadDirectoryPlugin(info.Dir)
	} else {
		err = m.loadPlugin(info.FilePath)
	}
	m.notifySearcherChange()
	return err
}

// DisableByID 禁用插件并持久化状态（供管理 API 调用）
func (m *Manager) DisableByID(id string) error {
	m.mu.Lock()

	info, exists := m.info[id]
	if !exists {
		m.mu.Unlock()
		return fmt.Errorf("插件 %s 不存在", id)
	}

	if client, exists := m.clients[id]; exists {
		client.Kill()
		delete(m.clients, id)
	}
	delete(m.searchers, id)
	delete(m.hooks, id)
	info.Status = StatusDisabled
	m.disabled[id] = true
	m.mu.Unlock()

	if m.state != nil {
		if err := m.state.SetDisabled(id, true); err != nil {
			log.Printf("[Plugin] 持久化禁用状态失败: %v", err)
		}
	}

	m.notifySearcherChange()
	return nil
}

// EnableByID 启用已禁用的插件并持久化状态
func (m *Manager) EnableByID(id string) error {
	m.mu.Lock()
	info, exists := m.info[id]
	disabled := m.disabled[id]
	delete(m.disabled, id)
	m.mu.Unlock()

	if !exists {
		return fmt.Errorf("插件 %s 不存在", id)
	}
	if !disabled {
		return fmt.Errorf("插件 %s 未被禁用", id)
	}

	if m.state != nil {
		if err := m.state.SetDisabled(id, false); err != nil {
			log.Printf("[Plugin] 持久化启用状态失败: %v", err)
		}
	}

	var err error
	if info.Dir != "" {
		err = m.loadDirectoryPlugin(info.Dir)
	} else {
		err = m.loadPlugin(info.FilePath)
	}
	if err != nil {
		return err
	}
	m.notifySearcherChange()
	return nil
}

// UninstallByID 卸载插件：停止进程、删除文件、清理持久化状态
func (m *Manager) UninstallByID(id string) error {
	m.mu.Lock()
	info, exists := m.info[id]
	if !exists {
		m.mu.Unlock()
		return fmt.Errorf("插件 %s 不存在", id)
	}

	if client, ok := m.clients[id]; ok {
		client.Kill()
		delete(m.clients, id)
	}
	delete(m.searchers, id)
	delete(m.hooks, id)
	delete(m.disabled, id)
	delete(m.info, id)

	target := info.FilePath
	if info.Dir != "" {
		target = info.Dir
	}
	m.mu.Unlock()

	if target != "" {
		if err := os.RemoveAll(target); err != nil {
			return fmt.Errorf("删除插件文件失败: %w", err)
		}
	}

	if m.state != nil {
		if err := m.state.Remove(id); err != nil {
			log.Printf("[Plugin] 清理插件状态失败: %v", err)
		}
	}

	m.notifySearcherChange()
	log.Printf("[Plugin] 🗑️ 已卸载插件: %s", id)
	return nil
}

// GetConfig 返回插件当前持久化配置
func (m *Manager) GetConfig(id string) map[string]string {
	if m.state == nil {
		return map[string]string{}
	}
	return m.state.GetConfig(id)
}

// UpdateConfig 校验并保存插件配置，运行中的插件自动重载生效
func (m *Manager) UpdateConfig(id string, config map[string]string) error {
	m.mu.RLock()
	info, exists := m.info[id]
	m.mu.RUnlock()

	if !exists {
		return fmt.Errorf("插件 %s 不存在", id)
	}
	if m.state == nil {
		return fmt.Errorf("插件系统未启用状态持久化")
	}

	// 按 manifest 声明校验必填项
	for _, field := range info.ConfigSchema {
		if field.Required && strings.TrimSpace(config[field.Key]) == "" {
			return fmt.Errorf("配置项 %s（%s）为必填", field.Label, field.Key)
		}
	}

	if err := m.state.SetConfig(id, config); err != nil {
		return fmt.Errorf("保存插件配置失败: %w", err)
	}

	// 运行中的插件重载以应用新配置；禁用/停止状态下留待下次启动生效
	if info.Status == StatusRunning {
		return m.ReloadByID(id)
	}
	return nil
}

// Dispatch 向所有订阅了该事件的事件钩子插件异步分发事件
// payload 会被序列化为 JSON；分发不阻塞调用方，插件处理失败仅记录日志
func (m *Manager) Dispatch(name string, payload any) {
	if m == nil {
		return
	}

	m.mu.RLock()
	if m.stopped {
		m.mu.RUnlock()
		return
	}
	type target struct {
		id   string
		hook EventHook
	}
	var targets []target
	for id, entry := range m.hooks {
		if m.disabled[id] {
			continue
		}
		if !subscriptionMatches(entry.subs, name) {
			continue
		}
		targets = append(targets, target{id: id, hook: entry.hook})
	}
	m.mu.RUnlock()

	if len(targets) == 0 {
		return
	}

	raw, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[Plugin] 事件 %s 负载序列化失败: %v", name, err)
		return
	}
	event := Event{Name: name, OccurredAt: time.Now(), Payload: raw}

	for _, t := range targets {
		go func(t target) {
			if err := t.hook.OnEvent(context.Background(), event); err != nil {
				log.Printf("[Plugin] 插件 %s 处理事件 %s 失败: %v", t.id, name, err)
			}
		}(t)
	}
}

// subscriptionMatches 判断订阅列表是否匹配事件名
// 空订阅列表视为订阅全部事件（宽松默认，便于最小实现）
func subscriptionMatches(subs []string, name string) bool {
	if len(subs) == 0 {
		return true
	}
	for _, s := range subs {
		if s == EventSubscribeAll || s == name {
			return true
		}
	}
	return false
}

// BestSearcher 返回最佳搜索引擎（使用缓存的引用，避免重复创建 RPC 连接）
func (m *Manager) BestSearcher() model.Searcher {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for id, searcher := range m.searchers {
		if m.disabled[id] {
			continue
		}
		if searcher != nil {
			return searcher
		}
	}
	return nil
}

// List 返回所有插件的信息（含当前配置）
func (m *Manager) List() []PluginInfo {
	m.mu.RLock()
	result := make([]PluginInfo, 0, len(m.info))
	for _, info := range m.info {
		result = append(result, *info)
	}
	m.mu.RUnlock()

	if m.state != nil {
		for i := range result {
			result[i].Config = m.state.GetConfig(result[i].Metadata.ID)
		}
	}
	return result
}

// GetInfo 按 ID 返回插件信息副本
func (m *Manager) GetInfo(id string) (PluginInfo, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	info, exists := m.info[id]
	if !exists {
		return PluginInfo{}, false
	}
	return *info, true
}

// PluginDir 返回插件目录路径
func (m *Manager) PluginDir() string {
	return m.pluginDir
}

// Shutdown 关闭所有插件进程和文件监听（可安全多次调用）
func (m *Manager) Shutdown() {
	m.mu.Lock()
	if m.stopped {
		m.mu.Unlock()
		return
	}
	m.stopped = true
	m.mu.Unlock()

	close(m.stopCh)

	if m.watcher != nil {
		m.watcher.Close()
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	for id, client := range m.clients {
		log.Printf("[Plugin] 关闭插件: %s", id)
		client.Kill()
	}
	m.clients = make(map[string]*goplugin.Client)
	m.searchers = make(map[string]model.Searcher)
	m.hooks = make(map[string]*hookEntry)
	log.Println("[Plugin] 所有插件已关闭")
}

// buildConfigEnv 将插件配置转换为注入插件进程的环境变量
// 提供两种形式：整体 JSON（ANHEYU_PLUGIN_CONFIG）与逐项变量（ANHEYU_PLUGIN_CONFIG_<KEY>）
func buildConfigEnv(config map[string]string) []string {
	if len(config) == 0 {
		return nil
	}
	env := make([]string, 0, len(config)+1)
	if raw, err := json.Marshal(config); err == nil {
		env = append(env, ConfigEnvName+"="+string(raw))
	}
	for k, v := range config {
		env = append(env, ConfigEnvName+"_"+sanitizeEnvKey(k)+"="+v)
	}
	return env
}

// ConfigEnvName 插件配置环境变量名（整体 JSON）
const ConfigEnvName = "ANHEYU_PLUGIN_CONFIG"

// sanitizeEnvKey 将配置 key 规范化为环境变量后缀（大写，非字母数字转下划线）
func sanitizeEnvKey(key string) string {
	upper := strings.ToUpper(key)
	var b strings.Builder
	for _, r := range upper {
		if (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		} else {
			b.WriteRune('_')
		}
	}
	return b.String()
}

var nonExecExts = map[string]bool{
	".md": true, ".txt": true, ".log": true, ".json": true,
	".yaml": true, ".yml": true, ".toml": true, ".ini": true,
	".conf": true, ".cfg": true, ".bak": true, ".tmp": true,
	".zip": true,
}

// isExecutable 判断文件是否可能是插件可执行文件（排除常见非可执行文件）
func isExecutable(name string) bool {
	if runtime.GOOS == "windows" {
		return filepath.Ext(name) == ".exe"
	}
	ext := filepath.Ext(name)
	if ext == ".so" {
		return true
	}
	if nonExecExts[ext] {
		return false
	}
	if name[0] == '.' {
		return false
	}
	return ext == ""
}

// StartHealthCheck 定期检查插件健康状态，自动重启崩溃的插件
func (m *Manager) StartHealthCheck(interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				m.checkHealth()
			case <-m.stopCh:
				return
			}
		}
	}()
	log.Printf("[Plugin] 已启动健康检查（间隔 %v）", interval)
}

func (m *Manager) checkHealth() {
	m.mu.RLock()
	type checkTarget struct {
		id       string
		searcher model.Searcher // 有 searcher 能力时走 RPC 健康检查
		client   *goplugin.Client
	}
	var targets []checkTarget
	for id, info := range m.info {
		if info.Status != StatusRunning || m.disabled[id] {
			continue
		}
		t := checkTarget{id: id, client: m.clients[id]}
		if s, exists := m.searchers[id]; exists && s != nil {
			t.searcher = s
		}
		if t.client == nil && t.searcher == nil {
			continue
		}
		targets = append(targets, t)
	}
	m.mu.RUnlock()

	if len(targets) == 0 {
		return
	}

	// 并行执行健康检查
	type result struct {
		id  string
		err error
	}
	results := make(chan result, len(targets))
	for _, t := range targets {
		go func(t checkTarget) {
			if t.searcher != nil {
				results <- result{id: t.id, err: t.searcher.HealthCheck(context.Background())}
				return
			}
			// 无 searcher 能力的插件（如纯事件钩子）检查进程是否存活
			if t.client != nil && t.client.Exited() {
				results <- result{id: t.id, err: fmt.Errorf("插件进程已退出")}
				return
			}
			results <- result{id: t.id, err: nil}
		}(t)
	}

	var toRestart []string
	for range targets {
		r := <-results
		if r.err != nil {
			log.Printf("[Plugin] 插件 %s 健康检查失败: %v，将尝试重启", r.id, r.err)
			toRestart = append(toRestart, r.id)
		}
	}

	for _, id := range toRestart {
		if err := m.ReloadByID(id); err != nil {
			log.Printf("[Plugin] 重启插件 %s 失败: %v", id, err)
		}
	}
}

// --- 全局管理器 ---

var defaultManager *Manager

// InitManager 初始化全局插件管理器
func InitManager(pluginDir string) (*Manager, error) {
	defaultManager = NewManager(pluginDir)
	if err := defaultManager.DiscoverAndLoad(); err != nil {
		return defaultManager, err
	}
	if err := defaultManager.StartWatcher(); err != nil {
		log.Printf("[Plugin] 启动文件监听失败: %v", err)
	}
	defaultManager.StartHealthCheck(60 * time.Second)
	return defaultManager, nil
}

// DefaultManager 返回全局默认管理器
func DefaultManager() *Manager {
	return defaultManager
}

// Dispatch 通过全局管理器分发事件（插件系统未初始化时为 no-op，业务侧可无条件调用）
func Dispatch(name string, payload any) {
	if defaultManager == nil {
		return
	}
	defaultManager.Dispatch(name, payload)
}
