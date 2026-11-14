/*
 * @Description: 频率限制中间件
 * @Author: 安知鱼
 * @Date: 2025-11-08 00:00:00
 * @LastEditTime: 2025-11-08 15:59:28
 * @LastEditors: 安知鱼
 */
package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	"github.com/anzhiyu-c/anheyu-app/pkg/util"
	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// ipRateLimiter 基于进程内存的 IP 限流器。
// 注意：每个应用实例独立计数，水平扩展时单 IP 的实际限额 = 配置限额 x 实例数。
// 如需全局限流，请改用 Redis 令牌桶或滑动窗口方案。
type ipRateLimiter struct {
	limiters map[string]*limiterInfo
	mu       sync.RWMutex
	// 每个IP每分钟允许的请求数
	requestsPerMinute int
	// 突发请求数（允许短时间内的突发流量）
	burst int
	// 清理过期限流器的时间间隔
	cleanupInterval time.Duration
}

// limiterInfo 存储限流器及其最后访问时间
type limiterInfo struct {
	limiter      *rate.Limiter
	lastAccessed time.Time
}

type slidingWindowIPRateLimiter struct {
	attempts    map[string][]time.Time
	mu          sync.Mutex
	maxRequests int
	window      time.Duration
	now         func() time.Time
}

// newIPRateLimiter 创建一个新的IP限流器
func newIPRateLimiter(requestsPerMinute, burst int) *ipRateLimiter {
	limiter := &ipRateLimiter{
		limiters:          make(map[string]*limiterInfo),
		requestsPerMinute: requestsPerMinute,
		burst:             burst,
		cleanupInterval:   5 * time.Minute,
	}

	// 启动定期清理协程
	go limiter.cleanupStaleEntries()

	return limiter
}

func newSlidingWindowIPRateLimiter(maxRequests int, window time.Duration, now func() time.Time) *slidingWindowIPRateLimiter {
	if now == nil {
		now = time.Now
	}
	return &slidingWindowIPRateLimiter{
		attempts:    make(map[string][]time.Time),
		maxRequests: maxRequests,
		window:      window,
		now:         now,
	}
}

func (s *slidingWindowIPRateLimiter) allow(ip string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	current := s.now()
	cutoff := current.Add(-s.window)
	existing := s.attempts[ip]
	kept := existing[:0]
	for _, ts := range existing {
		if ts.After(cutoff) {
			kept = append(kept, ts)
		}
	}

	if len(kept) >= s.maxRequests {
		s.attempts[ip] = kept
		return false
	}

	s.attempts[ip] = append(kept, current)
	return true
}

// getLimiter 获取指定IP的限流器
func (i *ipRateLimiter) getLimiter(ip string) *rate.Limiter {
	i.mu.Lock()
	defer i.mu.Unlock()

	info, exists := i.limiters[ip]
	if !exists {
		// 创建新的限流器
		// rate.Every(time.Minute / time.Duration(i.requestsPerMinute)) 表示每分钟允许 i.requestsPerMinute 个请求
		limiter := rate.NewLimiter(rate.Every(time.Minute/time.Duration(i.requestsPerMinute)), i.burst)
		info = &limiterInfo{
			limiter:      limiter,
			lastAccessed: time.Now(),
		}
		i.limiters[ip] = info
	} else {
		// 更新最后访问时间
		info.lastAccessed = time.Now()
	}

	return info.limiter
}

// cleanupStaleEntries 定期清理超过一定时间未使用的限流器
func (i *ipRateLimiter) cleanupStaleEntries() {
	ticker := time.NewTicker(i.cleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		i.mu.Lock()
		for ip, info := range i.limiters {
			// 如果超过10分钟未访问，则删除该限流器
			if time.Since(info.lastAccessed) > 10*time.Minute {
				delete(i.limiters, ip)
			}
		}
		i.mu.Unlock()
	}
}

// 全局的友链申请限流器实例。
// 限制同一真实 IP 在 10 分钟内最多提交 3 次，且不允许突发绕过。
var linkApplyLimiter = newSlidingWindowIPRateLimiter(3, 10*time.Minute, time.Now)

var commentLikeLimiter = newSlidingWindowIPRateLimiter(30, 10*time.Minute, time.Now)
var commentUploadLimiter = newSlidingWindowIPRateLimiter(10, 10*time.Minute, time.Now)
var publicWriteLimiter = newSlidingWindowIPRateLimiter(60, time.Minute, time.Now)

// CommentLikeRateLimit 限制同一 IP 的评论点赞频率。
func CommentLikeRateLimit() gin.HandlerFunc {
	return ipWindowLimit(commentLikeLimiter, "操作过于频繁，请稍后再试")
}

// CommentUploadRateLimit 限制同一 IP 的评论图片上传频率。
func CommentUploadRateLimit() gin.HandlerFunc {
	return ipWindowLimit(commentUploadLimiter, "上传过于频繁，请10分钟后再试")
}

// PublicWriteRateLimit 限制公开写接口的调用频率。
func PublicWriteRateLimit() gin.HandlerFunc {
	return ipWindowLimit(publicWriteLimiter, "请求过于频繁，请稍后再试")
}

func ipWindowLimit(limiter *slidingWindowIPRateLimiter, message string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !limiter.allow(getClientIP(c)) {
			response.Fail(c, http.StatusTooManyRequests, message)
			c.Abort()
			return
		}
		c.Next()
	}
}

// LinkApplyRateLimit 友链申请频率限制中间件
// 限制每个IP地址的友链申请频率
func LinkApplyRateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 获取客户端IP地址
		ip := getClientIP(c)

		if !linkApplyLimiter.allow(ip) {
			response.Fail(c, http.StatusTooManyRequests, "提交过于频繁，请10分钟后再试")
			c.Abort()
			return
		}

		c.Next()
	}
}

// getClientIP 获取客户端真实IP地址
// 委托给 util.GetRealClientIP，仅当直连来源是可信代理时才检查转发头部，
// 防止客户端直接伪造 X-Real-IP / X-Forwarded-For 等头部绕过限流。
func getClientIP(c *gin.Context) string {
	return util.GetRealClientIP(c)
}

// CustomRateLimit 创建一个自定义的频率限制中间件
// requestsPerMinute: 每分钟允许的请求数
// burst: 突发请求数
func CustomRateLimit(requestsPerMinute, burst int) gin.HandlerFunc {
	limiter := newIPRateLimiter(requestsPerMinute, burst)

	return func(c *gin.Context) {
		ip := getClientIP(c)
		ipLimiter := limiter.getLimiter(ip)

		if !ipLimiter.Allow() {
			response.Fail(c, http.StatusTooManyRequests, "请求过于频繁，请稍后再试")
			c.Abort()
			return
		}

		c.Next()
	}
}
