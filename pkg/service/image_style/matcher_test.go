/*
 * @Description: Matcher 决策树测试
 * @Author: 安知鱼
 */
package image_style

import (
	"errors"
	"net/url"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// buildPolicyWithStyles 构造一个启用图片处理的存储策略，挂载给定的样式列表。
func buildPolicyWithStyles(enabled bool, exts []string, defaultStyle string, styles ...model.ImageStyleConfig) *model.StoragePolicy {
	processRaw := map[string]any{
		"enabled":             enabled,
		"apply_to_extensions": exts,
		"default_style":       defaultStyle,
	}
	stylesRaw := make([]any, 0, len(styles))
	for _, s := range styles {
		stylesRaw = append(stylesRaw, map[string]any{
			"name":        s.Name,
			"format":      s.Format,
			"quality":     s.Quality,
			"auto_rotate": s.AutoRotate,
			"resize": map[string]any{
				"mode":    s.Resize.Mode,
				"width":   s.Resize.Width,
				"height":  s.Resize.Height,
				"scale":   s.Resize.Scale,
				"enlarge": s.Resize.Enlarge,
			},
		})
	}
	return &model.StoragePolicy{
		Type: constant.PolicyTypeLocal,
		Settings: model.StoragePolicySettings{
			constant.ImageProcessSettingsKey: processRaw,
			constant.ImageStylesSettingsKey:  stylesRaw,
		},
	}
}

func buildPolicyWithProcessRaw(processRaw map[string]any, styles ...model.ImageStyleConfig) *model.StoragePolicy {
	stylesRaw := make([]any, 0, len(styles))
	for _, s := range styles {
		stylesRaw = append(stylesRaw, map[string]any{
			"name":        s.Name,
			"format":      s.Format,
			"quality":     s.Quality,
			"auto_rotate": s.AutoRotate,
			"resize": map[string]any{
				"mode":    s.Resize.Mode,
				"width":   s.Resize.Width,
				"height":  s.Resize.Height,
				"scale":   s.Resize.Scale,
				"enlarge": s.Resize.Enlarge,
			},
		})
	}
	return &model.StoragePolicy{
		Type: constant.PolicyTypeLocal,
		Settings: model.StoragePolicySettings{
			constant.ImageProcessSettingsKey: processRaw,
			constant.ImageStylesSettingsKey:  stylesRaw,
		},
	}
}

func sampleThumbnail() model.ImageStyleConfig {
	return model.ImageStyleConfig{
		Name:       "thumbnail",
		Format:     "jpg",
		Quality:    60,
		AutoRotate: true,
		Resize:     model.ImageResizeConfig{Mode: "cover", Width: 400, Height: 300},
	}
}

func sampleLarge() model.ImageStyleConfig {
	return model.ImageStyleConfig{
		Name:       "large",
		Format:     "webp",
		Quality:    85,
		AutoRotate: true,
		Resize:     model.ImageResizeConfig{Mode: "contain", Width: 1600, Height: 1200},
	}
}

func TestMatch_EnabledFalse_ReturnsNotApplicable(t *testing.T) {
	policy := buildPolicyWithStyles(false, []string{"jpg", "png"}, "thumbnail", sampleThumbnail())
	_, err := Match(policy, "a.jpg", "", nil)
	if !errors.Is(err, ErrStyleNotApplicable) {
		t.Errorf("期望 ErrStyleNotApplicable，实际 %v", err)
	}
}

func TestMatch_ExtensionNotAllowed_ReturnsNotApplicable(t *testing.T) {
	policy := buildPolicyWithStyles(true, []string{"jpg"}, "thumbnail", sampleThumbnail())
	_, err := Match(policy, "a.png", "", nil)
	if !errors.Is(err, ErrStyleNotApplicable) {
		t.Errorf("期望 ErrStyleNotApplicable（png 不在白名单），实际 %v", err)
	}

	// 大小写不敏感 + 带点写法也可匹配
	_, err = Match(policy, "a.JPG", "", url.Values{"w": []string{"200"}})
	if err != nil {
		t.Errorf("JPG 大写应当匹配成功（大小写不敏感），实际 %v", err)
	}
}

func TestMatch_NamedStyle_HitReturnsResolved(t *testing.T) {
	policy := buildPolicyWithStyles(true, []string{"jpg"}, "", sampleThumbnail())
	got, err := Match(policy, "a.jpg", "thumbnail", nil)
	if err != nil {
		t.Fatalf("未期望错误：%v", err)
	}
	if got.Format != "jpg" || got.Quality != 60 {
		t.Errorf("命名样式未完整载入，实际 %+v", got)
	}
	if got.Resize.Mode != "cover" || got.Resize.Width != 400 || got.Resize.Height != 300 {
		t.Errorf("Resize 字段未正确载入，实际 %+v", got.Resize)
	}
	if !got.AutoRotate {
		t.Errorf("AutoRotate 期望 true")
	}
}

func TestMatch_NamedStyle_NotFound_ReturnsErr(t *testing.T) {
	policy := buildPolicyWithStyles(true, []string{"jpg"}, "", sampleThumbnail())
	_, err := Match(policy, "a.jpg", "not-exist", nil)
	if !errors.Is(err, ErrStyleNotFound) {
		t.Errorf("期望 ErrStyleNotFound，实际 %v", err)
	}
}

func TestMatch_DynamicOnly_BuildsFromQuery(t *testing.T) {
	policy := buildPolicyWithStyles(true, []string{"jpg"}, "", sampleThumbnail())
	q := url.Values{
		"w":      []string{"500"},
		"h":      []string{"500"},
		"fit":    []string{"cover"},
		"fm":     []string{"webp"},
		"q":      []string{"70"},
		"rotate": []string{"1"},
	}
	got, err := Match(policy, "a.jpg", "", q)
	if err != nil {
		t.Fatalf("未期望错误：%v", err)
	}
	if got.Format != "webp" || got.Quality != 70 {
		t.Errorf("动态参数未正确覆盖 format/quality：%+v", got)
	}
	if got.Resize.Mode != "cover" || got.Resize.Width != 500 || got.Resize.Height != 500 {
		t.Errorf("动态参数未正确转换为 Resize：%+v", got.Resize)
	}
	if !got.AutoRotate {
		t.Errorf("rotate=1 应映射为 AutoRotate=true，实际 %+v", got)
	}
}

func TestMatch_DefaultStyle_UsedWhenNoneSpecified(t *testing.T) {
	policy := buildPolicyWithStyles(true, []string{"jpg"}, "thumbnail", sampleThumbnail(), sampleLarge())
	got, err := Match(policy, "a.jpg", "", nil)
	if err != nil {
		t.Fatalf("未期望错误：%v", err)
	}
	if got.Format != "jpg" || got.Quality != 60 {
		t.Errorf("默认样式 thumbnail 未被使用，实际 %+v", got)
	}
}

func TestMatch_AutoCompress_UsedWhenNoStyleQueryOrDefault(t *testing.T) {
	policy := buildPolicyWithProcessRaw(map[string]any{
		"enabled":             true,
		"apply_to_extensions": []string{"jpg"},
		"default_style":       "",
		"auto_compress": map[string]any{
			"enabled":     true,
			"format":      "webp",
			"quality":     72,
			"max_width":   1200,
			"auto_rotate": false,
		},
	})

	got, err := Match(policy, "a.jpg", "", nil)
	if err != nil {
		t.Fatalf("未期望错误：%v", err)
	}
	if got.Format != "webp" || got.Quality != 72 {
		t.Errorf("自动压缩 format/quality 未生效，实际 %+v", got)
	}
	if got.Resize.Mode != "fit-inside" || got.Resize.Width != 1200 || got.Resize.Height != 0 {
		t.Errorf("自动压缩尺寸未生效，实际 %+v", got.Resize)
	}
	if got.AutoRotate {
		t.Errorf("auto_rotate=false 应被保留，实际 %+v", got)
	}
}

func TestMatch_AutoCompress_IgnoredForCloudPolicy(t *testing.T) {
	policy := buildPolicyWithProcessRaw(map[string]any{
		"enabled":             true,
		"apply_to_extensions": []string{"jpg"},
		"default_style":       "",
		"auto_compress": map[string]any{
			"enabled": true,
			"format":  "webp",
			"quality": 72,
		},
	})
	policy.Type = constant.PolicyTypeAliOSS

	_, err := Match(policy, "a.jpg", "", nil)
	if !errors.Is(err, ErrStyleNotApplicable) {
		t.Fatalf("云策略应继续使用 Provider 原生处理，自动压缩必须不适用，实际 %v", err)
	}
}

func TestMatch_DefaultStyle_TrumpsAutoCompress(t *testing.T) {
	policy := buildPolicyWithProcessRaw(map[string]any{
		"enabled":             true,
		"apply_to_extensions": []string{"jpg"},
		"default_style":       "thumbnail",
		"auto_compress": map[string]any{
			"enabled": true,
			"format":  "webp",
			"quality": 72,
		},
	}, sampleThumbnail())

	got, err := Match(policy, "a.jpg", "", nil)
	if err != nil {
		t.Fatalf("未期望错误：%v", err)
	}
	if got.Format != "jpg" || got.Quality != 60 {
		t.Errorf("默认样式应优先于自动压缩，实际 %+v", got)
	}
}

func TestMatch_AutoCompressInvalidFormat_ReturnsProcessFailed(t *testing.T) {
	policy := buildPolicyWithProcessRaw(map[string]any{
		"enabled":             true,
		"apply_to_extensions": []string{"jpg"},
		"auto_compress": map[string]any{
			"enabled": true,
			"format":  "bmp",
		},
	})

	_, err := Match(policy, "a.jpg", "", nil)
	if !errors.Is(err, ErrStyleProcessFailed) {
		t.Errorf("非法自动压缩 format 应返回 ErrStyleProcessFailed，实际 %v", err)
	}
}

func TestMatch_NoStyleNoQueryNoDefault_ReturnsNotApplicable(t *testing.T) {
	policy := buildPolicyWithStyles(true, []string{"jpg"}, "", sampleThumbnail())
	_, err := Match(policy, "a.jpg", "", nil)
	if !errors.Is(err, ErrStyleNotApplicable) {
		t.Errorf("没有默认样式且无 query 时应返回 ErrStyleNotApplicable，实际 %v", err)
	}
}

func TestMatch_NamedStyleWithQueryOverrides(t *testing.T) {
	policy := buildPolicyWithStyles(true, []string{"jpg"}, "", sampleThumbnail())
	// 命名样式 thumbnail 原配置 jpg/60/400x300，query 覆盖 width 800 + format webp
	q := url.Values{"w": []string{"800"}, "fm": []string{"webp"}}
	got, err := Match(policy, "a.jpg", "thumbnail", q)
	if err != nil {
		t.Fatalf("未期望错误：%v", err)
	}
	if got.Format != "webp" {
		t.Errorf("format 未被 query 覆盖，期望 webp 实际 %s", got.Format)
	}
	if got.Resize.Width != 800 {
		t.Errorf("width 未被 query 覆盖，期望 800 实际 %d", got.Resize.Width)
	}
	// 其他字段（quality/height/mode）应保留命名样式原值
	if got.Quality != 60 || got.Resize.Height != 300 || got.Resize.Mode != "cover" {
		t.Errorf("未被覆盖的字段应保留命名样式原值，实际 %+v / %+v", got, got.Resize)
	}
}

func TestMatch_NamedStyle_TrumpsDefault(t *testing.T) {
	// 默认样式是 thumbnail，但 URL 指定了 large，应以 large 为准
	policy := buildPolicyWithStyles(true, []string{"jpg"}, "thumbnail", sampleThumbnail(), sampleLarge())
	got, err := Match(policy, "a.jpg", "large", nil)
	if err != nil {
		t.Fatalf("未期望错误：%v", err)
	}
	if got.Format != "webp" || got.Resize.Width != 1600 {
		t.Errorf("应返回 large 样式，实际 %+v", got)
	}
}

func TestMatch_ScaleMode_FromQuery(t *testing.T) {
	policy := buildPolicyWithStyles(true, []string{"jpg"}, "", sampleThumbnail())
	q := url.Values{"s": []string{"0.5"}, "fit": []string{"scale"}}
	got, err := Match(policy, "a.jpg", "", q)
	if err != nil {
		t.Fatalf("未期望错误：%v", err)
	}
	if got.Resize.Mode != "scale" || got.Resize.Scale != 0.5 {
		t.Errorf("scale 参数未正确应用，实际 %+v", got.Resize)
	}
}

func TestMatch_EmptyApplyToExtensions_SameAsDisabled(t *testing.T) {
	policy := buildPolicyWithStyles(true, []string{}, "thumbnail", sampleThumbnail())
	_, err := Match(policy, "a.jpg", "", nil)
	if !errors.Is(err, ErrStyleNotApplicable) {
		t.Errorf("apply_to_extensions 为空时应 NotApplicable，实际 %v", err)
	}
}

// TestMatch_DynamicFullMapping 覆盖 Spec §5.4 所有 key 与别名的完整映射。
func TestMatch_DynamicFullMapping(t *testing.T) {
	policy := buildPolicyWithStyles(true, []string{"jpg"}, "", sampleThumbnail())

	cases := []struct {
		name   string
		query  url.Values
		assert func(t *testing.T, got *ResolvedStyle)
	}{
		{
			name:  "width_alias",
			query: url.Values{"width": []string{"320"}},
			assert: func(t *testing.T, got *ResolvedStyle) {
				if got.Resize.Width != 320 {
					t.Errorf("width 未生效，实际 %d", got.Resize.Width)
				}
			},
		},
		{
			name:  "height_alias",
			query: url.Values{"height": []string{"240"}},
			assert: func(t *testing.T, got *ResolvedStyle) {
				if got.Resize.Height != 240 {
					t.Errorf("height 未生效，实际 %d", got.Resize.Height)
				}
			},
		},
		{
			name:  "format_alias",
			query: url.Values{"format": []string{"PNG"}},
			assert: func(t *testing.T, got *ResolvedStyle) {
				if got.Format != "png" {
					t.Errorf("format 别名未生效，实际 %s", got.Format)
				}
			},
		},
		{
			name:  "quality_alias",
			query: url.Values{"quality": []string{"55"}},
			assert: func(t *testing.T, got *ResolvedStyle) {
				if got.Quality != 55 {
					t.Errorf("quality 别名未生效，实际 %d", got.Quality)
				}
			},
		},
		{
			name:  "fit_inside_alias",
			query: url.Values{"w": []string{"100"}, "fit": []string{"inside"}},
			assert: func(t *testing.T, got *ResolvedStyle) {
				if got.Resize.Mode != "fit-inside" {
					t.Errorf("fit=inside 应规范化为 fit-inside，实际 %s", got.Resize.Mode)
				}
			},
		},
		{
			name:  "scale_alias",
			query: url.Values{"scale": []string{"0.25"}, "fit": []string{"scale"}},
			assert: func(t *testing.T, got *ResolvedStyle) {
				if got.Resize.Scale != 0.25 {
					t.Errorf("scale 别名未生效，实际 %f", got.Resize.Scale)
				}
			},
		},
		{
			name:  "rotate_false",
			query: url.Values{"w": []string{"100"}, "rotate": []string{"0"}},
			assert: func(t *testing.T, got *ResolvedStyle) {
				if got.AutoRotate {
					t.Errorf("rotate=0 应禁用 auto rotate")
				}
			},
		},
		{
			name:  "rotate_true_bool",
			query: url.Values{"w": []string{"100"}, "rotate": []string{"true"}},
			assert: func(t *testing.T, got *ResolvedStyle) {
				if !got.AutoRotate {
					t.Errorf("rotate=true 应启用 auto rotate")
				}
			},
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := Match(policy, "a.jpg", "", c.query)
			if err != nil {
				t.Fatalf("未期望错误：%v", err)
			}
			c.assert(t, got)
		})
	}
}

// TestMatch_DynamicInvalidParam_ReturnsProcessFailed 校验非法参数返回 ErrStyleProcessFailed。
// 覆盖 quality / scale / dimension / format / fit / rotate 的边界与非法值。
func TestMatch_DynamicInvalidParam_ReturnsProcessFailed(t *testing.T) {
	policy := buildPolicyWithStyles(true, []string{"jpg"}, "", sampleThumbnail())

	cases := []struct {
		name  string
		query url.Values
	}{
		{"quality_negative", url.Values{"q": []string{"-1"}}},
		{"quality_over_100", url.Values{"q": []string{"101"}}},
		{"quality_not_int", url.Values{"q": []string{"abc"}}},
		{"width_negative", url.Values{"w": []string{"-1"}}},
		{"width_too_big", url.Values{"w": []string{"100000"}}},
		{"height_not_int", url.Values{"h": []string{"3.14"}}},
		{"scale_zero", url.Values{"s": []string{"0"}}},
		{"scale_over_one", url.Values{"s": []string{"1.5"}}},
		{"scale_not_num", url.Values{"s": []string{"abc"}}},
		{"format_invalid", url.Values{"fm": []string{"bmp"}}},
		{"fit_invalid", url.Values{"fit": []string{"stretch"}}},
		{"rotate_invalid", url.Values{"rotate": []string{"maybe"}}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := Match(policy, "a.jpg", "", c.query)
			if !errors.Is(err, ErrStyleProcessFailed) {
				t.Errorf("期望 ErrStyleProcessFailed，实际 err=%v got=%+v", err, got)
			}
		})
	}
}

// TestMatch_DynamicValidBoundary 校验严格边界值（恰好合法）不会被误杀。
func TestMatch_DynamicValidBoundary(t *testing.T) {
	policy := buildPolicyWithStyles(true, []string{"jpg"}, "", sampleThumbnail())

	cases := []struct {
		name  string
		query url.Values
	}{
		{"quality_zero", url.Values{"q": []string{"0"}}},
		{"quality_100", url.Values{"q": []string{"100"}}},
		{"scale_min", url.Values{"s": []string{"0.01"}, "fit": []string{"scale"}}},
		{"scale_max", url.Values{"s": []string{"1.0"}, "fit": []string{"scale"}}},
		{"width_zero", url.Values{"w": []string{"0"}}},
		{"width_max", url.Values{"w": []string{"10000"}}},
		{"format_webp", url.Values{"fm": []string{"webp"}}},
		{"format_avif", url.Values{"fm": []string{"avif"}}},
		{"fit_cover", url.Values{"w": []string{"1"}, "fit": []string{"cover"}}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, err := Match(policy, "a.jpg", "", c.query); err != nil {
				t.Errorf("合法边界值应通过校验，实际 %v", err)
			}
		})
	}
}

// TestMatch_NamedStyleWithInvalidQuery_ErrorsOut 确保命名样式分支也执行严格校验。
func TestMatch_NamedStyleWithInvalidQuery_ErrorsOut(t *testing.T) {
	policy := buildPolicyWithStyles(true, []string{"jpg"}, "", sampleThumbnail())
	q := url.Values{"q": []string{"999"}}
	_, err := Match(policy, "a.jpg", "thumbnail", q)
	if !errors.Is(err, ErrStyleProcessFailed) {
		t.Errorf("命名样式 + 非法 query 应返回 ErrStyleProcessFailed，实际 %v", err)
	}
}
