/*
 * @Description: 插件系统核心定义 - 基于 HashiCorp go-plugin 的运行时插件加载
 * @Author: 安知鱼
 * @Date: 2026-04-09
 */
package plugin

import (
	"context"
	"fmt"
	"log"
	"net/rpc"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	goplugin "github.com/hashicorp/go-plugin"
)

const rpcCallTimeout = 30 * time.Second

// Metadata 描述插件元信息
type Metadata struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Version     string `json:"version"`
	Description string `json:"description"`
	Author      string `json:"author"`
	Type        string `json:"type"` // 兼容保留的展示字段（如 "search"），新插件建议使用 Types
	// Types 插件提供的能力类型列表（如 ["searcher", "eventhook"]），由 SDK 自动填充
	Types []string `json:"types,omitempty"`
	// Homepage 插件主页或仓库地址
	Homepage string `json:"homepage,omitempty"`
}

// Handshake 是主程序与插件之间的握手配置，双方必须一致才能通信
var Handshake = goplugin.HandshakeConfig{
	ProtocolVersion:  1,
	MagicCookieKey:   "ANHEYU_PLUGIN",
	MagicCookieValue: "anheyu-plugin-v1",
}

// 插件类型名常量（PluginMap 的 key，宿主与插件双方必须一致）
const (
	TypeSearcher  = "searcher"
	TypeEventHook = "eventhook"
)

// PluginMap 是插件类型到接口的映射（用于 go-plugin 发现插件实现了哪些接口）
var PluginMap = map[string]goplugin.Plugin{
	TypeSearcher:  &SearcherPlugin{},
	TypeEventHook: &EventHookPlugin{},
}

// rpcCallWithTimeout 带超时的 RPC 调用
// 注意：net/rpc.Call 不支持取消，超时后底层 goroutine 会继续运行直到 RPC 完成或连接断开。
// 这是 net/rpc 的固有限制。如需完全可取消，应迁移到 gRPC 协议。
func rpcCallWithTimeout(client *rpc.Client, method string, args interface{}, reply interface{}) error {
	done := make(chan error, 1)
	go func() {
		done <- client.Call(method, args, reply)
	}()

	select {
	case err := <-done:
		return err
	case <-time.After(rpcCallTimeout):
		log.Printf("[Plugin] RPC 调用 %s 超时（%v），底层调用仍在后台运行", method, rpcCallTimeout)
		return fmt.Errorf("RPC call %s timed out after %v", method, rpcCallTimeout)
	}
}

// --- Searcher 插件接口（RPC 模式） ---

// SearcherPlugin 实现 goplugin.Plugin 接口，用于 net/rpc 序列化
type SearcherPlugin struct {
	Impl model.Searcher
}

func (p *SearcherPlugin) Server(*goplugin.MuxBroker) (interface{}, error) {
	return &SearcherRPCServer{Impl: p.Impl}, nil
}

func (p *SearcherPlugin) Client(b *goplugin.MuxBroker, c *rpc.Client) (interface{}, error) {
	return &SearcherRPCClient{client: c}, nil
}

// --- RPC Server 端（在插件进程中运行） ---

// SearcherRPCServer 是 Searcher 的 RPC 服务端包装
type SearcherRPCServer struct {
	Impl model.Searcher
}

// SearchArgs 搜索请求参数
type SearchArgs struct {
	Query string
	Page  int
	Size  int
}

// IndexArticleArgs 索引文章请求参数
type IndexArticleArgs struct {
	Article *model.Article
}

func (s *SearcherRPCServer) Search(args SearchArgs, resp *model.SearchResult) error {
	result, err := s.Impl.Search(context.Background(), args.Query, args.Page, args.Size)
	if err != nil {
		return err
	}
	*resp = *result
	return nil
}

func (s *SearcherRPCServer) IndexArticle(args IndexArticleArgs, resp *struct{}) error {
	return s.Impl.IndexArticle(context.Background(), args.Article)
}

func (s *SearcherRPCServer) DeleteArticle(articleID string, resp *struct{}) error {
	return s.Impl.DeleteArticle(context.Background(), articleID)
}

func (s *SearcherRPCServer) ClearAllDocuments(_ struct{}, resp *struct{}) error {
	return s.Impl.ClearAllDocuments(context.Background())
}

func (s *SearcherRPCServer) HealthCheck(_ struct{}, resp *struct{}) error {
	return s.Impl.HealthCheck(context.Background())
}

// GetMetadata 返回插件元信息（通过 RPC 调用）
func (s *SearcherRPCServer) GetMetadata(_ struct{}, resp *Metadata) error {
	if mp, ok := s.Impl.(MetadataProvider); ok {
		meta := mp.PluginMetadata()
		*resp = meta
	}
	return nil
}

// MetadataProvider 插件可选实现此接口以提供元信息
type MetadataProvider interface {
	PluginMetadata() Metadata
}

// --- RPC Client 端（在主程序中运行，代理调用到插件进程） ---

// SearcherRPCClient 是 Searcher 的 RPC 客户端包装，实现 model.Searcher 接口
type SearcherRPCClient struct {
	client *rpc.Client
}

// callWithTimeout 带超时的 RPC 调用
func (c *SearcherRPCClient) callWithTimeout(method string, args interface{}, reply interface{}) error {
	return rpcCallWithTimeout(c.client, method, args, reply)
}

func (c *SearcherRPCClient) Search(ctx context.Context, query string, page int, size int) (*model.SearchResult, error) {
	var resp model.SearchResult
	err := c.callWithTimeout("Plugin.Search", SearchArgs{Query: query, Page: page, Size: size}, &resp)
	if err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SearcherRPCClient) IndexArticle(ctx context.Context, article *model.Article) error {
	var resp struct{}
	return c.callWithTimeout("Plugin.IndexArticle", IndexArticleArgs{Article: article}, &resp)
}

func (c *SearcherRPCClient) DeleteArticle(ctx context.Context, articleID string) error {
	var resp struct{}
	return c.callWithTimeout("Plugin.DeleteArticle", articleID, &resp)
}

func (c *SearcherRPCClient) ClearAllDocuments(ctx context.Context) error {
	var resp struct{}
	return c.callWithTimeout("Plugin.ClearAllDocuments", struct{}{}, &resp)
}

func (c *SearcherRPCClient) HealthCheck(ctx context.Context) error {
	var resp struct{}
	return c.callWithTimeout("Plugin.HealthCheck", struct{}{}, &resp)
}

// GetMetadata 获取插件元信息
func (c *SearcherRPCClient) GetMetadata() Metadata {
	var resp Metadata
	if err := c.callWithTimeout("Plugin.GetMetadata", struct{}{}, &resp); err != nil {
		log.Printf("[Plugin] 获取插件元信息失败: %v", err)
	}
	return resp
}
