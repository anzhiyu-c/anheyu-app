/*
 * @Description: ResolveUploadURLSuffix 决策树测试
 * @Author: 安知鱼
 */
package image_style

import (
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
)

func TestResolveUploadURLSuffix_Matrix(t *testing.T) {
	thumbnail := sampleThumbnail()
	applyExts := []string{"jpg", "png"}

	cases := []struct {
		name     string
		enabled  bool
		exts     []string
		def      string
		styles   int
		filename string
		want     string
	}{
		{"enabled=false 返回空", false, applyExts, "thumbnail", 1, "a.jpg", ""},
		{"default_style 为空 返回空", true, applyExts, "", 1, "a.jpg", ""},
		{"扩展名不在白名单 返回空", true, applyExts, "thumbnail", 1, "a.bmp", ""},
		{"无扩展名 返回空", true, applyExts, "thumbnail", 1, "readme", ""},
		{"default_style 不存在于样式列表 返回空", true, applyExts, "not-exist", 1, "a.jpg", ""},
		{"全部命中 返回 !thumbnail", true, applyExts, "thumbnail", 1, "a.jpg", "!thumbnail"},
		{"大小写扩展名 也能命中", true, applyExts, "thumbnail", 1, "photo.JPG", "!thumbnail"},
		{"空样式列表 返回空", true, applyExts, "thumbnail", 0, "a.jpg", ""},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			policy := buildPolicyWithStyles(c.enabled, c.exts, c.def)
			if c.styles > 0 {
				policy = buildPolicyWithStyles(c.enabled, c.exts, c.def, thumbnail)
			}
			got := resolveUploadURLSuffix(policy, c.filename)
			if got != c.want {
				t.Errorf("case %s: 期望 %q，实际 %q", c.name, c.want, got)
			}
		})
	}
}

func TestResolveUploadURLSuffix_CustomSeparator(t *testing.T) {
	// style_separator 可由存储策略自定义
	policy := buildPolicyWithStyles(true, []string{"jpg"}, "thumbnail", sampleThumbnail())
	policy.Settings["style_separator"] = "@"

	got := resolveUploadURLSuffix(policy, "a.jpg")
	if got != "@thumbnail" {
		t.Errorf("自定义分隔符应为 @thumbnail，实际 %q", got)
	}
}

func TestResolveUploadURLSuffix_NilPolicy(t *testing.T) {
	got := resolveUploadURLSuffix(nil, "a.jpg")
	if got != "" {
		t.Errorf("nil policy 应返回空串，实际 %q", got)
	}
}

func TestResolveUploadURLSuffix_AutoCompressDoesNotMutateUploadURL(t *testing.T) {
	policy := buildPolicyWithProcessRaw(map[string]any{
		"enabled":             true,
		"apply_to_extensions": []string{"jpg"},
		"default_style":       "",
		"auto_compress": map[string]any{
			"enabled": true,
			"format":  "webp",
			"quality": 75,
		},
	})
	policy.Type = constant.PolicyTypeLocal

	if got := resolveUploadURLSuffix(policy, "a.jpg"); got != "" {
		t.Fatalf("自动压缩必须在读取时生效，上传 URL 不应追加后缀，实际 %q", got)
	}
}
