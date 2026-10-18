/*
 * @Description: 纯 Go 引擎测试
 * @Author: 安知鱼
 */
package engine

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// makeSolidJPEG 构造一张指定大小的纯色 JPEG 字节流，用于测试解码 + 处理流程。
func makeSolidJPEG(t *testing.T, w, h int, c color.Color) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, c)
		}
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatalf("encode jpeg: %v", err)
	}
	return buf.Bytes()
}

func makeSolidPNG(t *testing.T, w, h int, c color.Color) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, c)
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("encode png: %v", err)
	}
	return buf.Bytes()
}

func TestNativeGoEngine_Name(t *testing.T) {
	e := NewNativeGoEngine()
	if e.Name() != "nativego" {
		t.Errorf("Name 期望 nativego，实际 %s", e.Name())
	}
}

func TestNativeGoEngine_SupportedFormats(t *testing.T) {
	e := NewNativeGoEngine()
	in := e.SupportedInputFormats()
	out := e.SupportedOutputFormats()

	mustHave := func(list []string, v string) {
		for _, x := range list {
			if x == v {
				return
			}
		}
		t.Errorf("期望格式列表含 %s，实际 %v", v, list)
	}
	for _, ext := range []string{"jpg", "jpeg", "png", "gif", "webp"} {
		mustHave(in, ext)
	}
	for _, ext := range []string{"jpg", "jpeg", "png"} {
		mustHave(out, ext)
	}
}

func TestNativeGoEngine_CoverResize_JPEG_To_JPEG(t *testing.T) {
	e := NewNativeGoEngine()
	src := makeSolidJPEG(t, 800, 600, color.RGBA{255, 128, 64, 255})

	style := model.ImageStyleConfig{
		Format:  "jpg",
		Quality: 80,
		Resize:  model.ImageResizeConfig{Mode: "cover", Width: 400, Height: 300},
	}
	var out bytes.Buffer
	mime, err := e.Process(context.Background(), bytes.NewReader(src), style, &out)
	if err != nil {
		t.Fatalf("Process: %v", err)
	}
	if mime != "image/jpeg" {
		t.Errorf("mime 期望 image/jpeg，实际 %s", mime)
	}

	// 解码输出 JPEG 验证尺寸
	got, err := jpeg.Decode(bytes.NewReader(out.Bytes()))
	if err != nil {
		t.Fatalf("解码输出失败：%v", err)
	}
	b := got.Bounds()
	if b.Dx() != 400 || b.Dy() != 300 {
		t.Errorf("输出尺寸期望 400x300，实际 %dx%d", b.Dx(), b.Dy())
	}
}

func TestNativeGoEngine_ContainResize_PNG_To_PNG(t *testing.T) {
	e := NewNativeGoEngine()
	src := makeSolidPNG(t, 1000, 500, color.RGBA{0, 200, 0, 255})

	style := model.ImageStyleConfig{
		Format: "png",
		Resize: model.ImageResizeConfig{Mode: "contain", Width: 400, Height: 400},
	}
	var out bytes.Buffer
	mime, err := e.Process(context.Background(), bytes.NewReader(src), style, &out)
	if err != nil {
		t.Fatalf("Process: %v", err)
	}
	if mime != "image/png" {
		t.Errorf("mime 期望 image/png，实际 %s", mime)
	}

	got, err := png.Decode(bytes.NewReader(out.Bytes()))
	if err != nil {
		t.Fatalf("解码输出失败：%v", err)
	}
	b := got.Bounds()
	// contain 模式下两边都不超过目标边界，且保持宽高比
	if b.Dx() > 400 || b.Dy() > 400 {
		t.Errorf("contain 输出超出目标边界：%dx%d", b.Dx(), b.Dy())
	}
	if b.Dx() != 400 {
		// 原图比例 1000x500=2:1，contain 到 400x400 应是 400x200
		t.Errorf("contain 输出尺寸不符合预期：%dx%d（期望 400x200）", b.Dx(), b.Dy())
	}
}

func TestNativeGoEngine_ScaleMode(t *testing.T) {
	e := NewNativeGoEngine()
	src := makeSolidJPEG(t, 800, 600, color.RGBA{10, 20, 30, 255})

	style := model.ImageStyleConfig{
		Format:  "jpg",
		Quality: 80,
		Resize:  model.ImageResizeConfig{Mode: "scale", Scale: 0.5},
	}
	var out bytes.Buffer
	if _, err := e.Process(context.Background(), bytes.NewReader(src), style, &out); err != nil {
		t.Fatalf("Process: %v", err)
	}

	got, err := jpeg.Decode(bytes.NewReader(out.Bytes()))
	if err != nil {
		t.Fatalf("解码输出失败：%v", err)
	}
	b := got.Bounds()
	if b.Dx() != 400 || b.Dy() != 300 {
		t.Errorf("scale=0.5 的输出应为 400x300，实际 %dx%d", b.Dx(), b.Dy())
	}
}

func TestNativeGoEngine_OriginalFormat_KeepsInputType(t *testing.T) {
	e := NewNativeGoEngine()
	src := makeSolidPNG(t, 200, 200, color.RGBA{1, 2, 3, 255})

	style := model.ImageStyleConfig{
		Format: "original",
		Resize: model.ImageResizeConfig{Mode: "cover", Width: 100, Height: 100},
	}
	var out bytes.Buffer
	mime, err := e.Process(context.Background(), bytes.NewReader(src), style, &out)
	if err != nil {
		t.Fatalf("Process: %v", err)
	}
	if mime != "image/png" {
		t.Errorf("original 模式下应保持 PNG 输入类型，实际 mime=%s", mime)
	}
	if _, err := png.Decode(bytes.NewReader(out.Bytes())); err != nil {
		t.Errorf("输出应为 PNG，解码失败：%v", err)
	}
}

func TestNativeGoEngine_InputDependentFormat_KeepsInputType(t *testing.T) {
	for _, format := range []string{"", "original"} {
		for _, input := range []struct {
			name string
			mime string
			data []byte
		}{
			{"jpeg", "image/jpeg", makeSolidJPEG(t, 40, 20, color.RGBA{10, 20, 30, 255})},
			{"png", "image/png", makeSolidPNG(t, 40, 20, color.RGBA{10, 20, 30, 255})},
		} {
			t.Run(format+"/"+input.name, func(t *testing.T) {
				var out bytes.Buffer
				mime, err := NewNativeGoEngine().Process(context.Background(), bytes.NewReader(input.data),
					model.ImageStyleConfig{Format: format, Quality: 80}, &out)
				if err != nil {
					t.Fatalf("Process: %v", err)
				}
				if mime != input.mime {
					t.Errorf("mime = %q, want %q", mime, input.mime)
				}
				cfg, decodedFormat, err := image.DecodeConfig(bytes.NewReader(out.Bytes()))
				if err != nil {
					t.Fatalf("解码输出失败: %v", err)
				}
				if decodedFormat != input.name || cfg.Width != 40 || cfg.Height != 20 {
					t.Errorf("输出 = %s %dx%d, want %s 40x20", decodedFormat, cfg.Width, cfg.Height, input.name)
				}
			})
		}
	}
}

func TestNativeGoEngine_UnsupportedOutputFormat_DoesNotConsumeSource(t *testing.T) {
	data := makeSolidJPEG(t, 40, 20, color.RGBA{10, 20, 30, 255})
	for _, format := range []string{"webp", "avif", "heic", "heif", "gif"} {
		t.Run(format, func(t *testing.T) {
			src := bytes.NewReader(data)
			var out bytes.Buffer
			_, err := NewNativeGoEngine().Process(context.Background(), src,
				model.ImageStyleConfig{Format: format}, &out)
			if !errors.Is(err, ErrFormatUnsupported) {
				t.Fatalf("err = %v, want ErrFormatUnsupported", err)
			}
			if src.Len() != len(data) {
				t.Errorf("不支持格式不应消费源数据，实际读取 %d 字节", len(data)-src.Len())
			}
			if out.Len() != 0 {
				t.Errorf("不支持格式不应写输出，实际 %d 字节", out.Len())
			}
		})
	}
}

func TestNativeGoEngine_CancelledBeforeProcess_TakesPrecedenceOverFormat(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	src := bytes.NewReader([]byte("unread source"))
	var out bytes.Buffer
	_, err := NewNativeGoEngine().Process(ctx, src, model.ImageStyleConfig{Format: "webp"}, &out)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v, want context.Canceled", err)
	}
	if src.Len() != len("unread source") || out.Len() != 0 {
		t.Error("已取消任务不应读源数据或写输出")
	}
}

func TestNativeGoEngine_UnsupportedOutputFormat_ReturnsErr(t *testing.T) {
	e := NewNativeGoEngine()
	src := makeSolidJPEG(t, 100, 100, color.RGBA{0, 0, 0, 255})

	style := model.ImageStyleConfig{
		Format: "avif",
		Resize: model.ImageResizeConfig{Mode: "cover", Width: 50, Height: 50},
	}
	var out bytes.Buffer
	_, err := e.Process(context.Background(), bytes.NewReader(src), style, &out)
	if !errors.Is(err, ErrFormatUnsupported) {
		t.Errorf("期望 ErrFormatUnsupported，实际 %v", err)
	}
}

func TestNativeGoEngine_EnlargeDefault_DoesNotExceedSource(t *testing.T) {
	e := NewNativeGoEngine()
	src := makeSolidJPEG(t, 200, 200, color.RGBA{50, 50, 50, 255})

	// 未开启 Enlarge，目标 400x400 应被限制到 200x200
	style := model.ImageStyleConfig{
		Format: "jpg", Quality: 80,
		Resize: model.ImageResizeConfig{Mode: "cover", Width: 400, Height: 400, Enlarge: false},
	}
	var out bytes.Buffer
	if _, err := e.Process(context.Background(), bytes.NewReader(src), style, &out); err != nil {
		t.Fatalf("Process: %v", err)
	}
	got, _ := jpeg.Decode(bytes.NewReader(out.Bytes()))
	b := got.Bounds()
	if b.Dx() > 200 || b.Dy() > 200 {
		t.Errorf("enlarge=false 不应放大超过原图；实际 %dx%d", b.Dx(), b.Dy())
	}
}

// TestApplyExifOrientation 直接覆盖每种 Orientation 值（1-8）的像素变换正确性。
// 使用 3x2 彩色矩阵：(红 绿 蓝) / (黄 紫 青) — 每个像素独立颜色便于判定旋转结果。
func TestApplyExifOrientation(t *testing.T) {
	// 生成源图像：3x2，左上红 右上绿 右下青 左下黄
	src := image.NewRGBA(image.Rect(0, 0, 3, 2))
	// row 0: 红(0,0), 绿(1,0), 蓝(2,0)
	src.Set(0, 0, color.RGBA{255, 0, 0, 255})
	src.Set(1, 0, color.RGBA{0, 255, 0, 255})
	src.Set(2, 0, color.RGBA{0, 0, 255, 255})
	// row 1: 黄(0,1), 紫(1,1), 青(2,1)
	src.Set(0, 1, color.RGBA{255, 255, 0, 255})
	src.Set(1, 1, color.RGBA{255, 0, 255, 255})
	src.Set(2, 1, color.RGBA{0, 255, 255, 255})

	cases := []struct {
		name        string
		orientation int
		// expectedSize 处理后的宽高
		expectedW, expectedH int
		// checkPixel 验证 (x,y) 位置的颜色应该等于原图 (srcX,srcY) 的颜色
		checkX, checkY   int
		srcX, srcY       int
	}{
		{"Orientation=1 原样", 1, 3, 2, 0, 0, 0, 0},
		{"Orientation=2 水平翻转", 2, 3, 2, 0, 0, 2, 0}, // 输出(0,0) = 原(2,0) 蓝
		{"Orientation=3 旋转 180", 3, 3, 2, 0, 0, 2, 1}, // 输出(0,0) = 原(2,1) 青
		{"Orientation=4 垂直翻转", 4, 3, 2, 0, 0, 0, 1},   // 输出(0,0) = 原(0,1) 黄
		// 5-8 涉及 90 度旋转，输出尺寸会变为 2x3
		{"Orientation=5 Transpose", 5, 2, 3, 0, 0, 0, 0},       // 输出(0,0) = 原(0,0) 红
		{"Orientation=6 顺时针 90", 6, 2, 3, 0, 0, 0, 1},           // 输出(0,0) = 原(0,1) 黄
		{"Orientation=7 Transverse", 7, 2, 3, 0, 0, 2, 1},      // 输出(0,0) = 原(2,1) 青
		{"Orientation=8 逆时针 90", 8, 2, 3, 0, 0, 2, 0},           // 输出(0,0) = 原(2,0) 蓝
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := applyExifOrientation(src, c.orientation)
			b := got.Bounds()
			if b.Dx() != c.expectedW || b.Dy() != c.expectedH {
				t.Errorf("尺寸错误：期望 %dx%d，实际 %dx%d", c.expectedW, c.expectedH, b.Dx(), b.Dy())
				return
			}
			expected := src.At(c.srcX, c.srcY)
			actual := got.At(b.Min.X+c.checkX, b.Min.Y+c.checkY)
			er, eg, eb, ea := expected.RGBA()
			ar, ag, ab, aa := actual.RGBA()
			if er != ar || eg != ag || eb != ab || ea != aa {
				t.Errorf("像素不匹配 (expected=%v actual=%v)", expected, actual)
			}
		})
	}
}

func TestNativeGoEngine_AutoRotate_NoEXIF_Unchanged(t *testing.T) {
	// 无 EXIF 的 JPEG，auto_rotate=true 不应改变方向
	e := NewNativeGoEngine()
	src := makeSolidJPEG(t, 400, 200, color.RGBA{100, 100, 100, 255})

	style := model.ImageStyleConfig{
		Format: "jpg", Quality: 80, AutoRotate: true,
		Resize: model.ImageResizeConfig{Mode: "cover", Width: 400, Height: 200},
	}
	var out bytes.Buffer
	if _, err := e.Process(context.Background(), bytes.NewReader(src), style, &out); err != nil {
		t.Fatalf("Process: %v", err)
	}
	got, _ := jpeg.Decode(bytes.NewReader(out.Bytes()))
	b := got.Bounds()
	if b.Dx() != 400 || b.Dy() != 200 {
		t.Errorf("无 EXIF 时 AutoRotate 不应改变方向；实际 %dx%d", b.Dx(), b.Dy())
	}
}

// makeJPEGWithOrientation 构造一张左红右蓝的 JPEG 并手工插入 EXIF APP1 段设置 Orientation。
// 不依赖 testdata 文件，测试自包含；覆盖 Plan Task 3.2.3 的端到端链路。
func makeJPEGWithOrientation(t *testing.T, w, h int, orientation uint16) []byte {
	t.Helper()

	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w/2; x++ {
			img.Set(x, y, color.RGBA{255, 0, 0, 255}) // left half red
		}
		for x := w / 2; x < w; x++ {
			img.Set(x, y, color.RGBA{0, 0, 255, 255}) // right half blue
		}
	}
	var jpegBuf bytes.Buffer
	if err := jpeg.Encode(&jpegBuf, img, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatalf("encode jpeg: %v", err)
	}
	original := jpegBuf.Bytes()

	// 构造 EXIF payload：
	//   "Exif\0\0" + TIFF header(II, magic=42, IFD0=@8) + IFD0(count=1 + entry + nextOffset=0)
	var exif bytes.Buffer
	exif.WriteString("Exif\x00\x00")
	exif.WriteString("II")
	binary.Write(&exif, binary.LittleEndian, uint16(42))
	binary.Write(&exif, binary.LittleEndian, uint32(8))
	binary.Write(&exif, binary.LittleEndian, uint16(1))      // 1 entry
	binary.Write(&exif, binary.LittleEndian, uint16(0x0112)) // Orientation tag
	binary.Write(&exif, binary.LittleEndian, uint16(3))      // SHORT
	binary.Write(&exif, binary.LittleEndian, uint32(1))      // count
	// SHORT 只占 2 字节，但 value_offset 字段固定 4 字节
	binary.Write(&exif, binary.LittleEndian, orientation)
	exif.Write([]byte{0, 0})
	binary.Write(&exif, binary.LittleEndian, uint32(0)) // 下一个 IFD 偏移
	exifBytes := exif.Bytes()

	// APP1 segment = FFE1 + len(16bit BE, 含自身 2 字节) + payload
	var app1 bytes.Buffer
	app1.Write([]byte{0xFF, 0xE1})
	binary.Write(&app1, binary.BigEndian, uint16(len(exifBytes)+2))
	app1.Write(exifBytes)

	// 插入到 SOI (FFD8) 之后
	var out bytes.Buffer
	out.Write(original[:2])
	out.Write(app1.Bytes())
	out.Write(original[2:])
	return out.Bytes()
}

// TestReadExifOrientation_ExtractsFromJPEG 验证 readExifOrientation 能读取手工嵌入的 EXIF。
func TestReadExifOrientation_ExtractsFromJPEG(t *testing.T) {
	for _, orient := range []uint16{1, 2, 3, 4, 5, 6, 7, 8} {
		data := makeJPEGWithOrientation(t, 40, 20, orient)
		got, ok := readExifOrientation(data)
		if !ok {
			t.Errorf("Orientation=%d 应能被读出，实际未找到", orient)
			continue
		}
		if got != int(orient) {
			t.Errorf("Orientation=%d 读取错误：实际 %d", orient, got)
		}
	}
}

// TestNativeGoEngine_AutoRotate_Orientation6_EndToEnd 端到端测试：
// 手工嵌入 Orientation=6 的 JPEG → AutoRotate=true → 期望尺寸从 100x50 → 50x100。
// 同时关闭任何 resize 操作，以便观察纯旋转效果。
func TestNativeGoEngine_AutoRotate_Orientation6_EndToEnd(t *testing.T) {
	e := NewNativeGoEngine()
	src := makeJPEGWithOrientation(t, 100, 50, 6)

	style := model.ImageStyleConfig{
		Format:     "jpg",
		Quality:    90,
		AutoRotate: true,
		// 不进行 resize，只测 EXIF 旋转
		Resize: model.ImageResizeConfig{},
	}
	var out bytes.Buffer
	if _, err := e.Process(context.Background(), bytes.NewReader(src), style, &out); err != nil {
		t.Fatalf("Process: %v", err)
	}
	got, err := jpeg.Decode(bytes.NewReader(out.Bytes()))
	if err != nil {
		t.Fatalf("解码输出失败：%v", err)
	}
	b := got.Bounds()
	if b.Dx() != 50 || b.Dy() != 100 {
		t.Errorf("Orientation=6 + AutoRotate 应将 100x50 旋转为 50x100，实际 %dx%d", b.Dx(), b.Dy())
	}

	// 验证方向：原图左红右蓝，CW 90° 后顶部应为红色，底部应为蓝色。
	// 取顶部偏中 (25,5) 应为红；底部偏中 (25,95) 应为蓝。
	topR, topG, topB, _ := got.At(25, 5).RGBA()
	botR, botG, botB, _ := got.At(25, 95).RGBA()
	// JPEG 有损压缩导致颜色略偏，允许通道范围校验
	if !(topR > 40000 && topG < 10000 && topB < 10000) {
		t.Errorf("顶部应接近红色，实际 RGB=(%d,%d,%d)", topR>>8, topG>>8, topB>>8)
	}
	if !(botB > 40000 && botR < 10000 && botG < 10000) {
		t.Errorf("底部应接近蓝色，实际 RGB=(%d,%d,%d)", botR>>8, botG>>8, botB>>8)
	}
}

// spyWatermarker 记录 Apply 调用次数与入参快照，用于验证 engine 的集成调用。
type spyWatermarker struct {
	called     int
	lastWidth  int
	lastHeight int
	lastCfg    *model.WatermarkConfig
	// 若非 nil，Apply 时在源图中央写入该颜色以便观察效果
	paint *color.RGBA
}

func (s *spyWatermarker) Apply(img image.Image, cfg *model.WatermarkConfig) (image.Image, error) {
	s.called++
	b := img.Bounds()
	s.lastWidth = b.Dx()
	s.lastHeight = b.Dy()
	s.lastCfg = cfg
	if s.paint == nil {
		return img, nil
	}
	rgba := image.NewRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
	for y := 0; y < b.Dy(); y++ {
		for x := 0; x < b.Dx(); x++ {
			rgba.Set(x, y, img.At(b.Min.X+x, b.Min.Y+y))
		}
	}
	rgba.Set(b.Dx()/2, b.Dy()/2, *s.paint)
	return rgba, nil
}

// TestNativeGoEngine_Watermark_Applied 验证 Process 在 style.Watermark != nil 时调用 watermarker。
// 断言：1) spy 的 Apply 被调用 1 次；2) 水印作用在 resize 之后（尺寸匹配目标尺寸而非源尺寸）。
func TestNativeGoEngine_Watermark_Applied(t *testing.T) {
	spy := &spyWatermarker{paint: &color.RGBA{255, 0, 0, 255}}
	e := NewNativeGoEngine(WithNativeWatermarker(spy))

	src := makeSolidPNG(t, 400, 400, color.RGBA{10, 10, 10, 255})
	style := model.ImageStyleConfig{
		Format:    "png",
		Resize:    model.ImageResizeConfig{Mode: "cover", Width: 200, Height: 200},
		Watermark: &model.WatermarkConfig{Type: "text", Text: "© 2026"},
	}
	var out bytes.Buffer
	if _, err := e.Process(context.Background(), bytes.NewReader(src), style, &out); err != nil {
		t.Fatalf("Process: %v", err)
	}
	if spy.called != 1 {
		t.Errorf("Watermarker 应被调用 1 次，实际 %d", spy.called)
	}
	if spy.lastWidth != 200 || spy.lastHeight != 200 {
		t.Errorf("Watermarker 应收到 resize 后的 200x200 图像，实际 %dx%d", spy.lastWidth, spy.lastHeight)
	}
	if spy.lastCfg == nil || spy.lastCfg.Text != "© 2026" {
		t.Errorf("Watermarker 应收到原始 cfg，实际 %+v", spy.lastCfg)
	}
}

// TestNativeGoEngine_Watermark_SkippedWhenNil 验证未配置水印时不调用 watermarker。
func TestNativeGoEngine_Watermark_SkippedWhenNil(t *testing.T) {
	spy := &spyWatermarker{}
	e := NewNativeGoEngine(WithNativeWatermarker(spy))

	src := makeSolidJPEG(t, 100, 100, color.RGBA{50, 50, 50, 255})
	style := model.ImageStyleConfig{
		Format: "jpg", Quality: 80,
		Resize: model.ImageResizeConfig{Mode: "cover", Width: 50, Height: 50},
	}
	var out bytes.Buffer
	if _, err := e.Process(context.Background(), bytes.NewReader(src), style, &out); err != nil {
		t.Fatalf("Process: %v", err)
	}
	if spy.called != 0 {
		t.Errorf("Watermark=nil 时不应调用 watermarker，实际 %d", spy.called)
	}
}

// TestNativeGoEngine_AutoRotate_Disabled_Orientation6 当 auto_rotate=false 时不应旋转，
// 尺寸保持原样 100x50。
func TestNativeGoEngine_AutoRotate_Disabled_Orientation6(t *testing.T) {
	e := NewNativeGoEngine()
	src := makeJPEGWithOrientation(t, 100, 50, 6)

	style := model.ImageStyleConfig{
		Format:     "jpg",
		Quality:    90,
		AutoRotate: false,
		Resize:     model.ImageResizeConfig{},
	}
	var out bytes.Buffer
	if _, err := e.Process(context.Background(), bytes.NewReader(src), style, &out); err != nil {
		t.Fatalf("Process: %v", err)
	}
	got, _ := jpeg.Decode(bytes.NewReader(out.Bytes()))
	b := got.Bounds()
	if b.Dx() != 100 || b.Dy() != 50 {
		t.Errorf("auto_rotate=false 时应保持 100x50，实际 %dx%d", b.Dx(), b.Dy())
	}
}
