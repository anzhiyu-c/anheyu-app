package image_style

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// FieldError 描述图片样式配置的字段级校验错误。
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// Error 让 FieldError 可直接作为 error 使用。
func (e FieldError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

// ValidationErrors 聚合多个字段错误。
type ValidationErrors struct {
	Errors []FieldError `json:"errors"`
}

// Error 让 ValidationErrors 实现 error 接口。
func (v ValidationErrors) Error() string {
	if len(v.Errors) == 0 {
		return "validation passed"
	}
	msgs := make([]string, 0, len(v.Errors))
	for _, e := range v.Errors {
		msgs = append(msgs, e.Error())
	}
	return strings.Join(msgs, "; ")
}

// Has 是否包含任何错误。
func (v *ValidationErrors) Has() bool {
	return v != nil && len(v.Errors) > 0
}

var (
	configNameRegex = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,32}$`)

	validConfigFormats = map[string]struct{}{
		"original": {}, "webp": {}, "avif": {}, "png": {}, "jpg": {}, "heic": {},
	}
	validConfigResizeModes = map[string]struct{}{
		"cover": {}, "contain": {}, "fit-inside": {}, "scale": {},
	}
	validConfigWatermarkTypes = map[string]struct{}{
		"text": {}, "image": {},
	}
	validConfigWatermarkPositions = map[string]struct{}{
		"top-left": {}, "top-right": {}, "bottom-left": {}, "bottom-right": {},
		"center": {}, "tile": {},
	}
)

// ValidateConfig 校验完整 image_process + image_styles 配置。
func ValidateConfig(process model.ImageProcessConfig, styles []model.ImageStyleConfig) ValidationErrors {
	var errs ValidationErrors

	if process.Enabled && len(process.ApplyToExtensions) == 0 {
		errs.Errors = append(errs.Errors, FieldError{
			Field:   "image_process.apply_to_extensions",
			Message: "启用 image_process 时扩展名列表不能为空",
		})
	}
	for i, ext := range process.ApplyToExtensions {
		if ext == "" || strings.HasPrefix(ext, ".") || strings.ToLower(ext) != ext {
			errs.Errors = append(errs.Errors, FieldError{
				Field:   fmt.Sprintf("image_process.apply_to_extensions[%d]", i),
				Message: "扩展名必须小写且不含点，例如 jpg / webp",
			})
		}
	}
	validateAutoCompressConfig(&errs, "image_process.auto_compress", process.AutoCompress)

	seenNames := make(map[string]struct{}, len(styles))
	for i, st := range styles {
		validateStyleConfig(&errs, fmt.Sprintf("image_styles[%d]", i), st, seenNames, false)
	}

	if process.DefaultStyle != "" {
		if _, ok := seenNames[process.DefaultStyle]; !ok {
			errs.Errors = append(errs.Errors, FieldError{
				Field:   "image_process.default_style",
				Message: fmt.Sprintf("default_style %q 不在 image_styles 中", process.DefaultStyle),
			})
		}
	}

	return errs
}

// ValidateAutoCompressPolicy 校验自动压缩与存储策略类型的组合。
// 自动压缩由本地直链服务执行；云策略必须继续使用 Provider 原生图片处理。
func ValidateAutoCompressPolicy(
	policyType constant.StoragePolicyType,
	process model.ImageProcessConfig,
) ValidationErrors {
	var errs ValidationErrors
	if policyType != constant.PolicyTypeLocal &&
		process.AutoCompress != nil &&
		process.AutoCompress.Enabled {
		errs.Errors = append(errs.Errors, FieldError{
			Field:   "image_process.auto_compress.enabled",
			Message: "自动压缩仅支持本地存储策略；云存储请使用 Provider 原生图片处理",
		})
	}
	return errs
}

// ValidateStyleConfig 仅校验单条样式本身，预览等场景可复用。
func ValidateStyleConfig(style model.ImageStyleConfig) ValidationErrors {
	var errs ValidationErrors
	validateStyleConfig(&errs, "image_styles[0]", style, map[string]struct{}{}, true)
	return errs
}

func validateAutoCompressConfig(
	errs *ValidationErrors,
	fieldPrefix string,
	cfg *model.AutoCompressConfig,
) {
	if cfg == nil {
		return
	}
	if cfg.Format != "" {
		format := strings.ToLower(strings.TrimSpace(cfg.Format))
		if _, ok := validConfigFormats[format]; !ok {
			errs.Errors = append(errs.Errors, FieldError{
				Field:   fieldPrefix + ".format",
				Message: "format 必须是 original/webp/avif/png/jpg/heic 之一",
			})
		}
	}
	if cfg.Quality < 0 || cfg.Quality > 100 {
		errs.Errors = append(errs.Errors, FieldError{
			Field:   fieldPrefix + ".quality",
			Message: "quality 必须为 0 或 1-100；0 表示使用服务端默认值",
		})
	}
	if cfg.MaxWidth < 0 || cfg.MaxWidth > dynamicMaxDimension {
		errs.Errors = append(errs.Errors, FieldError{
			Field:   fieldPrefix + ".max_width",
			Message: fmt.Sprintf("max_width 必须在 0-%d 范围内", dynamicMaxDimension),
		})
	}
	if cfg.MaxHeight < 0 || cfg.MaxHeight > dynamicMaxDimension {
		errs.Errors = append(errs.Errors, FieldError{
			Field:   fieldPrefix + ".max_height",
			Message: fmt.Sprintf("max_height 必须在 0-%d 范围内", dynamicMaxDimension),
		})
	}
}

func validateStyleConfig(
	errs *ValidationErrors,
	fieldPrefix string,
	st model.ImageStyleConfig,
	seenNames map[string]struct{},
	allowEmptyName bool,
) {
	if st.Name != "" {
		if !configNameRegex.MatchString(st.Name) {
			errs.Errors = append(errs.Errors, FieldError{
				Field:   fieldPrefix + ".name",
				Message: "名称必须为 1-32 位 [a-zA-Z0-9_-]",
			})
		} else if seenNames != nil {
			if _, dup := seenNames[st.Name]; dup {
				errs.Errors = append(errs.Errors, FieldError{
					Field:   fieldPrefix + ".name",
					Message: fmt.Sprintf("名称 %q 重复，同策略内必须唯一", st.Name),
				})
			}
			seenNames[st.Name] = struct{}{}
		}
	} else if !allowEmptyName {
		errs.Errors = append(errs.Errors, FieldError{
			Field:   fieldPrefix + ".name",
			Message: "名称必须为 1-32 位 [a-zA-Z0-9_-]",
		})
	}

	if st.Format != "" {
		if _, ok := validConfigFormats[st.Format]; !ok {
			errs.Errors = append(errs.Errors, FieldError{
				Field:   fieldPrefix + ".format",
				Message: "format 必须是 original/webp/avif/png/jpg/heic 之一",
			})
		}
	}

	if st.Quality < 0 || st.Quality > 100 {
		errs.Errors = append(errs.Errors, FieldError{
			Field:   fieldPrefix + ".quality",
			Message: "quality 必须在 0-100 范围内",
		})
	}

	if _, ok := validConfigResizeModes[st.Resize.Mode]; !ok {
		errs.Errors = append(errs.Errors, FieldError{
			Field:   fieldPrefix + ".resize.mode",
			Message: "resize.mode 必须是 cover/contain/fit-inside/scale 之一",
		})
	} else {
		switch st.Resize.Mode {
		case "scale":
			if st.Resize.Scale <= 0 || st.Resize.Scale > 1 {
				errs.Errors = append(errs.Errors, FieldError{
					Field:   fieldPrefix + ".resize.scale",
					Message: "scale 模式下 scale 必须在 (0, 1] 区间",
				})
			}
		default:
			if st.Resize.Width <= 0 && st.Resize.Height <= 0 {
				errs.Errors = append(errs.Errors, FieldError{
					Field:   fieldPrefix + ".resize",
					Message: "非 scale 模式下 width 与 height 必须至少提供一个正整数",
				})
			}
			if st.Resize.Width < 0 {
				errs.Errors = append(errs.Errors, FieldError{
					Field:   fieldPrefix + ".resize.width",
					Message: "width 不能为负数",
				})
			}
			if st.Resize.Height < 0 {
				errs.Errors = append(errs.Errors, FieldError{
					Field:   fieldPrefix + ".resize.height",
					Message: "height 不能为负数",
				})
			}
		}
	}

	if st.Watermark != nil {
		validateWatermarkConfig(errs, fieldPrefix+".watermark", st.Watermark)
	}
}

func validateWatermarkConfig(errs *ValidationErrors, fieldPrefix string, watermark *model.WatermarkConfig) {
	if _, ok := validConfigWatermarkTypes[watermark.Type]; !ok {
		errs.Errors = append(errs.Errors, FieldError{
			Field:   fieldPrefix + ".type",
			Message: "watermark.type 必须是 text 或 image",
		})
	} else {
		switch watermark.Type {
		case "text":
			if strings.TrimSpace(watermark.Text) == "" {
				errs.Errors = append(errs.Errors, FieldError{
					Field:   fieldPrefix + ".text",
					Message: "text 类型水印必须提供非空 text",
				})
			}
		case "image":
			if strings.TrimSpace(watermark.ImageURL) == "" {
				errs.Errors = append(errs.Errors, FieldError{
					Field:   fieldPrefix + ".image_url",
					Message: "image 类型水印必须提供 image_url",
				})
			}
		}
	}
	if watermark.Position != "" {
		if _, ok := validConfigWatermarkPositions[watermark.Position]; !ok {
			errs.Errors = append(errs.Errors, FieldError{
				Field:   fieldPrefix + ".position",
				Message: "position 必须是 top-left/top-right/bottom-left/bottom-right/center/tile 之一",
			})
		}
	}
	if watermark.Opacity < 0 || watermark.Opacity > 1 {
		errs.Errors = append(errs.Errors, FieldError{
			Field:   fieldPrefix + ".opacity",
			Message: "opacity 必须在 0.0-1.0 范围",
		})
	}
}
