package parser

import (
	"bytes"
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/text"
	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

// SanitizeArticleHTML 从原始 Markdown 恢复旧版图表源码，再净化文章或历史 HTML。
// 前端可用安全的 Mermaid 配置重绘，不需要保留旧 SVG 内嵌的不可信样式或脚本。
func SanitizeArticleHTML(htmlContent, markdown string) string {
	if markdown == "" || !strings.Contains(htmlContent, "md-editor-mermaid") {
		return SanitizeHTML(htmlContent)
	}
	sources := mermaidMarkdownSources(markdown)
	if len(sources) == 0 {
		return SanitizeHTML(htmlContent)
	}
	nodes, err := html.ParseFragment(strings.NewReader(htmlContent), &html.Node{Type: html.ElementNode, Data: "div", DataAtom: atom.Div})
	if err != nil {
		return SanitizeHTML(htmlContent)
	}
	index := 0
	var restore func(*html.Node)
	restore = func(n *html.Node) {
		if isMermaidHTMLBlock(n) {
			if index < len(sources) && hasHTMLClass(n, "md-editor-mermaid") && containsHTMLElement(n, "svg") {
				attributeIndex := -1
				for i, attr := range n.Attr {
					if attr.Key == "data-mermaid-code" {
						attributeIndex = i
						break
					}
				}
				if attributeIndex == -1 {
					n.Attr = append(n.Attr, html.Attribute{Key: "data-mermaid-code", Val: sources[index]})
				} else if strings.TrimSpace(n.Attr[attributeIndex].Val) == "" {
					n.Attr[attributeIndex].Val = sources[index]
				}
			}
			index++
			return // 不重复计入同一个图表内嵌的 pre/code。
		}
		for child := n.FirstChild; child != nil; child = child.NextSibling {
			restore(child)
		}
	}
	var restored bytes.Buffer
	for _, node := range nodes {
		restore(node)
		if err := html.Render(&restored, node); err != nil {
			return SanitizeHTML(htmlContent)
		}
	}
	return SanitizeHTML(restored.String())
}

func mermaidMarkdownSources(markdown string) []string {
	source := []byte(markdown)
	document := goldmark.New().Parser().Parse(text.NewReader(source))
	var blocks []string
	var walk func(ast.Node)
	walk = func(n ast.Node) {
		if block, ok := n.(*ast.FencedCodeBlock); ok && strings.EqualFold(string(block.Language(source)), "mermaid") {
			blocks = append(blocks, string(block.Lines().Value(source)))
		}
		for child := n.FirstChild(); child != nil; child = child.NextSibling() {
			walk(child)
		}
	}
	walk(document)
	return blocks
}

func hasHTMLClass(n *html.Node, className string) bool {
	for _, attr := range n.Attr {
		if attr.Key == "class" {
			for _, class := range strings.Fields(attr.Val) {
				if class == className {
					return true
				}
			}
		}
	}
	return false
}

func containsHTMLElement(n *html.Node, tag string) bool {
	for child := n.FirstChild; child != nil; child = child.NextSibling {
		if child.Type == html.ElementNode && child.Data == tag || containsHTMLElement(child, tag) {
			return true
		}
	}
	return false
}

func isMermaidHTMLBlock(n *html.Node) bool {
	if n.Type != html.ElementNode {
		return false
	}
	if hasHTMLClass(n, "md-editor-mermaid") || hasHTMLClass(n, "mermaid-block") {
		return true
	}
	for _, attr := range n.Attr {
		if attr.Key == "data-mermaid-code" {
			return true
		}
	}
	if n.Data == "pre" {
		for child := n.FirstChild; child != nil; child = child.NextSibling {
			if child.Data == "code" && hasHTMLClass(child, "language-mermaid") {
				return true
			}
		}
	}
	return false
}
