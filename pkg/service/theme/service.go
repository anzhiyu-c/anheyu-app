/*
 * @Description: 主题管理服务（优化版）
 * @Author: 安知鱼
 * @Date: 2025-09-18 11:00:00
 * @LastEditTime: 2026-01-24 17:52:13
 * @LastEditors: 安知鱼
 *
 * 设计原则：
 * 1. 本地只存储必需信息，主题详情从外部API获取
 * 2. 文件系统即状态：通过static目录存在性控制渲染模式
 * 3. 数据组合：本地安装状态 + 外部API详细信息
 */
package theme

import (
	"archive/zip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/userinstalledtheme"
	frontend_runtime "github.com/anzhiyu-c/anheyu-app/internal/frontend"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/util"
)

const (
	// 主题目录名称
	ThemesDirName = "themes"
	StaticDirName = "static"

	// 官方主题名称
	OfficialThemeName = "theme-anheyu"

	// 备份目录名称
	BackupDirName = "backup"

	// 外部主题商城API地址
	ThemeMarketAPI = "https://anheyuofficialwebsiteapi.anheyu.com/api/v1/themes"

	// 部署类型常量
	DeployTypeStandard = "standard" // 普通主题
	DeployTypeSSR      = "ssr"      // SSR 主题
)

// SSRManagerInterface SSR 主题管理器接口
// 用于解耦 ThemeService 和 SSR Manager
type SSRManagerInterface interface {
	// Start 启动 SSR 主题
	Start(themeName string, port int) error
	// Stop 停止 SSR 主题
	Stop(themeName string) error
	// IsRunning 检查主题是否正在运行
	IsRunning(themeName string) bool
	// ListRunning 列出所有正在运行的主题
	ListRunning() []string
	// StopAll 停止所有运行中的主题
	StopAll() error
}

// ThemeInfo 主题信息结构（与主题商城格式保持一致，并添加本地状态）
type ThemeInfo struct {
	ID             int      `json:"id"`
	Name           string   `json:"name"`
	Author         string   `json:"author"`
	Description    string   `json:"description"`
	ThemeType      string   `json:"themeType"`
	RepoURL        string   `json:"repoUrl"`
	InstructionURL string   `json:"instructionUrl"`
	Price          int      `json:"price"`
	DownloadURL    string   `json:"downloadUrl"`
	Tags           []string `json:"tags"`
	PreviewURL     string   `json:"previewUrl"`
	DemoURL        string   `json:"demoUrl"`
	Version        string   `json:"version"`
	DownloadCount  int      `json:"downloadCount"`
	Rating         float64  `json:"rating"`
	IsOfficial     bool     `json:"isOfficial"`
	IsActive       bool     `json:"isActive"`
	CreatedAt      string   `json:"createdAt"`
	UpdatedAt      string   `json:"updatedAt"`

	// 本地状态字段
	IsCurrent        bool                   `json:"is_current"`                  // 是否为当前使用的主题
	IsInstalled      bool                   `json:"is_installed"`                // 是否已安装（对于已安装主题列表始终为true）
	InstallTime      *time.Time             `json:"install_time,omitempty"`      // 安装时间
	UserConfig       map[string]interface{} `json:"user_config,omitempty"`       // 用户配置
	InstalledVersion string                 `json:"installed_version,omitempty"` // 已安装版本
}

// ThemeInstallRequest 主题安装请求（简化版）
type ThemeInstallRequest struct {
	MarketID    int    `json:"market_id"`
	ThemeName   string `json:"theme_name"`
	DownloadURL string `json:"download_url"`
	Version     string `json:"version,omitempty"`
}

// MarketTheme 主题商城主题信息（外部API格式）
type MarketTheme struct {
	ID             int      `json:"id"`
	Name           string   `json:"name"`
	Author         string   `json:"author"`
	Description    string   `json:"description"`
	ThemeType      string   `json:"themeType"`
	DeployType     string   `json:"deployType"` // standard-传统安装，ssr-Docker SSR 部署
	RepoURL        string   `json:"repoUrl"`
	InstructionURL string   `json:"instructionUrl"`
	Price          int      `json:"price"`
	DownloadURL    string   `json:"downloadUrl"`
	Tags           []string `json:"tags"`
	PreviewURL     string   `json:"previewUrl"`
	DemoURL        string   `json:"demoUrl"`
	Version        string   `json:"version"`
	DownloadCount  int      `json:"downloadCount"`
	Rating         float64  `json:"rating"`
	IsOfficial     bool     `json:"isOfficial"`
	IsActive       bool     `json:"isActive"`
	CreatedAt      string   `json:"createdAt"`
	UpdatedAt      string   `json:"updatedAt"`
}

// ThemeMetadata 主题元信息（theme.json格式）
type ThemeMetadata struct {
	Name        string      `json:"name" binding:"required"`
	DisplayName string      `json:"displayName" binding:"required"`
	Version     string      `json:"version" binding:"required"`
	Description string      `json:"description" binding:"required"`
	Author      interface{} `json:"author" binding:"required"` // 可以是string或object
	License     string      `json:"license"`
	Homepage    string      `json:"homepage"`
	Repository  *struct {
		Type string `json:"type"`
		URL  string `json:"url"`
	} `json:"repository"`
	Keywords    []string          `json:"keywords"`
	Category    string            `json:"category"`
	Screenshots interface{}       `json:"screenshots"` // 支持字符串或字符串数组
	Engines     map[string]string `json:"engines"`
	Features    []string          `json:"features"`
	// 主题配置定义（类似 Halo 的 settings.yaml）
	Settings []ThemeSettingGroup `json:"settings,omitempty"`
}

// ThemeSettingGroup 主题配置分组
type ThemeSettingGroup struct {
	Group  string              `json:"group"`  // 分组标识（如 style, layout, footer）
	Label  string              `json:"label"`  // 分组显示名称
	Fields []ThemeSettingField `json:"fields"` // 配置字段列表
}

// ThemeSettingField 主题配置字段定义
type ThemeSettingField struct {
	Name        string                `json:"name"`                  // 字段名称（唯一标识）
	Label       string                `json:"label"`                 // 显示标签
	Type        string                `json:"type"`                  // 字段类型: text, textarea, number, select, color, switch, image, code
	Default     interface{}           `json:"default,omitempty"`     // 默认值
	Placeholder string                `json:"placeholder,omitempty"` // 占位提示
	Description string                `json:"description,omitempty"` // 字段描述
	Required    bool                  `json:"required,omitempty"`    // 是否必填
	Options     []ThemeSettingOption  `json:"options,omitempty"`     // 选项（用于 select、radio 类型）
	Validation  *ThemeFieldValidation `json:"validation,omitempty"`  // 验证规则
	Condition   *ThemeFieldCondition  `json:"condition,omitempty"`   // 显示条件（依赖其他字段）
}

// ThemeSettingOption 配置字段选项
type ThemeSettingOption struct {
	Label string      `json:"label"` // 选项显示名称
	Value interface{} `json:"value"` // 选项值
}

// ThemeFieldValidation 字段验证规则
type ThemeFieldValidation struct {
	MinLength *int     `json:"minLength,omitempty"` // 最小长度
	MaxLength *int     `json:"maxLength,omitempty"` // 最大长度
	Min       *float64 `json:"min,omitempty"`       // 最小值（数字类型）
	Max       *float64 `json:"max,omitempty"`       // 最大值（数字类型）
	Pattern   string   `json:"pattern,omitempty"`   // 正则表达式
	Message   string   `json:"message,omitempty"`   // 验证失败提示
}

// ThemeFieldCondition 字段显示条件
type ThemeFieldCondition struct {
	Field    string      `json:"field"`    // 依赖的字段名
	Operator string      `json:"operator"` // 操作符: eq, neq, contains, gt, lt
	Value    interface{} `json:"value"`    // 比较值
}

// AuthorInfo 作者信息结构
type AuthorInfo struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	URL   string `json:"url"`
}

// ThemeValidationResult 主题验证结果
type ThemeValidationResult struct {
	IsValid       bool           `json:"is_valid"`
	Errors        []string       `json:"errors"`
	Warnings      []string       `json:"warnings"`
	Metadata      *ThemeMetadata `json:"metadata"`
	FileList      []string       `json:"file_list"`
	TotalSize     int64          `json:"total_size"`
	ExistingTheme *ThemeInfo     `json:"existing_theme,omitempty"`
}

// ThemeService 主题服务接口
type ThemeService interface {
	// 获取当前使用的主题
	GetCurrentTheme(ctx context.Context, userID uint) (*ThemeInfo, error)

	// 获取用户已安装的主题列表（组合本地数据和外部API数据）
	GetInstalledThemes(ctx context.Context, userID uint) ([]*ThemeInfo, error)

	// 安装主题（简化流程）
	InstallTheme(ctx context.Context, userID uint, req *ThemeInstallRequest) error

	// 切换到指定主题（可能是普通主题或官方主题）
	// ssrManager: 用于切换到普通/官方主题时停止 SSR 进程
	SwitchToTheme(ctx context.Context, userID uint, themeName string, ssrManager SSRManagerInterface) error

	// 切换到官方主题（需要停止所有 SSR 主题）
	SwitchToOfficial(ctx context.Context, userID uint, ssrManager SSRManagerInterface) error

	// 卸载主题
	UninstallTheme(ctx context.Context, userID uint, themeName string) error

	// 检查是否使用静态模式（是否存在static目录）
	IsStaticModeActive() bool

	// 获取主题商城列表（从外部API获取）
	GetThemeMarketList(ctx context.Context) ([]*MarketTheme, error)

	// 获取 PRO 版本主题商城列表（包含完整的 PRO 主题下载链接）
	GetThemeMarketListForPro(ctx context.Context, licenseKey string) ([]*MarketTheme, error)

	// 上传主题压缩包
	UploadTheme(ctx context.Context, userID uint, file *multipart.FileHeader, forceUpdate ...bool) (*ThemeInfo, error)

	// 验证主题压缩包
	ValidateThemePackage(ctx context.Context, userID uint, file *multipart.FileHeader) (*ThemeValidationResult, error)

	// 修复用户主题的当前状态数据一致性
	FixThemeCurrentStatus(ctx context.Context, userID uint) error

	// ===== SSR 主题管理 =====

	// 安装 SSR 主题（写入数据库记录）
	InstallSSRTheme(ctx context.Context, userID uint, themeName string, version string, marketID int) error

	// 卸载 SSR 主题（删除数据库记录）
	UninstallSSRTheme(ctx context.Context, userID uint, themeName string) error

	// 切换到 SSR 主题（更新 is_current，停止其他 SSR）
	SwitchToSSRTheme(ctx context.Context, userID uint, themeName string, ssrManager SSRManagerInterface) error

	// 清除所有主题的当前状态
	ClearAllThemeCurrentStatus(ctx context.Context, userID uint) error

	// 同步 SSR 主题状态（扫描文件系统，同步到数据库）
	SyncSSRThemesFromFileSystem(ctx context.Context, userID uint, themesDir string) error

	// 获取 SSR 主题的 is_current 状态（返回 map[themeName]isCurrent）
	GetSSRThemeCurrentStatus(ctx context.Context, userID uint) (map[string]bool, error)

	// 获取当前活跃的 SSR 主题名称（供代理中间件使用）
	// 返回 (themeName, isCurrent)：如果有 SSR 主题设置为当前主题，返回其名称和 true
	GetCurrentSSRThemeName(ctx context.Context, userID uint) (string, bool)

	// ===== 主题配置相关 =====

	// 获取主题的配置定义（从 theme.json 读取）
	GetThemeSettings(ctx context.Context, themeName string) ([]ThemeSettingGroup, error)

	// 获取用户对某主题的配置值
	GetUserThemeConfig(ctx context.Context, userID uint, themeName string) (map[string]interface{}, error)

	// 保存用户对某主题的配置值
	SaveUserThemeConfig(ctx context.Context, userID uint, themeName string, config map[string]interface{}) error

	// 获取当前激活主题的配置（供前端主题使用的公开接口）
	GetCurrentThemeConfig(ctx context.Context, userID uint) (*ThemeConfigResponse, error)
}

// ThemeConfigResponse 主题配置响应
type ThemeConfigResponse struct {
	ThemeName string                 `json:"theme_name"` // 主题名称
	Settings  []ThemeSettingGroup    `json:"settings"`   // 配置定义
	Values    map[string]interface{} `json:"values"`     // 当前配置值（用户配置 + 默认值）
}

// themeService 主题服务实现
type themeService struct {
	db       *ent.Client
	userRepo repository.UserRepository
}

// NewThemeService 创建主题服务实例
func NewThemeService(db *ent.Client, userRepo repository.UserRepository) ThemeService {
	return &themeService{
		db:       db,
		userRepo: userRepo,
	}
}

// GetThemeMarketList 获取主题商城列表（从外部API获取）
func (s *themeService) GetThemeMarketList(ctx context.Context) ([]*MarketTheme, error) {
	// 创建HTTP客户端请求
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	req, err := http.NewRequestWithContext(ctx, "GET", ThemeMarketAPI, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Anheyu-App/1.0")

	// 发送请求
	resp, err := client.Do(req)
	if err != nil {
		// 如果外部API调用失败，返回空列表而不是错误，确保系统仍可用
		log.Printf("调用主题商城API失败: %v，返回空列表", err)
		return []*MarketTheme{}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("主题商城API返回错误状态码: %d，返回空列表", resp.StatusCode)
		return []*MarketTheme{}, nil
	}

	// 读取响应体
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("读取API响应失败: %v，返回空列表", err)
		return []*MarketTheme{}, nil
	}

	// 定义API响应结构
	type APIResponse struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    struct {
			List  []*MarketTheme `json:"list"`
			Total int            `json:"total"`
		} `json:"data"`
	}

	var apiResp APIResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		log.Printf("解析API响应失败: %v，返回空列表", err)
		return []*MarketTheme{}, nil
	}

	// 检查API响应码（官网 API 成功时返回 code: 0）
	if apiResp.Code != 0 && apiResp.Code != 200 {
		log.Printf("API返回错误码: %d, 消息: %s，返回空列表", apiResp.Code, apiResp.Message)
		return []*MarketTheme{}, nil
	}

	// 返回主题列表
	if apiResp.Data.List == nil {
		return []*MarketTheme{}, nil
	}

	log.Printf("成功从主题商城API获取到 %d 个主题", len(apiResp.Data.List))
	return apiResp.Data.List, nil
}

// PRO 版本主题商城 API 地址
const ThemeMarketProAPI = "https://anheyuofficialwebsiteapi.anheyu.com/api/v1/themes/pro"

// GetThemeMarketListForPro 获取 PRO 版本主题商城列表（包含完整的 PRO 主题下载链接）
// licenseKey 参数用于授权密钥验证
func (s *themeService) GetThemeMarketListForPro(ctx context.Context, licenseKey string) ([]*MarketTheme, error) {
	// 创建HTTP客户端请求
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	req, err := http.NewRequestWithContext(ctx, "GET", ThemeMarketProAPI, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Anheyu-Pro/1.0")
	req.Header.Set("X-License-Key", licenseKey) // 传递授权密钥用于验证

	log.Printf("[PRO API] 正在调用 PRO 主题商城 API: %s", ThemeMarketProAPI)

	// 发送请求
	resp, err := client.Do(req)
	if err != nil {
		// 如果 PRO API 调用失败，回退到普通 API
		log.Printf("调用 PRO 主题商城API失败: %v，回退到普通API", err)
		return s.GetThemeMarketList(ctx)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		// 授权密钥无效，回退到普通 API
		log.Printf("PRO 主题商城API授权密钥无效，回退到普通API")
		return s.GetThemeMarketList(ctx)
	}

	if resp.StatusCode != http.StatusOK {
		log.Printf("PRO 主题商城API返回错误状态码: %d，回退到普通API", resp.StatusCode)
		return s.GetThemeMarketList(ctx)
	}

	// 读取响应体
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("读取 PRO API响应失败: %v，回退到普通API", err)
		return s.GetThemeMarketList(ctx)
	}

	// PRO API 返回格式可能有两种：
	// 1. 直接返回 {"list":[...],"total":2}
	// 2. 包装格式 {"code":0,"data":{"list":[...],"total":2}}

	// 先尝试解析直接格式
	type DirectResponse struct {
		List  []*MarketTheme `json:"list"`
		Total int            `json:"total"`
	}

	var directResp DirectResponse
	if err := json.Unmarshal(body, &directResp); err == nil && directResp.List != nil {
		log.Printf("成功从 PRO 主题商城API获取到 %d 个主题（直接格式，包含完整下载链接）", len(directResp.List))
		return directResp.List, nil
	}

	// 尝试解析包装格式
	type WrappedResponse struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    struct {
			List  []*MarketTheme `json:"list"`
			Total int            `json:"total"`
		} `json:"data"`
	}

	var wrappedResp WrappedResponse
	if err := json.Unmarshal(body, &wrappedResp); err != nil {
		log.Printf("解析 PRO API响应失败: %v，回退到普通API", err)
		return s.GetThemeMarketList(ctx)
	}

	// 检查API响应码（官网 API 成功时返回 code: 0）
	if wrappedResp.Code != 0 && wrappedResp.Code != 200 {
		log.Printf("PRO API返回错误码: %d, 消息: %s，回退到普通API", wrappedResp.Code, wrappedResp.Message)
		return s.GetThemeMarketList(ctx)
	}

	// 返回主题列表
	if wrappedResp.Data.List == nil {
		return []*MarketTheme{}, nil
	}

	log.Printf("成功从 PRO 主题商城API获取到 %d 个主题（包装格式，包含完整下载链接）", len(wrappedResp.Data.List))
	return wrappedResp.Data.List, nil
}

// GetCurrentTheme 获取当前使用的主题
func (s *themeService) GetCurrentTheme(ctx context.Context, userID uint) (*ThemeInfo, error) {
	// 核心逻辑：如果没有static目录，一定是使用官方主题
	staticModeActive := s.IsStaticModeActive()
	now := time.Now()

	if !staticModeActive {
		// 没有static目录，使用官方主题
		log.Printf("用户 %d 当前使用官方主题（无static目录）", userID)
		return &ThemeInfo{
			ID:             1,
			Name:           "安和鱼官方主题",
			Author:         "安知鱼",
			Description:    "安知鱼官方主题",
			ThemeType:      "community",
			RepoURL:        "https://github.com/anzhiyu-c/anheyu-app-frontend",
			InstructionURL: "",
			Price:          0,
			DownloadURL:    "",
			Tags:           []string{"极致性能", "简洁", "不简单"},
			PreviewURL:     "https://upload-bbs.miyoushe.com/upload/2025/09/18/125766904/359dbf5b0ce07e56a960b31063c44280_4491727436207297404.png",
			DemoURL:        "https://demo.anheyu.com/",
			Version:        "1.0.0",
			DownloadCount:  0,
			Rating:         0,
			IsOfficial:     true,
			IsActive:       true,
			CreatedAt:      "2025-09-18 07:58:32",
			UpdatedAt:      "2025-09-18 13:17:10",
			IsCurrent:      true,
			IsInstalled:    false,
			InstallTime:    &now,
		}, nil
	}

	// 有static目录，查找数据库中的当前主题
	localTheme, err := s.db.UserInstalledTheme.
		Query().
		Where(
			userinstalledtheme.UserID(userID),
			userinstalledtheme.IsCurrent(true),
		).
		First(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			// 有static目录但没有数据库记录，这是异常情况
			log.Printf("警告：用户 %d 有static目录但数据库中没有当前主题记录", userID)
			// 返回一个未知的外部主题
			return &ThemeInfo{
				ID:          0,
				Name:        "外部主题",
				Author:      "Unknown",
				Description: "当前使用的外部主题",
				ThemeType:   "community",
				Version:     "Unknown",
				Tags:        []string{},
				IsOfficial:  false,
				IsActive:    true,
				CreatedAt:   now.Format("2006-01-02 15:04:05"),
				UpdatedAt:   now.Format("2006-01-02 15:04:05"),
				IsCurrent:   true,
				IsInstalled: false,
				InstallTime: &now,
			}, nil
		}
		return nil, fmt.Errorf("查询当前主题失败: %w", err)
	}

	// 组合本地数据和外部API数据
	themeInfo := &ThemeInfo{
		ID:               int(localTheme.ID),
		Name:             localTheme.ThemeName,
		Author:           "未知",
		Description:      "本地安装的主题",
		ThemeType:        "community",
		Version:          localTheme.InstalledVersion,
		Tags:             []string{},
		IsOfficial:       false,
		IsActive:         true,
		CreatedAt:        localTheme.InstallTime.Format("2006-01-02 15:04:05"),
		UpdatedAt:        localTheme.InstallTime.Format("2006-01-02 15:04:05"),
		IsCurrent:        localTheme.IsCurrent,
		IsInstalled:      true,
		InstallTime:      &localTheme.InstallTime,
		UserConfig:       localTheme.UserThemeConfig,
		InstalledVersion: localTheme.InstalledVersion,
	}

	return themeInfo, nil
}

// GetCurrentSSRThemeName 获取当前活跃的 SSR 主题名称
// 返回 (themeName, isCurrent)
// - themeName: SSR 主题名称
// - isCurrent: 是否有 SSR 主题设置为当前主题
// 此方法供 SSR 代理中间件使用，用于判断是否应该代理请求到 SSR
func (s *themeService) GetCurrentSSRThemeName(ctx context.Context, userID uint) (string, bool) {
	// 直接查询数据库中 is_current=true 且 deploy_type=ssr 的主题
	theme, err := s.db.UserInstalledTheme.
		Query().
		Where(
			userinstalledtheme.UserID(userID),
			userinstalledtheme.IsCurrent(true),
			userinstalledtheme.DeployTypeEQ(userinstalledtheme.DeployTypeSsr),
		).
		First(ctx)

	if err != nil {
		// 没有找到当前 SSR 主题（可能是官方主题或普通主题）
		return "", false
	}

	return theme.ThemeName, true
}

// GetInstalledThemes 获取用户已安装的主题列表
func (s *themeService) GetInstalledThemes(ctx context.Context, userID uint) ([]*ThemeInfo, error) {
	// 首先自动修复数据状态不一致问题
	if err := s.FixThemeCurrentStatus(ctx, userID); err != nil {
		log.Printf("警告：自动修复用户 %d 主题状态失败: %v", userID, err)
		// 继续执行，不因修复失败而中断获取主题列表
	}

	// 从数据库获取已安装主题（排除 SSR 类型，SSR 主题由单独的 API 返回）
	localThemes, err := s.db.UserInstalledTheme.
		Query().
		Where(
			userinstalledtheme.UserID(userID),
			userinstalledtheme.DeployTypeNEQ(userinstalledtheme.DeployTypeSsr),
		).
		Order(ent.Desc(userinstalledtheme.FieldInstallTime)).
		All(ctx)

	if err != nil {
		return nil, fmt.Errorf("查询已安装主题失败: %w", err)
	}

	// 获取主题商城数据（用于组合）
	marketThemes, err := s.GetThemeMarketList(ctx)
	if err != nil {
		log.Printf("获取主题商城数据失败: %v", err)
		marketThemes = []*MarketTheme{} // 继续处理，只是没有商城数据
	}

	// 创建主题映射表
	marketThemeMap := make(map[string]*MarketTheme)
	for _, theme := range marketThemes {
		marketThemeMap[theme.Name] = theme
	}

	// 组合本地数据和外部API数据
	result := make([]*ThemeInfo, 0, len(localThemes)+1)

	for _, localTheme := range localThemes {
		marketTheme := marketThemeMap[localTheme.ThemeName]

		// 组合本地数据和市场数据
		themeInfo := &ThemeInfo{
			// 本地状态字段
			IsCurrent:        localTheme.IsCurrent,
			IsInstalled:      true,
			InstallTime:      &localTheme.InstallTime,
			UserConfig:       localTheme.UserThemeConfig,
			InstalledVersion: localTheme.InstalledVersion,
		}

		// 如果有市场数据，使用市场数据填充详细信息
		if marketTheme != nil {
			themeInfo.ID = marketTheme.ID
			themeInfo.Name = marketTheme.Name
			themeInfo.Author = marketTheme.Author
			themeInfo.Description = marketTheme.Description
			themeInfo.ThemeType = marketTheme.ThemeType
			themeInfo.RepoURL = marketTheme.RepoURL
			themeInfo.InstructionURL = marketTheme.InstructionURL
			themeInfo.Price = marketTheme.Price
			themeInfo.DownloadURL = marketTheme.DownloadURL
			themeInfo.Tags = marketTheme.Tags
			themeInfo.PreviewURL = marketTheme.PreviewURL
			themeInfo.DemoURL = marketTheme.DemoURL
			themeInfo.Version = marketTheme.Version
			themeInfo.DownloadCount = marketTheme.DownloadCount
			themeInfo.Rating = marketTheme.Rating
			themeInfo.IsOfficial = marketTheme.IsOfficial
			themeInfo.IsActive = marketTheme.IsActive
			themeInfo.CreatedAt = marketTheme.CreatedAt
			themeInfo.UpdatedAt = marketTheme.UpdatedAt
		} else {
			// 如果没有市场数据，尝试从本地 theme.json 读取信息
			localMetadata, err := s.loadThemeMetadataFromDisk(localTheme.ThemeName)
			if err != nil {
				log.Printf("读取本地主题 %s 的 theme.json 失败: %v", localTheme.ThemeName, err)
				// 使用默认信息作为备用
				themeInfo.ID = int(localTheme.ID)
				themeInfo.Name = localTheme.ThemeName
				themeInfo.Author = "未知"
				themeInfo.Description = "本地安装的主题"
				themeInfo.ThemeType = "community"
				themeInfo.Version = localTheme.InstalledVersion
				themeInfo.Tags = []string{}
				themeInfo.IsOfficial = false
				themeInfo.IsActive = true
				themeInfo.CreatedAt = localTheme.InstallTime.Format("2006-01-02 15:04:05")
				themeInfo.UpdatedAt = localTheme.InstallTime.Format("2006-01-02 15:04:05")
			} else {
				// 使用本地 theme.json 的数据
				authorName := s.extractAuthorName(localMetadata.Author)
				previewURL := s.extractFirstScreenshot(localMetadata.Screenshots)

				// 处理仓库URL
				repoURL := ""
				if localMetadata.Repository != nil {
					repoURL = localMetadata.Repository.URL
				}

				// 处理主题类型
				themeType := "community"
				if localMetadata.Category != "" {
					themeType = localMetadata.Category
				}

				themeInfo.ID = int(localTheme.ID)
				themeInfo.Name = localMetadata.Name
				themeInfo.Author = authorName
				themeInfo.Description = localMetadata.Description
				themeInfo.ThemeType = themeType
				themeInfo.RepoURL = repoURL
				themeInfo.InstructionURL = localMetadata.Homepage
				themeInfo.Price = 0
				themeInfo.DownloadURL = ""
				themeInfo.Tags = localMetadata.Keywords
				themeInfo.PreviewURL = previewURL
				themeInfo.DemoURL = ""
				themeInfo.Version = localMetadata.Version
				themeInfo.DownloadCount = 0
				themeInfo.Rating = 0
				themeInfo.IsOfficial = false
				themeInfo.IsActive = true
				themeInfo.CreatedAt = localTheme.InstallTime.Format("2006-01-02 15:04:05")
				themeInfo.UpdatedAt = localTheme.InstallTime.Format("2006-01-02 15:04:05")
			}
		}

		result = append(result, themeInfo)
	}

	// 检查静态模式状态
	staticModeActive := s.IsStaticModeActive()

	// 检查数据库中是否有任何主题（包括 SSR 主题）被设为当前使用
	// 这用于判断官方主题是否应该显示为当前
	hasCurrentThemeInDB, err := s.db.UserInstalledTheme.
		Query().
		Where(
			userinstalledtheme.UserID(userID),
			userinstalledtheme.IsCurrent(true),
		).
		Exist(ctx)
	if err != nil {
		log.Printf("查询数据库当前主题失败: %v", err)
		hasCurrentThemeInDB = false
	}

	// 根据静态模式状态和数据库当前主题状态调整主题的当前使用状态
	// 只有在没有 static 目录且数据库中没有任何当前主题时，官方主题才应该是当前使用
	if !staticModeActive && !hasCurrentThemeInDB {
		// 如果没有static目录且数据库中没有当前主题，则所有数据库主题都不应该是当前使用
		for _, theme := range result {
			if theme.IsCurrent {
				log.Printf("警告：用户 %d 在官方主题模式下，数据库主题 %s 仍标记为当前使用，将被修正", userID, theme.Name)
				theme.IsCurrent = false
			}
		}
	}

	// 检查是否有官方主题，如果没有则添加
	hasOfficial := false
	for _, theme := range result {
		if s.isOfficialTheme(theme.Name) {
			hasOfficial = true
			break
		}
	}

	if !hasOfficial {
		now := time.Now()
		// 核心逻辑：只有在没有 static 目录且数据库中没有任何当前主题时，官方主题才是当前使用的
		// 如果数据库中有其他主题（包括 SSR 主题）被设为当前，官方主题就不是当前
		isOfficialCurrent := !staticModeActive && !hasCurrentThemeInDB

		officialTheme := &ThemeInfo{
			ID:             1,
			Name:           "安和鱼官方主题",
			Author:         "安知鱼",
			Description:    "这是一款简洁而不简单的主题。",
			ThemeType:      "community",
			RepoURL:        "https://github.com/anzhiyu-c/anheyu-app-frontend",
			InstructionURL: "",
			Price:          0,
			DownloadURL:    "",
			Tags:           []string{"极致性能", "简洁", "不简单"},
			PreviewURL:     "https://upload-bbs.miyoushe.com/upload/2025/09/18/125766904/359dbf5b0ce07e56a960b31063c44280_4491727436207297404.png",
			DemoURL:        "https://demo.anheyu.com/",
			Version:        "latest",
			DownloadCount:  0,
			Rating:         0,
			IsOfficial:     true,
			IsActive:       true,
			CreatedAt:      "2025-09-18 07:58:32",
			UpdatedAt:      "2025-09-18 13:17:10",

			// 本地状态字段
			IsCurrent:   isOfficialCurrent,
			IsInstalled: false,
			InstallTime: &now,
		}
		// 将官方主题插入到列表开头
		result = append([]*ThemeInfo{officialTheme}, result...)

		log.Printf("添加官方主题，是否为当前使用: %v (静态模式激活: %v)",
			isOfficialCurrent, staticModeActive)
	}

	// 数据一致性检查和最终验证
	currentThemeCount := 0
	var currentThemeNames []string
	for _, theme := range result {
		if theme.IsCurrent {
			currentThemeCount++
			currentThemeNames = append(currentThemeNames, theme.Name)
		}
	}

	if currentThemeCount != 1 {
		log.Printf("警告：用户 %d 有 %d 个当前主题 %v，期望只有1个 (静态模式: %v)",
			userID, currentThemeCount, currentThemeNames, staticModeActive)
	} else {
		log.Printf("用户 %d 当前主题状态正常: %s (静态模式: %v)",
			userID, currentThemeNames[0], staticModeActive)
	}

	return result, nil
}

// InstallTheme 安装主题（简化流程）
func (s *themeService) InstallTheme(ctx context.Context, userID uint, req *ThemeInstallRequest) error {
	if req == nil {
		return fmt.Errorf("主题安装请求不能为空")
	}
	themeDir, err := safeThemePath(req.ThemeName)
	if err != nil {
		return err
	}
	// 1. 检查主题是否已经安装
	exists, err := s.db.UserInstalledTheme.
		Query().
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

	// 2. 下载并解压主题文件
	if err := s.downloadAndExtractTheme(req.DownloadURL, themeDir); err != nil {
		return fmt.Errorf("下载主题失败: %w", err)
	}

	// 3. 验证主题文件完整性
	if err := s.validateThemeFiles(themeDir); err != nil {
		// 清理已下载的文件
		if cleanupErr := removeThemeDirectory(themeDir); cleanupErr != nil {
			log.Printf("清理主题目录失败: %v", cleanupErr)
		}
		return fmt.Errorf("主题文件验证失败: %w", err)
	}

	// 4. 在数据库中记录主题信息（只存储必要的本地信息）
	createBuilder := s.db.UserInstalledTheme.
		Create().
		SetUserID(userID).
		SetThemeName(req.ThemeName).
		SetInstallTime(time.Now())

	if req.MarketID > 0 {
		createBuilder = createBuilder.SetThemeMarketID(req.MarketID)
	}

	if req.Version != "" {
		createBuilder = createBuilder.SetInstalledVersion(req.Version)
	}

	_, err = createBuilder.Save(ctx)
	if err != nil {
		// 清理已下载的文件
		if cleanupErr := removeThemeDirectory(themeDir); cleanupErr != nil {
			log.Printf("清理主题目录失败: %v", cleanupErr)
		}
		return fmt.Errorf("保存主题信息失败: %w", err)
	}

	log.Printf("主题 %s 安装成功", req.ThemeName)
	return nil
}

// combineThemeInfo 组合本地数据和外部API数据
func (s *themeService) combineThemeInfo(ctx context.Context, localTheme *ent.UserInstalledTheme, marketTheme *MarketTheme) (*ThemeInfo, error) {
	themeInfo := &ThemeInfo{
		// 本地状态字段
		ID:               int(localTheme.ID),
		IsCurrent:        localTheme.IsCurrent,
		IsInstalled:      true,
		InstallTime:      &localTheme.InstallTime,
		UserConfig:       localTheme.UserThemeConfig,
		InstalledVersion: localTheme.InstalledVersion,
	}

	// 如果有商城数据，填充详细信息
	if marketTheme != nil {
		themeInfo.ID = marketTheme.ID
		themeInfo.Name = marketTheme.Name
		themeInfo.Author = marketTheme.Author
		themeInfo.Description = marketTheme.Description
		themeInfo.Version = marketTheme.Version
		themeInfo.ThemeType = marketTheme.ThemeType
		themeInfo.Tags = marketTheme.Tags
		themeInfo.RepoURL = marketTheme.RepoURL
		themeInfo.InstructionURL = marketTheme.InstructionURL
		themeInfo.Price = marketTheme.Price
		themeInfo.DownloadURL = marketTheme.DownloadURL
		themeInfo.PreviewURL = marketTheme.PreviewURL
		themeInfo.DemoURL = marketTheme.DemoURL
		themeInfo.DownloadCount = marketTheme.DownloadCount
		themeInfo.Rating = marketTheme.Rating
		themeInfo.IsOfficial = marketTheme.IsOfficial
		themeInfo.IsActive = marketTheme.IsActive
		themeInfo.CreatedAt = marketTheme.CreatedAt
		themeInfo.UpdatedAt = marketTheme.UpdatedAt
	} else {
		// 如果没有商城数据，使用基本信息
		themeInfo.Name = localTheme.ThemeName
		themeInfo.Author = "未知"
		themeInfo.Description = "本地安装的主题"
		themeInfo.ThemeType = "community"
		themeInfo.Version = localTheme.InstalledVersion
		themeInfo.Tags = []string{}
		themeInfo.IsOfficial = localTheme.ThemeName == OfficialThemeName
		themeInfo.IsActive = true
		themeInfo.CreatedAt = localTheme.InstallTime.Format("2006-01-02 15:04:05")
		themeInfo.UpdatedAt = localTheme.InstallTime.Format("2006-01-02 15:04:05")
	}

	return themeInfo, nil
}

// isOfficialTheme 判断是否是官方主题
func (s *themeService) isOfficialTheme(themeName string) bool {
	officialNames := []string{
		OfficialThemeName, // "theme-anheyu"
		"安和鱼官方主题",         // 显示名称
		"安知鱼官方主题",         // 另一个可能的显示名称
		"官方主题",            // 可能的简称
	}

	for _, officialName := range officialNames {
		if themeName == officialName {
			return true
		}
	}
	return false
}

// SwitchToTheme 切换到指定主题
func (s *themeService) SwitchToTheme(ctx context.Context, userID uint, themeName string, ssrManager SSRManagerInterface) error {
	// 检查是否是官方主题
	if s.isOfficialTheme(themeName) {
		log.Printf("用户 %d 请求切换到官方主题: %s", userID, themeName)
		return s.SwitchToOfficial(ctx, userID, ssrManager)
	}
	themeDir, err := safeThemePath(themeName)
	if err != nil {
		return err
	}

	// 1. 检查主题是否已安装
	theme, err := s.db.UserInstalledTheme.
		Query().
		Where(
			userinstalledtheme.UserID(userID),
			userinstalledtheme.ThemeName(themeName),
		).
		First(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			return fmt.Errorf("主题 %s 未安装", themeName)
		}
		return fmt.Errorf("查询主题失败: %w", err)
	}

	// 2. 检查主题文件是否存在
	if err := s.validateThemeFiles(themeDir); err != nil {
		return fmt.Errorf("主题文件不完整: %w", err)
	}

	// 3. 备份当前static目录（如果存在）
	backupPath := ""
	staticDir := s.staticDirPath()
	if s.IsStaticModeActive() {
		backupPath = filepath.Join(BackupDirName, fmt.Sprintf("static_backup_%d", time.Now().Unix()))
		if err := s.backupDirectory(staticDir, backupPath); err != nil {
			return fmt.Errorf("备份静态文件失败: %w", err)
		}
	}

	// 4. 复制主题文件到static目录
	if err := s.copyThemeToStatic(themeDir); err != nil {
		// 如果失败，恢复备份
		if backupPath != "" {
			s.restoreFromBackup(backupPath, staticDir)
		}
		return fmt.Errorf("复制主题文件失败: %w", err)
	}

	// 5. 更新数据库记录
	tx, err := s.db.Tx(ctx)
	if err != nil {
		return fmt.Errorf("开启事务失败: %w", err)
	}

	// 取消当前所有主题的激活状态
	_, err = tx.UserInstalledTheme.
		Update().
		Where(userinstalledtheme.UserID(userID)).
		SetIsCurrent(false).
		Save(ctx)

	if err != nil {
		tx.Rollback()
		if backupPath != "" {
			s.restoreFromBackup(backupPath, staticDir)
		}
		return fmt.Errorf("更新主题状态失败: %w", err)
	}

	// 设置新主题为当前主题
	_, err = tx.UserInstalledTheme.
		UpdateOneID(theme.ID).
		SetIsCurrent(true).
		Save(ctx)

	if err != nil {
		tx.Rollback()
		if backupPath != "" {
			s.restoreFromBackup(backupPath, staticDir)
		}
		return fmt.Errorf("设置当前主题失败: %w", err)
	}

	if err := tx.Commit(); err != nil {
		if backupPath != "" {
			s.restoreFromBackup(backupPath, staticDir)
		}
		return fmt.Errorf("提交事务失败: %w", err)
	}

	// 6. 验证切换后的状态一致性
	currentThemesCount, err := s.db.UserInstalledTheme.
		Query().
		Where(
			userinstalledtheme.UserID(userID),
			userinstalledtheme.IsCurrent(true),
		).
		Count(ctx)

	if err != nil {
		log.Printf("警告：验证用户 %d 当前主题状态失败: %v", userID, err)
	} else if currentThemesCount != 1 {
		log.Printf("警告：用户 %d 在主题切换后有 %d 个当前主题，状态异常", userID, currentThemesCount)
	}

	// 7. 清理备份文件
	if backupPath != "" {
		os.RemoveAll(backupPath)
	}

	log.Printf("成功切换到主题 %s", themeName)
	return nil
}

// SwitchToOfficial 切换到官方主题
// 重要：先更新数据库状态，再停止 SSR 进程
// 这样即使停止进程失败，代理中间件也不会再代理请求（因为数据库状态已经更新了）
func (s *themeService) SwitchToOfficial(ctx context.Context, userID uint, ssrManager SSRManagerInterface) error {
	// 1. 首先更新数据库记录（让代理中间件立即停止代理到 SSR）
	// 这是最关键的一步，必须首先执行
	_, err := s.db.UserInstalledTheme.
		Update().
		Where(userinstalledtheme.UserID(userID)).
		SetIsCurrent(false).
		Save(ctx)

	if err != nil {
		return fmt.Errorf("更新主题状态失败: %w", err)
	}
	log.Printf("[切换到官方主题] 数据库状态已更新：所有主题 is_current=false")

	// 2. 备份当前static目录（如果存在）
	backupPath := ""
	staticDir := s.staticDirPath()
	if s.IsStaticModeActive() {
		backupPath = filepath.Join(BackupDirName, fmt.Sprintf("static_backup_%d", time.Now().Unix()))
		if err := s.backupDirectory(staticDir, backupPath); err != nil {
			log.Printf("[切换到官方主题] 警告：备份静态文件失败: %v", err)
			// 不阻塞，继续执行
		}
	}

	// 3. 安全删除static目录
	if err := s.safeRemoveStaticDir(); err != nil {
		log.Printf("[切换到官方主题] 警告：删除静态目录失败: %v", err)
		// 不阻塞，继续执行
	}

	// 4. 停止所有运行中的 SSR 主题（异步执行，不阻塞主流程）
	// 即使这一步失败，前面数据库状态已经更新，代理中间件也不会再代理到 SSR
	if ssrManager != nil {
		runningThemes := ssrManager.ListRunning()
		for _, themeName := range runningThemes {
			log.Printf("[切换到官方主题] 停止 SSR 主题: %s", themeName)
			if err := ssrManager.Stop(themeName); err != nil {
				log.Printf("[切换到官方主题] 停止 SSR 主题 %s 失败（不影响切换结果）: %v", themeName, err)
				// 继续处理，不阻塞切换
			}
		}
	}

	// 5. 验证切换后的状态一致性
	currentThemesCount, err := s.db.UserInstalledTheme.
		Query().
		Where(
			userinstalledtheme.UserID(userID),
			userinstalledtheme.IsCurrent(true),
		).
		Count(ctx)

	if err != nil {
		log.Printf("警告：验证用户 %d 当前主题状态失败: %v", userID, err)
	} else if currentThemesCount > 0 {
		log.Printf("警告：用户 %d 切换到官方主题后仍有 %d 个数据库主题标记为当前，状态异常", userID, currentThemesCount)
	}

	// 6. 清理备份文件
	if backupPath != "" {
		os.RemoveAll(backupPath)
	}

	log.Printf("成功切换到官方主题")
	return nil
}

// UninstallTheme 卸载主题
func (s *themeService) UninstallTheme(ctx context.Context, userID uint, themeName string) error {
	themeDir, err := safeThemePath(themeName)
	if err != nil {
		return err
	}
	if s.isOfficialTheme(themeName) {
		return fmt.Errorf("不能卸载官方主题")
	}

	// 1. 查询主题记录
	theme, err := s.db.UserInstalledTheme.
		Query().
		Where(
			userinstalledtheme.UserID(userID),
			userinstalledtheme.ThemeName(themeName),
		).
		First(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			return fmt.Errorf("主题 %s 未安装", themeName)
		}
		return fmt.Errorf("查询主题失败: %w", err)
	}

	// 2. 检查是否是真正的当前使用主题（考虑静态模式）
	staticModeActive := s.IsStaticModeActive()

	// 判断是否真的是当前使用的主题
	isReallyCurrentTheme := false
	if staticModeActive {
		// 有static目录时，检查数据库状态
		isReallyCurrentTheme = theme.IsCurrent
	} else {
		// 没有static目录时，官方主题是当前使用的，数据库主题都不是当前使用
		isReallyCurrentTheme = false

		// 如果数据库中标记为当前使用但实际不是，记录警告并自动修正
		if theme.IsCurrent {
			log.Printf("警告：用户 %d 的主题 %s 在数据库中标记为当前使用，但实际使用的是官方主题，将自动修正", userID, themeName)
			// 自动修正数据库状态
			_, updateErr := s.db.UserInstalledTheme.
				UpdateOneID(theme.ID).
				SetIsCurrent(false).
				Save(ctx)
			if updateErr != nil {
				log.Printf("警告：自动修正主题 %s 的当前状态失败: %v", themeName, updateErr)
			}
		}
	}

	if isReallyCurrentTheme {
		return fmt.Errorf("不能卸载当前使用的主题，请先切换到其他主题")
	}

	// 3. 删除主题文件
	if err := removeThemeDirectory(themeDir); err != nil {
		log.Printf("警告：删除主题文件夹失败: %v", err)
		// 继续执行，不因为文件删除失败而中断
	}

	// 4. 删除数据库记录
	if err := s.db.UserInstalledTheme.DeleteOneID(theme.ID).Exec(ctx); err != nil {
		return fmt.Errorf("删除主题记录失败: %w", err)
	}

	log.Printf("主题 %s 卸载成功", themeName)
	return nil
}

// IsStaticModeActive 检查是否使用静态模式
func (s *themeService) IsStaticModeActive() bool {
	return frontend_runtime.IsStaticModeActive()
}

func (s *themeService) staticDirPath() string {
	return frontend_runtime.GetStaticDirPath()
}

func (s *themeService) isStaticDirPath(dirPath string) bool {
	staticDirAbsPath, err := filepath.Abs(s.staticDirPath())
	if err != nil {
		return false
	}
	targetAbsPath, err := filepath.Abs(dirPath)
	if err != nil {
		return false
	}
	return filepath.Clean(staticDirAbsPath) == filepath.Clean(targetAbsPath)
}

// downloadAndExtractTheme 下载并解压主题
var themeDownloadClient = util.NewPublicHTTPClient(2*time.Minute, true)

const maxThemeDownloadBytes = 256 << 20

func (s *themeService) downloadAndExtractTheme(downloadURL, themeDir string) error {
	if err := util.ValidatePublicHTTPURL(downloadURL, true); err != nil {
		return err
	}
	// 创建临时文件
	tempFile, err := os.CreateTemp("", "theme_*.zip")
	if err != nil {
		return fmt.Errorf("创建临时文件失败: %w", err)
	}
	defer os.Remove(tempFile.Name())
	defer tempFile.Close()

	// 下载文件
	resp, err := themeDownloadClient.Get(downloadURL)
	if err != nil {
		return fmt.Errorf("下载失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("下载失败，状态码: %d", resp.StatusCode)
	}

	// 复制到临时文件
	if resp.ContentLength > maxThemeDownloadBytes {
		return fmt.Errorf("主题下载超过大小限制")
	}
	written, err := io.Copy(tempFile, io.LimitReader(resp.Body, maxThemeDownloadBytes+1))
	if err != nil {
		return fmt.Errorf("保存下载文件失败: %w", err)
	}
	if written > maxThemeDownloadBytes {
		return fmt.Errorf("主题下载超过大小限制")
	}

	// 解压到主题目录
	return s.extractZip(tempFile.Name(), themeDir)
}

// extractZip 解压zip文件
func (s *themeService) extractZip(zipPath, destDir string) error {
	reader, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer closeThemeResource(reader)
	entries, err := inspectThemeArchive(reader.File)
	if err != nil {
		return err
	}
	root, err := openThemeDirectory(destDir, true)
	if err != nil {
		return err
	}
	defer closeThemeResource(root)
	// 既有目标也要先完整检查，避免在遇到链接前覆盖包中的正常文件。
	for _, entry := range entries {
		if err := checkThemeEntryDestination(root, entry.name, entry.file.FileInfo().IsDir()); err != nil {
			return err
		}
	}
	for _, entry := range entries {
		if err := extractThemeFile(root, entry); err != nil {
			return fmt.Errorf("解压主题文件 %s: %w", entry.file.Name, err)
		}
	}
	return nil
}

// validateThemeFiles 验证主题文件完整性
func (s *themeService) validateThemeFiles(themeDir string) error {
	// 检查index.html是否存在
	indexPath := filepath.Join(themeDir, "index.html")
	if _, err := os.Stat(indexPath); os.IsNotExist(err) {
		return fmt.Errorf("缺少必需的 index.html 文件")
	}

	// 检查static目录是否存在
	staticPath := filepath.Join(themeDir, "static")
	if _, err := os.Stat(staticPath); os.IsNotExist(err) {
		return fmt.Errorf("缺少必需的 static 目录")
	}

	return nil
}

// backupDirectory 备份目录
func (s *themeService) backupDirectory(srcDir, backupDir string) error {
	os.MkdirAll(filepath.Dir(backupDir), 0755)
	return s.copyDirectory(srcDir, backupDir)
}

// restoreFromBackup 从备份恢复
func (s *themeService) restoreFromBackup(backupDir, destDir string) error {
	// 如果目标是static目录，使用安全删除方法
	if s.isStaticDirPath(destDir) {
		if err := s.safeRemoveStaticDir(); err != nil {
			log.Printf("警告：恢复时清空static目录失败，继续尝试恢复: %v", err)
		}
		// 确保目录存在
		if err := os.MkdirAll(destDir, 0755); err != nil {
			return fmt.Errorf("创建恢复目录失败: %w", err)
		}
	} else {
		// 对于非static目录，直接删除
		os.RemoveAll(destDir)
	}

	// 从备份恢复
	return s.copyDirectory(backupDir, destDir)
}

// copyThemeToStatic 复制主题文件到static目录
func (s *themeService) copyThemeToStatic(themeDir string) error {
	staticDir := s.staticDirPath()

	// 先安全清空static目录
	if err := s.safeRemoveStaticDir(); err != nil {
		return fmt.Errorf("清空static目录失败: %w", err)
	}

	// 确保static目录存在
	if err := os.MkdirAll(staticDir, 0755); err != nil {
		return fmt.Errorf("创建static目录失败: %w", err)
	}

	// 复制整个主题目录内容到static
	return s.copyDirectory(themeDir, staticDir)
}

// copyDirectory 复制目录
func (s *themeService) copyDirectory(srcDir, destDir string) error {
	return filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && !info.Mode().IsRegular() {
			return fmt.Errorf("主题目录不允许链接或特殊文件: %s", path)
		}

		relPath, err := filepath.Rel(srcDir, path)
		if err != nil {
			return err
		}

		destPath := filepath.Join(destDir, relPath)

		if info.IsDir() {
			root, err := openThemeDirectory(destPath, true)
			if err != nil {
				return err
			}
			return root.Close()
		}

		return s.copyFile(path, destPath)
	})
}

// copyFile 复制文件
func (s *themeService) copyFile(srcPath, destPath string) error {
	return copyThemeFile(srcPath, destPath)
}

// UploadTheme 上传主题压缩包
func (s *themeService) UploadTheme(ctx context.Context, userID uint, file *multipart.FileHeader, forceUpdate ...bool) (*ThemeInfo, error) {
	// 解析可选的 forceUpdate 参数
	isForceUpdate := len(forceUpdate) > 0 && forceUpdate[0]
	// 1. 验证主题压缩包
	validationResult, err := s.ValidateThemePackage(ctx, userID, file)
	if err != nil {
		return nil, fmt.Errorf("验证主题包失败: %w", err)
	}

	if !validationResult.IsValid {
		return nil, fmt.Errorf("主题包验证失败: %s", strings.Join(validationResult.Errors, "; "))
	}

	metadata := validationResult.Metadata
	if metadata == nil {
		return nil, fmt.Errorf("无法获取主题元信息")
	}
	themeDir, err := safeThemePath(metadata.Name)
	if err != nil {
		return nil, err
	}

	// 2. 检查主题是否已安装
	existingInstallation, err := s.db.UserInstalledTheme.
		Query().
		Where(
			userinstalledtheme.UserID(userID),
			userinstalledtheme.ThemeName(metadata.Name),
		).
		Only(ctx)

	var isUpdate bool
	if err == nil {
		// 主题已安装
		if !isForceUpdate {
			// 如果没有强制更新标志，说明前端没有经过版本比较流程，直接返回错误
			// 正常流程应该是前端先调用 ValidateThemePackage，发现重复后进行版本比较和用户确认
			return nil, fmt.Errorf("主题 %s 已经安装，请使用版本更新功能。当前版本: %s",
				metadata.Name, existingInstallation.InstalledVersion)
		}
		isUpdate = true
		log.Printf("强制更新主题 %s: %s -> %s", metadata.Name, existingInstallation.InstalledVersion, metadata.Version)
	} else if !ent.IsNotFound(err) {
		return nil, fmt.Errorf("检查主题是否存在失败: %w", err)
	}

	// 3. 保存上传的文件到临时位置
	tempFile, err := s.saveUploadedFile(file)
	if err != nil {
		return nil, fmt.Errorf("保存上传文件失败: %w", err)
	}
	defer os.Remove(tempFile)

	// 4. 解压主题到目标目录
	if err := s.extractZip(tempFile, themeDir); err != nil {
		return nil, fmt.Errorf("解压主题失败: %w", err)
	}

	// 5. 再次验证解压后的文件
	if err := s.validateExtractedTheme(themeDir, metadata); err != nil {
		// 清理已解压的文件
		if cleanupErr := removeThemeDirectory(themeDir); cleanupErr != nil {
			log.Printf("清理主题目录失败: %v", cleanupErr)
		}
		return nil, fmt.Errorf("解压后验证失败: %w", err)
	}

	// 6. 在数据库中记录主题信息
	if isUpdate {
		// 更新现有记录
		_, err = existingInstallation.
			Update().
			SetInstalledVersion(metadata.Version).
			SetInstallTime(time.Now()).
			Save(ctx)

		if err != nil {
			// 清理已解压的文件
			if cleanupErr := removeThemeDirectory(themeDir); cleanupErr != nil {
				log.Printf("清理主题目录失败: %v", cleanupErr)
			}
			return nil, fmt.Errorf("更新主题信息失败: %w", err)
		}
	} else {
		// 创建新记录
		createBuilder := s.db.UserInstalledTheme.
			Create().
			SetUserID(userID).
			SetThemeName(metadata.Name).
			SetInstallTime(time.Now()).
			SetInstalledVersion(metadata.Version)

		// 设置默认用户配置（空配置）
		createBuilder = createBuilder.SetUserThemeConfig(map[string]interface{}{})

		_, err = createBuilder.Save(ctx)
		if err != nil {
			// 清理已解压的文件
			if cleanupErr := removeThemeDirectory(themeDir); cleanupErr != nil {
				log.Printf("清理主题目录失败: %v", cleanupErr)
			}
			return nil, fmt.Errorf("保存主题信息失败: %w", err)
		}
	}

	// 7. 构造返回的主题信息
	authorName := s.extractAuthorName(metadata.Author)
	previewURL := s.extractFirstScreenshot(metadata.Screenshots)
	now := time.Now()

	// 处理仓库URL
	repoURL := ""
	if metadata.Repository != nil {
		repoURL = metadata.Repository.URL
	}

	// 处理主题类型，默认为 "community"
	themeType := "community"
	if metadata.Category != "" {
		themeType = metadata.Category
	}

	themeInfo := &ThemeInfo{
		ID:               0,             // 上传的主题暂时没有市场ID
		Name:             metadata.Name, // 使用主题标识名称
		Author:           authorName,
		Description:      metadata.Description,
		Version:          metadata.Version,
		ThemeType:        themeType,
		RepoURL:          repoURL,
		InstructionURL:   metadata.Homepage, // 使用 homepage 作为说明地址
		Price:            0,
		DownloadURL:      "",
		Tags:             metadata.Keywords,
		PreviewURL:       previewURL, // 从 screenshots 提取预览图
		DemoURL:          "",
		DownloadCount:    0,
		Rating:           0,
		IsOfficial:       false,
		IsActive:         true,
		CreatedAt:        now.Format("2006-01-02 15:04:05"),
		UpdatedAt:        now.Format("2006-01-02 15:04:05"),
		IsCurrent:        false,
		IsInstalled:      true,
		InstallTime:      &now,
		InstalledVersion: metadata.Version,
		UserConfig:       nil, // 不使用 Configuration 作为用户配置
	}

	if isUpdate {
		log.Printf("主题 %s 更新成功，版本: %s", metadata.Name, metadata.Version)
	} else {
		log.Printf("主题 %s 上传并安装成功，版本: %s", metadata.Name, metadata.Version)
	}
	return themeInfo, nil
}

// ValidateThemePackage 验证主题压缩包
func (s *themeService) ValidateThemePackage(ctx context.Context, userID uint, file *multipart.FileHeader) (*ThemeValidationResult, error) {
	result := &ThemeValidationResult{
		IsValid:       false,
		Errors:        []string{},
		Warnings:      []string{},
		FileList:      []string{},
		TotalSize:     file.Size,
		ExistingTheme: nil,
	}

	// 1. 基础验证
	if file.Size == 0 {
		result.Errors = append(result.Errors, "文件为空")
		return result, nil
	}

	if file.Size > 50*1024*1024 { // 50MB
		result.Errors = append(result.Errors, "文件大小超过50MB限制")
		return result, nil
	}

	// 2. 保存临时文件用于验证
	tempFile, err := s.saveUploadedFile(file)
	if err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("保存临时文件失败: %v", err))
		return result, nil
	}
	defer os.Remove(tempFile)

	// 3. 验证ZIP文件格式
	zipReader, err := zip.OpenReader(tempFile)
	if err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("ZIP文件格式错误: %v", err))
		return result, nil
	}
	defer zipReader.Close()
	entries, err := inspectThemeArchive(zipReader.File)
	if err != nil {
		result.Errors = append(result.Errors, err.Error())
		return result, nil
	}

	// 4. 验证文件结构和内容
	var themeJsonFile *zip.File
	var indexHtmlFile *zip.File
	hasStaticDir := false
	for _, entry := range entries {
		file := entry.file
		result.FileList = append(result.FileList, file.Name)
		normalizedName := filepath.ToSlash(entry.name)

		// 检查必需文件
		switch {
		case normalizedName == "theme.json":
			themeJsonFile = file
		case normalizedName == "index.html":
			indexHtmlFile = file
		case normalizedName == "static" && file.FileInfo().IsDir(), strings.HasPrefix(normalizedName, "static/"):
			hasStaticDir = true
		}

		// 验证文件类型安全性
		if err := s.validateFileType(file.Name); err != nil {
			result.Errors = append(result.Errors, err.Error())
		}
	}

	// 5. 检查必需文件
	if themeJsonFile == nil {
		result.Errors = append(result.Errors, "缺少必需的 theme.json 文件")
	}

	if indexHtmlFile == nil {
		result.Errors = append(result.Errors, "缺少必需的 index.html 文件")
	}

	if !hasStaticDir {
		result.Warnings = append(result.Warnings, "建议包含 static/ 目录用于存放静态资源")
	}

	// 6. 验证theme.json内容
	if themeJsonFile != nil {
		metadata, err := s.parseThemeJson(themeJsonFile)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("theme.json解析失败: %v", err))
		} else {
			result.Metadata = metadata
			log.Printf("[ValidateTheme] 解析到主题元信息: 名称=%s, 版本=%s", metadata.Name, metadata.Version)
			// 验证元信息
			if validationErrors := s.validateThemeMetadata(metadata); len(validationErrors) > 0 {
				result.Errors = append(result.Errors, validationErrors...)
			}
		}
	}

	// 不安全的名称或归档必须在数据库查询之前返回。
	if len(result.Errors) > 0 {
		return result, nil
	}
	if _, err := safeThemePath(result.Metadata.Name); err != nil {
		result.Errors = append(result.Errors, err.Error())
		return result, nil
	}

	// 7. 检查是否存在重复主题
	if result.Metadata != nil {
		log.Printf("[ValidateTheme] 检查主题 %s 是否已被用户 %d 安装", result.Metadata.Name, userID)
		existingTheme, err := s.db.UserInstalledTheme.
			Query().
			Where(
				userinstalledtheme.UserID(userID),
				userinstalledtheme.ThemeName(result.Metadata.Name),
			).
			Only(ctx)

		if err == nil {
			// 找到重复主题，构建主题信息
			log.Printf("[ValidateTheme] 找到重复主题: %s, 已安装版本: %s, 新版本: %s",
				result.Metadata.Name, existingTheme.InstalledVersion, result.Metadata.Version)

			authorName := s.extractAuthorName(result.Metadata.Author)

			result.ExistingTheme = &ThemeInfo{
				ID:               0, // 本地安装的主题没有市场ID
				Name:             existingTheme.ThemeName,
				Author:           authorName,
				Description:      result.Metadata.Description,
				Version:          existingTheme.InstalledVersion,
				ThemeType:        "community", // 本地上传的主题默认为社区版
				InstalledVersion: existingTheme.InstalledVersion,
				InstallTime:      &existingTheme.InstallTime,
				IsInstalled:      true,
				CreatedAt:        existingTheme.InstallTime.Format("2006-01-02 15:04:05"),
				UpdatedAt:        existingTheme.InstallTime.Format("2006-01-02 15:04:05"),
			}
		} else if ent.IsNotFound(err) {
			// 未找到重复主题，这是正常情况
			log.Printf("[ValidateTheme] 未找到重复主题，可以正常安装")
		} else {
			// 数据库查询出错
			log.Printf("[ValidateTheme] 检查重复主题时发生数据库错误: %v", err)
		}
	}

	// 8. 设置验证结果
	result.IsValid = len(result.Errors) == 0

	return result, nil
}

// saveUploadedFile 保存上传的文件到临时位置
func (s *themeService) saveUploadedFile(file *multipart.FileHeader) (string, error) {
	src, err := file.Open()
	if err != nil {
		return "", err
	}
	defer src.Close()

	// 创建临时文件
	tempFile, err := os.CreateTemp("", "theme_upload_*.zip")
	if err != nil {
		return "", err
	}
	defer tempFile.Close()

	// 复制文件内容
	_, err = io.Copy(tempFile, src)
	if err != nil {
		os.Remove(tempFile.Name())
		return "", err
	}

	return tempFile.Name(), nil
}

// parseThemeJson 解析theme.json文件
func (s *themeService) parseThemeJson(file *zip.File) (*ThemeMetadata, error) {
	reader, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer reader.Close()

	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}

	var metadata ThemeMetadata
	if err := json.Unmarshal(data, &metadata); err != nil {
		return nil, fmt.Errorf("JSON格式错误: %w", err)
	}

	return &metadata, nil
}

// validateThemeMetadata 验证主题元信息
func (s *themeService) validateThemeMetadata(metadata *ThemeMetadata) []string {
	var errors []string

	// 验证必需字段
	if err := ValidateThemeName(metadata.Name); err != nil {
		errors = append(errors, err.Error())
	}

	if metadata.DisplayName == "" {
		errors = append(errors, "displayName字段不能为空")
	}

	if metadata.Version == "" {
		errors = append(errors, "version字段不能为空")
	} else {
		// 验证版本格式（简单的语义化版本检查）
		validVersion := regexp.MustCompile(`^\d+\.\d+\.\d+(-[a-zA-Z0-9\-\.]+)?$`)
		if !validVersion.MatchString(metadata.Version) {
			errors = append(errors, "version必须符合语义化版本规范（如：1.0.0）")
		}
	}

	if metadata.Description == "" {
		errors = append(errors, "description字段不能为空")
	}

	if metadata.Author == nil {
		errors = append(errors, "author字段不能为空")
	}

	// 验证分类
	if metadata.Category != "" {
		validCategories := []string{
			"blog", "portfolio", "business", "magazine", "minimal",
			"creative", "photography", "education", "technology", "other",
		}
		isValidCategory := false
		for _, cat := range validCategories {
			if metadata.Category == cat {
				isValidCategory = true
				break
			}
		}
		if !isValidCategory {
			errors = append(errors, fmt.Sprintf("不支持的主题分类: %s", metadata.Category))
		}
	}

	return errors
}

// validateFileType 验证文件类型安全性
func (s *themeService) validateFileType(filename string) error {
	// 跳过 macOS 系统文件
	if strings.Contains(filename, "__MACOSX/") || strings.HasPrefix(filepath.Base(filename), "._") {
		log.Printf("跳过系统文件: %s", filename)
		return nil
	}

	// 允许的文件扩展名
	allowedExtensions := map[string]bool{
		".html": true, ".htm": true, ".css": true, ".scss": true, ".sass": true, ".less": true,
		".js": true, ".ts": true, ".json": true, ".xml": true, ".yml": true, ".yaml": true,
		".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".svg": true, ".webp": true,
		".ttf": true, ".otf": true, ".woff": true, ".woff2": true, ".eot": true,
		".md": true, ".txt": true, ".ico": true,
		// 允许压缩文件（通常是构建工具生成的）
		".gz": true, ".br": true,
	}

	// 禁止的文件扩展名（移除了 .gz）
	forbiddenExtensions := map[string]bool{
		".exe": true, ".bat": true, ".sh": true, ".cmd": true, ".com": true,
		".php": true, ".asp": true, ".jsp": true, ".py": true, ".rb": true,
		".dll": true, ".so": true, ".dylib": true,
		".zip": true, ".rar": true, ".tar": true, ".7z": true,
	}

	ext := strings.ToLower(filepath.Ext(filename))

	if forbiddenExtensions[ext] {
		return fmt.Errorf("禁止的文件类型: %s", filename)
	}

	// 如果不在允许列表中，给出警告（但不阻止）
	if ext != "" && !allowedExtensions[ext] {
		log.Printf("警告：未知文件类型 %s，文件名：%s", ext, filename)
	}

	return nil
}

// validateExtractedTheme 验证解压后的主题文件
func (s *themeService) validateExtractedTheme(themeDir string, metadata *ThemeMetadata) error {
	// 检查theme.json文件
	themeJsonPath := filepath.Join(themeDir, "theme.json")
	if _, err := os.Stat(themeJsonPath); os.IsNotExist(err) {
		return fmt.Errorf("解压后缺少 theme.json 文件")
	}

	// 检查index.html文件
	indexPath := filepath.Join(themeDir, "index.html")
	if _, err := os.Stat(indexPath); os.IsNotExist(err) {
		return fmt.Errorf("解压后缺少 index.html 文件")
	}

	// 验证HTML文件基本格式
	if err := s.validateHtmlFile(indexPath); err != nil {
		return fmt.Errorf("index.html文件验证失败: %w", err)
	}

	return nil
}

// validateHtmlFile 验证HTML文件基本格式
func (s *themeService) validateHtmlFile(filePath string) error {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}

	contentStr := strings.ToLower(string(content))

	// 基本的HTML结构检查
	if !strings.Contains(contentStr, "<!doctype html>") && !strings.Contains(contentStr, "<html") {
		return fmt.Errorf("不是有效的HTML文件")
	}

	if !strings.Contains(contentStr, "<head>") || !strings.Contains(contentStr, "</head>") {
		return fmt.Errorf("HTML文件缺少head标签")
	}

	if !strings.Contains(contentStr, "<body>") || !strings.Contains(contentStr, "</body>") {
		return fmt.Errorf("HTML文件缺少body标签")
	}

	return nil
}

// extractAuthorName 从作者信息中提取作者名称
func (s *themeService) extractAuthorName(author interface{}) string {
	switch v := author.(type) {
	case string:
		// 如果是字符串格式，可能是 "Name <email>" 格式
		if strings.Contains(v, "<") {
			parts := strings.Split(v, "<")
			return strings.TrimSpace(parts[0])
		}
		return v
	case map[string]interface{}:
		if name, ok := v["name"].(string); ok {
			return name
		}
	}
	return "Unknown"
}

// extractFirstScreenshot 从 screenshots 字段提取第一个预览图URL
func (s *themeService) extractFirstScreenshot(screenshots interface{}) string {
	if screenshots == nil {
		return ""
	}

	switch v := screenshots.(type) {
	case string:
		// 单个字符串
		return v
	case []string:
		// 字符串数组，返回第一个
		if len(v) > 0 {
			return v[0]
		}
	case []interface{}:
		// interface{}数组，尝试转换第一个为字符串
		if len(v) > 0 {
			if str, ok := v[0].(string); ok {
				return str
			}
		}
	}
	return ""
}

// loadThemeMetadataFromDisk 从磁盘读取主题的 theme.json 文件
func (s *themeService) loadThemeMetadataFromDisk(themeName string) (*ThemeMetadata, error) {
	themeDir, err := safeThemePath(themeName)
	if err != nil {
		return nil, err
	}
	themeJsonPath := filepath.Join(themeDir, "theme.json")

	// 检查文件是否存在
	if _, err := os.Stat(themeJsonPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("theme.json 文件不存在: %s", themeJsonPath)
	}

	// 读取文件内容
	root, err := openThemeDirectory(themeDir, false)
	if err != nil {
		return nil, err
	}
	defer closeThemeResource(root)
	if err := checkThemeEntryDestination(root, "theme.json", false); err != nil {
		return nil, err
	}
	content, err := root.ReadFile("theme.json")
	if err != nil {
		return nil, fmt.Errorf("读取 theme.json 失败: %w", err)
	}

	// 解析 JSON
	var metadata ThemeMetadata
	if err := json.Unmarshal(content, &metadata); err != nil {
		return nil, fmt.Errorf("解析 theme.json 失败: %w", err)
	}

	return &metadata, nil
}

// safeRemoveStaticDir 安全地删除static目录，处理Docker挂载等特殊情况
func (s *themeService) safeRemoveStaticDir() error {
	root, err := openThemeDirectory(s.staticDirPath(), false)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	closeThemeResource(root)
	maxRetries := 3
	retryDelay := time.Second * 2

	for attempt := 0; attempt < maxRetries; attempt++ {
		// 首先尝试删除目录内容，而不是整个目录
		if err := s.clearStaticDirContents(); err == nil {
			log.Printf("成功清空static目录内容")
			return nil
		} else {
			log.Printf("第 %d 次尝试清空static目录失败: %v", attempt+1, err)
		}

		// 如果不是最后一次尝试，等待后重试
		if attempt < maxRetries-1 {
			log.Printf("等待 %v 后重试...", retryDelay)
			time.Sleep(retryDelay)
		}
	}

	// 所有重试都失败了，尝试最后的手段：强制删除
	log.Printf("警告：常规删除失败，尝试强制清理static目录")
	return s.forceCleanStaticDir()
}

// clearStaticDirContents 清空static目录的内容，但保留目录本身
func (s *themeService) clearStaticDirContents() error {
	staticDir := s.staticDirPath()
	root, err := openThemeDirectory(staticDir, false)
	if errors.Is(err, os.ErrNotExist) {
		return nil // 目录不存在，认为成功
	}
	if err != nil {
		return err
	}
	defer closeThemeResource(root)
	dir, err := root.Open(".")
	if err != nil {
		return err
	}
	defer closeThemeResource(dir)
	entries, err := dir.ReadDir(-1)
	if err != nil {
		return err
	}

	var lastError error
	for _, entry := range entries {
		entryPath := filepath.Join(staticDir, entry.Name())
		if err := root.RemoveAll(entry.Name()); err != nil {
			log.Printf("删除 %s 失败: %v", entryPath, err)
			lastError = err
		}
	}

	return lastError
}

// forceCleanStaticDir 强制清理static目录（最后手段）
func (s *themeService) forceCleanStaticDir() error {
	staticDir := s.staticDirPath()

	// 在Docker环境中，我们可能无法删除挂载的目录本身
	// 但我们可以确保目录是空的
	if err := s.clearStaticDirContents(); err != nil {
		log.Printf("强制清理static目录内容也失败: %v", err)
		return err
	}

	// 尝试删除目录本身，如果失败就忽略（Docker挂载的目录无法删除是正常的）
	if err := os.Remove(staticDir); err != nil {
		log.Printf("无法删除static目录本身（这在Docker环境中是正常的）: %v", err)
		// 不返回错误，因为目录内容已经清空了
	}

	return nil
}

// FixThemeCurrentStatus 修复用户主题的当前状态数据一致性
func (s *themeService) FixThemeCurrentStatus(ctx context.Context, userID uint) error {
	staticModeActive := s.IsStaticModeActive()

	// 首先检查是否有 SSR 主题被设为当前
	// 如果有 SSR 主题是当前使用，则不应该重置它
	hasCurrentSSRTheme, err := s.db.UserInstalledTheme.
		Query().
		Where(
			userinstalledtheme.UserID(userID),
			userinstalledtheme.IsCurrent(true),
			userinstalledtheme.DeployTypeEQ(userinstalledtheme.DeployTypeSsr),
		).
		Exist(ctx)
	if err != nil {
		log.Printf("检查当前 SSR 主题状态失败: %v", err)
		hasCurrentSSRTheme = false
	}

	if !staticModeActive && !hasCurrentSSRTheme {
		// 没有static目录且没有SSR主题被设为当前时，所有数据库主题都不应该是当前使用
		updatedCount, err := s.db.UserInstalledTheme.
			Update().
			Where(
				userinstalledtheme.UserID(userID),
				userinstalledtheme.IsCurrent(true),
			).
			SetIsCurrent(false).
			Save(ctx)

		if err != nil {
			return fmt.Errorf("修复主题状态失败: %w", err)
		}

		if updatedCount > 0 {
			log.Printf("已修复用户 %d 的 %d 个主题状态（从当前使用改为非当前使用）", userID, updatedCount)
		}
	} else if staticModeActive {
		// 有static目录时，确保只有一个主题是当前使用
		currentThemes, err := s.db.UserInstalledTheme.
			Query().
			Where(
				userinstalledtheme.UserID(userID),
				userinstalledtheme.IsCurrent(true),
			).
			All(ctx)

		if err != nil {
			return fmt.Errorf("查询当前主题失败: %w", err)
		}

		if len(currentThemes) > 1 {
			// 多个主题标记为当前使用，只保留第一个
			log.Printf("发现用户 %d 有 %d 个主题标记为当前使用，将修复为只保留一个", userID, len(currentThemes))

			for i := 1; i < len(currentThemes); i++ {
				_, err := s.db.UserInstalledTheme.
					UpdateOneID(currentThemes[i].ID).
					SetIsCurrent(false).
					Save(ctx)

				if err != nil {
					log.Printf("修复主题 %s 状态失败: %v", currentThemes[i].ThemeName, err)
				} else {
					log.Printf("已将主题 %s 的当前状态设置为 false", currentThemes[i].ThemeName)
				}
			}
		}
	}

	return nil
}

// ===== 主题配置相关方法实现 =====

// GetThemeSettings 获取主题的配置定义
func (s *themeService) GetThemeSettings(ctx context.Context, themeName string) ([]ThemeSettingGroup, error) {
	// 官方主题没有自定义配置
	if s.isOfficialTheme(themeName) {
		return []ThemeSettingGroup{}, nil
	}
	if err := ValidateThemeName(themeName); err != nil {
		return nil, err
	}
	// 从磁盘读取 theme.json
	metadata, err := s.loadThemeMetadataFromDisk(themeName)
	if err != nil {
		return nil, fmt.Errorf("读取主题元数据失败: %w", err)
	}

	// 返回配置定义
	if metadata.Settings == nil {
		return []ThemeSettingGroup{}, nil
	}

	return metadata.Settings, nil
}

// GetUserThemeConfig 获取用户对某主题的配置值
func (s *themeService) GetUserThemeConfig(ctx context.Context, userID uint, themeName string) (map[string]interface{}, error) {
	if err := ValidateThemeName(themeName); err != nil {
		return nil, err
	}
	// 查询用户安装的主题
	installedTheme, err := s.db.UserInstalledTheme.
		Query().
		Where(
			userinstalledtheme.UserID(userID),
			userinstalledtheme.ThemeName(themeName),
		).
		First(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			return nil, fmt.Errorf("主题 %s 未安装", themeName)
		}
		return nil, fmt.Errorf("查询主题失败: %w", err)
	}

	// 返回用户配置
	if installedTheme.UserThemeConfig == nil {
		return map[string]interface{}{}, nil
	}

	return installedTheme.UserThemeConfig, nil
}

// SaveUserThemeConfig 保存用户对某主题的配置值
func (s *themeService) SaveUserThemeConfig(ctx context.Context, userID uint, themeName string, config map[string]interface{}) error {
	if err := ValidateThemeName(themeName); err != nil {
		return err
	}
	// 获取配置定义用于验证
	settings, err := s.GetThemeSettings(ctx, themeName)
	if err != nil {
		return fmt.Errorf("获取主题配置定义失败: %w", err)
	}

	// 验证配置值
	if err := s.validateThemeConfig(settings, config); err != nil {
		return fmt.Errorf("配置验证失败: %w", err)
	}

	// 更新数据库
	_, err = s.db.UserInstalledTheme.
		Update().
		Where(
			userinstalledtheme.UserID(userID),
			userinstalledtheme.ThemeName(themeName),
		).
		SetUserThemeConfig(config).
		Save(ctx)

	if err != nil {
		return fmt.Errorf("保存主题配置失败: %w", err)
	}

	log.Printf("用户 %d 的主题 %s 配置已保存", userID, themeName)
	return nil
}

// GetCurrentThemeConfig 获取当前激活主题的配置（供前端主题使用）
func (s *themeService) GetCurrentThemeConfig(ctx context.Context, userID uint) (*ThemeConfigResponse, error) {
	// 获取当前主题
	currentTheme, err := s.GetCurrentTheme(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("获取当前主题失败: %w", err)
	}

	// 官方主题返回空配置
	if currentTheme.IsOfficial || s.isOfficialTheme(currentTheme.Name) {
		return &ThemeConfigResponse{
			ThemeName: currentTheme.Name,
			Settings:  []ThemeSettingGroup{},
			Values:    map[string]interface{}{},
		}, nil
	}

	// 获取配置定义
	settings, err := s.GetThemeSettings(ctx, currentTheme.Name)
	if err != nil {
		log.Printf("获取主题 %s 的配置定义失败: %v", currentTheme.Name, err)
		settings = []ThemeSettingGroup{}
	}

	// 获取用户配置
	userConfig, err := s.GetUserThemeConfig(ctx, userID, currentTheme.Name)
	if err != nil {
		log.Printf("获取用户主题配置失败: %v", err)
		userConfig = map[string]interface{}{}
	}

	// 合并默认值和用户配置
	mergedValues := s.mergeConfigWithDefaults(settings, userConfig)

	return &ThemeConfigResponse{
		ThemeName: currentTheme.Name,
		Settings:  settings,
		Values:    mergedValues,
	}, nil
}

// validateThemeConfig 验证主题配置值
func (s *themeService) validateThemeConfig(settings []ThemeSettingGroup, config map[string]interface{}) error {
	// 构建字段定义映射
	fieldDefs := make(map[string]ThemeSettingField)
	for _, group := range settings {
		for _, field := range group.Fields {
			fieldDefs[field.Name] = field
		}
	}

	// 验证每个配置项
	for key, value := range config {
		fieldDef, exists := fieldDefs[key]
		if !exists {
			// 允许额外的配置项（向前兼容）
			log.Printf("警告：未知的配置项 %s", key)
			continue
		}

		// 验证必填字段
		if fieldDef.Required && (value == nil || value == "") {
			return fmt.Errorf("字段 %s 为必填项", fieldDef.Label)
		}

		// 验证字段类型
		if err := s.validateFieldValue(fieldDef, value); err != nil {
			return fmt.Errorf("字段 %s 验证失败: %w", fieldDef.Label, err)
		}
	}

	// 检查必填字段是否都有值
	for _, group := range settings {
		for _, field := range group.Fields {
			if field.Required {
				if _, exists := config[field.Name]; !exists {
					return fmt.Errorf("字段 %s 为必填项", field.Label)
				}
			}
		}
	}

	return nil
}

// validateFieldValue 验证单个字段值
func (s *themeService) validateFieldValue(field ThemeSettingField, value interface{}) error {
	if value == nil {
		return nil
	}

	validation := field.Validation
	if validation == nil {
		return nil
	}

	// 字符串类型验证
	if strVal, ok := value.(string); ok {
		if validation.MinLength != nil && len(strVal) < *validation.MinLength {
			return fmt.Errorf("长度不能小于 %d", *validation.MinLength)
		}
		if validation.MaxLength != nil && len(strVal) > *validation.MaxLength {
			return fmt.Errorf("长度不能大于 %d", *validation.MaxLength)
		}
		if validation.Pattern != "" {
			matched, err := regexp.MatchString(validation.Pattern, strVal)
			if err != nil {
				return fmt.Errorf("正则表达式无效")
			}
			if !matched {
				if validation.Message != "" {
					return fmt.Errorf("%s", validation.Message)
				}
				return fmt.Errorf("格式不正确")
			}
		}
	}

	// 数字类型验证
	if numVal, ok := value.(float64); ok {
		if validation.Min != nil && numVal < *validation.Min {
			return fmt.Errorf("值不能小于 %v", *validation.Min)
		}
		if validation.Max != nil && numVal > *validation.Max {
			return fmt.Errorf("值不能大于 %v", *validation.Max)
		}
	}

	return nil
}

// mergeConfigWithDefaults 合并用户配置和默认值
func (s *themeService) mergeConfigWithDefaults(settings []ThemeSettingGroup, userConfig map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})

	// 首先设置所有默认值
	for _, group := range settings {
		for _, field := range group.Fields {
			if field.Default != nil {
				result[field.Name] = field.Default
			}
		}
	}

	// 然后用用户配置覆盖
	for key, value := range userConfig {
		result[key] = value
	}

	return result
}

// ===== SSR 主题管理方法实现 =====

// InstallSSRTheme 安装 SSR 主题（写入数据库记录）
func (s *themeService) InstallSSRTheme(ctx context.Context, userID uint, themeName string, version string, marketID int) error {
	if err := ValidateThemeName(themeName); err != nil {
		return err
	}
	// 检查是否已安装
	exists, err := s.db.UserInstalledTheme.
		Query().
		Where(
			userinstalledtheme.UserID(userID),
			userinstalledtheme.ThemeName(themeName),
		).
		Exist(ctx)

	if err != nil {
		return fmt.Errorf("检查 SSR 主题是否存在失败: %w", err)
	}

	if exists {
		// 已存在，更新版本信息
		_, err = s.db.UserInstalledTheme.
			Update().
			Where(
				userinstalledtheme.UserID(userID),
				userinstalledtheme.ThemeName(themeName),
			).
			SetInstalledVersion(version).
			SetInstallTime(time.Now()).
			Save(ctx)

		if err != nil {
			return fmt.Errorf("更新 SSR 主题记录失败: %w", err)
		}

		log.Printf("[SSR主题] 更新主题记录: %s, 版本: %s", themeName, version)
		return nil
	}

	// 创建新记录
	createBuilder := s.db.UserInstalledTheme.
		Create().
		SetUserID(userID).
		SetThemeName(themeName).
		SetDeployType(userinstalledtheme.DeployTypeSsr).
		SetInstallTime(time.Now()).
		SetIsCurrent(false)

	if version != "" {
		createBuilder = createBuilder.SetInstalledVersion(version)
	}

	if marketID > 0 {
		createBuilder = createBuilder.SetThemeMarketID(marketID)
	}

	_, err = createBuilder.Save(ctx)
	if err != nil {
		return fmt.Errorf("创建 SSR 主题记录失败: %w", err)
	}

	log.Printf("[SSR主题] 安装主题成功: %s, 版本: %s", themeName, version)
	return nil
}

// UninstallSSRTheme 卸载 SSR 主题（删除数据库记录）
func (s *themeService) UninstallSSRTheme(ctx context.Context, userID uint, themeName string) error {
	if err := ValidateThemeName(themeName); err != nil {
		return err
	}
	// 检查是否为当前主题
	theme, err := s.db.UserInstalledTheme.
		Query().
		Where(
			userinstalledtheme.UserID(userID),
			userinstalledtheme.ThemeName(themeName),
		).
		First(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			// 数据库中没有记录，直接返回成功
			log.Printf("[SSR主题] 主题 %s 在数据库中不存在，跳过删除", themeName)
			return nil
		}
		return fmt.Errorf("查询 SSR 主题失败: %w", err)
	}

	if theme.IsCurrent {
		return fmt.Errorf("不能卸载当前使用的主题，请先切换到其他主题")
	}

	// 删除记录
	if err := s.db.UserInstalledTheme.DeleteOneID(theme.ID).Exec(ctx); err != nil {
		return fmt.Errorf("删除 SSR 主题记录失败: %w", err)
	}

	log.Printf("[SSR主题] 卸载主题成功: %s", themeName)
	return nil
}

// SwitchToSSRTheme 切换到 SSR 主题
func (s *themeService) SwitchToSSRTheme(ctx context.Context, userID uint, themeName string, ssrManager SSRManagerInterface) error {
	if err := ValidateThemeName(themeName); err != nil {
		return err
	}
	// #region agent log
	debugLog := func(msg string, data map[string]interface{}) {
		f, _ := os.OpenFile("/Users/anzhiyu/Project/2025/anheyu-work/.cursor/debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if f != nil {
			defer f.Close()
			entry := map[string]interface{}{"location": "service.go:SwitchToSSRTheme", "message": msg, "data": data, "timestamp": time.Now().UnixMilli(), "sessionId": "debug-session", "hypothesisId": "A"}
			jsonData, _ := json.Marshal(entry)
			f.Write(append(jsonData, '\n'))
		}
	}
	// #endregion
	// #region agent log
	debugLog("开始切换SSR主题", map[string]interface{}{"userID": userID, "themeName": themeName})
	// #endregion

	// 1. 检查目标主题是否已安装
	theme, err := s.db.UserInstalledTheme.
		Query().
		Where(
			userinstalledtheme.UserID(userID),
			userinstalledtheme.ThemeName(themeName),
		).
		First(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			// #region agent log
			debugLog("主题未安装", map[string]interface{}{"error": "not found"})
			// #endregion
			return fmt.Errorf("SSR 主题 %s 未安装", themeName)
		}
		return fmt.Errorf("查询 SSR 主题失败: %w", err)
	}

	// #region agent log
	debugLog("找到目标主题", map[string]interface{}{"themeID": theme.ID, "currentIsCurrent": theme.IsCurrent})
	// #endregion

	// 1.5 切换到 SSR 前必须退出 static 模式，避免 static 抢占前台请求。
	if s.IsStaticModeActive() {
		debugLog("检测到static模式，开始清理static目录", nil)
		if err := s.safeRemoveStaticDir(); err != nil {
			return fmt.Errorf("切换到 SSR 主题前清理 static 目录失败: %w", err)
		}
		if s.IsStaticModeActive() {
			return fmt.Errorf("切换到 SSR 主题失败：static 目录仍然有效，请检查 static 目录权限")
		}
	}

	// 2. 停止其他运行中的 SSR 主题
	if ssrManager != nil {
		runningThemes := ssrManager.ListRunning()
		// #region agent log
		debugLog("运行中的SSR主题", map[string]interface{}{"runningThemes": runningThemes})
		// #endregion
		for _, name := range runningThemes {
			if name != themeName {
				if err := ssrManager.Stop(name); err != nil {
					log.Printf("[SSR主题] 停止主题 %s 失败: %v", name, err)
				}
			}
		}
	}

	// 3. 使用事务更新数据库状态
	tx, err := s.db.Tx(ctx)
	if err != nil {
		return fmt.Errorf("开启事务失败: %w", err)
	}

	// 清除所有主题的当前状态
	clearedCount, err := tx.UserInstalledTheme.
		Update().
		Where(userinstalledtheme.UserID(userID)).
		SetIsCurrent(false).
		Save(ctx)

	// #region agent log
	debugLog("清除所有主题is_current状态", map[string]interface{}{"clearedCount": clearedCount, "error": fmt.Sprintf("%v", err)})
	// #endregion

	if err != nil {
		tx.Rollback()
		return fmt.Errorf("清除主题当前状态失败: %w", err)
	}

	// 设置目标主题为当前主题
	updatedTheme, err := tx.UserInstalledTheme.
		UpdateOneID(theme.ID).
		SetIsCurrent(true).
		Save(ctx)

	// #region agent log
	if updatedTheme != nil {
		debugLog("设置目标主题为当前", map[string]interface{}{"themeID": updatedTheme.ID, "newIsCurrent": updatedTheme.IsCurrent, "error": fmt.Sprintf("%v", err)})
	} else {
		debugLog("设置目标主题为当前", map[string]interface{}{"updatedTheme": "nil", "error": fmt.Sprintf("%v", err)})
	}
	// #endregion

	if err != nil {
		tx.Rollback()
		return fmt.Errorf("设置当前主题失败: %w", err)
	}

	// 4. 启动 SSR 主题
	if ssrManager != nil {
		// 如果主题未运行，启动它
		if !ssrManager.IsRunning(themeName) {
			// #region agent log
			debugLog("启动SSR主题", map[string]interface{}{"themeName": themeName})
			// #endregion
			if err := ssrManager.Start(themeName, 3000); err != nil {
				tx.Rollback()
				return fmt.Errorf("启动 SSR 主题失败: %w", err)
			}
		}
	}

	// 5. 提交事务
	if err := tx.Commit(); err != nil {
		// #region agent log
		debugLog("事务提交失败", map[string]interface{}{"error": err.Error()})
		// #endregion
		// 如果提交失败，尝试停止刚启动的主题
		if ssrManager != nil {
			ssrManager.Stop(themeName)
		}
		return fmt.Errorf("提交事务失败: %w", err)
	}

	// #region agent log
	debugLog("切换SSR主题完成", map[string]interface{}{"themeName": themeName, "success": true})
	// #endregion

	log.Printf("[SSR主题] 切换到主题成功: %s", themeName)
	return nil
}

// ClearAllThemeCurrentStatus 清除所有主题的当前状态
func (s *themeService) ClearAllThemeCurrentStatus(ctx context.Context, userID uint) error {
	updatedCount, err := s.db.UserInstalledTheme.
		Update().
		Where(
			userinstalledtheme.UserID(userID),
			userinstalledtheme.IsCurrent(true),
		).
		SetIsCurrent(false).
		Save(ctx)

	if err != nil {
		return fmt.Errorf("清除主题当前状态失败: %w", err)
	}

	if updatedCount > 0 {
		log.Printf("[主题切换] 已清除用户 %d 的 %d 个主题的当前状态", userID, updatedCount)
	}

	return nil
}

// SyncSSRThemesFromFileSystem 同步 SSR 主题状态
// 扫描文件系统中的 SSR 主题，确保数据库中有对应记录
func (s *themeService) SyncSSRThemesFromFileSystem(ctx context.Context, userID uint, themesDir string) error {
	// 读取主题目录
	entries, err := os.ReadDir(themesDir)
	if err != nil {
		if os.IsNotExist(err) {
			log.Printf("[主题同步] 主题目录不存在: %s", themesDir)
			return nil
		}
		return fmt.Errorf("读取主题目录失败: %w", err)
	}

	var synced int
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		themeName := entry.Name()
		if err := ValidateThemeName(themeName); err != nil {
			log.Printf("跳过不安全的主题目录 %s: %v", themeName, err)
			continue
		}
		themePath := filepath.Join(themesDir, themeName)

		// 检查是否是 SSR 主题（有 server.js 文件）
		serverJS := filepath.Join(themePath, "server.js")
		if _, err := os.Stat(serverJS); os.IsNotExist(err) {
			continue
		}

		// 检查数据库中是否已有记录
		exists, err := s.db.UserInstalledTheme.
			Query().
			Where(
				userinstalledtheme.UserID(userID),
				userinstalledtheme.ThemeName(themeName),
			).
			Exist(ctx)

		if err != nil {
			log.Printf("[主题同步] 检查主题 %s 失败: %v", themeName, err)
			continue
		}

		if exists {
			// 已存在，确保 deploy_type 正确
			_, err = s.db.UserInstalledTheme.
				Update().
				Where(
					userinstalledtheme.UserID(userID),
					userinstalledtheme.ThemeName(themeName),
				).
				SetDeployType(userinstalledtheme.DeployTypeSsr).
				Save(ctx)

			if err != nil {
				log.Printf("[主题同步] 更新主题 %s 的 deploy_type 失败: %v", themeName, err)
			}
			continue
		}

		// 读取版本信息
		version := ""
		versionFile := filepath.Join(themePath, "version.txt")
		if data, err := os.ReadFile(versionFile); err == nil {
			version = strings.TrimSpace(string(data))
		}

		// 创建记录
		_, err = s.db.UserInstalledTheme.
			Create().
			SetUserID(userID).
			SetThemeName(themeName).
			SetDeployType(userinstalledtheme.DeployTypeSsr).
			SetInstallTime(time.Now()).
			SetInstalledVersion(version).
			SetIsCurrent(false).
			Save(ctx)

		if err != nil {
			log.Printf("[主题同步] 创建主题 %s 记录失败: %v", themeName, err)
			continue
		}

		synced++
		log.Printf("[主题同步] 已同步 SSR 主题: %s (版本: %s)", themeName, version)
	}

	if synced > 0 {
		log.Printf("[主题同步] 共同步 %d 个 SSR 主题到数据库", synced)
	}

	return nil
}

// GetSSRThemeCurrentStatus 获取 SSR 主题的 is_current 状态
// 返回 map[themeName]isCurrent
func (s *themeService) GetSSRThemeCurrentStatus(ctx context.Context, userID uint) (map[string]bool, error) {
	// #region agent log
	debugLog := func(msg string, data map[string]interface{}) {
		f, _ := os.OpenFile("/Users/anzhiyu/Project/2025/anheyu-work/.cursor/debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if f != nil {
			defer f.Close()
			entry := map[string]interface{}{"location": "service.go:GetSSRThemeCurrentStatus", "message": msg, "data": data, "timestamp": time.Now().UnixMilli(), "sessionId": "debug-session", "hypothesisId": "C"}
			jsonData, _ := json.Marshal(entry)
			f.Write(append(jsonData, '\n'))
		}
	}
	// #endregion

	themes, err := s.db.UserInstalledTheme.
		Query().
		Where(
			userinstalledtheme.UserID(userID),
			userinstalledtheme.DeployTypeEQ(userinstalledtheme.DeployTypeSsr),
		).
		All(ctx)

	if err != nil {
		return nil, fmt.Errorf("查询 SSR 主题状态失败: %w", err)
	}

	result := make(map[string]bool)
	for _, theme := range themes {
		result[theme.ThemeName] = theme.IsCurrent
	}

	// #region agent log
	debugLog("查询SSR主题is_current状态", map[string]interface{}{"userID": userID, "result": result})
	// #endregion

	return result, nil
}
