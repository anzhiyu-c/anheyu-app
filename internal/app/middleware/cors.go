package middleware

import (
	"net/http"
	"net/url"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
)

var (
	corsAllowedOrigins   []string
	corsAllowedOriginsMu sync.RWMutex
)

// SetCORSAllowedOrigins configures the allowed origins for CORS.
// Should be called at startup with values from the site configuration.
// An empty slice means only same-origin requests are allowed.
func SetCORSAllowedOrigins(origins []string) {
	corsAllowedOriginsMu.Lock()
	defer corsAllowedOriginsMu.Unlock()
	corsAllowedOrigins = origins
}

func isOriginAllowed(origin string) bool {
	if origin == "" {
		return false
	}

	corsAllowedOriginsMu.RLock()
	defer corsAllowedOriginsMu.RUnlock()

	for _, allowed := range corsAllowedOrigins {
		if strings.EqualFold(origin, allowed) {
			return true
		}
		parsed, err := url.Parse(allowed)
		if err == nil && parsed.Host != "" {
			if strings.EqualFold(origin, parsed.Scheme+"://"+parsed.Host) {
				return true
			}
		}
	}
	return false
}

func Cors() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.Next()
			return
		}

		origin := c.Request.Header.Get("Origin")
		if origin == "" || !isOriginAllowed(origin) {
			if c.Request.Method == http.MethodOptions {
				c.AbortWithStatus(http.StatusForbidden)
				return
			}
			c.Next()
			return
		}

		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key, X-CSRF-Token, X-Requested-With, Range, Accept-Ranges, Content-Range, Content-Length, Content-Disposition")
		c.Header("Access-Control-Expose-Headers", "Authorization, Content-Range, Content-Length, Content-Disposition")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
