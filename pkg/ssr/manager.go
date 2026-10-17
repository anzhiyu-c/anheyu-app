/*
 * SSR 主题管理器
 * 负责管理 Node.js 进程的启动、停止、状态监控
 * 支持 anheyu-app（社区版）和 anheyu-pro（专业版）
 */
package ssr

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/util"
)

// ThemeStatus SSR 主题状态
type ThemeStatus string

const (
	StatusNotInstalled ThemeStatus = "not_installed" // 未安装
	StatusInstalled    ThemeStatus = "installed"     // 已安装（未运行）
	StatusRunning      ThemeStatus = "running"       // 运行中
	StatusError        ThemeStatus = "error"         // 错误状态
)

// ThemeInfo SSR 主题信息
type ThemeInfo struct {
	Name        string      `json:"name"`
	Version     string      `json:"version"`
	Status      ThemeStatus `json:"status"`
	Port        int         `json:"port,omitempty"`
	InstalledAt *time.Time  `json:"installedAt,omitempty"`
	StartedAt   *time.Time  `json:"startedAt,omitempty"`
}

// runningTheme 运行中的主题信息
type runningTheme struct {
	cmd       *exec.Cmd
	port      int
	startedAt time.Time
}

// Manager SSR 主题管理器
type Manager struct {
	themesDir string                   // 主题存储目录
	processes map[string]*runningTheme // 运行中的主题进程
	mu        sync.RWMutex
	basePort  int // SSR 主题基础端口
}

// NewManager 创建 SSR 主题管理器
func NewManager(themesDir string) *Manager {
	// 确保主题目录存在
	if err := os.MkdirAll(themesDir, 0755); err != nil {
		log.Printf("[SSR] 创建主题目录失败: %s, 错误: %v", themesDir, err)
	}

	return &Manager{
		themesDir: themesDir,
		processes: make(map[string]*runningTheme),
		basePort:  3000,
	}
}

// GetThemesDir 获取主题目录路径
func (m *Manager) GetThemesDir() string {
	return m.themesDir
}

// validateThemeName 验证主题名不含路径穿越字符
func validateThemeName(name string) error {
	if name == "" {
		return fmt.Errorf("主题名称不能为空")
	}
	if name == "." || strings.ContainsAny(name, "/\\:\x00") || strings.Contains(name, "..") {
		return fmt.Errorf("主题名称包含非法字符")
	}
	if filepath.Base(name) != name {
		return fmt.Errorf("主题名称无效")
	}
	return nil
}

var ssrDownloadClient = util.NewPublicHTTPClient(2*time.Minute, true)

// Install 下载并安装 SSR 主题
func (m *Manager) Install(ctx context.Context, themeName, downloadURL string) error {
	if err := validateThemeName(themeName); err != nil {
		return err
	}

	// 验证下载 URL 安全性，防止 SSRF
	if err := util.ValidatePublicHTTPURL(downloadURL, true); err != nil {
		return err
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	themesRoot, err := m.openThemesRoot()
	if err != nil {
		return err
	}
	defer func() {
		if err := themesRoot.Close(); err != nil {
			log.Printf("[SSR] 关闭主题目录失败: %v", err)
		}
	}()

	themePath := filepath.Join(m.themesDir, themeName)

	// 检查是否已安装
	if _, err := themesRoot.Lstat(themeName); err == nil {
		return errors.New("theme already installed")
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("检查主题目录失败: %w", err)
	}

	// 下载主题包
	log.Printf("[SSR] 正在下载主题: %s", themeName)

	req, err := http.NewRequestWithContext(ctx, "GET", downloadURL, nil)
	if err != nil {
		return fmt.Errorf("create request failed: %w", err)
	}

	resp, err := ssrDownloadClient.Do(req)
	if err != nil {
		return fmt.Errorf("download failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed with status: %d", resp.StatusCode)
	}
	const maxDownloadBytes = 256 << 20
	if resp.ContentLength > maxDownloadBytes {
		return fmt.Errorf("主题下载超过大小限制")
	}

	// 解压到主题目录
	if err := m.extractTarGz(io.LimitReader(resp.Body, maxDownloadBytes+1), themePath); err != nil {
		if cleanupErr := themesRoot.RemoveAll(themeName); cleanupErr != nil {
			return fmt.Errorf("extract failed: %w; cleanup failed: %v", err, cleanupErr)
		}
		return fmt.Errorf("extract failed: %w", err)
	}

	log.Printf("[SSR] 主题安装成功: %s", themeName)
	return nil
}

func (m *Manager) openThemesRoot() (*os.Root, error) {
	info, err := os.Lstat(filepath.Clean(m.themesDir))
	if err != nil {
		return nil, fmt.Errorf("检查主题根目录失败: %w", err)
	}
	if info.Mode()&os.ModeSymlink != 0 || !info.IsDir() {
		return nil, fmt.Errorf("主题根目录必须为真实目录")
	}
	return os.OpenRoot(filepath.Clean(m.themesDir))
}

// extractTarGz 解压 tar.gz 文件
func (m *Manager) extractTarGz(r io.Reader, destDir string) error {
	name, err := filepath.Rel(filepath.Clean(m.themesDir), filepath.Clean(destDir))
	if err != nil || validateThemeName(name) != nil {
		return fmt.Errorf("不安全的主题解压目录: %s", destDir)
	}
	themesRoot, err := m.openThemesRoot()
	if err != nil {
		return err
	}
	defer func() {
		if err := themesRoot.Close(); err != nil {
			log.Printf("[SSR] 关闭主题目录失败: %v", err)
		}
	}()
	if info, err := themesRoot.Lstat(name); err == nil {
		if info.Mode()&os.ModeSymlink != 0 || !info.IsDir() {
			return fmt.Errorf("主题解压目录必须为真实目录")
		}
	} else if !os.IsNotExist(err) {
		return err
	}
	if err := themesRoot.MkdirAll(name, 0755); err != nil {
		return err
	}
	root, err := themesRoot.OpenRoot(name)
	if err != nil {
		return err
	}
	defer func() {
		if err := root.Close(); err != nil {
			log.Printf("[SSR] 关闭主题解压目录失败: %v", err)
		}
	}()

	gzr, err := gzip.NewReader(r)
	if err != nil {
		return err
	}
	defer func() {
		if err := gzr.Close(); err != nil {
			log.Printf("[SSR] 关闭主题归档失败: %v", err)
		}
	}()

	const maxExpandedBytes = 512 << 20
	tr := tar.NewReader(gzr)
	var expandedBytes int64
	entryCount := 0

	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		entryCount++
		if header.Size < 0 || header.Size > maxExpandedBytes-expandedBytes || entryCount > 10000 {
			return fmt.Errorf("主题归档超过解压限制")
		}
		expandedBytes += header.Size

		// 先检查原始路径，避免去除包装目录后掩盖非法路径。
		name := header.Name
		if strings.HasPrefix(name, "/") || strings.ContainsAny(name, "\\:\x00") {
			return fmt.Errorf("invalid file path: %s", name)
		}
		for _, part := range strings.Split(name, "/") {
			if part == ".." {
				return fmt.Errorf("invalid file path: %s", name)
			}
		}
		if header.Typeflag != tar.TypeDir && header.Typeflag != tar.TypeReg {
			return fmt.Errorf("不支持的归档文件类型: %s", name)
		}
		// 去除可能的顶层目录前缀（如 "theme-nova/"）
		parts := strings.SplitN(name, "/", 2)
		if len(parts) == 2 {
			name = parts[1]
		} else {
			name = parts[0]
		}

		if name == "" {
			continue
		}

		target := filepath.FromSlash(name)
		if !filepath.IsLocal(target) {
			return fmt.Errorf("invalid file path: %s", name)
		}

		switch header.Typeflag {
		case tar.TypeDir:
			if err := root.MkdirAll(target, 0755); err != nil {
				return err
			}
		case tar.TypeReg:
			const maxFileSize = 100 * 1024 * 1024 // 单文件最大 100MB
			if header.Size > maxFileSize {
				return fmt.Errorf("文件过大: %s (%d bytes > %d bytes)", name, header.Size, maxFileSize)
			}
			if err := root.MkdirAll(filepath.Dir(target), 0755); err != nil {
				return err
			}
			f, err := root.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
			if err != nil {
				return err
			}
			_, copyErr := io.Copy(f, io.LimitReader(tr, maxFileSize))
			closeErr := f.Close()
			if err := errors.Join(copyErr, closeErr); err != nil {
				return fmt.Errorf("写入主题文件失败: %w", err)
			}
		}
	}
	return nil
}

// Uninstall 卸载 SSR 主题
func (m *Manager) Uninstall(themeName string) error {
	if err := validateThemeName(themeName); err != nil {
		return err
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	root, err := m.openThemesRoot()
	if err != nil {
		return err
	}
	defer func() {
		if err := root.Close(); err != nil {
			log.Printf("[SSR] 关闭主题目录失败: %v", err)
		}
	}()

	// 先停止运行中的进程
	if rt, exists := m.processes[themeName]; exists && rt.cmd.Process != nil {
		rt.cmd.Process.Signal(syscall.SIGTERM)
		rt.cmd.Wait()
		delete(m.processes, themeName)
	}

	if err := root.RemoveAll(themeName); err != nil {
		return fmt.Errorf("remove theme failed: %w", err)
	}

	log.Printf("[SSR] 主题卸载成功: %s", themeName)
	return nil
}

// Start 启动 SSR 主题
func (m *Manager) Start(themeName string, port int) error {
	if err := validateThemeName(themeName); err != nil {
		return err
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// 检查是否已在运行
	if rt, exists := m.processes[themeName]; exists && rt.cmd.Process != nil {
		return errors.New("theme already running")
	}

	themePath := filepath.Join(m.themesDir, themeName)
	serverJS := filepath.Join(themePath, "server.js")

	// 检查主题是否已安装
	if _, err := os.Stat(serverJS); os.IsNotExist(err) {
		return errors.New("theme not installed or server.js not found")
	}

	// 启动 Node.js 进程
	// 注意：使用相对路径 server.js 而不是绝对路径，因为 Next.js 对工作目录有特殊要求
	cmd := exec.Command("node", "server.js")
	cmd.Dir = themePath
	cmd.Env = append(os.Environ(),
		fmt.Sprintf("PORT=%d", port),
		"API_URL=http://localhost:8091",
		"HOSTNAME=0.0.0.0",
	)

	// 设置日志输出
	logFile, err := os.OpenFile(
		filepath.Join(themePath, "ssr.log"),
		os.O_CREATE|os.O_WRONLY|os.O_APPEND,
		0644,
	)
	if err == nil {
		cmd.Stdout = logFile
		cmd.Stderr = logFile
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start node process failed: %w", err)
	}

	now := time.Now()
	m.processes[themeName] = &runningTheme{
		cmd:       cmd,
		port:      port,
		startedAt: now,
	}

	// 后台监控进程
	go func() {
		cmd.Wait()
		m.mu.Lock()
		delete(m.processes, themeName)
		m.mu.Unlock()
		log.Printf("[SSR] 主题进程已退出: %s", themeName)
	}()

	// 等待 SSR 主题就绪（健康检查）
	// 在后台进行健康检查，不阻塞主流程
	go m.waitForReady(themeName, port)

	log.Printf("[SSR] 主题启动成功: %s, 端口: %d", themeName, port)
	return nil
}

// waitForReady 等待 SSR 主题 HTTP 服务就绪
func (m *Manager) waitForReady(themeName string, port int) {
	healthURL := fmt.Sprintf("http://localhost:%d/", port)
	maxTimeout := 30 * time.Second // 最大等待时间 30 秒
	checkInterval := time.Second   // 每次检查间隔 1 秒
	httpTimeout := 2 * time.Second // HTTP 请求超时 2 秒
	startTime := time.Now()

	for {
		elapsed := time.Since(startTime)
		if elapsed >= maxTimeout {
			log.Printf("[SSR] ⚠️ 主题健康检查超时: %s（已等待 %.1f 秒）", themeName, elapsed.Seconds())
			return
		}

		// 检查进程是否还在运行
		m.mu.RLock()
		rt, exists := m.processes[themeName]
		if !exists || rt.cmd.Process == nil {
			m.mu.RUnlock()
			log.Printf("[SSR] 主题进程已退出，停止健康检查: %s", themeName)
			return
		}
		m.mu.RUnlock()

		// 尝试连接
		client := &http.Client{Timeout: httpTimeout}
		resp, err := client.Get(healthURL)
		if err == nil {
			resp.Body.Close()
			log.Printf("[SSR] 主题 HTTP 服务已就绪: %s (等待了 %.1f 秒)", themeName, time.Since(startTime).Seconds())
			return
		}

		time.Sleep(checkInterval)
	}
}

// Stop 停止 SSR 主题
func (m *Manager) Stop(themeName string) error {
	if err := validateThemeName(themeName); err != nil {
		return err
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	rt, exists := m.processes[themeName]
	if !exists || rt.cmd.Process == nil {
		return errors.New("theme not running")
	}

	// 优雅关闭
	if err := rt.cmd.Process.Signal(syscall.SIGTERM); err != nil {
		rt.cmd.Process.Kill()
	}

	// 等待进程结束（超时 5 秒）
	done := make(chan error, 1)
	go func() {
		done <- rt.cmd.Wait()
	}()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		rt.cmd.Process.Kill()
	}

	delete(m.processes, themeName)
	log.Printf("[SSR] 主题停止成功: %s", themeName)
	return nil
}

// GetPort 获取运行中主题的端口号
// 如果主题未运行，返回 0
func (m *Manager) GetPort(themeName string) int {
	if err := validateThemeName(themeName); err != nil {
		return 0
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	if rt, exists := m.processes[themeName]; exists && rt.cmd.Process != nil {
		return rt.port
	}
	return 0
}

// GetStatus 获取主题状态
func (m *Manager) GetStatus(themeName string) ThemeInfo {
	if err := validateThemeName(themeName); err != nil {
		return ThemeInfo{Name: themeName, Status: StatusError}
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	info := ThemeInfo{Name: themeName}
	themePath := filepath.Join(m.themesDir, themeName)

	// 检查是否安装
	stat, err := os.Stat(themePath)
	if os.IsNotExist(err) {
		info.Status = StatusNotInstalled
		return info
	}

	info.Status = StatusInstalled

	// 获取安装时间
	if stat != nil {
		modTime := stat.ModTime()
		info.InstalledAt = &modTime
	}

	// 检查是否运行
	if rt, exists := m.processes[themeName]; exists && rt.cmd.Process != nil {
		info.Status = StatusRunning
		info.Port = rt.port
		info.StartedAt = &rt.startedAt
	}

	// 读取版本信息
	versionFile := filepath.Join(themePath, "version.txt")
	if data, err := os.ReadFile(versionFile); err == nil {
		info.Version = strings.TrimSpace(string(data))
	}

	return info
}

// ListInstalled 列出所有已安装的 SSR 主题
func (m *Manager) ListInstalled() ([]ThemeInfo, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	entries, err := os.ReadDir(m.themesDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []ThemeInfo{}, nil
		}
		return nil, err
	}

	var themes []ThemeInfo
	for _, entry := range entries {
		if entry.IsDir() {
			// 检查是否有 server.js 文件（验证是 SSR 主题）
			serverJS := filepath.Join(m.themesDir, entry.Name(), "server.js")
			if _, err := os.Stat(serverJS); err == nil {
				themes = append(themes, m.getStatusUnlocked(entry.Name()))
			}
		}
	}
	return themes, nil
}

// getStatusUnlocked 获取主题状态（不加锁版本，内部使用）
func (m *Manager) getStatusUnlocked(themeName string) ThemeInfo {
	info := ThemeInfo{Name: themeName}
	themePath := filepath.Join(m.themesDir, themeName)

	// 检查是否安装
	stat, err := os.Stat(themePath)
	if os.IsNotExist(err) {
		info.Status = StatusNotInstalled
		return info
	}

	info.Status = StatusInstalled

	// 获取安装时间
	if stat != nil {
		modTime := stat.ModTime()
		info.InstalledAt = &modTime
	}

	// 检查是否运行
	if rt, exists := m.processes[themeName]; exists && rt.cmd.Process != nil {
		info.Status = StatusRunning
		info.Port = rt.port
		info.StartedAt = &rt.startedAt
	}

	// 读取版本信息
	versionFile := filepath.Join(themePath, "version.txt")
	if data, err := os.ReadFile(versionFile); err == nil {
		info.Version = strings.TrimSpace(string(data))
	}

	return info
}

// GetRunningTheme 获取当前运行中的 SSR 主题（只允许一个）
// 返回第一个运行中的主题信息，如果没有运行中的主题则返回 nil
func (m *Manager) GetRunningTheme() *ThemeInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for name, rt := range m.processes {
		if rt.cmd.Process != nil {
			info := ThemeInfo{
				Name:      name,
				Status:    StatusRunning,
				Port:      rt.port,
				StartedAt: &rt.startedAt,
			}
			return &info
		}
	}
	return nil
}

// StopAll 停止所有运行中的 SSR 主题
func (m *Manager) StopAll() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for name, rt := range m.processes {
		if rt.cmd.Process != nil {
			rt.cmd.Process.Signal(syscall.SIGTERM)
			rt.cmd.Wait()
			log.Printf("[SSR] 主题停止成功: %s", name)
		}
	}
	m.processes = make(map[string]*runningTheme)
	return nil
}

// IsRunning 检查主题是否正在运行
func (m *Manager) IsRunning(themeName string) bool {
	if err := validateThemeName(themeName); err != nil {
		return false
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	rt, exists := m.processes[themeName]
	return exists && rt.cmd.Process != nil
}

// ListRunning 列出所有正在运行的主题
func (m *Manager) ListRunning() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var running []string
	for name, rt := range m.processes {
		if rt.cmd.Process != nil {
			running = append(running, name)
		}
	}
	return running
}
