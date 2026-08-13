/*
 * @Description: 插件安装 - zip 包校验、防 zip slip、原子解压与升级替换
 * @Author: 安知鱼
 * @Date: 2026-08-13
 */
package plugin

import (
	"archive/zip"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"time"
)

const (
	// maxUncompressedSize 解压后总大小上限，防 zip 炸弹
	maxUncompressedSize = 512 << 20 // 512MB
	// maxFileCount 包内文件数量上限
	maxFileCount = 1000
)

// InstallFromZip 从 zip 安装包安装（或升级）插件
// 流程：解析校验 manifest -> 解压到临时目录（防 zip slip）-> 原子替换 -> 加载
// 升级同 ID 插件时保留其持久化配置与禁用状态
func (m *Manager) InstallFromZip(zipPath string) (PluginInfo, error) {
	if m.pluginDir == "" {
		return PluginInfo{}, fmt.Errorf("插件系统未配置插件目录")
	}

	reader, err := zip.OpenReader(zipPath)
	if err != nil {
		return PluginInfo{}, fmt.Errorf("打开插件包失败（不是有效的 zip 文件）: %w", err)
	}
	defer reader.Close()

	manifest, err := readManifestFromZip(&reader.Reader)
	if err != nil {
		return PluginInfo{}, err
	}

	binRel, err := manifest.EntryForCurrentPlatform()
	if err != nil {
		return PluginInfo{}, err
	}

	// 解压到插件目录内的临时目录（同一文件系统，保证 rename 原子性）
	tmpDir, err := os.MkdirTemp(m.pluginDir, ".tmp-install-*")
	if err != nil {
		return PluginInfo{}, fmt.Errorf("创建临时目录失败: %w", err)
	}
	cleanup := true
	defer func() {
		if cleanup {
			os.RemoveAll(tmpDir)
		}
	}()

	if err := extractZip(&reader.Reader, tmpDir); err != nil {
		return PluginInfo{}, err
	}

	binPath := filepath.Join(tmpDir, filepath.FromSlash(binRel))
	if _, err := os.Stat(binPath); err != nil {
		return PluginInfo{}, fmt.Errorf("安装包中缺少当前平台（%s）的二进制文件: %s", CurrentPlatform(), binRel)
	}
	if runtime.GOOS != "windows" {
		if err := os.Chmod(binPath, 0755); err != nil {
			return PluginInfo{}, fmt.Errorf("设置二进制可执行权限失败: %w", err)
		}
	}

	// 同 ID 插件已存在时执行升级：停止旧进程并移除旧文件（保留配置与禁用状态）
	finalDir := filepath.Join(m.pluginDir, manifest.ID)
	if err := m.removeExistingForUpgrade(manifest.ID, finalDir); err != nil {
		return PluginInfo{}, err
	}

	// 标记安装中：抑制文件监听对 rename 产生的 Create 事件重复加载
	m.markInstalling(finalDir, true)
	defer m.markInstalling(finalDir, false)

	if err := os.Rename(tmpDir, finalDir); err != nil {
		return PluginInfo{}, fmt.Errorf("安装插件目录失败: %w", err)
	}
	cleanup = false

	if err := m.loadDirectoryPlugin(finalDir); err != nil {
		return PluginInfo{}, fmt.Errorf("插件已安装但加载失败: %w", err)
	}
	m.notifySearcherChange()

	info, _ := m.GetInfo(manifest.ID)
	log.Printf("[Plugin] 📦 已安装插件: %s v%s", manifest.Name, manifest.Version)
	return info, nil
}

// removeExistingForUpgrade 升级前停止并移除同 ID 的旧插件文件（不清理持久化状态）
func (m *Manager) removeExistingForUpgrade(id, finalDir string) error {
	m.mu.Lock()
	var oldTarget string
	if old, exists := m.info[id]; exists {
		if client, ok := m.clients[id]; ok {
			client.Kill()
			delete(m.clients, id)
		}
		delete(m.searchers, id)
		delete(m.hooks, id)
		delete(m.info, id)
		oldTarget = old.FilePath
		if old.Dir != "" {
			oldTarget = old.Dir
		}
	}
	m.mu.Unlock()

	if oldTarget != "" {
		if err := os.RemoveAll(oldTarget); err != nil {
			return fmt.Errorf("移除旧版本插件失败: %w", err)
		}
	}
	// 防御历史残留目录（如上次安装中断）
	if err := os.RemoveAll(finalDir); err != nil {
		return fmt.Errorf("清理插件目录失败: %w", err)
	}
	return nil
}

// readManifestFromZip 从 zip 根目录读取并校验 plugin.json
func readManifestFromZip(reader *zip.Reader) (*Manifest, error) {
	for _, f := range reader.File {
		if f.Name != ManifestFileName {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return nil, fmt.Errorf("读取 %s 失败: %w", ManifestFileName, err)
		}
		data, err := io.ReadAll(io.LimitReader(rc, 1<<20))
		rc.Close()
		if err != nil {
			return nil, fmt.Errorf("读取 %s 失败: %w", ManifestFileName, err)
		}
		return ParseManifest(data)
	}
	return nil, fmt.Errorf("安装包缺少 %s（必须位于压缩包根目录）", ManifestFileName)
}

// extractZip 解压 zip 到目标目录，包含 zip slip、zip 炸弹与文件数量防护
func extractZip(reader *zip.Reader, destDir string) error {
	if len(reader.File) > maxFileCount {
		return fmt.Errorf("安装包内文件数量超过上限（%d）", maxFileCount)
	}

	var totalSize uint64
	for _, f := range reader.File {
		totalSize += f.UncompressedSize64
		if totalSize > maxUncompressedSize {
			return fmt.Errorf("安装包解压后大小超过上限（%dMB）", maxUncompressedSize>>20)
		}
	}

	for _, f := range reader.File {
		name := filepath.FromSlash(f.Name)
		// zip slip 防护：路径必须是目标目录内的相对路径
		if filepath.IsAbs(name) || !filepath.IsLocal(name) {
			return fmt.Errorf("安装包内存在非法路径: %s", f.Name)
		}
		target := filepath.Join(destDir, name)

		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0755); err != nil {
				return fmt.Errorf("创建目录失败: %w", err)
			}
			continue
		}
		// 跳过符号链接等非常规文件，避免链接逃逸
		if !f.Mode().IsRegular() {
			continue
		}

		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return fmt.Errorf("创建目录失败: %w", err)
		}

		if err := extractZipFile(f, target); err != nil {
			return err
		}
	}
	return nil
}

// extractZipFile 解压单个文件
func extractZipFile(f *zip.File, target string) error {
	rc, err := f.Open()
	if err != nil {
		return fmt.Errorf("读取安装包文件 %s 失败: %w", f.Name, err)
	}
	defer rc.Close()

	// 部分 Windows 工具打包的 zip 条目权限为 0，兜底为可读写
	perm := f.Mode().Perm()
	if perm == 0 {
		perm = 0644
	}
	out, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, perm)
	if err != nil {
		return fmt.Errorf("写入文件 %s 失败: %w", f.Name, err)
	}
	defer out.Close()

	// 逐文件限制拷贝大小，防止 header 伪造的 zip 炸弹
	limited := io.LimitReader(rc, maxUncompressedSize+1)
	written, err := io.Copy(out, limited)
	if err != nil {
		return fmt.Errorf("解压文件 %s 失败: %w", f.Name, err)
	}
	if written > maxUncompressedSize {
		return fmt.Errorf("安装包文件 %s 解压后超过大小上限", f.Name)
	}
	return nil
}

// SaveUploadToTemp 将上传流保存为临时 zip 文件，返回文件路径（调用方负责删除）
func SaveUploadToTemp(src io.Reader) (string, error) {
	tmpFile, err := os.CreateTemp("", fmt.Sprintf("anheyu-plugin-upload-%d-*.zip", time.Now().UnixNano()))
	if err != nil {
		return "", fmt.Errorf("创建临时文件失败: %w", err)
	}
	defer tmpFile.Close()

	if _, err := io.Copy(tmpFile, src); err != nil {
		os.Remove(tmpFile.Name())
		return "", fmt.Errorf("保存上传文件失败: %w", err)
	}
	return tmpFile.Name(), nil
}
