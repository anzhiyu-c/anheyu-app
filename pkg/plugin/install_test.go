package plugin

import (
	"archive/zip"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// writeZip 在临时目录生成测试用 zip 文件
func writeZip(t *testing.T, entries map[string]string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "plugin.zip")
	f, err := os.Create(path)
	if err != nil {
		t.Fatalf("创建 zip 失败: %v", err)
	}
	defer f.Close()

	w := zip.NewWriter(f)
	for name, content := range entries {
		fw, err := w.Create(name)
		if err != nil {
			t.Fatalf("写入 zip 条目失败: %v", err)
		}
		if _, err := fw.Write([]byte(content)); err != nil {
			t.Fatalf("写入 zip 内容失败: %v", err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatalf("关闭 zip 失败: %v", err)
	}
	return path
}

func TestInstallFromZipMissingManifest(t *testing.T) {
	m := NewManager(t.TempDir())
	zipPath := writeZip(t, map[string]string{"bin/foo": "binary"})

	if _, err := m.InstallFromZip(zipPath); err == nil || !strings.Contains(err.Error(), ManifestFileName) {
		t.Errorf("缺少 manifest 应报错并提示文件名，实际: %v", err)
	}
}

func TestInstallFromZipUnsupportedPlatform(t *testing.T) {
	m := NewManager(t.TempDir())
	zipPath := writeZip(t, map[string]string{
		ManifestFileName: `{"manifest_version":1,"id":"demo-plugin","name":"Demo","version":"1.0","entry":{"plan9-386":"bin/demo"}}`,
		"bin/demo":       "binary",
	})

	if _, err := m.InstallFromZip(zipPath); err == nil || !strings.Contains(err.Error(), "不支持当前平台") {
		t.Errorf("平台不支持应报错，实际: %v", err)
	}
}

func TestInstallFromZipSlipRejected(t *testing.T) {
	pluginDir := t.TempDir()
	m := NewManager(pluginDir)
	zipPath := writeZip(t, map[string]string{
		ManifestFileName:  `{"manifest_version":1,"id":"demo-plugin","name":"Demo","version":"1.0","entry":{"` + CurrentPlatform() + `":"bin/demo"}}`,
		"bin/demo":        "binary",
		"../evil.txt":     "evil",
	})

	if _, err := m.InstallFromZip(zipPath); err == nil || !strings.Contains(err.Error(), "非法路径") {
		t.Errorf("zip slip 应被拒绝，实际: %v", err)
	}
	// 确认没有文件逃逸到插件目录之外
	if _, err := os.Stat(filepath.Join(filepath.Dir(pluginDir), "evil.txt")); !os.IsNotExist(err) {
		t.Error("检测到 zip slip 逃逸文件")
	}
	// 确认无残留临时目录
	entries, err := os.ReadDir(pluginDir)
	if err != nil {
		t.Fatalf("读取插件目录失败: %v", err)
	}
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), ".tmp-install-") {
			t.Errorf("安装失败后残留临时目录: %s", e.Name())
		}
	}
}

func TestInstallFromZipMissingBinary(t *testing.T) {
	m := NewManager(t.TempDir())
	zipPath := writeZip(t, map[string]string{
		ManifestFileName: `{"manifest_version":1,"id":"demo-plugin","name":"Demo","version":"1.0","entry":{"` + CurrentPlatform() + `":"bin/demo"}}`,
		"README.md":      "no binary here",
	})

	if _, err := m.InstallFromZip(zipPath); err == nil || !strings.Contains(err.Error(), "二进制") {
		t.Errorf("缺少二进制应报错，实际: %v", err)
	}
}

func TestInstallFromZipInvalidZip(t *testing.T) {
	m := NewManager(t.TempDir())
	badPath := filepath.Join(t.TempDir(), "bad.zip")
	if err := os.WriteFile(badPath, []byte("not a zip"), 0644); err != nil {
		t.Fatalf("写入文件失败: %v", err)
	}

	if _, err := m.InstallFromZip(badPath); err == nil {
		t.Error("非 zip 文件应报错")
	}
}
