package theme

import (
	"archive/zip"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
)

var themeNamePattern = regexp.MustCompile(`^theme-[a-z0-9-]+$`)

// ValidateThemeName 校验可用作主题目录名的标识，供服务和处理器共用。
func ValidateThemeName(name string) error {
	if !themeNamePattern.MatchString(name) || len(name) > 100 {
		return fmt.Errorf("主题名称必须以'theme-'开头，仅包含小写字母、数字和连字符，且不超过100字符")
	}
	return nil
}

func safeThemePath(name string) (string, error) {
	if err := ValidateThemeName(name); err != nil {
		return "", err
	}
	dir := filepath.Join(ThemesDirName, name)
	root, err := openThemeDirectory(dir, false)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return dir, nil
		}
		return "", err
	}
	defer closeThemeResource(root)
	return dir, nil
}

func closeThemeResource(resource io.Closer) {
	if err := resource.Close(); err != nil {
		log.Printf("关闭主题文件资源失败: %v", err)
	}
}

// openThemeDirectory 逐层打开目录并拒绝链接；每层句柄固定已验证目录，
// 防止 themes 本身或中间目录的符号链接改变解压根目录。
func openThemeDirectory(dir string, create bool) (*os.Root, error) {
	clean := filepath.Clean(dir)
	base := "."
	if filepath.IsAbs(clean) {
		base = filepath.VolumeName(clean) + string(filepath.Separator)
		clean = strings.TrimPrefix(clean, base)
	} else if !filepath.IsLocal(clean) {
		return nil, fmt.Errorf("不安全的主题目录: %s", dir)
	}
	root, err := os.OpenRoot(base)
	if err != nil {
		return nil, err
	}
	for _, component := range strings.Split(clean, string(filepath.Separator)) {
		if component == "" || component == "." {
			continue
		}
		info, err := root.Lstat(component)
		if errors.Is(err, os.ErrNotExist) && create {
			if err = root.Mkdir(component, 0755); err == nil || errors.Is(err, os.ErrExist) {
				info, err = root.Lstat(component)
			}
		}
		if err != nil {
			closeThemeResource(root)
			return nil, fmt.Errorf("检查主题目录 %s: %w", dir, err)
		}
		if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
			closeThemeResource(root)
			return nil, fmt.Errorf("主题目录不能包含链接或非目录文件: %s", dir)
		}
		next, err := root.OpenRoot(component)
		closeThemeResource(root)
		if err != nil {
			return nil, err
		}
		openedInfo, err := next.Stat(".")
		if err != nil || !os.SameFile(info, openedInfo) {
			closeThemeResource(next)
			return nil, fmt.Errorf("主题目录在检查期间发生变化: %s", dir)
		}
		root = next
	}
	return root, nil
}

type themeArchiveEntry struct {
	file *zip.File
	name string
}

// inspectThemeArchive 在任何目标文件写入之前验证完整归档，并统一包装目录处理。
func inspectThemeArchive(files []*zip.File) ([]themeArchiveEntry, error) {
	var rootPrefix string
	hasRootFiles := false
	for _, file := range files {
		name := file.Name
		if name == "" || strings.HasPrefix(name, "/") || strings.ContainsAny(name, "\\:\x00") {
			return nil, fmt.Errorf("发现危险归档路径: %s", name)
		}
		for _, component := range strings.Split(name, "/") {
			if component == ".." {
				return nil, fmt.Errorf("发现危险归档路径: %s", name)
			}
		}
		if file.Mode().Type() != 0 && file.Mode().Type() != os.ModeDir {
			return nil, fmt.Errorf("主题归档不允许符号链接或特殊文件: %s", name)
		}
		name = path.Clean(name)
		if name == "theme.json" || name == "index.html" {
			hasRootFiles = true
		}
	}
	if !hasRootFiles {
		for _, file := range files {
			parts := strings.Split(path.Clean(file.Name), "/")
			if len(parts) == 2 && (parts[1] == "theme.json" || parts[1] == "index.html") {
				prefix := parts[0] + "/"
				if rootPrefix != "" && rootPrefix != prefix {
					return nil, fmt.Errorf("主题归档包含多个根目录")
				}
				rootPrefix = prefix
			}
		}
	}
	entries := make([]themeArchiveEntry, 0, len(files))
	paths := make(map[string]bool, len(files))
	for _, file := range files {
		name := path.Clean(file.Name)
		if rootPrefix != "" {
			if name == strings.TrimSuffix(rootPrefix, "/") && file.FileInfo().IsDir() {
				continue
			}
			name = strings.TrimPrefix(name, rootPrefix)
		}
		if name == "." && file.FileInfo().IsDir() {
			continue
		}
		localName := filepath.FromSlash(name)
		if !filepath.IsLocal(localName) || localName == "." {
			return nil, fmt.Errorf("发现危险归档路径: %s", file.Name)
		}
		if _, exists := paths[localName]; exists {
			return nil, fmt.Errorf("主题归档包含重复路径: %s", name)
		}
		paths[localName] = file.FileInfo().IsDir()
		entries = append(entries, themeArchiveEntry{file: file, name: localName})
	}
	for _, entry := range entries {
		for parent := filepath.Dir(entry.name); parent != "."; parent = filepath.Dir(parent) {
			if directory, exists := paths[parent]; exists && !directory {
				return nil, fmt.Errorf("主题归档路径同时被用作文件和目录: %s", parent)
			}
		}
	}
	return entries, nil
}

func checkThemeEntryDestination(root *os.Root, name string, directory bool) error {
	components := strings.Split(name, string(filepath.Separator))
	for i := range components {
		current := filepath.Join(components[:i+1]...)
		info, err := root.Lstat(current)
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		if err != nil {
			return err
		}
		if info.Mode()&os.ModeSymlink != 0 || (!info.Mode().IsRegular() && !info.IsDir()) {
			return fmt.Errorf("主题目标包含链接或特殊文件: %s", current)
		}
		wantDirectory := i < len(components)-1 || directory
		if wantDirectory != info.IsDir() {
			return fmt.Errorf("主题目标文件类型冲突: %s", current)
		}
	}
	return nil
}

func extractThemeFile(root *os.Root, entry themeArchiveEntry) error {
	if entry.file.FileInfo().IsDir() {
		return root.MkdirAll(entry.name, 0755)
	}
	if err := root.MkdirAll(filepath.Dir(entry.name), 0755); err != nil {
		return err
	}
	source, err := entry.file.Open()
	if err != nil {
		return err
	}
	defer closeThemeResource(source)
	target, err := root.OpenFile(entry.name, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return err
	}
	// 用已打开的句柄改权限，清除旧文件上可能残留的执行位。
	if err := target.Chmod(0644); err != nil {
		return errors.Join(err, target.Close())
	}
	_, copyErr := io.Copy(target, source)
	return errors.Join(copyErr, target.Close())
}

func removeThemeDirectory(dir string) error {
	root, err := openThemeDirectory(filepath.Dir(dir), false)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	defer closeThemeResource(root)
	return root.RemoveAll(filepath.Base(dir))
}

func copyThemeFile(srcPath, destPath string) error {
	sourceRoot, err := openThemeDirectory(filepath.Dir(srcPath), false)
	if err != nil {
		return err
	}
	defer closeThemeResource(sourceRoot)
	if err := checkThemeEntryDestination(sourceRoot, filepath.Base(srcPath), false); err != nil {
		return err
	}
	source, err := sourceRoot.Open(filepath.Base(srcPath))
	if err != nil {
		return err
	}
	defer closeThemeResource(source)
	targetRoot, err := openThemeDirectory(filepath.Dir(destPath), true)
	if err != nil {
		return err
	}
	defer closeThemeResource(targetRoot)
	if err := checkThemeEntryDestination(targetRoot, filepath.Base(destPath), false); err != nil {
		return err
	}
	target, err := targetRoot.OpenFile(filepath.Base(destPath), os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return err
	}
	if err := target.Chmod(0644); err != nil {
		return errors.Join(err, target.Close())
	}
	_, copyErr := io.Copy(target, source)
	return errors.Join(copyErr, target.Close())
}
