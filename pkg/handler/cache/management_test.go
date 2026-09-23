package cache

import (
	"context"
	cache_service "github.com/anzhiyu-c/anheyu-app/internal/service/cache"
	"github.com/gin-gonic/gin"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestManagementRejectsUnknownAndUnavailableOperations(t *testing.T) {
	h := NewHandler(cache_service.NewRevalidateService())
	calls := 0
	h.Configure(func(context.Context) map[string]any {
		return map[string]any{"page": map[string]any{"available": false}}
	}, map[string]func(context.Context) error{"image": func(context.Context) error { calls++; return nil }})
	router := gin.New()
	router.POST("/manage", h.Manage)
	router.GET("/status", h.GetStatus)
	for _, op := range []string{"delete-source", "flush-database", "image"} {
		w := httptest.NewRecorder()
		r := httptest.NewRequest("POST", "/manage", strings.NewReader(`{"type":"`+op+`"}`))
		r.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, r)
		if op != "image" && !strings.Contains(w.Body.String(), "当前运行模式不支持此操作") {
			t.Fatalf("unsupported op accepted: %s", w.Body.String())
		}
	}
	if calls != 1 {
		t.Fatalf("calls=%d", calls)
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest("GET", "/status", nil))
	if w.Header().Get("Cache-Control") != "no-store" || !strings.Contains(w.Body.String(), `"available":false`) {
		t.Fatal(w.Body.String())
	}
}
