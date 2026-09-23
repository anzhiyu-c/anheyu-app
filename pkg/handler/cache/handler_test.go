package cache

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func cacheOperationRequest(router *gin.Engine) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/manage", strings.NewReader(`{"type":"index"}`))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)
	return recorder
}

func TestManageRejectsConcurrentOperationAndReleasesLock(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	var calls atomic.Int32
	handler := NewHandler(nil)
	handler.Configure(nil, map[string]func(context.Context) error{"index": func(context.Context) error {
		if calls.Add(1) == 1 {
			close(started)
			<-release
		}
		return errors.New("index failed")
	}})
	router := gin.New()
	router.POST("/manage", handler.Manage)
	done := make(chan *httptest.ResponseRecorder, 1)
	go func() { done <- cacheOperationRequest(router) }()
	select {
	case <-started:
	case <-time.After(5 * time.Second):
		close(release)
		t.Fatal("first action never started")
	}
	second := cacheOperationRequest(router)
	close(release)
	first := <-done
	if second.Code != http.StatusConflict || calls.Load() != 1 {
		t.Fatalf("concurrent response=%d calls=%d", second.Code, calls.Load())
	}
	if first.Code != http.StatusInternalServerError || first.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("first response=%d cache-control=%q", first.Code, first.Header().Get("Cache-Control"))
	}
	third := cacheOperationRequest(router)
	if third.Code != http.StatusInternalServerError || calls.Load() != 2 {
		t.Fatalf("lock not released: response=%d calls=%d", third.Code, calls.Load())
	}
}
