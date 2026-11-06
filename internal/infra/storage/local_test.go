package storage

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

func TestLocalProviderRejectsSourcesOutsideBasePath(t *testing.T) {
	workspace := t.TempDir()
	t.Chdir(workspace)
	base := filepath.Join(workspace, "storage")
	if err := os.Mkdir(base, 0o700); err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(workspace, "secret.txt")
	if err := os.WriteFile(outside, []byte("outside secret"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink("../secret.txt", filepath.Join(base, "escape.txt")); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink("..", filepath.Join(base, "escape-dir")); err != nil {
		t.Fatal(err)
	}
	provider := NewLocalProvider("test-secret")
	policy := &model.StoragePolicy{BasePath: base, VirtualPath: "/local"}
	sources := []string{
		outside,
		"secret.txt",
		"storage/../secret.txt",
		filepath.Join(base, "escape.txt"),
		filepath.Join(base, "escape-dir", "secret.txt"),
	}
	for _, source := range sources {
		t.Run(source, func(t *testing.T) {
			reader, err := provider.Get(context.Background(), policy, source)
			if reader != nil {
				if closeErr := reader.Close(); closeErr != nil {
					t.Fatal(closeErr)
				}
			}
			if err == nil {
				t.Error("Get accepted a source outside the storage root")
			}
			var content bytes.Buffer
			if err := provider.Stream(context.Background(), policy, source, &content); err == nil || content.Len() != 0 {
				t.Errorf("Stream exposed outside content: error=%v content=%q", err, content.String())
			}
			if exists, err := provider.IsExist(context.Background(), policy, source); err == nil || exists {
				t.Errorf("IsExist accepted an outside source: exists=%v error=%v", exists, err)
			}
		})
	}
}

func TestLocalProviderReadsAbsoluteAndLegacyRelativeSources(t *testing.T) {
	workspace := t.TempDir()
	t.Chdir(workspace)
	base := filepath.Join(workspace, "storage")
	if err := os.Mkdir(base, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(base, "file.txt"), []byte("stored content"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink("file.txt", filepath.Join(base, "alias.txt")); err != nil {
		t.Fatal(err)
	}
	provider := NewLocalProvider("test-secret")
	for _, basePath := range []string{base, "storage"} {
		for _, source := range []string{filepath.Join(base, "file.txt"), "storage/file.txt", "storage/alias.txt"} {
			t.Run(basePath+"/"+source, func(t *testing.T) {
				policy := &model.StoragePolicy{BasePath: basePath, VirtualPath: "/local"}
				reader, err := provider.Get(context.Background(), policy, source)
				if err != nil {
					t.Fatalf("Get: %v", err)
				}
				content, readErr := io.ReadAll(reader)
				closeErr := reader.Close()
				if readErr != nil || closeErr != nil || string(content) != "stored content" {
					t.Fatalf("Get content=%q read error=%v close error=%v", content, readErr, closeErr)
				}
				var streamed bytes.Buffer
				if err := provider.Stream(context.Background(), policy, source, &streamed); err != nil || streamed.String() != "stored content" {
					t.Fatalf("Stream content=%q error=%v", streamed.String(), err)
				}
				if exists, err := provider.IsExist(context.Background(), policy, source); err != nil || !exists {
					t.Fatalf("IsExist exists=%v error=%v", exists, err)
				}
			})
		}
	}
}

func TestLocalProviderDeleteRejectsOutsideSources(t *testing.T) {
	for _, sourceKind := range []string{"absolute", "symlink-parent"} {
		t.Run(sourceKind, func(t *testing.T) {
			workspace := t.TempDir()
			base := filepath.Join(workspace, "storage")
			if err := os.Mkdir(base, 0o700); err != nil {
				t.Fatal(err)
			}
			outside := filepath.Join(workspace, "secret.txt")
			if err := os.WriteFile(outside, []byte("keep me"), 0o600); err != nil {
				t.Fatal(err)
			}
			if err := os.Symlink("..", filepath.Join(base, "escape")); err != nil {
				t.Fatal(err)
			}
			source := outside
			if sourceKind == "symlink-parent" {
				source = filepath.Join(base, "escape", "secret.txt")
			}
			provider := NewLocalProvider("test-secret")
			policy := &model.StoragePolicy{BasePath: base, VirtualPath: "/local"}
			if err := provider.Delete(context.Background(), policy, []string{source}); err == nil {
				t.Error("Delete accepted an outside source")
			}
			if content, err := os.ReadFile(outside); err != nil || string(content) != "keep me" {
				t.Errorf("outside file was modified: content=%q error=%v", content, err)
			}
		})
	}
}

func TestLocalProviderListRejectsOutsideSymlink(t *testing.T) {
	workspace := t.TempDir()
	base := filepath.Join(workspace, "storage")
	if err := os.Mkdir(base, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(workspace, "secret.txt"), []byte("secret"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink("..", filepath.Join(base, "escape")); err != nil {
		t.Fatal(err)
	}
	provider := NewLocalProvider("test-secret")
	policy := &model.StoragePolicy{BasePath: base, VirtualPath: "/local"}
	if files, err := provider.List(context.Background(), policy, "/local/escape"); err == nil || len(files) != 0 {
		t.Fatalf("List exposed directory outside root: files=%v error=%v", files, err)
	}
}

func TestLocalPhysicalPathRejectsInvalidVirtualPaths(t *testing.T) {
	policy := &model.StoragePolicy{BasePath: t.TempDir(), VirtualPath: "/local"}
	for _, virtualPath := range []string{
		"/other/file.txt", "/local-extra/file.txt", "/local/../file.txt",
		"/local/nested/../../file.txt", "/local/nested/../file.txt", "/local/..\\file.txt", "local/file.txt", "",
	} {
		t.Run(virtualPath, func(t *testing.T) {
			if physical, err := LocalEntitySourcePath(policy, virtualPath); err == nil {
				t.Fatalf("invalid virtual path accepted: %q", physical)
			}
		})
	}
}

func TestLocalPhysicalPathPreservesValidMountPaths(t *testing.T) {
	base := t.TempDir()
	for _, mount := range []string{"/local", "/local/", "/"} {
		virtualPath := mount + "/nested/file.txt"
		if mount == "/" {
			virtualPath = "/nested/file.txt"
		}
		policy := &model.StoragePolicy{BasePath: base, VirtualPath: mount}
		physical, err := LocalEntitySourcePath(policy, virtualPath)
		if err != nil || physical != filepath.Join(base, "nested", "file.txt") {
			t.Errorf("mount=%q path=%q error=%v", mount, physical, err)
		}
	}
}

func TestLocalProviderMutationsRejectSymlinkParents(t *testing.T) {
	for _, operation := range []string{"upload", "mkdir", "rename-from", "rename-to", "delete-directory"} {
		t.Run(operation, func(t *testing.T) {
			workspace := t.TempDir()
			t.Chdir(workspace)
			base := filepath.Join(workspace, "storage")
			outsideDir := filepath.Join(workspace, "outside")
			for _, dir := range []string{base, outsideDir, filepath.Join(outsideDir, "empty")} {
				if err := os.Mkdir(dir, 0o700); err != nil {
					t.Fatal(err)
				}
			}
			for _, filename := range []string{filepath.Join(base, "file.txt"), filepath.Join(outsideDir, "file.txt")} {
				if err := os.WriteFile(filename, []byte("unchanged"), 0o600); err != nil {
					t.Fatal(err)
				}
			}
			if err := os.Symlink("../outside", filepath.Join(base, "escape")); err != nil {
				t.Fatal(err)
			}
			provider := NewLocalProvider("test-secret")
			policy := &model.StoragePolicy{BasePath: base, VirtualPath: "/local"}
			var err error
			switch operation {
			case "upload":
				_, err = provider.Upload(context.Background(), strings.NewReader("overwrite"), policy, "/local/escape/file.txt")
			case "mkdir":
				err = provider.CreateDirectory(context.Background(), policy, "/local/escape/new-directory")
			case "rename-from":
				err = provider.Rename(context.Background(), policy, "/local/escape/file.txt", "/local/moved.txt")
			case "rename-to":
				err = provider.Rename(context.Background(), policy, "/local/file.txt", "/local/escape/file.txt")
			case "delete-directory":
				err = provider.DeleteDirectory(context.Background(), policy, "/local/escape/empty")
			}
			if err == nil {
				t.Error("operation accepted a symlink parent outside storage root")
			}
			if content, err := os.ReadFile(filepath.Join(outsideDir, "file.txt")); err != nil || string(content) != "unchanged" {
				t.Errorf("outside file changed: content=%q error=%v", content, err)
			}
			if _, err := os.Stat(filepath.Join(outsideDir, "empty")); err != nil {
				t.Errorf("outside directory was removed: %v", err)
			}
			if _, err := os.Stat(filepath.Join(outsideDir, "new-directory")); !os.IsNotExist(err) {
				t.Errorf("outside directory was created: %v", err)
			}
		})
	}
}

func TestLocalProviderFileLifecycle(t *testing.T) {
	workspace := t.TempDir()
	t.Chdir(workspace)
	provider := NewLocalProvider("test-secret")
	policy := &model.StoragePolicy{BasePath: "storage", VirtualPath: "/local"}
	ctx := context.Background()
	result, err := provider.Upload(ctx, strings.NewReader("hello storage"), policy, "/local/nested/file.txt")
	if err != nil {
		t.Fatalf("Upload: %v", err)
	}
	if result.Source != filepath.Join(workspace, "storage", "nested", "file.txt") || result.Size != 13 {
		t.Fatalf("unexpected upload result: %+v", result)
	}
	if err := provider.Rename(ctx, policy, "/local/nested/file.txt", "/local/moved/file.txt"); err != nil {
		t.Fatalf("Rename: %v", err)
	}
	files, err := provider.List(ctx, policy, "/local/moved")
	if err != nil || len(files) != 1 || files[0].Name != "file.txt" || files[0].Size != 13 {
		t.Fatalf("List files=%+v error=%v", files, err)
	}
	if err := provider.Delete(ctx, policy, []string{"storage/moved/file.txt", "storage/missing.txt"}); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if exists, err := provider.IsExist(ctx, policy, "storage/moved/file.txt"); err != nil || exists {
		t.Fatalf("deleted file exists=%v error=%v", exists, err)
	}
	if err := provider.DeleteDirectory(ctx, policy, "/local/moved"); err != nil {
		t.Fatalf("DeleteDirectory: %v", err)
	}
	if err := provider.CreateDirectory(ctx, policy, "/local/created/nested"); err != nil {
		t.Fatalf("CreateDirectory: %v", err)
	}
	if err := provider.Delete(ctx, policy, []string{"storage/created"}); err != nil {
		t.Fatalf("Delete directory tree: %v", err)
	}
}

func TestLocalProviderGetRejectsDirectory(t *testing.T) {
	base := t.TempDir()
	provider := NewLocalProvider("test-secret")
	reader, err := provider.Get(context.Background(), &model.StoragePolicy{BasePath: base}, base)
	if reader != nil {
		if err := reader.Close(); err != nil {
			t.Fatal(err)
		}
	}
	if err == nil {
		t.Fatal("Get accepted a directory as a file")
	}
}

func TestLocalProviderHidesAndCleansUploadTemporaryFiles(t *testing.T) {
	for _, failUpload := range []bool{false, true} {
		t.Run(map[bool]string{false: "complete", true: "failure"}[failUpload], func(t *testing.T) {
			base := t.TempDir()
			provider := NewLocalProvider("test-secret")
			policy := &model.StoragePolicy{BasePath: base, VirtualPath: "/local"}
			// 相似但非内部随机名称的合法文件不能被过滤。
			visibleName := ".anheyu-upload-not-internal.tmp"
			if err := os.WriteFile(filepath.Join(base, visibleName), []byte("visible"), 0o600); err != nil {
				t.Fatal(err)
			}
			reader, writer := io.Pipe()
			done := make(chan error, 1)
			go func() {
				_, err := provider.Upload(context.Background(), reader, policy, "/local/file.txt")
				if closeErr := reader.Close(); closeErr != nil {
					err = errors.Join(err, closeErr)
				}
				done <- err
			}()
			if _, err := writer.Write([]byte("partial upload")); err != nil {
				t.Fatal(err)
			}
			files, listErr := provider.List(context.Background(), policy, "/local")
			var uploadErr error
			if failUpload {
				uploadErr = errors.New("interrupted upload")
			}
			if err := writer.CloseWithError(uploadErr); err != nil {
				t.Fatal(err)
			}
			err := <-done
			if listErr != nil || len(files) != 1 || files[0].Name != visibleName {
				t.Errorf("List exposed incomplete upload: files=%+v error=%v", files, listErr)
			}
			if (err != nil) != failUpload {
				t.Errorf("Upload error=%v, failure expected=%v", err, failUpload)
			}
			entries, err := os.ReadDir(base)
			if err != nil {
				t.Fatal(err)
			}
			wantEntries := 2
			if failUpload {
				wantEntries = 1
			}
			if len(entries) != wantEntries {
				t.Errorf("upload left temporary files: %v", entries)
			}
		})
	}
}

func TestLocalProviderErrorsDoNotExposePhysicalPaths(t *testing.T) {
	base := t.TempDir()
	provider := NewLocalProvider("test-secret")
	policy := &model.StoragePolicy{BasePath: base, VirtualPath: "/local"}
	for _, source := range []string{filepath.Join(base, "missing.txt"), filepath.Join(base, "..", "secret.txt")} {
		reader, err := provider.Get(context.Background(), policy, source)
		if reader != nil {
			if err := reader.Close(); err != nil {
				t.Fatal(err)
			}
		}
		if err == nil || strings.Contains(err.Error(), base) || strings.Contains(err.Error(), source) {
			t.Errorf("error should be sanitized: %v", err)
		}
	}
}
