/*
 * @Description: 样式匹配决策树实现
 * @Author: 安知鱼
 *
 * 对应规范 §6.2：
 *     命名样式 > 动态参数 > 默认样式 > 自动压缩 > 不处理
 *
 * 动态参数映射表（§5.4）：
 *     w/width     -> resize.width
 *     h/height    -> resize.height
 *     fm/format   -> format
 *     q/quality   -> quality
 *     fit         -> resize.mode（cover/contain/inside/scale）
 *     s/scale     -> resize.scale
 *     rotate      -> auto_rotate（0/1）
 *
 * Phase 3（Task 3.1）：补全严格的合法性校验，非法值返回 ErrStyleProcessFailed。
 */
package image_style

import (
	"encoding/json"
	"fmt"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// 动态参数合法性边界常量（§5.4 + Plan Task 3.1）。
const (
	dynamicMinDimension = 0
	dynamicMaxDimension = 10000
	dynamicMinQuality   = 0
	dynamicMaxQuality   = 100
	dynamicMinScale     = 0.01
	dynamicMaxScale     = 1.0

	autoCompressDefaultQuality = 85
)

// 支持的输出格式白名单。实际能否输出由引擎决定，此处只过滤明显非法值。
var supportedDynamicFormats = map[string]struct{}{
	"jpg":  {},
	"jpeg": {},
	"png":  {},
	"webp": {},
	"avif": {},
	"heic": {},
	"heif": {},
	"gif":  {},
}

// 支持的 fit 模式白名单（规范化后）。
var supportedFitModes = map[string]struct{}{
	"cover":      {},
	"contain":    {},
	"fit-inside": {},
	"scale":      {},
}

var supportedAutoCompressFormats = map[string]struct{}{
	"original": {},
	"webp":     {},
	"avif":     {},
	"png":      {},
	"jpg":      {},
	"heic":     {},
}

// Match 根据策略配置 + URL 语义产出 ResolvedStyle，错误语义见 errors.go。
//   - filename：文件原始名（用于判定扩展名是否在处理白名单内）
//   - styleName：URL 分隔符后的命名样式；空串表示未显式指定
//   - query：原始 URL query（可能为 nil）
func Match(policy *model.StoragePolicy, filename, styleName string, query url.Values) (*ResolvedStyle, error) {
	if policy == nil {
		return nil, ErrStyleNotApplicable
	}

	process := parseImageProcess(policy)
	if !process.Enabled || len(process.ApplyToExtensions) == 0 {
		return nil, ErrStyleNotApplicable
	}

	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(filename), "."))
	if ext == "" || !containsString(process.ApplyToExtensions, ext) {
		return nil, ErrStyleNotApplicable
	}

	// 1. 命名样式显式请求（URL 带 !styleName）
	if styleName != "" {
		s, ok := findStyleByName(policy, styleName)
		if !ok {
			return nil, ErrStyleNotFound
		}
		resolved := styleToResolved(s)
		if err := applyQueryOverrides(&resolved, query); err != nil {
			return nil, err
		}
		return &resolved, nil
	}

	// 2. 纯动态参数请求（URL 带 ?w=... 等，但没有命名样式）
	if hasAnyDynamicOpt(query) {
		resolved := ResolvedStyle{
			// Phase 1 默认 JPEG / 质量 80 / 自动旋转 true；Phase 3 可由 DefaultThumbParam 等覆盖
			Format:     "jpg",
			Quality:    80,
			AutoRotate: true,
			Resize:     model.ImageResizeConfig{Mode: "cover"},
		}
		if err := applyQueryOverrides(&resolved, query); err != nil {
			return nil, err
		}
		return &resolved, nil
	}

	// 3. 默认样式
	if process.DefaultStyle != "" {
		s, ok := findStyleByName(policy, process.DefaultStyle)
		if !ok {
			// 默认样式配置了但未找到实体 → 视为不适用（不是 404）
			return nil, ErrStyleNotApplicable
		}
		resolved := styleToResolved(s)
		return &resolved, nil
	}

	// 4. 自动压缩：仅用于本地策略，并在无命名样式、无动态参数、
	// 无默认样式命中时启用。云策略继续使用 Provider 原生图片处理。
	if policy.Type == constant.PolicyTypeLocal &&
		process.AutoCompress != nil &&
		process.AutoCompress.Enabled {
		return autoCompressToResolved(process.AutoCompress)
	}

	return nil, ErrStyleNotApplicable
}

// parseImageProcess 从 policy.Settings 中解析 image_process 子段。
// 允许字段缺失，缺失时返回零值（等效未启用）。
func parseImageProcess(policy *model.StoragePolicy) model.ImageProcessConfig {
	var cfg model.ImageProcessConfig
	raw, ok := policy.Settings[constant.ImageProcessSettingsKey]
	if !ok || raw == nil {
		return cfg
	}
	if err := reencode(raw, &cfg); err != nil {
		return model.ImageProcessConfig{}
	}
	// 规范化扩展名：去点、转小写
	if len(cfg.ApplyToExtensions) > 0 {
		normalized := make([]string, 0, len(cfg.ApplyToExtensions))
		for _, ext := range cfg.ApplyToExtensions {
			ext = strings.ToLower(strings.TrimPrefix(strings.TrimSpace(ext), "."))
			if ext != "" {
				normalized = append(normalized, ext)
			}
		}
		cfg.ApplyToExtensions = normalized
	}
	return cfg
}

// parseImageStyles 从 policy.Settings 中解析 image_styles 列表。
func parseImageStyles(policy *model.StoragePolicy) []model.ImageStyleConfig {
	raw, ok := policy.Settings[constant.ImageStylesSettingsKey]
	if !ok || raw == nil {
		return nil
	}
	var styles []model.ImageStyleConfig
	if err := reencode(raw, &styles); err != nil {
		return nil
	}
	return styles
}

// findStyleByName 在策略样式列表中按名字查找，name 大小写敏感（与 URL 一致）。
func findStyleByName(policy *model.StoragePolicy, name string) (model.ImageStyleConfig, bool) {
	for _, s := range parseImageStyles(policy) {
		if s.Name == name {
			return s, true
		}
	}
	return model.ImageStyleConfig{}, false
}

// styleToResolved 将持久化的 ImageStyleConfig 转换为引擎可直接消费的 ResolvedStyle。
// 若 style.Watermark 非 nil，保留指针（不深拷贝内部字段，对热路径友好）。
func styleToResolved(s model.ImageStyleConfig) ResolvedStyle {
	return ResolvedStyle{
		Format:     s.Format,
		Quality:    s.Quality,
		AutoRotate: s.AutoRotate,
		Resize:     s.Resize,
		Watermark:  s.Watermark,
	}
}

func autoCompressToResolved(cfg *model.AutoCompressConfig) (*ResolvedStyle, error) {
	if cfg == nil || !cfg.Enabled {
		return nil, ErrStyleNotApplicable
	}

	format := strings.ToLower(strings.TrimSpace(cfg.Format))
	if format == "" {
		format = "original"
	}
	if _, ok := supportedAutoCompressFormats[format]; !ok {
		return nil, fmt.Errorf("%w: invalid auto_compress.format=%q", ErrStyleProcessFailed, cfg.Format)
	}

	quality := cfg.Quality
	if quality < dynamicMinQuality || quality > dynamicMaxQuality {
		return nil, fmt.Errorf("%w: invalid auto_compress.quality=%d", ErrStyleProcessFailed, cfg.Quality)
	}
	if quality == 0 {
		quality = autoCompressDefaultQuality
	}

	if cfg.MaxWidth < dynamicMinDimension || cfg.MaxWidth > dynamicMaxDimension {
		return nil, fmt.Errorf("%w: invalid auto_compress.max_width=%d", ErrStyleProcessFailed, cfg.MaxWidth)
	}
	if cfg.MaxHeight < dynamicMinDimension || cfg.MaxHeight > dynamicMaxDimension {
		return nil, fmt.Errorf("%w: invalid auto_compress.max_height=%d", ErrStyleProcessFailed, cfg.MaxHeight)
	}

	autoRotate := true
	if cfg.AutoRotate != nil {
		autoRotate = *cfg.AutoRotate
	}

	resolved := &ResolvedStyle{
		Format:     format,
		Quality:    quality,
		AutoRotate: autoRotate,
	}
	if cfg.MaxWidth > 0 || cfg.MaxHeight > 0 {
		resolved.Resize = model.ImageResizeConfig{
			Mode:   "fit-inside",
			Width:  cfg.MaxWidth,
			Height: cfg.MaxHeight,
		}
	}
	return resolved, nil
}

// hasAnyDynamicOpt 判定 query 是否包含至少一个被识别的图片处理参数。
func hasAnyDynamicOpt(query url.Values) bool {
	if len(query) == 0 {
		return false
	}
	keys := []string{"w", "width", "h", "height", "fm", "format", "q", "quality", "fit", "s", "scale", "rotate"}
	for _, k := range keys {
		if _, ok := query[k]; ok {
			return true
		}
	}
	return false
}

// applyQueryOverrides 按 Spec §5.4 的映射表对 ResolvedStyle 做就地覆盖。
// Phase 3（Task 3.1）：对每个参数做严格合法性校验，任一非法参数返回 ErrStyleProcessFailed
// 包装的 error，由上层转为 400/处理失败行为，避免静默丢弃让用户困惑。
func applyQueryOverrides(r *ResolvedStyle, query url.Values) error {
	if len(query) == 0 {
		return nil
	}

	if v := pickFirst(query, "fm", "format"); v != "" {
		fm := strings.ToLower(strings.TrimSpace(v))
		if _, ok := supportedDynamicFormats[fm]; !ok {
			return newDynamicParamErr("fm", v, "expect one of jpg/jpeg/png/webp/avif/heic/heif/gif")
		}
		r.Format = fm
	}

	if v := pickFirst(query, "q", "quality"); v != "" {
		q, err := strconv.Atoi(strings.TrimSpace(v))
		if err != nil || q < dynamicMinQuality || q > dynamicMaxQuality {
			return newDynamicParamErr("q", v,
				fmt.Sprintf("expect integer in [%d,%d]", dynamicMinQuality, dynamicMaxQuality))
		}
		r.Quality = q
	}

	if v := pickFirst(query, "w", "width"); v != "" {
		w, err := strconv.Atoi(strings.TrimSpace(v))
		if err != nil || w < dynamicMinDimension || w > dynamicMaxDimension {
			return newDynamicParamErr("w", v,
				fmt.Sprintf("expect integer in [%d,%d]", dynamicMinDimension, dynamicMaxDimension))
		}
		r.Resize.Width = w
	}

	if v := pickFirst(query, "h", "height"); v != "" {
		h, err := strconv.Atoi(strings.TrimSpace(v))
		if err != nil || h < dynamicMinDimension || h > dynamicMaxDimension {
			return newDynamicParamErr("h", v,
				fmt.Sprintf("expect integer in [%d,%d]", dynamicMinDimension, dynamicMaxDimension))
		}
		r.Resize.Height = h
	}

	if v := pickFirst(query, "fit"); v != "" {
		// 规范化别名：inside -> fit-inside
		mode := strings.ToLower(strings.TrimSpace(v))
		if mode == "inside" {
			mode = "fit-inside"
		}
		if _, ok := supportedFitModes[mode]; !ok {
			return newDynamicParamErr("fit", v,
				"expect one of cover/contain/inside/fit-inside/scale")
		}
		r.Resize.Mode = mode
	}

	if v := pickFirst(query, "s", "scale"); v != "" {
		s, err := strconv.ParseFloat(strings.TrimSpace(v), 64)
		if err != nil || s < dynamicMinScale || s > dynamicMaxScale {
			return newDynamicParamErr("s", v,
				fmt.Sprintf("expect float in [%.2f,%.2f]", dynamicMinScale, dynamicMaxScale))
		}
		r.Resize.Scale = s
		if r.Resize.Mode == "" {
			r.Resize.Mode = "scale"
		}
	}

	if v := pickFirst(query, "rotate"); v != "" {
		vv := strings.ToLower(strings.TrimSpace(v))
		switch vv {
		case "1", "true", "on", "yes":
			r.AutoRotate = true
		case "0", "false", "off", "no":
			r.AutoRotate = false
		default:
			return newDynamicParamErr("rotate", v, "expect 0/1 or true/false")
		}
	}

	return nil
}

// newDynamicParamErr 构造一个被 ErrStyleProcessFailed 包裹的参数校验错误，
// 便于 Handler 通过 errors.Is 统一识别。
func newDynamicParamErr(key, raw, hint string) error {
	return fmt.Errorf("%w: invalid query %q=%q (%s)", ErrStyleProcessFailed, key, raw, hint)
}

// pickFirst 从 query 中按给定 key 列表依次寻找，返回第一个非空字符串。
func pickFirst(query url.Values, keys ...string) string {
	for _, k := range keys {
		vs := query[k]
		if len(vs) > 0 && vs[0] != "" {
			return vs[0]
		}
	}
	return ""
}

func containsString(list []string, target string) bool {
	for _, s := range list {
		if s == target {
			return true
		}
	}
	return false
}

// reencode 把 Settings map 中的 interface{} 值借道 JSON 转换到目标结构体。
// Settings 底层是 map[string]any，可能来自 JSON 反序列化也可能来自代码构造，
// 统一走一次 json 序列化再反序列化最为稳妥。
func reencode(src any, dst any) error {
	b, err := json.Marshal(src)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, dst)
}
