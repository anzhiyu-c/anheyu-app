/*
 * @Description: Next.js 前端缓存清理服务
 * @Author: 安知鱼
 * @Date: 2025-01-26
 *
 * SSR 模式下，当后端数据变更时，调用 Next.js 的 revalidate API 清理缓存
 */
package cache

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

// RevalidateService Next.js 缓存清理服务
type RevalidateService struct {
	enabled    bool
	baseURL    string
	token      string
	httpClient *http.Client
}

// NewRevalidateService 创建缓存清理服务
func NewRevalidateService() *RevalidateService {
	// 从环境变量获取配置
	// SSR 模式下，FRONTEND_URL 指向 Next.js 容器
	frontendURL := strings.TrimRight(strings.TrimSpace(os.Getenv("FRONTEND_URL")), "/")
	if frontendURL == "" {
		frontendURL = strings.TrimRight(strings.TrimSpace(os.Getenv("ANHEYU_FRONTEND_URL")), "/")
	}
	if frontendURL == "" {
		frontendURL = "http://127.0.0.1:3000"
		if os.Getenv("ANHEYU_MODE") == "api" {
			frontendURL = "http://anheyu-frontend:3000"
		}
		if port, err := strconv.Atoi(os.Getenv("ANHEYU_FRONTEND_PORT")); err == nil && port > 0 && port <= 65535 {
			frontendURL = "http://127.0.0.1:" + strconv.Itoa(port)
		}
	}
	token := strings.TrimSpace(os.Getenv("REVALIDATE_TOKEN"))
	// Match the Next.js endpoint: no implicit/default secret and support built-in deployments.
	enabled := token != ""

	return &RevalidateService{
		enabled: enabled,
		baseURL: frontendURL + "/revalidate",
		token:   token,
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

// IsEnabled 检查服务是否启用
func (s *RevalidateService) IsEnabled() bool {
	return s.enabled
}

// RevalidateArticle 文章变更时清理缓存，同时发送 abbrlink 和 publicID 以清除两种访问路径的缓存
func (s *RevalidateService) RevalidateArticle(slug, publicID string) error {
	if !s.enabled {
		return nil
	}
	body := map[string]interface{}{}
	if slug != "" {
		body["article"] = slug
	}
	if publicID != "" {
		body["articleID"] = publicID
	}
	return s.doRevalidate(body)
}

// RevalidateSiteConfig 站点配置变更时清理缓存
func (s *RevalidateService) RevalidateSiteConfig() error {
	if !s.enabled {
		return nil
	}
	return s.doRevalidate(map[string]interface{}{"siteConfig": true})
}

// RevalidateCategories 分类变更时清理缓存
func (s *RevalidateService) RevalidateCategories() error {
	if !s.enabled {
		return nil
	}
	return s.doRevalidate(map[string]interface{}{"categories": true})
}

// RevalidateTags 标签变更时清理缓存
func (s *RevalidateService) RevalidateTags() error {
	if !s.enabled {
		return nil
	}
	return s.doRevalidate(map[string]interface{}{"tagsList": true})
}

// RevalidateFriendLinks 友链变更时清理缓存
func (s *RevalidateService) RevalidateFriendLinks() error {
	if !s.enabled {
		return nil
	}
	return s.doRevalidate(map[string]interface{}{
		"tags": []string{"friend-links"},
	})
}

// RevalidateAll 清理所有缓存
func (s *RevalidateService) RevalidateAll() error {
	if !s.enabled {
		return nil
	}
	return s.doRevalidate(map[string]interface{}{"all": true})
}

// doRevalidate 执行缓存清理请求
func (s *RevalidateService) doRevalidate(body map[string]interface{}) error {
	data, err := json.Marshal(body)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", s.baseURL, bytes.NewReader(data))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-revalidate-token", s.token)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Printf("[Revalidate] Failed to call revalidate API: %v", err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("[Revalidate] Revalidate API returned status %d", resp.StatusCode)
	} else {
		log.Printf("[Revalidate] Cache cleared: %v", body)
	}

	return nil
}
