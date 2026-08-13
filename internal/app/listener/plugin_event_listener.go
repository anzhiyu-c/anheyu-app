/*
 * @Description: 插件事件桥接监听器 - 订阅内部事件总线并转发给事件钩子插件
 * @Author: 安知鱼
 * @Date: 2026-08-13
 *
 * 内部 EventBus 的事件经此桥接为插件事件（如 article:published -> article.published），
 * 转发通过 plugin.Dispatch 完成：插件系统未初始化或无订阅插件时为 no-op，开销可忽略。
 */
package listener

import (
	"log"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/event"
	"github.com/anzhiyu-c/anheyu-app/pkg/plugin"
)

// PluginEventListener 插件事件桥接监听器
type PluginEventListener struct{}

// NewPluginEventListener 创建插件事件桥接监听器
func NewPluginEventListener() *PluginEventListener {
	return &PluginEventListener{}
}

// RegisterHandlers 注册事件处理器
func (l *PluginEventListener) RegisterHandlers(bus *event.EventBus) {
	log.Println("[PluginEventListener] 已注册插件事件桥接（article.* / comment.*）")

	bus.Subscribe(event.ArticleCreated, func(p interface{}) { l.forwardArticleEvent(plugin.EventArticleCreated, p) })
	bus.Subscribe(event.ArticlePublished, func(p interface{}) { l.forwardArticleEvent(plugin.EventArticlePublished, p) })
	bus.Subscribe(event.ArticleUpdated, func(p interface{}) { l.forwardArticleEvent(plugin.EventArticleUpdated, p) })
	bus.Subscribe(event.ArticleDeleted, func(p interface{}) { l.forwardArticleEvent(plugin.EventArticleDeleted, p) })
	bus.Subscribe(event.CommentCreated, l.forwardCommentEvent)
}

// articleEventPayload 转发给插件的文章事件负载（仅公开字段）
type articleEventPayload struct {
	ID    string `json:"id"`
	Slug  string `json:"slug,omitempty"`
	Title string `json:"title,omitempty"`
	URL   string `json:"url,omitempty"`
}

// commentEventPayload 转发给插件的评论事件负载（仅公开字段）
type commentEventPayload struct {
	ID          uint   `json:"id"`
	TargetPath  string `json:"target_path"`
	TargetTitle string `json:"target_title,omitempty"`
	Nickname    string `json:"nickname"`
	Content     string `json:"content"`
	IsPublished bool   `json:"is_published"`
	IsAdmin     bool   `json:"is_admin"`
}

func (l *PluginEventListener) forwardArticleEvent(name string, payload interface{}) {
	p, ok := payload.(*event.ArticlePayload)
	if !ok {
		return
	}
	target := p.Slug
	if target == "" {
		target = p.PublicID
	}
	url := ""
	if target != "" {
		url = "/posts/" + target
	}
	plugin.Dispatch(name, articleEventPayload{
		ID:    p.PublicID,
		Slug:  p.Slug,
		Title: p.Title,
		URL:   url,
	})
}

func (l *PluginEventListener) forwardCommentEvent(payload interface{}) {
	p, ok := payload.(*event.CommentPayload)
	if !ok {
		return
	}
	plugin.Dispatch(plugin.EventCommentCreated, commentEventPayload{
		ID:          p.ID,
		TargetPath:  p.TargetPath,
		TargetTitle: p.TargetTitle,
		Nickname:    p.Nickname,
		Content:     p.Content,
		IsPublished: p.IsPublished,
		IsAdmin:     p.IsAdmin,
	})
}
