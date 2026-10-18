/*
 * @Description: AutoEngine 降级路径测试
 * @Author: 安知鱼
 */
package engine

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/color"
	"io"
	"os/exec"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// stubEngine 用于精细控制每次 Process 的返回值。
type stubEngine struct {
	name    string
	inFmts  []string
	outFmts []string
	calls   []model.ImageStyleConfig
	handler func(style model.ImageStyleConfig) (string, error)
}

func (s *stubEngine) Name() string                      { return s.name }
func (s *stubEngine) SupportedInputFormats() []string   { return s.inFmts }
func (s *stubEngine) SupportedOutputFormats() []string  { return s.outFmts }
func (s *stubEngine) Process(ctx context.Context, src io.Reader, style model.ImageStyleConfig, dst io.Writer) (string, error) {
	s.calls = append(s.calls, style)
	return s.handler(style)
}

// drainReader 消费 src，避免因未读完源数据导致的测试资源泄漏。
func drainReader(src io.Reader) { _, _ = io.Copy(io.Discard, src) }

func TestAutoEngine_PrimarySuccess_NoFallback(t *testing.T) {
	primary := &stubEngine{
		name:    "primary",
		outFmts: []string{"jpg"},
		handler: func(style model.ImageStyleConfig) (string, error) {
			return "image/jpeg", nil
		},
	}
	fallback := &stubEngine{
		name:    "fallback",
		outFmts: []string{"jpg"},
		handler: func(style model.ImageStyleConfig) (string, error) {
			t.Fatalf("primary 成功时不应调 fallback")
			return "", nil
		},
	}
	auto := NewAutoEngineWith(primary, fallback, VipsCapability{})

	var out writerSink
	mime, err := auto.Process(context.Background(), readerOf("src"), model.ImageStyleConfig{Format: "jpg"}, &out)
	if err != nil {
		t.Fatalf("Process: %v", err)
	}
	if mime != "image/jpeg" {
		t.Errorf("mime 期望 image/jpeg，实际 %s", mime)
	}
	if len(primary.calls) != 1 || len(fallback.calls) != 0 {
		t.Errorf("primary 应被调 1 次，fallback 应为 0；实际 primary=%d fallback=%d",
			len(primary.calls), len(fallback.calls))
	}
}

func TestAutoEngine_FallbackOnFormatUnsupported_AvifToJpeg(t *testing.T) {
	primary := &stubEngine{
		name:    "primary",
		outFmts: []string{"jpg"},
		handler: func(style model.ImageStyleConfig) (string, error) {
			// primary 不支持 avif
			if style.Format == "avif" {
				return "", ErrFormatUnsupported
			}
			return "image/jpeg", nil
		},
	}
	fallback := &stubEngine{
		name:    "fallback",
		outFmts: []string{"jpg"},
		handler: func(style model.ImageStyleConfig) (string, error) {
			// fallback 支持 jpg
			if style.Format == "jpg" {
				return "image/jpeg", nil
			}
			return "", ErrFormatUnsupported
		},
	}
	auto := NewAutoEngineWith(primary, fallback, VipsCapability{})

	var out writerSink
	mime, err := auto.Process(context.Background(), readerOf("src"),
		model.ImageStyleConfig{Format: "avif", Quality: 80},
		&out)
	if err != nil {
		t.Fatalf("降级后不应失败，实际 err=%v", err)
	}
	if mime != "image/jpeg" {
		t.Errorf("降级后 mime 应为 image/jpeg，实际 %s", mime)
	}
	if len(primary.calls) != 1 {
		t.Errorf("primary 应被调 1 次，实际 %d", len(primary.calls))
	}
	if len(fallback.calls) != 1 {
		t.Fatalf("fallback 应被调 1 次（降级），实际 %d", len(fallback.calls))
	}
	if fallback.calls[0].Format != "jpg" {
		t.Errorf("降级后 format 应为 jpg，实际 %s", fallback.calls[0].Format)
	}
	if fallback.calls[0].Quality != 80 {
		t.Errorf("降级保留 quality=80，实际 %d", fallback.calls[0].Quality)
	}
}

func TestAutoEngine_FallbackOnFormatUnsupported_HeicToJpeg(t *testing.T) {
	primary := &stubEngine{
		outFmts: []string{"jpg"},
		handler: func(style model.ImageStyleConfig) (string, error) {
			return "", ErrFormatUnsupported
		},
	}
	fallback := &stubEngine{
		outFmts: []string{"jpg"},
		handler: func(style model.ImageStyleConfig) (string, error) {
			return "image/jpeg", nil
		},
	}
	auto := NewAutoEngineWith(primary, fallback, VipsCapability{})

	var out writerSink
	_, err := auto.Process(context.Background(), readerOf("src"),
		model.ImageStyleConfig{Format: "heic"},
		&out)
	if err != nil {
		t.Fatalf("降级后不应失败，实际 err=%v", err)
	}
	if fallback.calls[0].Format != "jpg" {
		t.Errorf("heic → jpg，实际 %s", fallback.calls[0].Format)
	}
}

func TestAutoEngine_FallbackOnFormatUnsupported_WebpToJpeg(t *testing.T) {
	primary := &stubEngine{
		handler: func(style model.ImageStyleConfig) (string, error) {
			return "", ErrFormatUnsupported
		},
	}
	fallback := &stubEngine{
		handler: func(style model.ImageStyleConfig) (string, error) {
			return "image/jpeg", nil
		},
	}
	auto := NewAutoEngineWith(primary, fallback, VipsCapability{})

	var out writerSink
	if _, err := auto.Process(context.Background(), readerOf("src"),
		model.ImageStyleConfig{Format: "webp"}, &out); err != nil {
		t.Fatalf("应当降级成功，实际 err=%v", err)
	}
	if fallback.calls[0].Format != "jpg" {
		t.Errorf("webp → jpg，实际 %s", fallback.calls[0].Format)
	}
}

func TestAutoEngine_NativeFallback_TransformsOnce(t *testing.T) {
	src := makeSolidJPEG(t, 80, 60, color.RGBA{10, 20, 30, 255})
	for _, format := range []string{"webp", "avif", "heic", "heif"} {
		t.Run(format, func(t *testing.T) {
			watermarker := &spyWatermarker{paint: &color.RGBA{255, 0, 0, 255}}
			auto := NewAutoEngine(VipsCapability{}, WithAutoWatermarker(watermarker))
			style := model.ImageStyleConfig{
				Format:    format,
				Quality:   80,
				Resize:    model.ImageResizeConfig{Mode: "cover", Width: 40, Height: 30},
				Watermark: &model.WatermarkConfig{Type: "text", Text: "watermark"},
			}
			var out bytes.Buffer
			mime, err := auto.Process(context.Background(), bytes.NewReader(src), style, &out)
			if err != nil {
				t.Fatalf("Process: %v", err)
			}
			if mime != "image/jpeg" {
				t.Errorf("mime = %q, want image/jpeg", mime)
			}
			cfg, decodedFormat, err := image.DecodeConfig(bytes.NewReader(out.Bytes()))
			if err != nil {
				t.Fatalf("解码输出失败: %v", err)
			}
			if decodedFormat != "jpeg" || cfg.Width != 40 || cfg.Height != 30 {
				t.Errorf("降级输出 = %s %dx%d, want jpeg 40x30", decodedFormat, cfg.Width, cfg.Height)
			}
			if watermarker.called != 1 {
				t.Errorf("降级应只做一次水印，实际 %d 次", watermarker.called)
			}
			if watermarker.lastWidth != 40 || watermarker.lastHeight != 30 || watermarker.lastCfg != style.Watermark {
				t.Errorf("降级水印应保留配置并在缩放后处理，实际 %+v", watermarker)
			}
		})
	}
}

func TestAutoEngine_JpegPngNotDegraded(t *testing.T) {
	// JPEG / PNG 不在降级表里；primary 返回 ErrFormatUnsupported 时直接返回该错误
	// （不再触发 fallback 的格式转换）
	primary := &stubEngine{
		handler: func(style model.ImageStyleConfig) (string, error) {
			return "", ErrFormatUnsupported
		},
	}
	fallback := &stubEngine{
		handler: func(style model.ImageStyleConfig) (string, error) {
			return "image/jpeg", nil
		},
	}
	auto := NewAutoEngineWith(primary, fallback, VipsCapability{})

	var out writerSink
	_, err := auto.Process(context.Background(), readerOf("src"),
		model.ImageStyleConfig{Format: "jpg"}, &out)
	if !errors.Is(err, ErrFormatUnsupported) {
		t.Errorf("jpg 不应触发降级；期望 ErrFormatUnsupported，实际 %v", err)
	}
	if len(fallback.calls) != 0 {
		t.Errorf("jpg 不应触发 fallback 调用；实际 %d 次", len(fallback.calls))
	}
}

func TestAutoEngine_PrimaryNonFormatError_NoFallback(t *testing.T) {
	customErr := errors.New("decode error")
	primary := &stubEngine{
		handler: func(style model.ImageStyleConfig) (string, error) {
			return "", customErr
		},
	}
	fallback := &stubEngine{
		handler: func(style model.ImageStyleConfig) (string, error) {
			t.Fatalf("非 ErrFormatUnsupported 错误不应降级")
			return "", nil
		},
	}
	auto := NewAutoEngineWith(primary, fallback, VipsCapability{})

	var out writerSink
	_, err := auto.Process(context.Background(), readerOf("src"),
		model.ImageStyleConfig{Format: "avif"}, &out)
	if !errors.Is(err, customErr) {
		t.Errorf("应透传原错误，实际 %v", err)
	}
}

func TestNewAutoEngine_DefaultsToNativeGo(t *testing.T) {
	auto := NewAutoEngine(VipsCapability{Available: false})
	if auto.Primary().Name() != "nativego" {
		t.Errorf("vips 不可用时 primary 应为 nativego，实际 %s", auto.Primary().Name())
	}
	if auto.Fallback().Name() != "nativego" {
		t.Errorf("fallback 应为 nativego，实际 %s", auto.Fallback().Name())
	}
}

func TestNewAutoEngine_PrefersVipsWhenAvailable(t *testing.T) {
	cap := VipsCapability{
		Available:     true,
		BinaryPath:    "/usr/local/bin/vips",
		Version:       "8.18.2",
		InputFormats:  []string{"jpeg", "png", "webp"},
		OutputFormats: []string{"jpeg", "png", "webp"},
	}
	auto := NewAutoEngine(cap)
	if auto.Primary().Name() != "vips" {
		t.Errorf("vips 可用时 primary 应为 vips，实际 %s", auto.Primary().Name())
	}
	if auto.Fallback().Name() != "nativego" {
		t.Errorf("fallback 应为 nativego 作为保底，实际 %s", auto.Fallback().Name())
	}
	if auto.Capability().BinaryPath != cap.BinaryPath {
		t.Errorf("Capability().BinaryPath 未透传，实际 %s", auto.Capability().BinaryPath)
	}
}

func TestNewAutoEngine_VipsUnavailableWithEmptyPath_FallsBackToNative(t *testing.T) {
	// Available=true 但 BinaryPath 为空属异常探测结果，保守走 native 避免 exec 空路径崩溃。
	auto := NewAutoEngine(VipsCapability{Available: true, BinaryPath: ""})
	if auto.Primary().Name() != "nativego" {
		t.Errorf("BinaryPath 为空时 primary 应退化为 nativego，实际 %s", auto.Primary().Name())
	}
}

// TestAutoEngine_EndToEnd_RoutesToVips 验证：当 vips 可用时，AutoEngine 确实把 JPEG→WebP
// 这种请求交给 vips 处理（若无 vips 则 skip）。
func TestAutoEngine_EndToEnd_RoutesToVips(t *testing.T) {
	if _, err := exec.LookPath("vips"); err != nil {
		t.Skip("vips not available in test env")
	}
	ResetProbeForTest()
	cap := Probe()
	if !cap.Available {
		t.Skip("vips probe unavailable in test env")
	}

	auto := NewAutoEngine(cap)
	if auto.Primary().Name() != "vips" {
		t.Fatalf("primary 应为 vips，实际 %s", auto.Primary().Name())
	}

	src := buildTestJPEG(t, 600, 400)
	style := model.ImageStyleConfig{
		Format:     "webp",
		Quality:    70,
		AutoRotate: true,
		Resize:     model.ImageResizeConfig{Mode: "contain", Width: 300, Height: 300},
	}
	var out bytes.Buffer
	mime, err := auto.Process(context.Background(), bytes.NewReader(src), style, &out)
	if err != nil {
		t.Fatalf("AutoEngine.Process: %v", err)
	}
	if mime != "image/webp" {
		t.Errorf("mime = %s, want image/webp", mime)
	}
	cfg, format := decodeImageConfig(t, out.Bytes())
	if format != "webp" {
		t.Errorf("format = %s, want webp", format)
	}
	// contain 模式 + 600x400 缩到最长 300 → 应为 300x200
	if cfg.Width != 300 || cfg.Height != 200 {
		t.Errorf("contain 300x300 on 600x400 应得 300x200，实际 %dx%d", cfg.Width, cfg.Height)
	}
}

// ---- 测试工具 ----

type writerSink struct{ buf []byte }

func (w *writerSink) Write(p []byte) (int, error) {
	w.buf = append(w.buf, p...)
	return len(p), nil
}

// readerOf 返回一个带预设字节流的 io.Reader；每次测试都创建新的 reader，避免 seek 污染。
func readerOf(s string) io.Reader {
	return &byteReader{src: []byte(s)}
}

type byteReader struct {
	src []byte
	pos int
}

func (b *byteReader) Read(p []byte) (int, error) {
	if b.pos >= len(b.src) {
		return 0, io.EOF
	}
	n := copy(p, b.src[b.pos:])
	b.pos += n
	return n, nil
}

var _ = drainReader // 抑制"未使用"提示；后续测试如果需要可直接引用
