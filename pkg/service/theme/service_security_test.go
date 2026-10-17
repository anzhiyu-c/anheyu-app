package theme

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/ent/enttest"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	_ "github.com/ncruces/go-sqlite3/driver"
	_ "github.com/ncruces/go-sqlite3/embed"
)

func newThemeTestService(t *testing.T) (*themeService, uint) {
	t.Helper()
	client := enttest.Open(t, "sqlite3", "file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared&_fk=1")
	t.Cleanup(func() {
		if err := client.Close(); err != nil {
			t.Errorf("close test database: %v", err)
		}
	})
	group, err := client.UserGroup.Create().SetName("theme-test").SetPermissions(model.Boolset{}).Save(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	user, err := client.User.Create().SetUsername("theme-test").SetPasswordHash("test-only").SetUserGroup(group).Save(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return &themeService{db: client}, user.ID
}

func themeUploadHeader(t *testing.T, archive string) *multipart.FileHeader {
	t.Helper()
	data, err := os.ReadFile(archive)
	if err != nil {
		t.Fatal(err)
	}
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	file, err := writer.CreateFormFile("file", "theme.zip")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := file.Write(data); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	form, err := multipart.NewReader(bytes.NewReader(body.Bytes()), writer.Boundary()).ReadForm(1 << 20)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := form.RemoveAll(); err != nil {
			t.Errorf("remove multipart temp files: %v", err)
		}
	})
	return form.File["file"][0]
}

func validThemeEntries(prefix, name, version, content string) []themeZIPEntry {
	return []themeZIPEntry{
		{name: prefix + "theme.json", body: fmt.Sprintf(`{"name":%q,"displayName":"Test","version":%q,"description":"Test theme","author":"Test"}`, name, version)},
		{name: prefix + "index.html", body: "<!doctype html><html><head><title>Test</title></head><body>" + content + "</body></html>", mode: 0755},
		{name: prefix + "static/main.js", body: content, mode: 0755},
	}
}

type themeRoundTripper func(*http.Request) (*http.Response, error)

func (f themeRoundTripper) RoundTrip(request *http.Request) (*http.Response, error) {
	return f(request)
}

func serveThemeArchiveWithoutNetwork(t *testing.T, archive string) *int {
	t.Helper()
	data, err := os.ReadFile(archive)
	if err != nil {
		t.Fatal(err)
	}
	calls := new(int)
	original := themeDownloadClient.Transport
	themeDownloadClient.Transport = themeRoundTripper(func(request *http.Request) (*http.Response, error) {
		*calls++
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(bytes.NewReader(data)), Header: make(http.Header), Request: request}, nil
	})
	t.Cleanup(func() { themeDownloadClient.Transport = original })
	return calls
}

func TestUploadThemeInstallsAndForceUpdates(t *testing.T) {
	for _, prefix := range []string{"", "release/"} {
		t.Run(prefix, func(t *testing.T) {
			t.Chdir(themeTestDir(t))
			s, userID := newThemeTestService(t)
			ctx := context.Background()
			first := themeUploadHeader(t, writeThemeZIP(t, validThemeEntries(prefix, "theme-safe", "1.0.0", "initial")))
			if _, err := s.UploadTheme(ctx, userID, first); err != nil {
				t.Fatalf("initial upload: %v", err)
			}
			original, err := s.db.UserInstalledTheme.Query().Only(ctx)
			if err != nil {
				t.Fatal(err)
			}
			config := map[string]interface{}{"accent": "blue", "show_footer": true}
			original, err = original.Update().SetUserThemeConfig(config).SetIsCurrent(true).SetThemeMarketID(42).Save(ctx)
			if err != nil {
				t.Fatal(err)
			}
			updated := themeUploadHeader(t, writeThemeZIP(t, validThemeEntries(prefix, "theme-safe", "1.1.0", "updated")))
			if _, err := s.UploadTheme(ctx, userID, updated); err == nil {
				t.Fatal("duplicate upload without force must be rejected")
			}
			afterDuplicate, err := s.db.UserInstalledTheme.Query().Only(ctx)
			if err != nil || afterDuplicate.ID != original.ID || afterDuplicate.InstalledVersion != "1.0.0" ||
				!reflect.DeepEqual(afterDuplicate.UserThemeConfig, config) {
				t.Fatalf("duplicate upload changed installation: %+v, error=%v", afterDuplicate, err)
			}
			asset := filepath.Join(ThemesDirName, "theme-safe", "static", "main.js")
			content, err := os.ReadFile(asset)
			if err != nil || string(content) != "initial" {
				t.Fatalf("duplicate upload changed asset: %q, error=%v", content, err)
			}
			info, err := s.UploadTheme(ctx, userID, updated, true)
			if err != nil || info == nil || info.Version != "1.1.0" {
				t.Fatalf("force upload: info=%+v, error=%v", info, err)
			}
			installed, err := s.db.UserInstalledTheme.Query().Only(ctx)
			if err != nil || installed.InstalledVersion != "1.1.0" {
				t.Fatalf("updated database record: %+v, %v", installed, err)
			}
			if installed.ID != original.ID || !installed.IsCurrent || installed.ThemeMarketID != 42 ||
				!reflect.DeepEqual(installed.UserThemeConfig, config) {
				t.Fatalf("force update did not preserve installation identity and configuration: %+v", installed)
			}
			content, err = os.ReadFile(asset)
			if err != nil || string(content) != "updated" {
				t.Fatalf("updated file = %q, error=%v", content, err)
			}
			stat, err := os.Stat(asset)
			if err != nil || stat.Mode().Perm() != 0644 {
				t.Fatalf("updated file mode: %v, error=%v", stat, err)
			}
		})
	}
}

func TestInstallThemeAndTransactionAcceptValidPackages(t *testing.T) {
	for _, transaction := range []bool{false, true} {
		for _, prefix := range []string{"", "release/"} {
			t.Run(fmt.Sprintf("transaction=%t/prefix=%s", transaction, prefix), func(t *testing.T) {
				t.Chdir(themeTestDir(t))
				s, userID := newThemeTestService(t)
				archive := writeThemeZIP(t, validThemeEntries(prefix, "theme-safe", "1.0.0", "installed"))
				calls := serveThemeArchiveWithoutNetwork(t, archive)
				request := &ThemeInstallRequest{ThemeName: "theme-safe", DownloadURL: "https://theme.invalid/theme.zip", Version: "1.0.0"}
				install := s.InstallTheme
				if transaction {
					install = s.ThemeInstallWithTransaction
				}
				if err := install(context.Background(), userID, request); err != nil {
					t.Fatal(err)
				}
				if err := install(context.Background(), userID, request); err == nil {
					t.Fatal("duplicate install must be rejected")
				}
				if *calls != 1 {
					t.Fatalf("download requests = %d, want 1", *calls)
				}
				content, err := os.ReadFile(filepath.Join(ThemesDirName, "theme-safe", "static", "main.js"))
				if err != nil || string(content) != "installed" {
					t.Fatalf("installed asset = %q, error=%v", content, err)
				}
				if count, err := s.db.UserInstalledTheme.Query().Count(context.Background()); err != nil || count != 1 {
					t.Fatalf("installed records=%d, error=%v", count, err)
				}
			})
		}
	}
}

func TestUploadThemeRejectsUnsafePackagesBeforeDatabase(t *testing.T) {
	t.Chdir(themeTestDir(t))
	cases := map[string][]themeZIPEntry{
		"name":  validThemeEntries("", "theme-xxx/../../data/plugins", "1.0.0", "safe"),
		"entry": append(validThemeEntries("", "theme-safe", "1.0.0", "safe"), themeZIPEntry{name: "../plugins/payload", body: "not executable"}),
		"link":  append(validThemeEntries("", "theme-safe", "1.0.0", "safe"), themeZIPEntry{name: "static/link", body: "../../outside", mode: os.ModeSymlink | 0777}),
	}
	for name, entries := range cases {
		t.Run(name, func(t *testing.T) {
			defer func() {
				if value := recover(); value != nil {
					t.Errorf("unsafe package reached database: %v", value)
				}
			}()
			header := themeUploadHeader(t, writeThemeZIP(t, entries))
			if _, err := (&themeService{}).UploadTheme(context.Background(), 1, header); err == nil {
				t.Fatal("unsafe upload must be rejected")
			}
			if _, err := os.Stat(ThemesDirName); !os.IsNotExist(err) {
				t.Errorf("unsafe upload created theme directory: %v", err)
			}
		})
	}
}

func TestInstallRejectsNestedSymlinkWithoutChangingExistingFiles(t *testing.T) {
	for _, transaction := range []bool{false, true} {
		t.Run(fmt.Sprintf("transaction=%t", transaction), func(t *testing.T) {
			t.Chdir(themeTestDir(t))
			s, userID := newThemeTestService(t)
			themeDir := filepath.Join(ThemesDirName, "theme-safe")
			if err := os.MkdirAll(themeDir, 0755); err != nil {
				t.Fatal(err)
			}
			outside := themeTestDir(t)
			sentinel := filepath.Join(outside, "main.js")
			index := filepath.Join(themeDir, "index.html")
			for _, file := range []string{sentinel, index} {
				if err := os.WriteFile(file, []byte("unchanged"), 0644); err != nil {
					t.Fatal(err)
				}
			}
			if err := os.Symlink(outside, filepath.Join(themeDir, "static")); err != nil {
				t.Fatal(err)
			}
			serveThemeArchiveWithoutNetwork(t, writeThemeZIP(t, validThemeEntries("", "theme-safe", "1.0.0", "changed")))
			install := s.InstallTheme
			if transaction {
				install = s.ThemeInstallWithTransaction
			}
			if err := install(context.Background(), userID, &ThemeInstallRequest{ThemeName: "theme-safe", DownloadURL: "https://theme.invalid/theme.zip"}); err == nil {
				t.Fatal("existing nested symlink must be rejected")
			}
			for _, file := range []string{sentinel, index} {
				data, err := os.ReadFile(file)
				if err != nil || string(data) != "unchanged" {
					t.Errorf("existing file %s changed: %q, %v", file, data, err)
				}
			}
		})
	}
}

func TestStaticCleanupRejectsSymlinkRoot(t *testing.T) {
	t.Chdir(themeTestDir(t))
	t.Setenv("ANHEYU_STATIC_DIR", "static")
	outside := themeTestDir(t)
	sentinel := filepath.Join(outside, "sentinel.txt")
	if err := os.WriteFile(sentinel, []byte("unchanged"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, "static"); err != nil {
		t.Fatal(err)
	}
	s := &themeService{}
	for _, operation := range []func() error{s.clearStaticDirContents, s.safeRemoveStaticDir, func() error { return s.copyThemeToStatic("themes/theme-safe") }} {
		if err := operation(); err == nil {
			t.Error("static symlink must be rejected before cleanup")
		}
	}
	data, err := os.ReadFile(sentinel)
	if err != nil || string(data) != "unchanged" {
		t.Fatalf("outside file changed: %q, %v", data, err)
	}
}
