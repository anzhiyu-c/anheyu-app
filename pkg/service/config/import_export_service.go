/*
 * @Description: 配置导入导出服务
 * @Author: 安知鱼
 * @Date: 2025-10-19
 */
package config

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
)

// ImportExportService 定义了配置导入导出服务的接口
type ImportExportService interface {
	// ExportConfig 导出数据库配置表数据
	ExportConfig(ctx context.Context) ([]byte, error)
	// ImportConfig 导入配置数据到数据库
	ImportConfig(ctx context.Context, content io.Reader) error
}

// exportPayload 扩展导出格式：系统设置 + 支付配置（由 Pro 实现扩展时使用）
type exportPayload struct {
	Settings       map[string]string         `json:"settings,omitempty"`
	PaymentConfigs []PaymentConfigExportItem `json:"payment_configs,omitempty"`
}

// importExportService 是 ImportExportService 接口的实现
type importExportService struct {
	settingRepo    repository.SettingRepository
	settingService setting.SettingService
	extension      *ConfigExportImportExtension // 可选，Pro 可在 App 创建后通过 SetConfigExtension 注入
}

// NewImportExportService 创建一个新的配置导入导出服务实例
// extension 为指向扩展的指针，便于 Pro 在 App 创建后再注入；为 nil 或 *nil 时仅处理系统设置
func NewImportExportService(settingRepo repository.SettingRepository, settingService setting.SettingService, extension *ConfigExportImportExtension) ImportExportService {
	return &importExportService{
		settingRepo:    settingRepo,
		settingService: settingService,
		extension:      extension,
	}
}

// ExportConfig 导出数据库配置表数据；若注入了扩展（如 Pro 支付配置），则一并导出
func (s *importExportService) ExportConfig(ctx context.Context) ([]byte, error) {
	settings, err := s.settingRepo.FindAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("从数据库读取配置失败: %w", err)
	}

	configMap := make(map[string]string)
	for _, setting := range settings {
		configMap[setting.ConfigKey] = setting.Value
	}
	excludeRuntimeSigningKeys(configMap)

	if s.extension != nil && *s.extension != nil {
		paymentConfigs, err := (*s.extension).ExportPayment(ctx)
		if err != nil {
			return nil, fmt.Errorf("导出支付配置失败: %w", err)
		}
		payload := exportPayload{
			Settings:       configMap,
			PaymentConfigs: paymentConfigs,
		}
		data, err := json.MarshalIndent(payload, "", "  ")
		if err != nil {
			return nil, fmt.Errorf("序列化配置数据失败: %w", err)
		}
		log.Printf("✅ 配置数据导出成功，系统设置 %d 项、支付配置 %d 项，大小: %d 字节", len(configMap), len(paymentConfigs), len(data))
		return data, nil
	}

	data, err := json.MarshalIndent(configMap, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("序列化配置数据失败: %w", err)
	}
	log.Printf("✅ 配置数据导出成功，共 %d 项配置，大小: %d 字节", len(configMap), len(data))
	return data, nil
}

// ImportConfig 导入配置数据到数据库；支持旧版纯 settings 与新版 settings+payment_configs 格式
func (s *importExportService) ImportConfig(ctx context.Context, content io.Reader) error {
	data, err := io.ReadAll(content)
	if err != nil {
		return fmt.Errorf("读取上传内容失败: %w", err)
	}
	if len(data) == 0 {
		return fmt.Errorf("上传的配置文件为空")
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("解析配置数据失败，请确保文件格式正确: %w", err)
	}

	var settingsMap map[string]string
	var paymentItems []PaymentConfigExportItem

	if settingsObj, ok := raw["settings"]; ok {
		if m, ok := settingsObj.(map[string]interface{}); ok {
			// 新版格式：根节点含 "settings" 对象
			settingsMap = make(map[string]string)
			for k, v := range m {
				if v == nil {
					settingsMap[k] = ""
				} else if str, ok := v.(string); ok {
					settingsMap[k] = str
				} else {
					settingsMap[k] = fmt.Sprintf("%v", v)
				}
			}
			if pc, ok := raw["payment_configs"]; ok && s.extension != nil && *s.extension != nil {
				if arr, ok := pc.([]interface{}); ok {
					for _, item := range arr {
						if itemMap, ok := item.(map[string]interface{}); ok {
							pi := paymentExportItemFromMap(itemMap)
							paymentItems = append(paymentItems, pi)
						}
					}
				}
			}
		}
	}
	if settingsMap == nil {
		// 旧版格式：根节点即为 key-value 配置
		settingsMap = make(map[string]string)
		for k, v := range raw {
			if v == nil {
				settingsMap[k] = ""
			} else if str, ok := v.(string); ok {
				settingsMap[k] = str
			} else {
				settingsMap[k] = fmt.Sprintf("%v", v)
			}
		}
	}

	// 旧备份也不能恢复旧签名身份；保留当前实例正在使用的签名密钥。
	excludeRuntimeSigningKeys(settingsMap)
	if len(settingsMap) == 0 && len(paymentItems) == 0 {
		return fmt.Errorf("配置文件中没有有效的配置项")
	}

	if len(settingsMap) > 0 {
		if err := s.settingRepo.Upsert(ctx, settingsMap); err != nil {
			return fmt.Errorf("导入配置到数据库失败: %w", err)
		}
		if err := s.settingService.LoadAllSettings(ctx); err != nil {
			log.Printf("⚠️ 警告: 刷新配置缓存失败: %v", err)
		} else {
			log.Printf("✅ 配置缓存已刷新，新配置已立即生效")
		}
		log.Printf("✅ 系统设置导入成功，共 %d 项", len(settingsMap))
	}

	if len(paymentItems) > 0 && s.extension != nil && *s.extension != nil {
		if err := (*s.extension).ImportPayment(ctx, paymentItems); err != nil {
			return fmt.Errorf("导入支付配置失败: %w", err)
		}
		log.Printf("✅ 支付配置导入成功，共 %d 项", len(paymentItems))
	}

	return nil
}

// 运行期签名密钥不属于可迁移配置。其他配置（包括 Pro 支付数据）保持原有语义。
func excludeRuntimeSigningKeys(settings map[string]string) {
	for key := range settings {
		normalized := strings.TrimSpace(key)
		if strings.EqualFold(normalized, constant.KeyJWTSecret.String()) ||
			strings.EqualFold(normalized, constant.KeyLocalFileSigningSecret.String()) {
			delete(settings, key)
		}
	}
}

func paymentExportItemFromMap(m map[string]interface{}) PaymentConfigExportItem {
	var provider, configData, appID, description string
	var isEnabled bool
	if v, ok := m["provider"]; ok && v != nil {
		if s, ok := v.(string); ok {
			provider = s
		} else {
			log.Printf("[配置导入] provider 类型不匹配，期望 string，实际 %T，使用 fmt 转换", v)
			provider = fmt.Sprintf("%v", v)
		}
	}
	if v, ok := m["config_data"]; ok && v != nil {
		if s, ok := v.(string); ok {
			configData = s
		} else {
			log.Printf("[配置导入] config_data 类型不匹配，期望 string，实际 %T，使用 fmt 转换", v)
			configData = fmt.Sprintf("%v", v)
		}
	}
	if v, ok := m["app_id"]; ok && v != nil {
		if s, ok := v.(string); ok {
			appID = s
		} else {
			log.Printf("[配置导入] app_id 类型不匹配，期望 string，实际 %T，使用 fmt 转换", v)
			appID = fmt.Sprintf("%v", v)
		}
	}
	if v, ok := m["description"]; ok && v != nil {
		if s, ok := v.(string); ok {
			description = s
		} else {
			log.Printf("[配置导入] description 类型不匹配，期望 string，实际 %T，使用 fmt 转换", v)
			description = fmt.Sprintf("%v", v)
		}
	}
	if v, ok := m["is_enabled"]; ok && v != nil {
		if b, ok := v.(bool); ok {
			isEnabled = b
		} else if s, ok := v.(string); ok {
			isEnabled = s == "true"
		} else {
			log.Printf("[配置导入] is_enabled 类型不匹配，期望 bool，实际 %T", v)
		}
	}
	return PaymentConfigExportItem{
		Provider:    provider,
		IsEnabled:   isEnabled,
		ConfigData:  configData,
		AppID:       appID,
		Description: description,
	}
}
