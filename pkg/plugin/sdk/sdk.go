/*
 * @Description: 插件开发 SDK - 封装握手、元信息与多能力注册，开发者一行代码即可启动插件
 * @Author: 安知鱼
 * @Date: 2026-08-13
 *
 * 最小事件钩子插件示例：
 *
 *	package main
 *
 *	import (
 *		"context"
 *
 *		"github.com/anzhiyu-c/anheyu-app/pkg/plugin"
 *		"github.com/anzhiyu-c/anheyu-app/pkg/plugin/sdk"
 *	)
 *
 *	type MyHook struct{}
 *
 *	func (h *MyHook) Subscriptions() []string { return []string{plugin.EventArticlePublished} }
 *
 *	func (h *MyHook) OnEvent(ctx context.Context, event plugin.Event) error {
 *		// 处理事件
 *		return nil
 *	}
 *
 *	func main() {
 *		sdk.Serve(sdk.Options{
 *			Metadata: plugin.Metadata{
 *				ID: "my-plugin", Name: "我的插件", Version: "1.0.0",
 *			},
 *			EventHook: &MyHook{},
 *		})
 *	}
 */
package sdk

import (
	"context"
	"log"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/plugin"
	goplugin "github.com/hashicorp/go-plugin"
)

// Options 插件启动选项
type Options struct {
	// Metadata 插件元信息（必填：ID、Name、Version）
	Metadata plugin.Metadata
	// Searcher 搜索引擎能力实现（可选）
	Searcher model.Searcher
	// EventHook 事件钩子能力实现（可选）
	EventHook plugin.EventHook
}

// Serve 启动插件并阻塞运行（应在 main 函数中调用）
// 自动完成 go-plugin 握手，并为提供的每种能力注册 RPC 服务与元信息
func Serve(opts Options) {
	if opts.Metadata.ID == "" {
		log.Fatal("[Plugin SDK] Metadata.ID 不能为空")
	}
	if opts.Searcher == nil && opts.EventHook == nil {
		log.Fatal("[Plugin SDK] 至少需要提供一种能力实现（Searcher / EventHook）")
	}

	// 自动填充能力类型列表，供宿主展示
	var types []string
	if opts.Searcher != nil {
		types = append(types, plugin.TypeSearcher)
	}
	if opts.EventHook != nil {
		types = append(types, plugin.TypeEventHook)
	}
	if len(opts.Metadata.Types) == 0 {
		opts.Metadata.Types = types
	}
	if opts.Metadata.Type == "" && len(types) > 0 {
		opts.Metadata.Type = types[0]
	}

	pluginMap := map[string]goplugin.Plugin{}
	if opts.Searcher != nil {
		pluginMap[plugin.TypeSearcher] = &plugin.SearcherPlugin{
			Impl: &searcherWithMeta{Searcher: opts.Searcher, meta: opts.Metadata},
		}
	}
	if opts.EventHook != nil {
		pluginMap[plugin.TypeEventHook] = &plugin.EventHookPlugin{
			Impl: &hookWithMeta{EventHook: opts.EventHook, meta: opts.Metadata},
		}
	}

	goplugin.Serve(&goplugin.ServeConfig{
		HandshakeConfig: plugin.Handshake,
		Plugins:         pluginMap,
	})
}

// searcherWithMeta 为搜索实现附加元信息（实现 plugin.MetadataProvider）
type searcherWithMeta struct {
	model.Searcher
	meta plugin.Metadata
}

func (s *searcherWithMeta) PluginMetadata() plugin.Metadata { return s.meta }

// hookWithMeta 为事件钩子实现附加元信息（实现 plugin.MetadataProvider）
type hookWithMeta struct {
	plugin.EventHook
	meta plugin.Metadata
}

func (h *hookWithMeta) PluginMetadata() plugin.Metadata { return h.meta }

// EventHandlerFunc 便捷类型：用函数直接实现事件处理（订阅全部事件）
type EventHandlerFunc func(ctx context.Context, event plugin.Event) error

func (f EventHandlerFunc) Subscriptions() []string { return []string{plugin.EventSubscribeAll} }

func (f EventHandlerFunc) OnEvent(ctx context.Context, event plugin.Event) error {
	return f(ctx, event)
}
