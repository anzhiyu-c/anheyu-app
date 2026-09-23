// Package frontend provides a lightweight in-memory page cache for proxied
// Next.js responses. It eliminates the Next.js SSR + DB query round-trip for
// frequently-accessed public pages, reducing TTFB to sub-millisecond levels.
package frontend

import (
	"bytes"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// cacheEntry holds a cached HTTP response.
type cacheEntry struct {
	body       []byte
	header     http.Header
	statusCode int
	expiresAt  time.Time
}

// pageCache is a simple in-memory TTL cache for proxied page responses.
// Only public GET requests to cacheable paths are stored.
type pageCache struct {
	mu    sync.RWMutex
	items map[string]*cacheEntry
}

var sharedPageCache = &pageCache{
	items: make(map[string]*cacheEntry, 256),
}

var pageCacheEnabled atomic.Bool

// PageCacheStatus reports only live entries; no request URLs or cached content leave the process.
func PageCacheStatus() (bool, int) {
	sharedPageCache.mu.RLock()
	defer sharedPageCache.mu.RUnlock()
	count := 0
	for _, entry := range sharedPageCache.items {
		if time.Now().Before(entry.expiresAt) {
			count++
		}
	}
	return pageCacheEnabled.Load(), count
}

func ClearPageCache() {
	sharedPageCache.mu.Lock()
	defer sharedPageCache.mu.Unlock()
	clear(sharedPageCache.items)
}

// cacheTTL returns the TTL for a given request path.
// Content pages get 15s, listing pages get 30s, static-like pages get 60s.
func cacheTTL(path string) time.Duration {
	switch {
	case path == "/":
		return 15 * time.Second
	case strings.HasPrefix(path, "/posts/"):
		return 15 * time.Second
	case strings.HasPrefix(path, "/categories"):
		return 30 * time.Second
	case strings.HasPrefix(path, "/tags"):
		return 30 * time.Second
	case strings.HasPrefix(path, "/archives"):
		return 30 * time.Second
	case strings.HasPrefix(path, "/about"):
		return 60 * time.Second
	case strings.HasPrefix(path, "/link"):
		return 30 * time.Second
	case strings.HasPrefix(path, "/album"):
		return 30 * time.Second
	case strings.HasPrefix(path, "/page"):
		return 60 * time.Second
	default:
		return 10 * time.Second
	}
}

// isCacheablePath returns true if the path is eligible for response caching.
// Admin, auth, and user-specific pages are never cached.
func isCacheablePath(path string) bool {
	if path == "/sw.js" || path == "/manifest.json" || path == "/offline.html" {
		return false
	}
	skipPrefixes := []string{
		"/admin", "/login", "/user-center", "/api/",
		"/_next/", "/f/", "/needcache/", "/static/",
	}
	for _, prefix := range skipPrefixes {
		if strings.HasPrefix(path, prefix) {
			return false
		}
	}
	return true
}

// hasAuthCookie checks if the request contains authentication tokens.
func hasAuthCookie(r *http.Request) bool {
	for _, c := range r.Cookies() {
		if c.Name == "access_token" || c.Name == "refresh_token" {
			return true
		}
	}
	return r.Header.Get("Authorization") != ""
}

// get retrieves a cached response. Returns nil if not found or expired.
func (pc *pageCache) get(key string) *cacheEntry {
	pc.mu.RLock()
	entry, ok := pc.items[key]
	pc.mu.RUnlock()

	if !ok {
		return nil
	}
	if time.Now().After(entry.expiresAt) {
		pc.mu.Lock()
		delete(pc.items, key)
		pc.mu.Unlock()
		return nil
	}
	return entry
}

// set stores a response in the cache with a path-appropriate TTL.
func (pc *pageCache) set(key string, body []byte, header http.Header, statusCode int) {
	ttl := cacheTTL(key)
	if ttl <= 0 {
		return
	}
	// Clone the header to avoid retaining references to the original request
	clonedHeader := header.Clone()

	entry := &cacheEntry{
		body:       make([]byte, len(body)),
		header:     clonedHeader,
		statusCode: statusCode,
		expiresAt:  time.Now().Add(ttl),
	}
	copy(entry.body, body)

	pc.mu.Lock()
	// Evict old entries if cache grows too large (keep max 512 entries)
	if len(pc.items) >= 512 {
		now := time.Now()
		for k, v := range pc.items {
			if now.After(v.expiresAt) {
				delete(pc.items, k)
			}
		}
	}
	pc.items[key] = entry
	pc.mu.Unlock()
}

// buildPageCacheKey builds a cache key from the full request URI.
// Public pages can vary by query parameters such as album filters.
func buildPageCacheKey(r *http.Request) string {
	return r.URL.RequestURI()
}

// tryServeFromCache attempts to serve the request from the page cache.
// Returns true if the response was served from cache.
func tryServeFromCache(w http.ResponseWriter, r *http.Request) bool {
	if r.Method != "GET" || r.Header.Get("RSC") != "" {
		return false
	}
	if !isCacheablePath(r.URL.Path) {
		return false
	}
	if hasAuthCookie(r) {
		return false
	}

	key := buildPageCacheKey(r)
	entry := sharedPageCache.get(key)
	if entry == nil {
		return false
	}

	// Copy cached headers to response
	for k, values := range entry.header {
		for _, v := range values {
			w.Header().Add(k, v)
		}
	}
	// Mark as served from cache
	w.Header().Set("X-Cache", "HIT")
	w.Header().Set("X-Cache-TTL", cacheTTL(r.URL.Path).String())
	w.WriteHeader(entry.statusCode)
	w.Write(entry.body)
	return true
}

// cacheResponseWriter wraps http.ResponseWriter to capture the response body
// for caching while still writing to the underlying writer.
// It also implements http.Flusher (delegating to the underlying writer if possible)
// for compatibility with httputil.ReverseProxy.
type cacheResponseWriter struct {
	http.ResponseWriter
	body       *bytes.Buffer
	statusCode int
}

func (w *cacheResponseWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

func (w *cacheResponseWriter) WriteHeader(code int) {
	w.statusCode = code
	w.ResponseWriter.WriteHeader(code)
}

// Flush implements http.Flusher for proxy compatibility.
func (w *cacheResponseWriter) Flush() {
	if flusher, ok := w.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

// wrapForCaching wraps a ResponseWriter to capture the response for caching.
// After the caller invokes the returned store function, if the response is
// cacheable (2xx status, cacheable path), it's stored in the page cache.
func wrapForCaching(w http.ResponseWriter, r *http.Request) (*cacheResponseWriter, func()) {
	crw := &cacheResponseWriter{
		ResponseWriter: w,
		body:           &bytes.Buffer{},
		statusCode:     http.StatusOK,
	}
	return crw, func() {
		// Only cache successful GET responses for cacheable paths
		if r.Method != "GET" || !isCacheablePath(r.URL.Path) || hasAuthCookie(r) || r.Header.Get("RSC") != "" {
			return
		}
		policy := strings.ToLower(crw.Header().Get("Cache-Control"))
		if strings.Contains(policy, "private") || strings.Contains(policy, "no-store") || strings.Contains(policy, "no-cache") || crw.Header().Get("Set-Cookie") != "" {
			return
		}
		if crw.statusCode >= 200 && crw.statusCode < 300 {
			sharedPageCache.set(
				buildPageCacheKey(r),
				crw.body.Bytes(),
				crw.ResponseWriter.Header(),
				crw.statusCode,
			)
		}
	}
}
