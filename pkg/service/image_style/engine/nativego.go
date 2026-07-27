/*
 * @Description: 纯 Go 实现的图片处理引擎，无外部依赖
 * @Author: 安知鱼
 *
 * 支持：
 *   - 解码：JPEG / PNG / GIF（首帧）/ WebP
 *   - 编码：JPEG / PNG
 *   - 缩放：cover (imaging.Fill) / contain | fit-inside (imaging.Fit) / scale (imaging.Resize)
 *   - EXIF Orientation 自动矫正（1-8 完整支持）
 *
 * 不支持：AVIF / HEIC / WebP 编码 —— 遇到这些输出格式返回 ErrFormatUnsupported，
 * 由 AutoEngine 按 §6.3.3 降级表回落到 jpeg/png。
 */
package engine

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"image"
	"image/gif"
	"image/jpeg"
	"image/png"
	"io"

	"github.com/disintegration/imaging"
	exif "github.com/dsoprea/go-exif/v3"

	_ "image/gif"  // 注册 gif 解码器
	_ "image/jpeg" // 注册 jpeg 解码器
	_ "image/png"  // 注册 png 解码器

	_ "golang.org/x/image/webp" // 注册 webp 解码器（仅支持解码）

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// NativeGoEngine 是无外部命令依赖的 Go 实现。
// 作为 AutoEngine 的 fallback，保证在没有 vips 的环境中仍可处理 JPEG/PNG。
type NativeGoEngine struct {
	watermarker Watermarker
}

// NativeOption 配置 NativeGoEngine 的可选依赖。
type NativeOption func(*NativeGoEngine)

// WithNativeWatermarker 注入水印实现；为空时使用 NoopWatermarker。
func WithNativeWatermarker(wm Watermarker) NativeOption {
	return func(e *NativeGoEngine) {
		if wm != nil {
			e.watermarker = wm
		}
	}
}

// NewNativeGoEngine 构造一个 NativeGoEngine 实例（无状态，可并发复用）。
// 未传入 watermarker 时默认使用 NoopWatermarker，从而保持 Phase 1/2 行为不变。
func NewNativeGoEngine(opts ...NativeOption) *NativeGoEngine {
	e := &NativeGoEngine{watermarker: NoopWatermarker()}
	for _, opt := range opts {
		opt(e)
	}
	return e
}

// Name 返回引擎标识。
func (e *NativeGoEngine) Name() string { return "nativego" }

// SupportedInputFormats 列出可解码格式（与注册的 image.Decode 保持一致）。
func (e *NativeGoEngine) SupportedInputFormats() []string {
	return []string{"jpg", "jpeg", "png", "gif", "webp"}
}

// SupportedOutputFormats 列出可编码格式。注意纯 Go 实现不含 WebP/AVIF/HEIC 编码器。
func (e *NativeGoEngine) SupportedOutputFormats() []string {
	return []string{"jpg", "jpeg", "png"}
}

// Process 按 style 处理 src，结果写入 dst。
// 实现顺序：解码 → EXIF 旋转（可选）→ 尺寸调整 → 编码。
func (e *NativeGoEngine) Process(ctx context.Context, src io.Reader, style model.ImageStyleConfig, dst io.Writer) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}

	// 1. 将 src 读入内存（后续需要多次 seek：读 EXIF + 解码）
	buf, err := io.ReadAll(src)
	if err != nil {
		return "", fmt.Errorf("读取源图数据失败: %w", err)
	}
	if err := ctx.Err(); err != nil {
		return "", err
	}
	if len(buf) == 0 {
		return "", errors.New("源图为空")
	}

	// 2. 解码图片，获取原始格式字符串（便于 "original" 模式决定输出类型）
	img, inFormat, err := image.Decode(bytes.NewReader(buf))
	if err != nil {
		return "", fmt.Errorf("解码图片失败: %w", err)
	}
	if err := ctx.Err(); err != nil {
		return "", err
	}

	// 3. EXIF 自动旋转（仅 JPEG 典型含 EXIF；其他格式忽略）
	if style.AutoRotate {
		if orient, ok := readExifOrientation(buf); ok && orient != 1 {
			img = applyExifOrientation(img, orient)
		}
	}
	if err := ctx.Err(); err != nil {
		return "", err
	}

	// 4. 尺寸调整
	img = applyResize(img, style.Resize)
	if err := ctx.Err(); err != nil {
		return "", err
	}

	// 5. 水印叠加（Phase 3 Task 3.4）；nil 配置时跳过。
	if style.Watermark != nil && e.watermarker != nil {
		wmImg, werr := e.watermarker.Apply(img, style.Watermark)
		if werr != nil {
			return "", fmt.Errorf("水印叠加失败: %w", werr)
		}
		img = wmImg
	}
	if err := ctx.Err(); err != nil {
		return "", err
	}

	// 6. 决定输出格式
	outFormat := resolveOutputFormat(style.Format, inFormat)
	if !isOutputSupported(outFormat) {
		return "", ErrFormatUnsupported
	}

	// 7. 编码
	mime, err := encode(dst, img, outFormat, style.Quality)
	if err != nil {
		return "", fmt.Errorf("编码输出失败: %w", err)
	}
	if err := ctx.Err(); err != nil {
		return "", err
	}
	return mime, nil
}

// applyResize 根据 Resize 配置对图像做缩放处理。
// 未设置 Mode 或无意义参数时直接返回原图（不报错，保持尽力而为）。
func applyResize(img image.Image, rc model.ImageResizeConfig) image.Image {
	b := img.Bounds()
	srcW, srcH := b.Dx(), b.Dy()

	switch rc.Mode {
	case "cover":
		w, h := clampToSource(rc.Width, rc.Height, srcW, srcH, rc.Enlarge)
		if w <= 0 || h <= 0 {
			return img
		}
		return imaging.Fill(img, w, h, imaging.Center, imaging.Lanczos)

	case "contain", "fit-inside":
		w, h := clampToSource(rc.Width, rc.Height, srcW, srcH, rc.Enlarge)
		if w <= 0 && h <= 0 {
			return img
		}
		if w <= 0 {
			w = srcW
		}
		if h <= 0 {
			h = srcH
		}
		return imaging.Fit(img, w, h, imaging.Lanczos)

	case "scale":
		if rc.Scale <= 0 || rc.Scale > 1.0 && !rc.Enlarge {
			// 超出 1.0 且不允许放大 → 直接返回原图
			return img
		}
		w := int(float64(srcW) * rc.Scale)
		h := int(float64(srcH) * rc.Scale)
		if w <= 0 || h <= 0 {
			return img
		}
		return imaging.Resize(img, w, h, imaging.Lanczos)
	}

	// Mode 未设置或未识别：保持原样
	return img
}

// clampToSource 限制目标宽高不超过原图（除非明确允许放大）。
// 传入 0 表示该维度"自由"，按 aspect ratio 另一维计算。
func clampToSource(wantW, wantH, srcW, srcH int, enlarge bool) (int, int) {
	w, h := wantW, wantH
	if !enlarge {
		if w > srcW {
			w = srcW
		}
		if h > srcH {
			h = srcH
		}
	}
	return w, h
}

// resolveOutputFormat 按 style.Format 决定最终输出格式；空或 "original" 时跟随输入。
func resolveOutputFormat(requested, inputFormat string) string {
	if requested == "" || requested == "original" {
		return normalizeImageFormat(inputFormat)
	}
	return normalizeImageFormat(requested)
}

// normalizeImageFormat 将 Go image 库返回的格式字符串归一化为 "jpg"/"png"/"gif"/"webp"。
func normalizeImageFormat(f string) string {
	switch f {
	case "jpeg", "jpg":
		return "jpg"
	case "png":
		return "png"
	case "gif":
		return "gif"
	case "webp":
		return "webp"
	case "avif":
		return "avif"
	case "heic", "heif":
		return "heic"
	default:
		return f
	}
}

func isOutputSupported(f string) bool {
	return f == "jpg" || f == "jpeg" || f == "png"
}

// encode 按 outFormat 编码图像到 dst，返回 MIME 类型。
// Quality 仅对 JPEG 生效；0 = 最大压缩由 jpeg 库内部 clamp 处理。
func encode(dst io.Writer, img image.Image, outFormat string, quality int) (string, error) {
	switch outFormat {
	case "jpg", "jpeg":
		q := quality
		if q < 1 {
			q = 1
		}
		if q > 100 {
			q = 100
		}
		if err := jpeg.Encode(dst, img, &jpeg.Options{Quality: q}); err != nil {
			return "", err
		}
		return "image/jpeg", nil
	case "png":
		enc := &png.Encoder{CompressionLevel: png.DefaultCompression}
		if err := enc.Encode(dst, img); err != nil {
			return "", err
		}
		return "image/png", nil
	case "gif":
		if err := gif.Encode(dst, img, nil); err != nil {
			return "", err
		}
		return "image/gif", nil
	default:
		return "", ErrFormatUnsupported
	}
}

// readExifOrientation 从 JPEG 字节流中读取 EXIF Orientation 标签（tag 274）。
// 无 EXIF 或字段缺失时返回 (1, false)；存在则返回 (value, true)。
func readExifOrientation(data []byte) (int, bool) {
	exifData, err := exif.SearchAndExtractExifWithReader(bytes.NewReader(data))
	if err != nil {
		return 1, false
	}
	entries, _, err := exif.GetFlatExifData(exifData, nil)
	if err != nil {
		return 1, false
	}
	for _, e := range entries {
		if e.TagName != "Orientation" {
			continue
		}
		// Orientation 的 EXIF 值类型为 SHORT（[]uint16）
		if vs, ok := e.Value.([]uint16); ok && len(vs) > 0 {
			v := int(vs[0])
			if v >= 1 && v <= 8 {
				return v, true
			}
		}
	}
	return 1, false
}

// applyExifOrientation 按 EXIF Orientation (1-8) 返回矫正后的图像。
// 对应 Plan Task 3.2 的严格映射表（显示时应做的逆向变换）：
//
//	1: 原样
//	2: 水平翻转
//	3: 旋转 180°
//	4: 垂直翻转
//	5: Transpose（主对角线镜像，= Rotate90 + FlipH）
//	6: 顺时针 90° = imaging.Rotate270
//	7: Transverse（反对角线镜像，= Rotate90 + FlipV）
//	8: 逆时针 90° = imaging.Rotate90
//
// 对未知或越界值（<1 或 >8）按 "1 原样" 处理，保证总是返回可用图像。
func applyExifOrientation(img image.Image, orientation int) image.Image {
	switch orientation {
	case 1:
		return img
	case 2:
		return imaging.FlipH(img)
	case 3:
		return imaging.Rotate180(img)
	case 4:
		return imaging.FlipV(img)
	case 5:
		return imaging.Transpose(img)
	case 6:
		return imaging.Rotate270(img)
	case 7:
		return imaging.Transverse(img)
	case 8:
		return imaging.Rotate90(img)
	default:
		return img
	}
}

// 静态断言 NativeGoEngine 实现了 Engine 接口。
var _ Engine = (*NativeGoEngine)(nil)
