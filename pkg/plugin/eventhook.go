/*
 * @Description: 事件钩子插件类型 - 插件可订阅站点事件（文章发布、评论创建等）实现二次开发
 * @Author: 安知鱼
 * @Date: 2026-08-13
 */
package plugin

import (
	"context"
	"encoding/json"
	"net/rpc"
	"time"

	goplugin "github.com/hashicorp/go-plugin"
)

// Event 描述一次站点事件
type Event struct {
	// Name 事件名，格式为 "<领域>.<动作>"，如 "article.published"
	Name string `json:"name"`
	// OccurredAt 事件发生时间
	OccurredAt time.Time `json:"occurred_at"`
	// Payload 事件负载（JSON），字段结构见各事件定义
	Payload json.RawMessage `json:"payload"`
}

// 站点事件名常量
const (
	EventArticleCreated   = "article.created"
	EventArticlePublished = "article.published"
	EventArticleUpdated   = "article.updated"
	EventArticleDeleted   = "article.deleted"
	EventCommentCreated   = "comment.created"

	// EventSubscribeAll 订阅通配符，表示接收全部事件
	EventSubscribeAll = "*"
)

// EventHook 事件钩子接口，由插件实现
type EventHook interface {
	// Subscriptions 返回订阅的事件名列表，支持 "*" 通配全部事件
	Subscriptions() []string
	// OnEvent 处理一次事件，错误只记录日志，不影响业务流程
	OnEvent(ctx context.Context, event Event) error
}

// --- go-plugin 接线 ---

// EventHookPlugin 实现 goplugin.Plugin 接口，用于 net/rpc 序列化
type EventHookPlugin struct {
	Impl EventHook
}

func (p *EventHookPlugin) Server(*goplugin.MuxBroker) (interface{}, error) {
	return &EventHookRPCServer{Impl: p.Impl}, nil
}

func (p *EventHookPlugin) Client(b *goplugin.MuxBroker, c *rpc.Client) (interface{}, error) {
	return &EventHookRPCClient{client: c}, nil
}

// --- RPC Server 端（在插件进程中运行） ---

// EventHookRPCServer 是 EventHook 的 RPC 服务端包装
type EventHookRPCServer struct {
	Impl EventHook
}

func (s *EventHookRPCServer) Subscriptions(_ struct{}, resp *[]string) error {
	*resp = s.Impl.Subscriptions()
	return nil
}

func (s *EventHookRPCServer) OnEvent(event Event, _ *struct{}) error {
	return s.Impl.OnEvent(context.Background(), event)
}

// GetMetadata 返回插件元信息（通过 RPC 调用）
func (s *EventHookRPCServer) GetMetadata(_ struct{}, resp *Metadata) error {
	if mp, ok := s.Impl.(MetadataProvider); ok {
		*resp = mp.PluginMetadata()
	}
	return nil
}

// --- RPC Client 端（在主程序中运行，代理调用到插件进程） ---

// EventHookRPCClient 是 EventHook 的 RPC 客户端包装，实现 EventHook 接口
type EventHookRPCClient struct {
	client *rpc.Client
}

func (c *EventHookRPCClient) callWithTimeout(method string, args interface{}, reply interface{}) error {
	return rpcCallWithTimeout(c.client, method, args, reply)
}

func (c *EventHookRPCClient) Subscriptions() []string {
	var resp []string
	if err := c.callWithTimeout("Plugin.Subscriptions", struct{}{}, &resp); err != nil {
		return nil
	}
	return resp
}

func (c *EventHookRPCClient) OnEvent(ctx context.Context, event Event) error {
	var resp struct{}
	return c.callWithTimeout("Plugin.OnEvent", event, &resp)
}

// GetMetadata 获取插件元信息
func (c *EventHookRPCClient) GetMetadata() Metadata {
	var resp Metadata
	if err := c.callWithTimeout("Plugin.GetMetadata", struct{}{}, &resp); err != nil {
		return Metadata{}
	}
	return resp
}
