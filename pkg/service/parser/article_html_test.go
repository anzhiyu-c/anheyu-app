package parser

import (
	"strings"
	"testing"

	"golang.org/x/net/html"
)

func mermaidSources(t *testing.T, content string) []string {
	t.Helper()
	doc, err := html.Parse(strings.NewReader(content))
	if err != nil {
		t.Fatal(err)
	}
	var sources []string
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		for _, attr := range n.Attr {
			if attr.Key == "data-mermaid-code" {
				sources = append(sources, attr.Val)
			}
		}
		for child := n.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(doc)
	return sources
}

func TestSanitizeArticleHTMLRestoresLegacyMermaidSource(t *testing.T) {
	input := `<p class="md-editor-mermaid"><svg viewBox="0 0 100 50"><style>.node{fill:red}</style><g><text>A</text></g></svg><img src="x" onerror="alert(1)"></p>`
	markdown := "```mermaid\ngraph TD; A-->B\n```"
	got := SanitizeArticleHTML(input, markdown)
	sources := mermaidSources(t, got)
	if len(sources) != 1 || strings.TrimSpace(sources[0]) != "graph TD; A-->B" {
		t.Fatalf("legacy diagram cannot be rerendered: %s", got)
	}
	if strings.Contains(got, "onerror") || strings.Contains(got, "<style") {
		t.Fatalf("unsafe legacy markup survived: %s", got)
	}
}

func TestSanitizeArticleHTMLAlignsMixedMermaidBlocks(t *testing.T) {
	input := `<div class="mermaid-block" data-mermaid-code="graph TD; A--&gt;B"><pre><code class="language-mermaid">graph TD; A--&gt;B</code></pre></div><div class="md-editor-mermaid"><svg><text>C</text></svg></div>`
	markdown := "```mermaid\ngraph TD; A-->B\n```\n\n~~~~mermaid\ngraph LR; C-->D\n~~~~"
	got := SanitizeArticleHTML(input, markdown)
	sources := mermaidSources(t, got)
	if len(sources) != 2 || strings.TrimSpace(sources[0]) != "graph TD; A-->B" || strings.TrimSpace(sources[1]) != "graph LR; C-->D" {
		t.Fatalf("diagram sources were mismatched: %+v", sources)
	}
}

func TestSanitizeArticleHTMLEscapesRecoveredSource(t *testing.T) {
	source := `graph TD; A["<img src=x onerror=alert(1)>"]`
	got := SanitizeArticleHTML(`<div class="md-editor-mermaid"><svg><text>A</text></svg></div>`, "```mermaid\n"+source+"\n```")
	sources := mermaidSources(t, got)
	if len(sources) != 1 || strings.TrimSpace(sources[0]) != source {
		t.Fatalf("source not safely preserved: %s", got)
	}
	if strings.Contains(got, "<img") {
		t.Fatalf("source became an executable element: %s", got)
	}
}
