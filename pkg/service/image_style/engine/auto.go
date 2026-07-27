/*
 * @Description: AutoEngine 根据 vips 可用性选择 primary 引擎，并在格式不支持时降级
 * @Author: 安知鱼
 *
 * 对应 Spec §6.3.3 降级表：
 *   avif / heic / webp  →  jpg
 *   jpeg / png          →  不降级（primary 失败即最终失败）
 *
 * Phase 2（Task 2.3）：
 *   - cap.Available == true  → primary = VipsEngine，fallback = NativeGoEngine
 *   - cap.Available == false → primary = fallback = NativeGoEngine（相当于无降级通道）
 * 这样做的语义：
 *   - 有 vips 时优先用 vips，vips 如果因编译时没 libheif 之类导致 avif 报
 *     ErrFormatUnsupported，AutoEngine 会把 format 降到 jpg 再走 native，保底可用。
 *   - 无 vips 时原生就只能处理 jpg/png；用户配了 webp → native 拒绝 → AutoEngine
 *     把 format 降到 jpg 再走自己，实现了"优雅降级"。
 */
package engine

import (
	"bytes"
	"context"
	"errors"
	"io"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// AutoEngine 组合 primary / fallback 两个引擎实现"能用就用、不能用就降级"。
type AutoEngine struct {
	primary    Engine
	fallback   Engine
	capability VipsCapability
}

// AutoOption 配置 AutoEngine 构造时的可选能力（如水印实现）。
type AutoOption func(*autoConfig)

type autoConfig struct {
	watermarker Watermarker
}

// WithAutoWatermarker 将水印实现同时注入 AutoEngine 内部的 primary / fallback 引擎。
// 为空时各引擎默认使用 NoopWatermarker。
func WithAutoWatermarker(wm Watermarker) AutoOption {
	return func(c *autoConfig) {
		c.watermarker = wm
	}
}

// NewAutoEngine 按 vips 可用性构造 AutoEngine。
//
// Phase 2 Task 2.3：
//   - cap.Available == true  → primary = VipsEngine，fallback = NativeGoEngine。
//   - cap.Available == false → primary 与 fallback 均为 NativeGoEngine（不降级）。
//
// Phase 3 Task 3.4：通过 AutoOption 可注入 Watermarker，传递给 primary 与 fallback。
//
// 注意：cap 通常由 Probe() 提供；测试可使用 NewAutoEngineWith 精细注入。
func NewAutoEngine(cap VipsCapability, opts ...AutoOption) *AutoEngine {
	cfg := &autoConfig{}
	for _, opt := range opts {
		opt(cfg)
	}
	nativeOpts := []NativeOption{}
	vipsOpts := []VipsOption{}
	if cfg.watermarker != nil {
		nativeOpts = append(nativeOpts, WithNativeWatermarker(cfg.watermarker))
		vipsOpts = append(vipsOpts, WithVipsWatermarker(cfg.watermarker))
	}

	native := NewNativeGoEngine(nativeOpts...)
	if cap.Available && cap.BinaryPath != "" {
		return &AutoEngine{
			primary:    NewVipsEngine(cap, vipsOpts...),
			fallback:   native,
			capability: cap,
		}
	}
	return &AutoEngine{
		primary:    native,
		fallback:   native,
		capability: cap,
	}
}

// NewAutoEngineWith 显式注入 primary/fallback，供测试使用。
func NewAutoEngineWith(primary, fallback Engine, cap VipsCapability) *AutoEngine {
	return &AutoEngine{
		primary:    primary,
		fallback:   fallback,
		capability: cap,
	}
}

// Primary 返回主引擎（便于诊断日志与测试断言）。
func (a *AutoEngine) Primary() Engine { return a.primary }

// Fallback 返回降级引擎。
func (a *AutoEngine) Fallback() Engine { return a.fallback }

// Capability 返回启动时探测到的 vips 能力快照。
func (a *AutoEngine) Capability() VipsCapability { return a.capability }

// Name 返回聚合型引擎名称。
func (a *AutoEngine) Name() string { return "auto(" + a.primary.Name() + "/" + a.fallback.Name() + ")" }

// SupportedInputFormats 返回两引擎并集（primary 视作更强）。
func (a *AutoEngine) SupportedInputFormats() []string {
	return unionStrings(a.primary.SupportedInputFormats(), a.fallback.SupportedInputFormats())
}

// SupportedOutputFormats 返回两引擎并集；降级后 fallback 能写出的格式也算支持。
func (a *AutoEngine) SupportedOutputFormats() []string {
	return unionStrings(a.primary.SupportedOutputFormats(), a.fallback.SupportedOutputFormats())
}

// Process 先 primary，若返回 ErrFormatUnsupported 且格式可降级 → fallback。
// 其他错误直接透传；fallback 自身失败则返回 fallback 的错误。
//
// 实现注意：由于 src 可能是一次性 Reader（已被 primary 消耗），这里先把 src 读到内存，
// 降级时重新构造 *bytes.Reader。
func (a *AutoEngine) Process(ctx context.Context, src io.Reader, style model.ImageStyleConfig, dst io.Writer) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	raw, err := io.ReadAll(src)
	if err != nil {
		return "", err
	}
	if err := ctx.Err(); err != nil {
		return "", err
	}
	if len(raw) == 0 {
		return "", errors.New("源图为空")
	}

	// 1. 第一次尝试：primary + 原始 style
	mime, err := a.primary.Process(ctx, bytes.NewReader(raw), style, dst)
	if err == nil {
		return mime, nil
	}

	// 2. 非格式错误直接透传
	if !errors.Is(err, ErrFormatUnsupported) {
		return "", err
	}

	// 3. 判断是否在降级表中
	fallbackFormat, ok := degradeFormat(style.Format)
	if !ok {
		// JPEG/PNG 不降级；返回原错误
		return "", err
	}

	// 4. 用 fallback 引擎 + 降级格式重试
	degraded := style
	degraded.Format = fallbackFormat
	if err := ctx.Err(); err != nil {
		return "", err
	}
	return a.fallback.Process(ctx, bytes.NewReader(raw), degraded, dst)
}

// degradeFormat 按 Spec §6.3.3 给出替代格式；未命中表时返回 ("", false)。
func degradeFormat(requested string) (string, bool) {
	switch requested {
	case "avif", "heic", "heif", "webp":
		return "jpg", true
	default:
		return "", false
	}
}

// unionStrings 返回两个字符串切片的并集，保持首个切片中元素的先后顺序。
func unionStrings(a, b []string) []string {
	seen := make(map[string]struct{}, len(a)+len(b))
	result := make([]string, 0, len(a)+len(b))
	for _, x := range a {
		if _, ok := seen[x]; ok {
			continue
		}
		seen[x] = struct{}{}
		result = append(result, x)
	}
	for _, x := range b {
		if _, ok := seen[x]; ok {
			continue
		}
		seen[x] = struct{}{}
		result = append(result, x)
	}
	return result
}

// 静态断言 AutoEngine 实现了 Engine 接口。
var _ Engine = (*AutoEngine)(nil)
