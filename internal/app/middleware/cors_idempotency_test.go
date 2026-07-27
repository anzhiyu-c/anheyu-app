package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCORSAllowsIdempotencyKeyHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)
	const origin = "https://editor.example.com"
	SetCORSAllowedOrigins([]string{origin})
	t.Cleanup(func() {
		SetCORSAllowedOrigins(nil)
	})

	router := gin.New()
	router.Use(Cors())
	router.OPTIONS("/api/articles", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodOptions, "/api/articles", nil)
	request.Header.Set("Origin", origin)
	request.Header.Set("Access-Control-Request-Method", http.MethodPost)
	request.Header.Set("Access-Control-Request-Headers", "content-type,idempotency-key")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusNoContent)
	}
	allowedHeaders := strings.ToLower(recorder.Header().Get("Access-Control-Allow-Headers"))
	if !strings.Contains(allowedHeaders, "idempotency-key") {
		t.Fatalf("Access-Control-Allow-Headers = %q, want Idempotency-Key", allowedHeaders)
	}
}
