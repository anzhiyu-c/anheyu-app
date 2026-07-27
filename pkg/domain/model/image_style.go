/*
 * @Description: 存储策略图片样式处理的领域模型
 * @Author: 安知鱼
 *
 * 对应规范：docs/superpowers/specs/2026-04-21-storage-policy-image-processing-design.md §5
 *
 * 这些结构体以 JSON 形式嵌入在 StoragePolicy.Settings 中，键分别为
 * constant.ImageProcessSettingsKey / constant.ImageStylesSettingsKey。
 */
package model

import "slices"

// DefaultImageProcessApplyExtensions 为启用 image_process 但未指定扩展名时的默认列表
// （与后台「填入默认」及规范示例一致）。
var DefaultImageProcessApplyExtensions = []string{"jpg", "jpeg", "png", "webp", "heic"}

// ImageProcessConfig 描述单个存储策略是否启用图片样式处理及处理范围。
// 对应 Spec §5.2 image_process 表。
type ImageProcessConfig struct {
	// Enabled 是否启用样式处理；关闭时所有样式请求 302 回原图。
	Enabled bool `json:"enabled"`
	// ApplyToExtensions 命中处理的扩展名（不含点、全部小写）。
	// 关闭或未配置时可为空；已启用且为空时，Put 接口会在校验前补全为 DefaultImageProcessApplyExtensions。
	ApplyToExtensions []string `json:"apply_to_extensions"`
	// DefaultStyle 上传返回 URL 时自动拼接的默认样式名；空串表示不自动拼接。
	// 非空时必须存在于 ImageStyles[].Name。
	DefaultStyle string `json:"default_style"`
	// AutoCompress 描述无显式样式请求时的自动压缩配置；nil 或 disabled 表示不启用。
	AutoCompress *AutoCompressConfig `json:"auto_compress,omitempty"`
}

// NormalizeApplyExtensionsWhenEnabled 在 Enabled 为 true 且扩展名列表为空时，
// 写入 DefaultImageProcessApplyExtensions 的副本，避免客户端漏传导致保存失败。
func (c *ImageProcessConfig) NormalizeApplyExtensionsWhenEnabled() {
	if c == nil || !c.Enabled {
		return
	}
	if len(c.ApplyToExtensions) > 0 {
		return
	}
	c.ApplyToExtensions = slices.Clone(DefaultImageProcessApplyExtensions)
}

// AutoCompressConfig 描述策略级自动压缩配置。
//
// 它只作用于没有命名样式、没有动态参数、也没有默认样式命中的原图读取请求；
// 不修改上传原文件。
type AutoCompressConfig struct {
	// Enabled 是否启用自动压缩。
	Enabled bool `json:"enabled"`
	// Quality 输出质量。0 表示使用服务端默认值；1-100 表示显式质量。
	Quality int `json:"quality,omitempty"`
	// MaxWidth / MaxHeight 为最大输出尺寸；均为 0 时不缩放，只重编码。
	MaxWidth  int `json:"max_width,omitempty"`
	MaxHeight int `json:"max_height,omitempty"`
	// Format 输出格式：original / webp / avif / png / jpg / heic。空串视为 original。
	Format string `json:"format,omitempty"`
	// AutoRotate 是否按 EXIF Orientation 自动矫正方向。nil 表示默认 true。
	AutoRotate *bool `json:"auto_rotate,omitempty"`
}

// ImageStyleConfig 描述单个命名样式。
// 对应 Spec §5.2 image_styles 表。
type ImageStyleConfig struct {
	// Name 样式唯一标识，正则 ^[a-zA-Z0-9_-]{1,32}$；同策略内唯一。
	Name string `json:"name"`
	// Format 输出格式：original / webp / avif / png / jpg / heic。
	// 省略时视为 original。
	Format string `json:"format,omitempty"`
	// Quality 0-100；0 = 最大压缩，100 = 无损；省略时由服务层给出默认值 80。
	Quality int `json:"quality,omitempty"`
	// AutoRotate 是否按 EXIF Orientation 自动矫正方向。
	AutoRotate bool `json:"auto_rotate"`
	// Resize 尺寸调整参数；每条样式必须提供。
	Resize ImageResizeConfig `json:"resize"`
	// Watermark 水印配置；nil 表示无水印。
	// 使用 omitempty + 指针，确保 nil 时不出现 "watermark": null。
	Watermark *WatermarkConfig `json:"watermark,omitempty"`
}

// ImageResizeConfig 描述尺寸调整参数。
// 对应 Spec §5.2 resize 子段。
type ImageResizeConfig struct {
	// Mode 缩放模式：cover / contain / fit-inside / scale。
	Mode string `json:"mode"`
	// Width / Height 目标像素；当 Mode != scale 时至少一个必填。
	Width  int `json:"width,omitempty"`
	Height int `json:"height,omitempty"`
	// Scale 仅在 Mode == scale 时生效，范围 0.01 - 1.0。
	Scale float64 `json:"scale,omitempty"`
	// Enlarge 是否允许放大超过原图尺寸；默认 false。
	Enlarge bool `json:"enlarge,omitempty"`
}

// WatermarkConfig 描述水印参数。
// 对应 Spec §5.3。
type WatermarkConfig struct {
	// Type 水印类型：text / image。
	Type string `json:"type"`
	// Text 文本内容（Type == text 时使用）。
	Text string `json:"text,omitempty"`
	// ImageURL 图片 URL（Type == image 时使用），可为站内直链或外部 URL。
	ImageURL string `json:"image_url,omitempty"`
	// Position 摆放位置：top-left / top-right / bottom-left / bottom-right / center / tile。
	Position string `json:"position,omitempty"`
	// OffsetX / OffsetY 相对 Position 的像素偏移（tile 模式下表示瓷砖平铺间距）。
	OffsetX int `json:"offset_x,omitempty"`
	OffsetY int `json:"offset_y,omitempty"`
	// Opacity 水印透明度 0.0 - 1.0。
	Opacity float64 `json:"opacity,omitempty"`
	// FontSize 文字大小（pt），text 类型生效。
	FontSize int `json:"font_size,omitempty"`
	// Color 文字颜色，十六进制 #rrggbb 或带透明度 #rrggbbaa。
	Color string `json:"color,omitempty"`
	// FontFamily 字体族：serif / sans-serif / monospace；空串使用内置 GoRegular。
	FontFamily string `json:"font_family,omitempty"`
}
