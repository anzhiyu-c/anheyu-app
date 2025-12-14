// internal/app/service/setting/service.go
package setting

import (
	"context"
	"encoding/json"
	"log"
	"strconv"
	"strings"
	"sync"

	"github.com/anzhiyu-c/anheyu-app/internal/configdef"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/event"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
)

// TopicSettingUpdated 定义了配置更新事件的主题（Topic）
const TopicSettingUpdated = "setting:updated"

// SettingUpdatedEvent 定义了配置更新事件的数据结构
type SettingUpdatedEvent struct {
	Key   string
	Value string
}

// SettingService 定义了配置服务的接口
type SettingService interface {
	LoadAllSettings(ctx context.Context) error
	Get(key string) string
	GetBool(key string) bool
	GetByKeys(keys []string) map[string]interface{}
	GetSiteConfig() map[string]interface{}
	UpdateSettings(ctx context.Context, settingsToUpdate map[string]string) error
	RegisterPublicSettings(keys []string) // 动态注册公开配置
	IsPublicSetting(key string) bool      // 检查配置是否为公开配置
}

// settingService 是 SettingService 接口的实现
type settingService struct {
	repo          repository.SettingRepository
	cache         map[string]string
	mu            sync.RWMutex
	publicSetting map[string]bool
	eventBus      *event.EventBus // 已修正: 类型从 event.Bus 修改为 *event.EventBus
}

// NewSettingService 是 settingService 的构造函数
func NewSettingService(repo repository.SettingRepository, bus *event.EventBus) SettingService {
	publicKeys := make(map[string]bool)
	for _, def := range configdef.AllSettings {
		if def.IsPublic {
			publicKeys[def.Key.String()] = true
		}
	}
	log.Printf("Setting Service 初始化完成，自动识别到 %d 个公开配置项。", len(publicKeys))

	return &settingService{
		repo:          repo,
		cache:         make(map[string]string),
		publicSetting: publicKeys,
		eventBus:      bus,
	}
}

// LoadAllSettings 从代码定义和数据库中加载所有配置项到内存缓存。
func (s *settingService) LoadAllSettings(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	newCache := make(map[string]string)
	for _, def := range configdef.AllSettings {
		newCache[def.Key.String()] = def.Value
	}

	dbSettings, err := s.repo.FindAll(ctx)
	if err != nil {
		s.cache = newCache
		log.Printf("⚠️ 警告: 从数据库加载配置失败: %v。服务将使用代码中定义的默认配置。", err)
		return err
	}

	for _, dbSetting := range dbSettings {
		newCache[dbSetting.ConfigKey] = dbSetting.Value
	}

	s.cache = newCache

	log.Printf("所有站点配置已成功加载到缓存，共 %d 项。", len(s.cache))
	return nil
}

// UpdateSettings 更新一个或多个配置项，并发布变更事件
func (s *settingService) UpdateSettings(ctx context.Context, settingsToUpdate map[string]string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.repo.Update(ctx, settingsToUpdate); err != nil {
		return err
	}

	for key, value := range settingsToUpdate {
		s.cache[key] = value
		// 发布事件，并确保 Topic 类型正确
		s.eventBus.Publish(event.Topic(TopicSettingUpdated), SettingUpdatedEvent{
			Key:   key,
			Value: value,
		})
	}

	log.Printf("成功更新 %d 个站点配置项，并已发布变更事件。", len(settingsToUpdate))
	return nil
}

// Get 根据键获取配置值
func (s *settingService) Get(key string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.cache[key]
}

// GetBool 根据键获取布尔类型的配置值
func (s *settingService) GetBool(key string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	valueStr := strings.ToLower(s.cache[key])
	b, _ := strconv.ParseBool(valueStr)
	return b
}

// GetByKeys 根据一组键获取配置
func (s *settingService) GetByKeys(keys []string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()
	flatResult := make(map[string]string)
	for _, key := range keys {
		if value, ok := s.cache[key]; ok {
			flatResult[key] = value
		}
	}
	return unflatten(flatResult)
}

// GetSiteConfig 返回所有公开的站点配置
func (s *settingService) GetSiteConfig() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()
	safeFlatConfig := make(map[string]string)
	for key, value := range s.cache {
		if s.isPublicSetting(key) {
			safeFlatConfig[key] = value
		}
	}
	return unflatten(safeFlatConfig)
}

func (s *settingService) isPublicSetting(key string) bool {
	_, ok := s.publicSetting[key]
	return ok
}

// IsPublicSetting 检查配置是否为公开配置（公开方法）
func (s *settingService) IsPublicSetting(key string) bool {
	return s.isPublicSetting(key)
}

// RegisterPublicSettings 动态注册公开配置键
// PRO 版本可以调用此方法将额外的配置标记为公开
func (s *settingService) RegisterPublicSettings(keys []string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, key := range keys {
		s.publicSetting[key] = true
	}
	log.Printf("已注册 %d 个公开配置项", len(keys))
}

func unflatten(flatConfig map[string]string) map[string]interface{} {
	nested := make(map[string]interface{})
	for key, originalValue := range flatConfig {
		trimmedValue := strings.TrimSpace(originalValue)

		if (strings.HasPrefix(trimmedValue, "{") && strings.HasSuffix(trimmedValue, "}")) ||
			(strings.HasPrefix(trimmedValue, "[") && strings.HasSuffix(trimmedValue, "]")) {
			var jsonData interface{}
			if json.Unmarshal([]byte(trimmedValue), &jsonData) == nil {
				setNestedValue(nested, key, jsonData)
				continue
			}
		}

		lowerValue := strings.ToLower(trimmedValue)
		if lowerValue == "true" {
			setNestedValue(nested, key, true)
			continue
		}
		if lowerValue == "false" {
			setNestedValue(nested, key, false)
			continue
		}

		if num, err := strconv.ParseFloat(trimmedValue, 64); err == nil {
			if float64(int64(num)) == num {
				setNestedValue(nested, key, int64(num))
			} else {
				setNestedValue(nested, key, num)
			}
			continue
		}

		setNestedValue(nested, key, originalValue)
	}
	return nested
}

func setNestedValue(nested map[string]interface{}, key string, value interface{}) {
	parts := strings.Split(key, ".")
	currentMap := nested
	for i, part := range parts {
		if i == len(parts)-1 {
			currentMap[part] = value
			return
		}
		if _, ok := currentMap[part]; !ok {
			currentMap[part] = make(map[string]interface{})
		}
		nextMap, ok := currentMap[part].(map[string]interface{})
		if !ok {
			return
		}
		currentMap = nextMap
	}
}
