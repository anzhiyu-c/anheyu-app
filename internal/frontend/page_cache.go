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

const (
	maxPageCacheEntries    = 512
	maxPageCacheEntryBytes = 1 << 20
	maxPageCacheBodyBytes  = 32 << 20
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
	mu        sync.RWMutex
	items     map[string]*cacheEntry
	bodyBytes int
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
	sharedPageCache.bodyBytes = 0
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
		// Another request may have replaced this entry while we waited for the lock.
		if pc.items[key] == entry {
			pc.remove(key)
		}
		pc.mu.Unlock()
		return nil
	}
	return entry
}

// set stores a response in the cache with a path-appropriate TTL.
func (pc *pageCache) set(key string, body []byte, header http.Header, statusCode int) {
	path, _, _ := strings.Cut(key, "?")
	ttl := cacheTTL(path)
	if ttl <= 0 || len(body) > maxPageCacheEntryBytes {
		return
	}

	pc.mu.Lock()
	defer pc.mu.Unlock()
	pc.remove(key)
	if len(pc.items) >= maxPageCacheEntries || pc.bodyBytes+len(body) > maxPageCacheBodyBytes {
		now := time.Now()
		for k, v := range pc.items {
			if now.After(v.expiresAt) {
				pc.remove(k)
			}
		}
	}
	// Expiry alone cannot bound a cache filled with many distinct live URLs.
	for len(pc.items) >= maxPageCacheEntries || pc.bodyBytes+len(body) > maxPageCacheBodyBytes {
		var oldestKey string
		var oldest *cacheEntry
		for k, entry := range pc.items {
			if oldest == nil || entry.expiresAt.Before(oldest.expiresAt) {
				oldestKey, oldest = k, entry
			}
		}
		pc.remove(oldestKey)
	}
	pc.items[key] = &cacheEntry{
		body:       bytes.Clone(body),
		header:     header.Clone(),
		statusCode: statusCode,
		expiresAt:  time.Now().Add(ttl),
	}
	pc.bodyBytes += len(body)
}

// remove requires the write lock and keeps capacity accounting consistent.
func (pc *pageCache) remove(key string) {
	if entry, ok := pc.items[key]; ok {
		pc.bodyBytes -= len(entry.body)
		delete(pc.items, key)
	}
}

// buildPageCacheKey builds a cache key from the full request URI.
// Public pages can vary by query parameters such as album filters.
func buildPageCacheKey(r *http.Request) string {
	return r.URL.RequestURI()
}

// tryServeFromCache attempts to serve the request from the page cache.
// Returns true if the response was served from cache.
func tryServeFromCache(w http.ResponseWriter, r *http.Request) bool {
	if !isCacheableRequest(r) {
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

func isCacheableRequest(r *http.Request) bool {
	return r.Method == http.MethodGet && r.Header.Get("RSC") == "" &&
		isCacheablePath(r.URL.Path) && !hasAuthCookie(r)
}

func isCacheableResponse(header http.Header, statusCode int) bool {
	policy := strings.ToLower(header.Get("Cache-Control"))
	return statusCode >= 200 && statusCode < 300 && header.Get("Set-Cookie") == "" &&
		!strings.Contains(policy, "private") && !strings.Contains(policy, "no-store") &&
		!strings.Contains(policy, "no-cache")
}

// cacheResponseWriter wraps http.ResponseWriter to capture the response body
// for caching while still writing to the underlying writer.
// It also implements http.Flusher (delegating to the underlying writer if possible)
// for compatibility with httputil.ReverseProxy.
type cacheResponseWriter struct {
	http.ResponseWriter
	body        *bytes.Buffer
	statusCode  int
	wroteHeader bool
}

func (w *cacheResponseWriter) Write(b []byte) (int, error) {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	n, err := w.ResponseWriter.Write(b)
	if err != nil {
		w.body = nil
		return n, err
	}
	if w.body != nil {
		if len(b) > maxPageCacheEntryBytes-w.body.Len() {
			// Continue streaming to the client, but release the partial capture.
			w.body = nil
		} else if _, captureErr := w.body.Write(b[:n]); captureErr != nil {
			return n, captureErr
		}
	}
	return n, nil
}

func (w *cacheResponseWriter) WriteHeader(code int) {
	if code >= 200 && !w.wroteHeader {
		w.statusCode = code
		w.wroteHeader = true
		if !isCacheableResponse(w.Header(), code) {
			w.body = nil
		}
	}
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
		statusCode:     http.StatusOK,
	}
	if isCacheableRequest(r) {
		crw.body = &bytes.Buffer{}
	}
	return crw, func() {
		// Only cache successful GET responses for cacheable paths
		if crw.body == nil || !isCacheableRequest(r) {
			return
		}
		if !isCacheableResponse(crw.Header(), crw.statusCode) {
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
