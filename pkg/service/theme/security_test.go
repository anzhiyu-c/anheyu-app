package theme

import (
	"archive/zip"
	"bytes"
	"context"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type themeZIPEntry struct {
	name string
	body string
	mode fs.FileMode
}

func writeThemeZIP(t *testing.T, entries []themeZIPEntry) string {
	t.Helper()
	var data bytes.Buffer
	w := zip.NewWriter(&data)
	for _, entry := range entries {
		header := &zip.FileHeader{Name: entry.name, Method: zip.Deflate}
		if entry.mode != 0 {
			header.SetMode(entry.mode)
		}
		file, err := w.CreateHeader(header)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := file.Write([]byte(entry.body)); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	zipPath := filepath.Join(t.TempDir(), "theme.zip")
	if err := os.WriteFile(zipPath, data.Bytes(), 0600); err != nil {
		t.Fatal(err)
	}
	return zipPath
}

func themeTestDir(t *testing.T) string {
	t.Helper()
	dir, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	return dir
}

func TestThemeOperationsRejectTraversalBeforeDatabase(t *testing.T) {
	s := &themeService{}
	ctx := context.Background()
	name := "theme-xxx/../../data/plugins"
	cases := map[string]func() error{
		"install":       func() error { return s.InstallTheme(ctx, 1, &ThemeInstallRequest{ThemeName: name}) },
		"transaction":   func() error { return s.ThemeInstallWithTransaction(ctx, 1, &ThemeInstallRequest{ThemeName: name}) },
		"switch":        func() error { return s.SwitchToTheme(ctx, 1, name, nil) },
		"uninstall":     func() error { return s.UninstallTheme(ctx, 1, name) },
		"settings":      func() error { _, err := s.GetThemeSettings(ctx, name); return err },
		"get-config":    func() error { _, err := s.GetUserThemeConfig(ctx, 1, name); return err },
		"save-config":   func() error { return s.SaveUserThemeConfig(ctx, 1, name, nil) },
		"install-ssr":   func() error { return s.InstallSSRTheme(ctx, 1, name, "1.0.0", 0) },
		"uninstall-ssr": func() error { return s.UninstallSSRTheme(ctx, 1, name) },
		"switch-ssr":    func() error { return s.SwitchToSSRTheme(ctx, 1, name, nil) },
	}
	for label, operation := range cases {
		t.Run(label, func(t *testing.T) {
			defer func() {
				if recovered := recover(); recovered != nil {
					t.Errorf("invalid name reached database before validation: %v", recovered)
				}
			}()
			if err := operation(); err == nil {
				t.Fatal("expected invalid theme name to be rejected")
			}
		})
	}
}

func TestExtractZIPRejectsUnsafeEntriesBeforeWriting(t *testing.T) {
	cases := []themeZIPEntry{
		{name: "../escape.txt", body: "unsafe"},
		{name: "/absolute.txt", body: "unsafe"},
		{name: `static\escape.txt`, body: "unsafe"},
		{name: "C:/escape.txt", body: "unsafe"},
		{name: "static/invalid\x00.txt", body: "unsafe"},
		{name: "static/link", body: "../../outside", mode: os.ModeSymlink | 0777},
		{name: "static/link-dir/", mode: os.ModeSymlink | 0777},
		{name: "static/pipe", mode: os.ModeNamedPipe | 0600},
	}
	for _, entry := range cases {
		t.Run(entry.name, func(t *testing.T) {
			dest := filepath.Join(themeTestDir(t), "theme-safe")
			archive := writeThemeZIP(t, []themeZIPEntry{{name: "index.html", body: "safe"}, entry})
			if err := (&themeService{}).extractZip(archive, dest); err == nil {
				t.Error("expected unsafe archive to be rejected")
			}
			if _, err := os.Stat(filepath.Join(dest, "index.html")); !os.IsNotExist(err) {
				t.Errorf("archive wrote its safe entry before rejection: %v", err)
			}
		})
	}
}

func TestExtractZIPRejectsExistingSymlinks(t *testing.T) {
	for _, location := range []string{"root", "parent", "directory", "file"} {
		t.Run(location, func(t *testing.T) {
			base := themeTestDir(t)
			outside := filepath.Join(base, "outside")
			if err := os.MkdirAll(outside, 0755); err != nil {
				t.Fatal(err)
			}
			sentinel := filepath.Join(outside, "sentinel.txt")
			if err := os.WriteFile(sentinel, []byte("unchanged"), 0644); err != nil {
				t.Fatal(err)
			}
			dest := filepath.Join(base, "themes", "theme-safe")
			entry := "sentinel.txt"
			var link, target string
			switch location {
			case "parent":
				link, target = filepath.Dir(dest), outside
			case "root":
				link, target = dest, outside
			case "directory":
				link, target = filepath.Join(dest, "static"), outside
				entry = "static/sentinel.txt"
			case "file":
				link, target = filepath.Join(dest, "sentinel.txt"), sentinel
			}
			if err := os.MkdirAll(filepath.Dir(link), 0755); err != nil {
				t.Fatal(err)
			}
			if err := os.Symlink(target, link); err != nil {
				t.Fatal(err)
			}
			archive := writeThemeZIP(t, []themeZIPEntry{{name: "index.html", body: "safe"}, {name: entry, body: "overwritten"}})
			if err := (&themeService{}).extractZip(archive, dest); err == nil {
				t.Error("expected existing symlink to be rejected")
			}
			got, err := os.ReadFile(sentinel)
			if err != nil || string(got) != "unchanged" {
				t.Errorf("outside sentinel changed: %q, %v", got, err)
			}
		})
	}
}

func TestExtractZIPPreservesLayoutsAndRemovesExecutableBits(t *testing.T) {
	for _, prefix := range []string{"", "theme-safe-main/"} {
		t.Run(prefix, func(t *testing.T) {
			dest := filepath.Join(themeTestDir(t), "theme-safe")
			archive := writeThemeZIP(t, []themeZIPEntry{
				{name: prefix + "theme.json", body: `{}`},
				{name: prefix + "index.html", body: "<!doctype html>", mode: 0777},
				{name: prefix + "static/", mode: os.ModeDir | 0777},
				{name: prefix + "static/main.js", body: "initial", mode: 0755},
			})
			s := &themeService{}
			if err := s.extractZip(archive, dest); err != nil {
				t.Fatal(err)
			}
			updated := writeThemeZIP(t, []themeZIPEntry{{name: prefix + "static/main.js", body: "updated", mode: 0777}, {name: prefix + "index.html", body: "<!doctype html>"}})
			if err := s.extractZip(updated, dest); err != nil {
				t.Fatal(err)
			}
			file := filepath.Join(dest, "static", "main.js")
			data, err := os.ReadFile(file)
			if err != nil || string(data) != "updated" {
				t.Fatalf("updated content = %q, error = %v", data, err)
			}
			info, err := os.Stat(file)
			if err != nil {
				t.Fatal(err)
			}
			if info.Mode().Perm() != 0644 {
				t.Errorf("file mode = %v, want 0644", info.Mode().Perm())
			}
			directory, err := os.Stat(filepath.Dir(file))
			if err != nil || directory.Mode().Perm() != 0755 {
				t.Errorf("directory mode = %v, error=%v, want 0755", directory, err)
			}
		})
	}
}

func TestValidateThemeName(t *testing.T) {
	for _, name := range []string{"theme-a", "theme-anheyu", "theme-a-123", "theme-" + strings.Repeat("a", 94)} {
		if err := ValidateThemeName(name); err != nil {
			t.Errorf("valid name %q rejected: %v", name, err)
		}
	}
	for _, name := range []string{"", "theme-", "theme-xxx/../../data/plugins", `theme-xxx\..\plugins`, "/theme-a", "theme-%2e%2e", "theme-Upper", "theme-a\x00", "theme-a\n", "theme-" + strings.Repeat("a", 95)} {
		if err := ValidateThemeName(name); err == nil {
			t.Errorf("invalid name %q accepted", name)
		}
	}
}

func TestOfficialThemeSettingsPreserveKnownAliases(t *testing.T) {
	for _, name := range []string{OfficialThemeName, "安和鱼官方主题", "安知鱼官方主题", "官方主题"} {
		settings, err := (&themeService{}).GetThemeSettings(context.Background(), name)
		if err != nil || len(settings) != 0 {
			t.Errorf("official alias %q: settings=%v, error=%v", name, settings, err)
		}
	}
}
