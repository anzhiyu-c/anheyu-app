package article

import (
	"strings"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

func TestArticleResponseSanitizesStoredHTML(t *testing.T) {
	svc := &serviceImpl{parserSvc: newArticleValidationParser(t)}
	stored := &model.Article{ContentHTML: `<div class="md-editor-mermaid"><img src="/safe.png" onerror="alert(1)"><svg onload="alert(2)"></svg></div><p>retained</p>`}
	response := svc.ToAPIResponse(stored, false, true)
	if strings.Contains(response.ContentHTML, "onerror") || strings.Contains(response.ContentHTML, "onload") {
		t.Fatalf("stored XSS exposed: %s", response.ContentHTML)
	}
	if !strings.Contains(response.ContentHTML, "retained") {
		t.Fatal("safe content lost")
	}
	if !strings.Contains(stored.ContentHTML, "onerror") {
		t.Fatal("response sanitization modified persisted input")
	}
}

func TestArticleResponseRepairsLegacyMermaidBeforeSanitizing(t *testing.T) {
	svc := &serviceImpl{}
	stored := &model.Article{ContentMd: "```mermaid\nflowchart LR\nA-->B\n```", ContentHTML: `<div class="md-editor-mermaid"><svg><style>.node {fill:red}</style></svg></div>`}
	response := svc.ToAPIResponse(stored, false, true)
	if !strings.Contains(response.ContentHTML, `data-mermaid-code="flowchart LR`) {
		t.Fatalf("legacy Mermaid source lost: %s", response.ContentHTML)
	}
}
