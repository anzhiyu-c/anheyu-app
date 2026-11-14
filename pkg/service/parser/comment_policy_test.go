package parser

import (
	"strings"
	"testing"
)

func TestCommentHTMLPolicyStripsOverlayStyles(t *testing.T) {
	input := `<div style="position:fixed;inset:0;z-index:2147483647;background:#000;color:red">网页已被大肥鱼劫持</div>`
	output := commentHTMLPolicy.Sanitize(input)
	lower := strings.ToLower(output)
	for _, forbidden := range []string{"position", "z-index", "fixed", "inset"} {
		if strings.Contains(lower, forbidden) {
			t.Fatalf("评论 HTML 仍包含 %s: %s", forbidden, output)
		}
	}
}

func TestArticleHTMLPolicyKeepsStyleAttribute(t *testing.T) {
	input := `<span style="color:red">标注</span>`
	output := htmlPolicy.Sanitize(input)
	if !strings.Contains(output, "style") {
		t.Fatalf("文章 HTML 不应去掉普通样式: %s", output)
	}
}
