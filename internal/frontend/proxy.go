package frontend

import (
	"io"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// staticCache* variables cache the result of IsStaticModeActive() to avoid
// filesystem I/O (os.Stat, os.ReadDir, os.ReadFile) on every request.
var (
	staticCacheMu     sync.RWMutex
	staticCacheActive bool
	staticCacheExpiry time.Time
)

// proxyState holds the reusable reverse proxy and the current target URL.
// The proxy is created once and reused; only the target URL is updated dynamically.
type proxyState struct {
	mu       sync.RWMutex
	proxy    *httputil.ReverseProxy
	target   string
	launcher *Launcher
}

// newProxyState creates a reusable reverse proxy for the given launcher.
// The proxy reuses SharedTransport for connection pooling.
func newProxyState(launcher *Launcher) *proxyState {
	ps := &proxyState{launcher: launcher}

	// Create the proxy once — Director is called per-request to set the target.
	ps.proxy = &httputil.ReverseProxy{
		Transport: SharedTransport,
		Director: func(req *http.Request) {
			// Read the current target URL (protected by RLock in the caller)
			target, _ := url.Parse(ps.target)
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			req.Host = target.Host
			req.Header.Set("X-Forwarded-Host", req.Header.Get("X-Forwarded-Host"))
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, proxyErr error) {
			log.Printf("[Frontend Proxy] 代理错误: %v (target: %s)", proxyErr, ps.launcher.GetFrontendURL())
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>前端服务暂不可用</title>
<style>body{font-family:system-ui,sans-serif;text-align:center;padding:60px}h1{color:#333}p{color:#666}</style>
</head><body>
<h1>前端服务暂时不可用</h1>
<p>服务正在启动中或遇到问题，请稍后刷新页面重试。</p>
</body></html>`))
		},
		ModifyResponse: func(resp *http.Response) error {
			// Add immutable caching for content-hashed Next.js static assets
			path := resp.Request.URL.Path
			if strings.HasPrefix(path, "/_next/static/") {
				if strings.Contains(strings.ToLower(resp.Header.Get("Content-Type")), "text/html") {
					if err := resp.Body.Close(); err != nil {
						log.Printf("[Frontend Proxy] 关闭无效静态资源响应失败: %v", err)
					}
					const body = "not found\n"
					resp.StatusCode = http.StatusNotFound
					resp.Status = "404 Not Found"
					resp.Header.Del("Content-Encoding")
					resp.Header.Del("Etag")
					resp.Header.Del("Last-Modified")
					resp.Header.Set("Content-Type", "text/plain; charset=utf-8")
					resp.Header.Set("Content-Length", strconv.Itoa(len(body)))
					resp.Body = io.NopCloser(strings.NewReader(body))
					resp.ContentLength = int64(len(body))
				}
				if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusNotModified {
					resp.Header.Set("Cache-Control", "public, max-age=31536000, immutable")
				} else {
					resp.Header.Set("Cache-Control", "no-store")
				}
			}
			return nil
		},
	}

	// Set initial target
	ps.target = launcher.GetFrontendURL()

	return ps
}

// getProxy returns the shared reverse proxy, updating the target URL if needed.
func (ps *proxyState) getProxy() *httputil.ReverseProxy {
	ps.mu.RLock()
	currentTarget := ps.target
	ps.mu.RUnlock()

	newTarget := ps.launcher.GetFrontendURL()
	if newTarget != currentTarget {
		ps.mu.Lock()
		ps.target = newTarget
		ps.mu.Unlock()
	}

	return ps.proxy
}

// cachedStaticActive returns whether static mode is active, caching the result
// for 30 seconds to avoid filesystem I/O on every request.
// The static/ directory is a deploy-time concern — re-checking every 30s is sufficient.
func cachedStaticActive() bool {
	now := time.Now()
	staticCacheMu.RLock()
	if now.Before(staticCacheExpiry) {
		active := staticCacheActive
		staticCacheMu.RUnlock()
		return active
	}
	staticCacheMu.RUnlock()

	staticCacheMu.Lock()
	defer staticCacheMu.Unlock()
	// Double-check after acquiring write lock
	if now.Before(staticCacheExpiry) {
		return staticCacheActive
	}
	staticCacheActive = IsStaticModeActive()
	staticCacheExpiry = now.Add(30 * time.Second)
	return staticCacheActive
}

// ProxyMiddleware creates a reverse proxy middleware that forwards
// non-API requests to the Next.js frontend service.
// When a valid static directory is detected (custom frontend mode), public-facing
// pages are served from it; admin pages still proxy to Next.js.
func ProxyMiddleware(launcher *Launcher) gin.HandlerFunc {
	pageCacheEnabled.Store(true)
	// Create the reusable proxy once at middleware creation time
	state := newProxyState(launcher)

	return func(c *gin.Context) {
		path := c.Request.URL.Path

		if shouldSkipProxy(path, launcher.SkipStaticProxy()) {
			c.Next()
			return
		}

		// 自定义前端模式：从 static 目录提供前台页面，
		// 管理后台路径和未找到的静态资源将穿透到 Next.js 代理。
		// 使用缓存避免每次请求进行文件系统 I/O（30s TTL）。
		if cachedStaticActive() {
			if handleStaticRequest(c, path) {
				return
			}
		}

		if !launcher.IsRunning() {
			c.Header("Cache-Control", "no-store")
			c.Header("Retry-After", "5")
			c.String(http.StatusServiceUnavailable, "前端服务暂不可用，请稍后重试")
			c.Abort()
			return
		}

		// 页面响应缓存：先尝试从缓存中直接返回，跳过 Next.js SSR 全过程
		// 仅对公开 GET 请求生效，管理后台/API/登录等路径不缓存
		if tryServeFromCache(c.Writer, c.Request) {
			c.Abort()
			return
		}

		// 包装 ResponseWriter 以捕获响应内容用于后续缓存
		cacheRW, storeCache := wrapForCaching(c.Writer, c.Request)

		// Set per-request proxy headers before forwarding
		originalHost := c.Request.Host
		originalScheme := scheme(c)
		originalIP := c.ClientIP()

		// Set headers on the incoming request so the proxy's Director can forward them
		c.Request.Header.Set("X-Forwarded-Host", originalHost)
		c.Request.Header.Set("X-Forwarded-Proto", originalScheme)
		c.Request.Header.Set("X-Real-IP", originalIP)

		state.getProxy().ServeHTTP(cacheRW, c.Request)
		storeCache()
		c.Abort()
	}
}

// shouldSkipProxy 决定请求是否不代理、交给 Go 处理。
// skipStaticProxy 为 true 时 /static/ 也跳过，由 Go 提供主题目录（自定义前端在 /static 下）；默认 false，/static 代理到 Next.js。
func shouldSkipProxy(path string, skipStaticProxy bool) bool {
	exactPaths := []string{
		"/robots.txt",
		"/sitemap.xml",
		"/rss.xml",
		"/feed.xml",
		"/atom.xml",
	}
	for _, exact := range exactPaths {
		if path == exact {
			return true
		}
	}

	skipPrefixes := []string{
		"/api/",
		"/f/",
		"/needcache/",
	}
	if skipStaticProxy {
		// 自定义主题模式：/static 由 Go 提供，不代理到 Next.js
		skipPrefixes = append(skipPrefixes, "/static/")
	}
	for _, prefix := range skipPrefixes {
		if strings.HasPrefix(path, prefix) {
			return true
		}
	}

	return false
}

// scheme 返回请求使用的协议。仅信任 TLS 状态和合法的 X-Forwarded-Proto 值，
// 需配合 Gin 的 TrustedProxies 配置确保该头来自受信任代理。
func scheme(c *gin.Context) string {
	if c.Request.TLS != nil {
		return "https"
	}
	if proto := c.GetHeader("X-Forwarded-Proto"); proto == "https" || proto == "http" {
		return proto
	}
	return "http"
}
