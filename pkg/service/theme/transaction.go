/*
 * @Description: 主题管理事务处理（基于Ent最佳实践）
 * @Author: 安知鱼
 * @Date: 2025-09-18 19:00:00
 * @LastEditTime: 2025-09-18 19:00:00
 * @LastEditors: 安知鱼
 *
 * 基于Ent最佳实践优化：
 * 1. 使用WithTx模式进行事务管理
 * 2. 优雅的错误处理和回滚
 * 3. Context传递和取消处理
 * 4. Panic恢复机制
 */
package theme

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/userinstalledtheme"
)

// WithTx 通用事务处理函数（基于Ent最佳实践）
func WithTx(ctx context.Context, client *ent.Client, fn func(tx *ent.Tx) error) error {
	tx, err := client.Tx(ctx)
	if err != nil {
		log.Printf("[Theme Transaction] 开始事务失败: %v", err)
		return fmt.Errorf("开始事务失败: %w", err)
	}

	// 使用defer确保在panic时回滚事务
	defer func() {
		if v := recover(); v != nil {
			log.Printf("[Theme Transaction] 检测到panic，回滚事务: %v", v)
			if rollbackErr := tx.Rollback(); rollbackErr != nil {
				log.Printf("[Theme Transaction] Panic回滚失败: %v", rollbackErr)
			}
			panic(v) // 重新抛出panic
		}
	}()

	// 执行业务逻辑
	if err := fn(tx); err != nil {
		log.Printf("[Theme Transaction] 业务逻辑执行失败，回滚事务: %v", err)
		if rerr := tx.Rollback(); rerr != nil {
			log.Printf("[Theme Transaction] 事务回滚失败: %v", rerr)
			return fmt.Errorf("%w: 回滚事务失败: %v", err, rerr)
		}
		return err
	}

	// 提交事务
	if err := tx.Commit(); err != nil {
		log.Printf("[Theme Transaction] 提交事务失败: %v", err)
		return fmt.Errorf("提交事务失败: %w", err)
	}

	log.Printf("[Theme Transaction] 事务执行成功")
	return nil
}

// FileOperationManager 文件操作管理器（支持回滚）
type FileOperationManager struct {
	operations []FileOperation
}

// FileOperation 文件操作接口
type FileOperation interface {
	Execute() error
	Rollback() error
	Description() string
}

// CreateDirectoryOperation 创建目录操作
type CreateDirectoryOperation struct {
	Path string
}

func (op *CreateDirectoryOperation) Execute() error {
	root, err := openThemeDirectory(op.Path, true)
	if err != nil {
		return fmt.Errorf("创建目录失败 %s: %w", op.Path, err)
	}
	defer closeThemeResource(root)
	log.Printf("[File Operation] 创建目录成功: %s", op.Path)
	return nil
}

func (op *CreateDirectoryOperation) Rollback() error {
	if err := removeThemeDirectory(op.Path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("删除目录失败 %s: %w", op.Path, err)
	}
	log.Printf("[File Operation] 回滚创建目录: %s", op.Path)
	return nil
}

func (op *CreateDirectoryOperation) Description() string {
	return fmt.Sprintf("创建目录: %s", op.Path)
}

// CopyFileOperation 复制文件操作
type CopyFileOperation struct {
	Source      string
	Destination string
	BackupPath  string
}

func (op *CopyFileOperation) Execute() error {
	root, err := openThemeDirectory(filepath.Dir(op.Destination), false)
	if err != nil {
		return err
	}
	defer closeThemeResource(root)
	name := filepath.Base(op.Destination)
	if err := checkThemeEntryDestination(root, name, false); err != nil {
		return err
	}
	// 如果目标文件存在，先备份
	if _, err := root.Lstat(name); err == nil {
		op.BackupPath = op.Destination + ".backup"
		if err := checkThemeEntryDestination(root, name+".backup", false); err != nil {
			return err
		}
		if err := root.Rename(name, name+".backup"); err != nil {
			return fmt.Errorf("备份文件失败 %s: %w", op.Destination, err)
		}
		log.Printf("[File Operation] 备份原文件: %s -> %s", op.Destination, op.BackupPath)
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}

	// 执行复制
	if err := copyThemeFile(op.Source, op.Destination); err != nil {
		return fmt.Errorf("写入目标文件失败 %s: %w", op.Destination, err)
	}

	log.Printf("[File Operation] 复制文件成功: %s -> %s", op.Source, op.Destination)
	return nil
}

func (op *CopyFileOperation) Rollback() error {
	root, err := openThemeDirectory(filepath.Dir(op.Destination), false)
	if err != nil {
		return err
	}
	defer closeThemeResource(root)
	// 删除复制的文件
	if err := root.Remove(filepath.Base(op.Destination)); err != nil && !os.IsNotExist(err) {
		log.Printf("[File Operation] 删除复制文件失败: %v", err)
	}

	// 恢复备份文件
	if op.BackupPath != "" {
		if err := root.Rename(filepath.Base(op.BackupPath), filepath.Base(op.Destination)); err != nil {
			return fmt.Errorf("恢复备份文件失败 %s: %w", op.BackupPath, err)
		}
		log.Printf("[File Operation] 恢复备份文件: %s -> %s", op.BackupPath, op.Destination)
	}

	return nil
}

func (op *CopyFileOperation) Description() string {
	return fmt.Sprintf("复制文件: %s -> %s", op.Source, op.Destination)
}

// NewFileOperationManager 创建文件操作管理器
func NewFileOperationManager() *FileOperationManager {
	return &FileOperationManager{
		operations: make([]FileOperation, 0),
	}
}

// AddOperation 添加文件操作
func (fm *FileOperationManager) AddOperation(op FileOperation) {
	fm.operations = append(fm.operations, op)
}

// Execute 执行所有文件操作
func (fm *FileOperationManager) Execute() error {
	for i, op := range fm.operations {
		log.Printf("[File Operation Manager] 执行操作 %d/%d: %s", i+1, len(fm.operations), op.Description())
		if err := op.Execute(); err != nil {
			log.Printf("[File Operation Manager] 操作失败，开始回滚: %v", err)
			// 回滚已执行的操作
			fm.rollbackFrom(i - 1)
			return fmt.Errorf("文件操作失败: %w", err)
		}
	}
	log.Printf("[File Operation Manager] 所有文件操作执行成功")
	return nil
}

// rollbackFrom 从指定索引开始回滚操作
func (fm *FileOperationManager) rollbackFrom(fromIndex int) {
	for i := fromIndex; i >= 0; i-- {
		op := fm.operations[i]
		log.Printf("[File Operation Manager] 回滚操作 %d: %s", i+1, op.Description())
		if err := op.Rollback(); err != nil {
			log.Printf("[File Operation Manager] 回滚操作失败: %v", err)
		}
	}
}

// ThemeInstallWithTransaction 在事务中安装主题（基于Ent最佳实践）
func (s *themeService) ThemeInstallWithTransaction(ctx context.Context, userID uint, req *ThemeInstallRequest) error {
	if req == nil {
		return fmt.Errorf("主题安装请求不能为空")
	}
	themeDir, err := safeThemePath(req.ThemeName)
	if err != nil {
		return err
	}
	return WithTx(ctx, s.db, func(tx *ent.Tx) error {
		// 检查主题是否已安装
		exists, err := tx.UserInstalledTheme.Query().
			Where(
				userinstalledtheme.UserID(userID),
				userinstalledtheme.ThemeName(req.ThemeName),
			).
			Exist(ctx)
		if err != nil {
			return fmt.Errorf("检查主题是否存在失败: %w", err)
		}

		if exists {
			return fmt.Errorf("主题 %s 已经安装", req.ThemeName)
		}

		// 下载并解压主题文件
		tempDir, err := os.MkdirTemp("", "theme_install_*")
		if err != nil {
			return fmt.Errorf("创建主题临时目录失败: %w", err)
		}
		defer func(cleanupDir string) {
			if err := os.RemoveAll(cleanupDir); err != nil {
				log.Printf("清理主题临时目录失败: %v", err)
			}
		}(tempDir)
		// 系统临时目录在 macOS 上可经 /var 链接，先解析受信任的临时根。
		tempDir, err = filepath.EvalSymlinks(tempDir)
		if err != nil {
			return fmt.Errorf("解析主题临时目录失败: %w", err)
		}
		if err := s.downloadAndExtractTheme(req.DownloadURL, tempDir); err != nil {
			return fmt.Errorf("下载主题失败: %w", err)
		}

		// 验证主题文件
		if err := s.validateThemeFiles(tempDir); err != nil {
			return fmt.Errorf("主题文件验证失败: %w", err)
		}

		// 准备文件操作
		fm := NewFileOperationManager()
		targetRoot, err := openThemeDirectory(themeDir, false)
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
		if targetRoot != nil {
			defer closeThemeResource(targetRoot)
		}

		// 创建主题目录
		fm.AddOperation(&CreateDirectoryOperation{Path: themeDir})

		// 复制主题文件
		err = filepath.Walk(tempDir, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}

			relPath, err := filepath.Rel(tempDir, path)
			if err != nil {
				return err
			}

			destPath := filepath.Join(themeDir, relPath)
			if targetRoot != nil {
				if err := checkThemeEntryDestination(targetRoot, relPath, info.IsDir()); err != nil {
					return err
				}
			}

			if info.IsDir() {
				fm.AddOperation(&CreateDirectoryOperation{Path: destPath})
			} else {
				fm.AddOperation(&CopyFileOperation{
					Source:      path,
					Destination: destPath,
				})
			}

			return nil
		})
		if err != nil {
			return fmt.Errorf("准备文件操作失败: %w", err)
		}

		// 执行文件操作
		if err := fm.Execute(); err != nil {
			return fmt.Errorf("复制主题文件失败: %w", err)
		}

		// 在数据库中记录主题安装
		createBuilder := tx.UserInstalledTheme.Create().
			SetUserID(userID).
			SetThemeName(req.ThemeName).
			SetIsCurrent(false).
			SetUserThemeConfig(map[string]interface{}{})

		// 如果有主题市场ID，设置它
		if req.MarketID != 0 {
			createBuilder = createBuilder.SetNillableThemeMarketID(&req.MarketID)
		}

		_, err = createBuilder.Save(ctx)
		if err != nil {
			return fmt.Errorf("保存主题安装记录失败: %w", err)
		}

		log.Printf("[Theme Service] 主题 %s 安装成功", req.ThemeName)
		return nil
	})
}
