package ssr

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"math"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func ssrArchive(t *testing.T, name string, kind byte, extraFiles ...string) []byte {
	t.Helper()
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	header := &tar.Header{Name: name, Typeflag: kind, Mode: 0755}
	if kind == tar.TypeReg {
		header.Size = int64(len("harmless test content"))
	} else {
		header.Linkname = "../outside"
	}
	if err := tw.WriteHeader(header); err != nil {
		t.Fatal(err)
	}
	if kind == tar.TypeReg {
		if _, err := tw.Write([]byte("harmless test content")); err != nil {
			t.Fatal(err)
		}
	}
	for _, name := range extraFiles {
		if err := tw.WriteHeader(&tar.Header{Name: name, Typeflag: tar.TypeReg, Mode: 0755, Size: int64(len("harmless test content"))}); err != nil {
			t.Fatal(err)
		}
		if _, err := tw.Write([]byte("harmless test content")); err != nil {
			t.Fatal(err)
		}
	}
	if err := tw.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gz.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestSSRArchiveRejectsUnsafePaths(t *testing.T) {
	for _, name := range []string{
		"theme-safe/../theme-safe-other/probe.txt",
		"theme-safe/../../data/plugins/probe.txt",
		"/theme-safe/probe.txt",
		`theme-safe/..\outside\probe.txt`,
		"theme-safe/C:/probe.txt",
	} {
		t.Run(name, func(t *testing.T) {
			base := t.TempDir()
			manager := NewManager(base)
			dest := filepath.Join(base, "theme-safe")
			err := manager.extractTarGz(bytes.NewReader(ssrArchive(t, name, tar.TypeReg)), dest)
			if err == nil {
				t.Errorf("unsafe archive path accepted: %q", name)
			}
			if _, err := os.Stat(filepath.Join(base, "theme-safe-other", "probe.txt")); !os.IsNotExist(err) {
				t.Errorf("archive escaped into sibling directory: %v", err)
			}
		})
	}
}

func TestSSRArchiveRejectsLinks(t *testing.T) {
	for _, kind := range []byte{tar.TypeSymlink, tar.TypeLink} {
		manager := NewManager(t.TempDir())
		err := manager.extractTarGz(bytes.NewReader(ssrArchive(t, "theme-safe/link", kind)), filepath.Join(manager.themesDir, "theme-safe"))
		if err == nil {
			t.Errorf("archive link type %q accepted", kind)
		}
	}
}

func TestSSRArchiveDoesNotFollowExistingLinks(t *testing.T) {
	for _, linkTarget := range []string{"destination", "file", "directory"} {
		t.Run(linkTarget, func(t *testing.T) {
			base := t.TempDir()
			outside := t.TempDir()
			dest := filepath.Join(base, "theme-safe")
			probe := filepath.Join(outside, "probe.txt")
			if err := os.WriteFile(probe, []byte("original"), 0644); err != nil {
				t.Fatal(err)
			}
			name := "theme-safe/probe.txt"
			if linkTarget == "destination" {
				if err := os.Symlink(outside, dest); err != nil {
					t.Fatal(err)
				}
			} else {
				if err := os.MkdirAll(dest, 0755); err != nil {
					t.Fatal(err)
				}
				if linkTarget == "file" {
					if err := os.Symlink(probe, filepath.Join(dest, "probe.txt")); err != nil {
						t.Fatal(err)
					}
				} else {
					name = "theme-safe/linked/probe.txt"
					if err := os.Symlink(outside, filepath.Join(dest, "linked")); err != nil {
						t.Fatal(err)
					}
				}
			}
			err := NewManager(base).extractTarGz(bytes.NewReader(ssrArchive(t, name, tar.TypeReg)), dest)
			if err == nil {
				t.Error("extraction followed an existing link outside destination")
			}
			data, err := os.ReadFile(probe)
			if err != nil || string(data) != "original" {
				t.Errorf("outside file changed: %q, error=%v", data, err)
			}
		})
	}
}

func TestSSRArchiveExtractsValidTheme(t *testing.T) {
	base := t.TempDir()
	dest := filepath.Join(base, "theme-safe")
	archive := ssrArchive(t, "theme-safe/server.js", tar.TypeReg, "theme-safe/node_modules/package/index.js", "theme-safe/public/static/main.css")
	if err := NewManager(base).extractTarGz(bytes.NewReader(archive), dest); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"server.js", "node_modules/package/index.js", "public/static/main.css"} {
		filename := filepath.Join(dest, filepath.FromSlash(name))
		data, err := os.ReadFile(filename)
		if err != nil || string(data) != "harmless test content" {
			t.Fatalf("valid theme extraction failed for %s: %q, error=%v", name, data, err)
		}
		info, err := os.Stat(filename)
		if err != nil {
			t.Fatal(err)
		}
		if info.Mode().Perm()&0111 != 0 {
			t.Errorf("archive executable permission retained for %s: %v", name, info.Mode())
		}
	}
}

func TestSSRArchiveRejectsLinkedThemesRoot(t *testing.T) {
	base := t.TempDir()
	outside := t.TempDir()
	linked := filepath.Join(base, "themes")
	if err := os.Symlink(outside, linked); err != nil {
		t.Fatal(err)
	}
	for _, themesDir := range []string{linked, linked + string(filepath.Separator)} {
		manager := NewManager(themesDir)
		if err := manager.extractTarGz(bytes.NewReader(ssrArchive(t, "theme-safe/server.js", tar.TypeReg)), filepath.Join(themesDir, "theme-safe")); err == nil {
			t.Errorf("linked themes root accepted: %q", themesDir)
		}
	}
	if _, err := os.Stat(filepath.Join(outside, "theme-safe")); !os.IsNotExist(err) {
		t.Fatalf("wrote through linked themes root: %v", err)
	}
}

func TestSSRUninstallRejectsLinkedThemesRoot(t *testing.T) {
	base := t.TempDir()
	outside := t.TempDir()
	if err := os.Mkdir(filepath.Join(outside, "theme-safe"), 0755); err != nil {
		t.Fatal(err)
	}
	linked := filepath.Join(base, "themes")
	if err := os.Symlink(outside, linked); err != nil {
		t.Fatal(err)
	}
	if err := NewManager(linked).Uninstall("theme-safe"); err == nil {
		t.Fatal("uninstall accepted a linked themes root")
	}
	if _, err := os.Stat(filepath.Join(outside, "theme-safe")); err != nil {
		t.Fatalf("uninstall modified outside directory: %v", err)
	}
}

func TestSSRArchiveRejectsExpandedSizeOverflow(t *testing.T) {
	var archive bytes.Buffer
	gz := gzip.NewWriter(&archive)
	tw := tar.NewWriter(gz)
	// 目录不含正文，但 tar.Reader 保留其声明的 Size。
	// 若先累加再比较，1 + MaxInt64 会翻负，从而绕过解压总量上限。
	for _, header := range []*tar.Header{
		{Name: "theme-safe/seed/", Typeflag: tar.TypeDir, Mode: 0755, Size: 1, Format: tar.FormatGNU},
		{Name: "theme-safe/overflow/", Typeflag: tar.TypeDir, Mode: 0755, Size: math.MaxInt64, Format: tar.FormatGNU},
	} {
		if err := tw.WriteHeader(header); err != nil {
			t.Fatal(err)
		}
	}
	if err := tw.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gz.Close(); err != nil {
		t.Fatal(err)
	}
	base := t.TempDir()
	err := NewManager(base).extractTarGz(bytes.NewReader(archive.Bytes()), filepath.Join(base, "theme-safe"))
	if err == nil || !strings.Contains(err.Error(), "解压限制") {
		t.Fatalf("expanded size overflow was not rejected: %v", err)
	}
}
