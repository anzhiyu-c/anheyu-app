/*
 * @Description: 系统设置（数据库配置）备份服务
 * @Author: 安知鱼
 * @Date: 2025-10-19
 */
package config

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// BackupInfo 定义了备份的元数据信息
type BackupInfo struct {
	Filename    string    `json:"filename"`    // 备份文件名
	Size        int64     `json:"size"`        // 文件大小（字节）
	CreatedAt   time.Time `json:"created_at"`  // 创建时间
	Description string    `json:"description"` // 备份描述
	IsAuto      bool      `json:"is_auto"`     // 是否自动备份
}

// BackupService 定义了系统设置备份服务的接口
type BackupService interface {
	// CreateBackup 创建系统设置备份（导出数据库配置到备份文件）
	CreateBackup(ctx context.Context, description string, isAuto bool) (*BackupInfo, error)

	// ListBackups 列出所有备份
	ListBackups(ctx context.Context) ([]*BackupInfo, error)

	// RestoreBackup 从备份恢复系统设置（将备份文件导入数据库）
	RestoreBackup(ctx context.Context, filename string) error

	// DeleteBackup 删除指定的备份
	DeleteBackup(ctx context.Context, filename string) error

	// CleanOldBackups 清理旧的备份文件，保留最近的 keepCount 个
	CleanOldBackups(ctx context.Context, keepCount int) error

	// SetMaxBackupCount 设置最大备份数量
	SetMaxBackupCount(maxCount int) error

	// GetMaxBackupCount 获取最大备份数量
	GetMaxBackupCount() int
}

// backupService 是 BackupService 接口的实现
// 备份内容为「系统设置」即数据库中的配置表数据，与「导出配置」一致
type backupService struct {
	backupDir       string               // 备份目录
	importExportSvc ImportExportService // 用于导出/导入数据库配置
	maxBackupCount  int                  // 最大备份数量，0表示无限制
}

const backupFilePrefix = "settings_backup_"
const backupFileSuffix = ".json"

// NewBackupService 创建一个新的系统设置备份服务实例
func NewBackupService(backupDir string, importExportSvc ImportExportService) BackupService {
	return NewBackupServiceWithLimit(backupDir, importExportSvc, 10)
}

// NewBackupServiceWithLimit 创建一个新的系统设置备份服务实例，可指定最大备份数量
func NewBackupServiceWithLimit(backupDir string, importExportSvc ImportExportService, maxBackupCount int) BackupService {
	if err := os.MkdirAll(backupDir, 0700); err != nil {
		log.Printf("警告: 创建备份目录失败: %v", err)
	}
	if maxBackupCount < 0 {
		log.Printf("警告: 最大备份数量不能为负数，设置为默认值10")
		maxBackupCount = 10
	}
	return &backupService{
		backupDir:       backupDir,
		importExportSvc: importExportSvc,
		maxBackupCount:  maxBackupCount,
	}
}

// CreateBackup 创建系统设置备份：从数据库导出配置并写入备份文件
func (s *backupService) CreateBackup(ctx context.Context, description string, isAuto bool) (*BackupInfo, error) {
	data, err := s.importExportSvc.ExportConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("导出系统配置失败: %w", err)
	}

	timestamp := time.Now().Format("20060102_150405")
	backupFilename := backupFilePrefix + timestamp + backupFileSuffix
	backupPath := filepath.Join(s.backupDir, backupFilename)

	if err := os.WriteFile(backupPath, data, 0600); err != nil {
		return nil, fmt.Errorf("写入备份文件失败: %w", err)
	}

	metadata := BackupInfo{
		Filename:    backupFilename,
		Size:        int64(len(data)),
		CreatedAt:   time.Now(),
		Description: description,
		IsAuto:      isAuto,
	}

	if err := s.saveMetadata(backupFilename, &metadata); err != nil {
		log.Printf("警告: 保存备份元数据失败: %v", err)
	}

	log.Printf("✅ 系统设置备份成功: %s (共 %d 字节)", backupFilename, metadata.Size)

	if s.maxBackupCount > 0 {
		if err := s.CleanOldBackups(ctx, s.maxBackupCount); err != nil {
			log.Printf("警告: 自动清理旧备份失败: %v", err)
		}
	}

	return &metadata, nil
}

// ListBackups 列出所有系统设置备份（仅 .json 备份文件）
func (s *backupService) ListBackups(ctx context.Context) ([]*BackupInfo, error) {
	entries, err := os.ReadDir(s.backupDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []*BackupInfo{}, nil
		}
		return nil, fmt.Errorf("读取备份目录失败: %w", err)
	}

	var backups []*BackupInfo
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		// 只处理系统设置备份文件，排除元数据文件
		if !strings.HasPrefix(name, backupFilePrefix) || !strings.HasSuffix(name, backupFileSuffix) {
			continue
		}
		if strings.HasSuffix(name, ".meta.json") {
			continue
		}

		metadata := s.loadMetadata(name)
		if metadata == nil {
			info, err := entry.Info()
			if err != nil {
				continue
			}
			metadata = &BackupInfo{
				Filename:    name,
				Size:        info.Size(),
				CreatedAt:   info.ModTime(),
				Description: "旧版本备份",
				IsAuto:      false,
			}
		}
		backups = append(backups, metadata)
	}

	sort.Slice(backups, func(i, j int) bool {
		return backups[i].CreatedAt.After(backups[j].CreatedAt)
	})

	return backups, nil
}

// RestoreBackup 从备份恢复系统设置：读取备份文件并导入到数据库
func (s *backupService) RestoreBackup(ctx context.Context, filename string) error {
	if err := s.validateBackupFilename(filename); err != nil {
		return err
	}

	backupPath := filepath.Join(s.backupDir, filename)
	if _, err := os.Stat(backupPath); err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("备份文件不存在: %s", filename)
		}
		return fmt.Errorf("访问备份文件失败: %w", err)
	}

	// 恢复前先备份当前配置
	_, _ = s.CreateBackup(ctx, "恢复前自动备份", true)

	data, err := os.ReadFile(backupPath)
	if err != nil {
		return fmt.Errorf("读取备份文件失败: %w", err)
	}

	if err := s.importExportSvc.ImportConfig(ctx, bytes.NewReader(data)); err != nil {
		return fmt.Errorf("恢复系统设置失败: %w", err)
	}

	log.Printf("✅ 系统设置已从备份恢复: %s", filename)
	return nil
}

// DeleteBackup 删除指定的备份文件及其元数据
func (s *backupService) DeleteBackup(ctx context.Context, filename string) error {
	if err := s.validateBackupFilename(filename); err != nil {
		return err
	}
	backupPath := filepath.Join(s.backupDir, filename)
	if _, err := os.Stat(backupPath); err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("备份文件不存在: %s", filename)
		}
		return fmt.Errorf("访问备份文件失败: %w", err)
	}
	if err := os.Remove(backupPath); err != nil {
		return fmt.Errorf("删除备份文件失败: %w", err)
	}
	metaPath := s.getMetadataPath(filename)
	if _, err := os.Stat(metaPath); err == nil {
		_ = os.Remove(metaPath)
	}
	log.Printf("✅ 备份已删除: %s", filename)
	return nil
}

const maxKeepCount = 100

// CleanOldBackups 清理旧备份，保留最近 keepCount 个
func (s *backupService) CleanOldBackups(ctx context.Context, keepCount int) error {
	if keepCount < 1 {
		return fmt.Errorf("保留数量必须大于0")
	}
	if keepCount > maxKeepCount {
		return fmt.Errorf("保留数量不能超过 %d", maxKeepCount)
	}
	backups, err := s.ListBackups(ctx)
	if err != nil {
		return err
	}
	if len(backups) <= keepCount {
		return nil
	}
	for i := keepCount; i < len(backups); i++ {
		_ = s.DeleteBackup(ctx, backups[i].Filename)
	}
	return nil
}

// validateBackupFilename 校验备份文件名，防止路径穿越或非法文件名
// 合法格式：settings_backup_YYYYMMDD_HHMMSS.json（时间戳固定 15 位）
func (s *backupService) validateBackupFilename(filename string) error {
	if filename == "" {
		return fmt.Errorf("备份文件名为空")
	}
	if strings.Contains(filename, "..") || strings.ContainsRune(filename, os.PathSeparator) ||
		strings.Contains(filename, "/") || strings.Contains(filename, "\\") {
		return fmt.Errorf("无效的备份文件名: %s", filename)
	}
	expectedLen := len(backupFilePrefix) + 15 + len(backupFileSuffix) // 16+15+5=36
	if len(filename) != expectedLen ||
		!strings.HasPrefix(filename, backupFilePrefix) ||
		!strings.HasSuffix(filename, backupFileSuffix) {
		return fmt.Errorf("无效的备份文件名: %s", filename)
	}
	// 中间时间戳必须为 20060102_150405 格式（仅数字与下划线）
	mid := filename[len(backupFilePrefix) : len(filename)-len(backupFileSuffix)]
	for _, r := range mid {
		if r != '_' && (r < '0' || r > '9') {
			return fmt.Errorf("无效的备份文件名: %s", filename)
		}
	}
	return nil
}

// getMetadataPath 获取元数据文件路径（备份文件 x.json 对应 x.meta.json）
func (s *backupService) getMetadataPath(filename string) string {
	base := strings.TrimSuffix(filename, backupFileSuffix)
	return filepath.Join(s.backupDir, base+".meta.json")
}

func (s *backupService) saveMetadata(filename string, metadata *BackupInfo) error {
	data, err := json.MarshalIndent(metadata, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.getMetadataPath(filename), data, 0600)
}

func (s *backupService) loadMetadata(filename string) *BackupInfo {
	data, err := os.ReadFile(s.getMetadataPath(filename))
	if err != nil {
		return nil
	}
	var metadata BackupInfo
	if err := json.Unmarshal(data, &metadata); err != nil {
		return nil
	}
	return &metadata
}

// SetMaxBackupCount 设置最大备份数量
func (s *backupService) SetMaxBackupCount(maxCount int) error {
	if maxCount < 0 {
		return fmt.Errorf("最大备份数量不能为负数")
	}
	s.maxBackupCount = maxCount
	if maxCount > 0 {
		ctx := context.Background()
		_ = s.CleanOldBackups(ctx, maxCount)
	}
	return nil
}

// GetMaxBackupCount 获取最大备份数量
func (s *backupService) GetMaxBackupCount() int {
	return s.maxBackupCount
}
