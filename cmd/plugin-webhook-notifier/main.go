/*
 * @Description: Webhook 通知插件 - 把站点事件（文章发布、评论创建等）POST 到自定义 Webhook 地址
 * @Author: 安知鱼
 * @Date: 2026-08-13
 *
 * 这是事件钩子插件的官方示例，也是文档《插件开发》快速开始的参考实现。
 *
 * 编译方式: go build -o webhook-notifier ./cmd/plugin-webhook-notifier
 * 使用方式: 打包为目录式插件（plugin.json + 二进制）后台上传安装，
 *          或直接将二进制放入 data/plugins/ 目录（旧式，配置需走主进程环境变量）
 *
 * 配置项（由管理后台下发，manifest 中声明）:
 *   webhook_url - 接收事件 POST 请求的完整 URL（必填）
 *   events      - 订阅的事件名，逗号分隔，默认 "*"（全部事件）
 */
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/plugin"
	"github.com/anzhiyu-c/anheyu-app/pkg/plugin/sdk"
)

// webhookHook 实现 plugin.EventHook 接口
type webhookHook struct {
	webhookURL string
	events     []string
	client     *http.Client
}

// Subscriptions 返回订阅的事件列表
func (h *webhookHook) Subscriptions() []string {
	return h.events
}

// OnEvent 把事件序列化为 JSON 并 POST 到配置的 Webhook 地址
func (h *webhookHook) OnEvent(ctx context.Context, event plugin.Event) error {
	if h.webhookURL == "" {
		log.Printf("[webhook-notifier] 未配置 webhook_url，跳过事件 %s", event.Name)
		return nil
	}

	body, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("序列化事件失败: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, h.webhookURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("构建请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "anheyu-webhook-notifier/1.0")

	resp, err := h.client.Do(req)
	if err != nil {
		return fmt.Errorf("发送 Webhook 请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("Webhook 返回异常状态码: %d", resp.StatusCode)
	}
	log.Printf("[webhook-notifier] 事件 %s 已推送", event.Name)
	return nil
}

// parseEvents 解析逗号分隔的事件订阅配置
func parseEvents(raw string) []string {
	parts := strings.Split(raw, ",")
	events := make([]string, 0, len(parts))
	for _, p := range parts {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			events = append(events, trimmed)
		}
	}
	if len(events) == 0 {
		return []string{plugin.EventSubscribeAll}
	}
	return events
}

func main() {
	cfg := sdk.LoadConfig()

	hook := &webhookHook{
		webhookURL: cfg.String("webhook_url"),
		events:     parseEvents(cfg.StringDefault("events", plugin.EventSubscribeAll)),
		client:     &http.Client{Timeout: 10 * time.Second},
	}
	if hook.webhookURL == "" {
		// 不中断启动：等待管理员在后台填写配置后自动重载生效
		log.Println("[webhook-notifier] ⚠️ 尚未配置 webhook_url，插件将空转直至配置完成")
	}

	sdk.Serve(sdk.Options{
		Metadata: plugin.Metadata{
			ID:          "webhook-notifier",
			Name:        "Webhook 通知",
			Version:     "1.0.0",
			Description: "把文章发布、评论创建等站点事件推送到自定义 Webhook 地址",
			Author:      "安知鱼",
			Homepage:    "https://github.com/anzhiyu-c/anheyu-app",
		},
		EventHook: hook,
	})
}
