/*
 * @Description: image_style 服务的内部类型定义
 * @Author: 安知鱼
 *
 * 这些类型只在 image_style 包内部以及与之直接交互的 handler / service 之间流转，
 * 不作为 HTTP API 的序列化 DTO。对外公开的持久化配置结构体位于 pkg/domain/model。
 */
package image_style

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// StyleRequest 描述一次样式请求的完整上下文。
// 由 handler 层解析 URL + 查询数据库后装配，传入 ImageStyleService.Process。
type StyleRequest struct {
	// Policy 文件所属的存储策略；内含 ImageProcessConfig / ImageStyles。
	Policy *model.StoragePolicy
	// File 文件本身（主要关心 ID / 名称 / 主存储实体），必填。
	File *model.File
	// Filename 原始文件名（可能与 File.Name 一致，也可能来自上传时的原始名）。
	// Matcher 判定扩展名时以此为准。
	Filename string
	// StyleName 从 URL 分离出的命名样式；为空字符串表示未显式指定。
	StyleName string
	// DynamicOpts 原始 URL query；可能为空。保留 url.Values 类型以便兼容多值参数。
	DynamicOpts url.Values
}

// StyleResult 是 ImageStyleService.Process 的成功结果，
// 调用方需要负责消费 Reader 并在消费完后调用 Close。
type StyleResult struct {
	// ContentType 输出 MIME 类型，如 "image/webp"。
	ContentType string
	// Reader 指向处理后的图片字节流（内存缓冲或磁盘文件）。
	Reader io.ReadCloser
	// Size 处理后的字节大小。
	Size int64
	// FromCache 是否命中磁盘缓存（未命中时由引擎实时处理）。
	FromCache bool
	// StyleHash ResolvedStyle 与当前原图版本共同生成的稳定 hash，也作为 ETag 响应头。
	StyleHash string
	// LastModified 缓存产物的创建时间；同一产物的后续命中保持不变。
	LastModified time.Time
	// RequestedFormat 是样式配置（或动态参数）中用户原始请求的输出格式，
	// 如 "webp" / "avif" / "jpg" / "original" / ""。Handler 层会把它与实际
	// ContentType 对比，若不一致写入 `X-Style-Fallback: requested->actual` 响应头
	// 便于客户端与运维排查格式降级（Spec §6.3.3）。
	// 为空或 "original" 表示"无显式格式要求"，不触发降级头。
	RequestedFormat string
}

// ResolvedStyle 是 Matcher 经过命名样式/动态参数/默认样式合并后得到的最终处理参数。
// 此结构体不会被持久化，仅作为引擎入参与缓存键计算输入。
// 字段顺序严格按照 JSON tag 序列化，用于 Hash() 计算。
type ResolvedStyle struct {
	Format     string                  `json:"format"`
	Quality    int                     `json:"quality"`
	AutoRotate bool                    `json:"auto_rotate"`
	Resize     model.ImageResizeConfig `json:"resize"`
	Watermark  *model.WatermarkConfig  `json:"watermark,omitempty"`
}

// Hash 返回 ResolvedStyle 的稳定基础哈希（sha256 前 16 位 hex）。
// Process 会再追加原图版本摘要，生成缓存文件名、HTTP ETag 与 singleflight key。
//
// 稳定性来源：
//   - encoding/json 默认按字段定义顺序输出，结构体内字段顺序固定。
//   - map 类型不会出现在 ResolvedStyle 中（避免随机顺序问题）。
//   - omitempty 仅对 Watermark 生效，nil 与 &{} 产生的 JSON 不同 -> hash 不同。
func (r ResolvedStyle) Hash() string {
	b, err := json.Marshal(&r)
	if err != nil {
		// 在实际运行中几乎不会发生：结构体字段均为基础类型或嵌套结构体。
		// 为避免 panic 影响热路径，退化到带错误标记的空值 hash，方便排查。
		sum := sha256.Sum256([]byte("image_style/marshal_error"))
		return hex.EncodeToString(sum[:8])
	}
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:8])
}

// versionedStyleHash 将原图物理版本纳入派生图身份。
//
// 文件内容覆盖会保留逻辑 File.ID，但会创建新的 PrimaryEntityID。若缓存和 ETag
// 只使用样式 hash，覆盖后仍会命中旧派生图。这里保留样式 hash 作为前缀，追加
// 物理版本摘要，既能自动失效旧缓存，也能让按样式清理匹配同一家族的所有版本。
func versionedStyleHash(styleHash string, file *model.File) string {
	identity := sourceVersionIdentity(file)
	if identity == "" {
		return styleHash
	}
	sum := sha256.Sum256([]byte(identity))
	return styleHash + "-" + hex.EncodeToString(sum[:8])
}

// sourceVersionIdentity 按可信度选择稳定的原图版本标识。
// 生产读取路径通常具备 PrimaryEntityID；其余字段仅用于兼容旧数据和测试夹具。
func sourceVersionIdentity(file *model.File) string {
	if file == nil {
		return ""
	}
	if file.PrimaryEntityID.Valid && file.PrimaryEntityID.Uint64 > 0 {
		return "entity:" + strconv.FormatUint(file.PrimaryEntityID.Uint64, 10)
	}
	if entity := file.PrimaryEntity; entity != nil {
		if entity.ID > 0 {
			return "entity:" + strconv.FormatUint(uint64(entity.ID), 10)
		}
		if entity.Etag.Valid {
			if etag := strings.TrimSpace(entity.Etag.String); etag != "" {
				return "etag:" + etag
			}
		}
		if !entity.UpdatedAt.IsZero() {
			return "entity_updated:" + strconv.FormatInt(entity.UpdatedAt.UnixNano(), 10)
		}
	}
	if !file.UpdatedAt.IsZero() {
		return "updated:" + strconv.FormatInt(file.UpdatedAt.UnixNano(), 10)
	}
	if entity := file.PrimaryEntity; entity != nil && entity.Source.Valid {
		if source := strings.TrimSpace(entity.Source.String); source != "" {
			return "source:" + source
		}
	}
	return ""
}

// CacheStats 描述单个策略的缓存统计信息。
// 管理员 API / 启动日志会以此为 DTO 直接返回。
//
// 说明：HitCount / MissCount 是进程级全局计数，目前并未按策略分维度统计；
// 在 ListAllStats 场景下它会对所有策略返回相同值，仅 Count / TotalSize
// 是真正的 per-policy 数据。为避免误用，两字段另提供 per-policy 口径的
// 别名（当前保持 0）。未来如果 DiskCache 引入 per-policy 命中计数器，
// 可以把 PolicyHitCount / PolicyMissCount 作为真正的 per-policy 值填入。
type CacheStats struct {
	PolicyID  uint  `json:"policy_id"`
	TotalSize int64 `json:"total_size"` // 字节（per-policy）
	Count     int   `json:"count"`      // 条目数（per-policy）
	// HitCount / MissCount 为进程级全局累计值；ListAllStats 下每条记录都相同。
	// 建议仅作"整体命中率"展示，不要在策略维度对比。
	HitCount  int64 `json:"hit_count"`
	MissCount int64 `json:"miss_count"`
	// PolicyHitCount / PolicyMissCount 预留 per-policy 命中计数位。
	// 当前版本没有按策略维度的计数器，统一返回 0；未来接入后直接填入即可，
	// 前端可以优先展示这两个字段（非 0 时），回退到 HitCount / MissCount。
	PolicyHitCount  int64 `json:"policy_hit_count"`
	PolicyMissCount int64 `json:"policy_miss_count"`
}

// PreviewResult 是 ImageStyleService.Preview 的响应 DTO。
// 仅用于管理员后台的"样式预览"功能，返回处理后字节与 MIME。
// 不走磁盘缓存，避免污染生产缓存目录。
type PreviewResult struct {
	ContentType string `json:"content_type"`
	Data        []byte `json:"-"` // handler 层直接写响应体，不走 JSON
}

// WarmProgress 描述一次异步预热任务的进度快照。
// 字段全部可 JSON 序列化，便于前端轮询展示。
// Status 取值：
//   - "pending"    任务已创建，尚未开始
//   - "running"    正在处理
//   - "done"       已完成（Processed+Failed==Total）
//   - "failed"     致命错误提前终止（例如样式不存在）
//   - "cancelled"  被调用方取消
type WarmProgress struct {
	TaskID     string    `json:"task_id"`
	PolicyID   uint      `json:"policy_id"`
	StyleName  string    `json:"style_name"`
	Status     string    `json:"status"`
	Total      int       `json:"total"`
	Processed  int       `json:"processed"`
	Failed     int       `json:"failed"`
	StartedAt  time.Time `json:"started_at"`
	FinishedAt time.Time `json:"finished_at,omitempty"`
	LastError  string    `json:"last_error,omitempty"`
}
