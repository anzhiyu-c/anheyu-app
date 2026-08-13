/*
 * @Description: 一个带固定Worker池的异步事件总线
 * @Author: 安知鱼
 * @Date: 2025-07-10 19:06:12
 * @LastEditTime: 2025-07-18 18:20:05
 * @LastEditors: 安知鱼
 */
package event

import (
	"log"
	"sync"
)

// 定义事件类型
type Topic string

const (
	FileCreated Topic = "file:created"

	// 友链事件
	LinkCreated Topic = "link:created"
	LinkUpdated Topic = "link:updated"
	LinkDeleted Topic = "link:deleted"

	// 文章事件（用于缓存清理）
	ArticleCreated   Topic = "article:created"
	ArticleUpdated   Topic = "article:updated"
	ArticleDeleted   Topic = "article:deleted"
	ArticlePublished Topic = "article:published"

	// 配置事件
	SiteConfigUpdated Topic = "site-config:updated"

	// 分类/标签事件
	CategoryUpdated Topic = "category:updated"
	TagUpdated      Topic = "tag:updated"

	// 评论事件
	CommentCreated Topic = "comment:created"
)

// ArticlePayload 文章事件载荷（用于 ArticleCreated / ArticleUpdated / ArticleDeleted / ArticlePublished）
type ArticlePayload struct {
	Slug     string // abbrlink（优先）
	PublicID string // 公共 ID（备选，确保两种访问路径都能清缓存）
	Title    string // 文章标题（供插件事件等订阅者展示使用）
}

// CommentPayload 评论事件载荷（用于 CommentCreated）
type CommentPayload struct {
	ID          uint   // 评论数据库 ID
	TargetPath  string // 评论所属页面路径
	TargetTitle string // 评论所属页面标题
	Nickname    string // 评论者昵称
	Content     string // 评论内容（原文）
	IsPublished bool   // 是否已发布（false 表示待审核）
	IsAdmin     bool   // 是否为管理员评论
}

// 事件处理器函数类型
type Handler func(payload interface{})

// Event 是在通道中传递的事件结构
type Event struct {
	Topic   Topic
	Payload interface{}
}

// EventBus 实现了基于Worker池的异步事件总线
type EventBus struct {
	mu        sync.RWMutex
	handlers  map[Topic][]Handler
	eventChan chan Event     // 带缓冲的事件通道
	wg        sync.WaitGroup // 用于优雅关闭
}

// 定义Worker池和通道的配置
const (
	DefaultWorkerCount = 4    // 默认启动4个后台Worker
	DefaultChannelSize = 1024 // 默认事件通道缓冲区大小
)

// NewEventBus 创建并启动一个新的事件总线
func NewEventBus() *EventBus {
	bus := &EventBus{
		handlers: make(map[Topic][]Handler),
		// 创建一个带缓冲的通道，避免Publish阻塞
		eventChan: make(chan Event, DefaultChannelSize),
	}
	bus.startWorkers(DefaultWorkerCount)
	return bus
}

// startWorkers 启动固定数量的后台worker
func (b *EventBus) startWorkers(count int) {
	for i := 0; i < count; i++ {
		b.wg.Add(1)
		// 每个worker都是一个独立的goroutine
		go b.worker(i + 1)
	}
}

// worker 是消费者，不断从通道中读取并处理事件
func (b *EventBus) worker(workerID int) {
	defer b.wg.Done()
	log.Printf("[EventBus] Worker %d started", workerID)

	for event := range b.eventChan {
		b.mu.RLock()
		if handlers, ok := b.handlers[event.Topic]; ok {
			// 在worker的goroutine内执行handler
			// 这限制了并发，避免了资源争抢
			for _, handler := range handlers {
				handler(event.Payload)
			}
		}
		b.mu.RUnlock()
	}
	log.Printf("[EventBus] Worker %d stopped", workerID)
}

// Subscribe 订阅一个事件
func (b *EventBus) Subscribe(topic Topic, handler Handler) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.handlers[topic] = append(b.handlers[topic], handler)
}

// Publish 发布一个事件
// 现在它是一个非阻塞操作，将事件发送到通道
func (b *EventBus) Publish(topic Topic, payload interface{}) {
	event := Event{Topic: topic, Payload: payload}

	// 使用非阻塞发送，确保Publish永远不会阻塞调用者（主流程）
	select {
	case b.eventChan <- event:
		// 事件成功放入通道
	default:
		// 如果通道已满，这是一个警告信号，说明后台处理不过来了
		log.Printf("[EventBus] WARN: Event channel is full. Dropping event for topic '%s'.", topic)
	}
}

// Shutdown 优雅地关闭事件总线
func (b *EventBus) Shutdown() {
	log.Println("[EventBus] Shutting down...")
	close(b.eventChan) // 关闭通道，这将使worker的range循环结束
	b.wg.Wait()        // 等待所有worker完成当前任务并退出
	log.Println("[EventBus] All workers have stopped.")
}
