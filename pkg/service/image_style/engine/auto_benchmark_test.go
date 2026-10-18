package engine

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/jpeg"
	"io"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// BenchmarkAutoEngine_NativeWebPFallback 覆盖无 vips 时 2MP JPEG 的 WebP→JPEG 降级。
func BenchmarkAutoEngine_NativeWebPFallback(b *testing.B) {
	img := image.NewRGBA(image.Rect(0, 0, 1920, 1080))
	for y := 0; y < 1080; y++ {
		for x := 0; x < 1920; x++ {
			img.SetRGBA(x, y, color.RGBA{R: uint8(x), G: uint8(y), B: uint8(x + y), A: 255})
		}
	}
	var src bytes.Buffer
	if err := jpeg.Encode(&src, img, &jpeg.Options{Quality: 90}); err != nil {
		b.Fatalf("encode fixture: %v", err)
	}
	raw := src.Bytes()
	auto := NewAutoEngine(VipsCapability{})
	style := model.ImageStyleConfig{
		Format:  "webp",
		Quality: 80,
		Resize:  model.ImageResizeConfig{Mode: "contain", Width: 960, Height: 540},
	}
	b.SetBytes(int64(len(raw)))
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := auto.Process(context.Background(), bytes.NewReader(raw), style, io.Discard); err != nil {
			b.Fatalf("Process: %v", err)
		}
	}
}
