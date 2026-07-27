/*
 * @Description: DiskCache 行为测试
 * @Author: 安知鱼
 */
package image_style

import (
	"bytes"
	"context"
	"errors"
	"io"
	"path/filepath"
	"testing"
	"time"
)

func newTestCache(t *testing.T, maxSize int64) *DiskCache {
	t.Helper()
	root := filepath.Join(t.TempDir(), "image_style_cache")
	c, err := NewDiskCache(CacheConfig{
		Root:            root,
		MaxSizeBytes:    maxSize,
		CleanupInterval: 0, // 测试禁用后台清理
	})
	if err != nil {
		t.Fatalf("NewDiskCache: %v", err)
	}
	t.Cleanup(func() { _ = c.Close() })
	return c
}

func TestDiskCache_PutGet_HitsAndReturnsBytes(t *testing.T) {
	ctx := context.Background()
	c := newTestCache(t, 1024*1024)

	data := []byte("hello-webp-bytes")
	_, err := c.Put(ctx, 1, 100, "hash001", "image/webp", "webp", data)
	if err != nil {
		t.Fatalf("Put: %v", err)
	}

	entry, rc, err := c.Get(ctx, 1, 100, "hash001")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	defer rc.Close()
	if entry.Size != int64(len(data)) {
		t.Errorf("Size 不符，期望 %d 实际 %d", len(data), entry.Size)
	}
	if entry.MIME != "image/webp" {
		t.Errorf("MIME 不符，期望 image/webp 实际 %s", entry.MIME)
	}
	got, _ := io.ReadAll(rc)
	if !bytes.Equal(got, data) {
		t.Errorf("读回的字节不一致")
	}
	if entry.AccessCount < 1 {
		t.Errorf("Get 后 AccessCount 应 ≥ 1，实际 %d", entry.AccessCount)
	}
}

func TestDiskCache_Miss_ReturnsErrCacheMiss(t *testing.T) {
	ctx := context.Background()
	c := newTestCache(t, 1024*1024)

	_, _, err := c.Get(ctx, 1, 999, "nope")
	if !errors.Is(err, ErrCacheMiss) {
		t.Errorf("期望 ErrCacheMiss，实际 %v", err)
	}
}

func TestDiskCache_LRUEviction_KeepsUnderUpperBound(t *testing.T) {
	ctx := context.Background()
	// MaxSize=10000 bytes；evict 触发阈值 10000*1.1=11000；目标 10000*0.8=8000。
	// 多次 Put 超过阈值会触发 evict 到 8000 字节；但之后继续 Put 可能累积到
	// ≤ 1.1*max。这里验证"上界稳定、条目数减少"的 LRU 本质。
	const maxSize int64 = 10000
	c := newTestCache(t, maxSize)

	blob := bytes.Repeat([]byte("x"), 1200)
	for i := 0; i < 12; i++ {
		_, err := c.Put(ctx, 1, uint(i+1), "h", "image/jpeg", "jpg", blob)
		if err != nil {
			t.Fatalf("Put #%d: %v", i, err)
		}
		time.Sleep(2 * time.Millisecond) // 保证 LastAccessAt 单调递增
	}

	stats, err := c.Stats(ctx, 1)
	if err != nil {
		t.Fatalf("Stats: %v", err)
	}
	upper := int64(float64(maxSize) * 1.1)
	if stats.TotalSize > upper {
		t.Errorf("evict 后总大小应 ≤ maxSize*1.1=%d 字节，实际 %d", upper, stats.TotalSize)
	}
	if stats.Count == 0 || stats.Count >= 12 {
		t.Errorf("evict 应保留部分但非全部条目；实际 count=%d", stats.Count)
	}

	// 最早插入的 fileID=1 应已经被 evict（最旧）
	_, _, err = c.Get(ctx, 1, 1, "h")
	if !errors.Is(err, ErrCacheMiss) {
		t.Errorf("最旧的条目应被 evict，实际 err=%v", err)
	}
}

func TestDiskCache_LRUEviction_KeepsRecentlyAccessed(t *testing.T) {
	ctx := context.Background()
	const maxSize int64 = 3000
	c := newTestCache(t, maxSize)

	blob := bytes.Repeat([]byte("y"), 400)

	// 先插入 6 个条目（2400 bytes < 3300 不触发 evict），其中 fileID=1 最早
	for i := 0; i < 6; i++ {
		_, err := c.Put(ctx, 1, uint(i+1), "h", "image/jpeg", "jpg", blob)
		if err != nil {
			t.Fatalf("Put #%d: %v", i, err)
		}
		time.Sleep(2 * time.Millisecond)
	}

	// 先访问 fileID=1 一次，让它的 LastAccessAt 更新
	if _, rc, err := c.Get(ctx, 1, 1, "h"); err != nil {
		t.Fatalf("Get 预期命中，但 err=%v", err)
	} else {
		_ = rc.Close()
	}

	// 再插入多个条目触发多次 evict（7~12）；每次 Put 后刷新 fileID=1 的访问时间戳，
	// 使它一直保持在 LRU 顺序的最新位置，不应被 evict。
	for i := 6; i < 12; i++ {
		_, err := c.Put(ctx, 1, uint(i+1), "h", "image/jpeg", "jpg", blob)
		if err != nil {
			t.Fatalf("Put #%d: %v", i, err)
		}
		time.Sleep(2 * time.Millisecond)
		if _, rc, err := c.Get(ctx, 1, 1, "h"); err == nil {
			_ = rc.Close()
		}
		time.Sleep(2 * time.Millisecond)
	}

	// fileID=1 由于 LastAccessAt 一直是最新，应仍然命中
	_, rc, err := c.Get(ctx, 1, 1, "h")
	if err != nil {
		t.Errorf("最近访问的条目被误 evict：%v", err)
	} else {
		_ = rc.Close()
	}

	// 较早未被访问过的条目应被 evict，count 应 < 12
	stats, _ := c.Stats(ctx, 1)
	if stats.Count >= 12 {
		t.Errorf("应发生 evict 使 count < 12，实际 count=%d", stats.Count)
	}
}

func TestDiskCache_Purge_ByPolicy(t *testing.T) {
	ctx := context.Background()
	c := newTestCache(t, 1024*1024)

	_, _ = c.Put(ctx, 1, 100, "h", "image/jpeg", "jpg", []byte("a"))
	_, _ = c.Put(ctx, 1, 101, "h", "image/jpeg", "jpg", []byte("b"))
	_, _ = c.Put(ctx, 2, 200, "h", "image/jpeg", "jpg", []byte("c"))

	n, err := c.Purge(ctx, PurgeOpts{PolicyID: uintPtr(1)})
	if err != nil {
		t.Fatalf("Purge: %v", err)
	}
	if n != 2 {
		t.Errorf("应清理 2 条（policy=1），实际 %d", n)
	}

	// policy=2 的条目仍在
	_, rc, err := c.Get(ctx, 2, 200, "h")
	if err != nil {
		t.Errorf("policy=2 的条目不应被清理，实际 %v", err)
	} else {
		_ = rc.Close()
	}

	_, _, err = c.Get(ctx, 1, 100, "h")
	if !errors.Is(err, ErrCacheMiss) {
		t.Errorf("policy=1 应已被清理")
	}
}

func TestDiskCache_Purge_ByFileID(t *testing.T) {
	ctx := context.Background()
	c := newTestCache(t, 1024*1024)

	_, _ = c.Put(ctx, 1, 100, "h1", "image/jpeg", "jpg", []byte("a"))
	_, _ = c.Put(ctx, 1, 100, "h2", "image/jpeg", "jpg", []byte("b"))
	_, _ = c.Put(ctx, 1, 200, "h1", "image/jpeg", "jpg", []byte("c"))

	n, err := c.Purge(ctx, PurgeOpts{PolicyID: uintPtr(1), FileID: uintPtr(100)})
	if err != nil {
		t.Fatalf("Purge: %v", err)
	}
	if n != 2 {
		t.Errorf("fileID=100 应有 2 条被清理，实际 %d", n)
	}
}

func TestDiskCache_Stats_ReflectsEntries(t *testing.T) {
	ctx := context.Background()
	c := newTestCache(t, 1024*1024)

	_, _ = c.Put(ctx, 1, 100, "h1", "image/jpeg", "jpg", bytes.Repeat([]byte("a"), 100))
	_, _ = c.Put(ctx, 1, 100, "h2", "image/jpeg", "jpg", bytes.Repeat([]byte("b"), 200))

	stats, _ := c.Stats(ctx, 1)
	if stats.Count != 2 || stats.TotalSize != 300 {
		t.Errorf("Stats 期望 count=2 size=300，实际 %+v", stats)
	}
	if stats.PolicyID != 1 {
		t.Errorf("Stats.PolicyID=1，实际 %d", stats.PolicyID)
	}
}

// TestDiskCache_ListAllStats_GroupsByPolicy 覆盖 Phase 4 新增的 ListAllStats：
// 多策略共存时应按 policyID 升序返回每策略的条目数与总字节，
// HitCount/MissCount 使用进程级全局累计。
func TestDiskCache_ListAllStats_GroupsByPolicy(t *testing.T) {
	ctx := context.Background()
	c := newTestCache(t, 1024*1024)

	// 策略 2：两条，体积 100+150
	_, _ = c.Put(ctx, 2, 10, "p2a", "image/jpeg", "jpg", bytes.Repeat([]byte("a"), 100))
	_, _ = c.Put(ctx, 2, 11, "p2b", "image/jpeg", "jpg", bytes.Repeat([]byte("b"), 150))
	// 策略 1：一条，体积 50
	_, _ = c.Put(ctx, 1, 20, "p1a", "image/webp", "webp", bytes.Repeat([]byte("c"), 50))

	got, err := c.ListAllStats(ctx)
	if err != nil {
		t.Fatalf("ListAllStats: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("期望 2 个策略分组，实际 %d: %+v", len(got), got)
	}
	if got[0].PolicyID != 1 || got[0].Count != 1 || got[0].TotalSize != 50 {
		t.Errorf("策略 1 统计不符，期望 count=1 size=50，实际 %+v", got[0])
	}
	if got[1].PolicyID != 2 || got[1].Count != 2 || got[1].TotalSize != 250 {
		t.Errorf("策略 2 统计不符，期望 count=2 size=250，实际 %+v", got[1])
	}
}

// TestDiskCache_ListAllStats_Empty 空缓存应返回空数组，不返回 nil 以便 JSON 序列化稳定。
func TestDiskCache_ListAllStats_Empty(t *testing.T) {
	ctx := context.Background()
	c := newTestCache(t, 1024*1024)
	got, err := c.ListAllStats(ctx)
	if err != nil {
		t.Fatalf("ListAllStats: %v", err)
	}
	if got == nil {
		t.Fatalf("空缓存应返回空切片，而非 nil")
	}
	if len(got) != 0 {
		t.Errorf("空缓存应返回 0 长度切片，实际 %d", len(got))
	}
}

func TestDiskCache_AtomicPut_NoPartialFiles(t *testing.T) {
	ctx := context.Background()
	c := newTestCache(t, 1024*1024)

	_, err := c.Put(ctx, 1, 42, "abc", "image/jpeg", "jpg", []byte("body"))
	if err != nil {
		t.Fatalf("Put: %v", err)
	}

	// 不应在缓存目录中留下 .tmp 临时文件
	matches, _ := filepath.Glob(filepath.Join(c.root, "1", "*", "*.tmp"))
	if len(matches) > 0 {
		t.Errorf("Put 成功后不应保留 .tmp 文件，实际 %v", matches)
	}
}

func TestDiskCache_RestartScansAndPurgesLegacyStyleHashFamily(t *testing.T) {
	ctx := context.Background()
	root := filepath.Join(t.TempDir(), "image_style_cache")
	cfg := CacheConfig{Root: root, MaxSizeBytes: 1024 * 1024}
	const (
		policyID      = uint(1)
		fileID        = uint(42)
		legacyHash    = "0123456789abcdef"
		versionedHash = legacyHash + "-fedcba9876543210"
	)

	first, err := NewDiskCache(cfg)
	if err != nil {
		t.Fatalf("首次 NewDiskCache: %v", err)
	}
	if _, err := first.Put(ctx, policyID, fileID, legacyHash, "image/jpeg", "jpg", []byte("legacy")); err != nil {
		t.Fatalf("写入旧格式缓存: %v", err)
	}
	if _, err := first.Put(ctx, policyID, fileID, versionedHash, "image/jpeg", "jpg", []byte("versioned")); err != nil {
		t.Fatalf("写入版本化缓存: %v", err)
	}
	if err := first.Close(); err != nil {
		t.Fatalf("关闭首次缓存: %v", err)
	}

	restarted, err := NewDiskCache(cfg)
	if err != nil {
		t.Fatalf("重启 NewDiskCache: %v", err)
	}
	defer restarted.Close()

	stats, err := restarted.Stats(ctx, policyID)
	if err != nil {
		t.Fatalf("读取重启缓存统计: %v", err)
	}
	if stats.Count != 2 {
		t.Fatalf("重启后应恢复旧格式和版本化缓存，实际 %d 条", stats.Count)
	}

	for _, hash := range []string{legacyHash, versionedHash} {
		entry, reader, err := restarted.Get(ctx, policyID, fileID, hash)
		if err != nil {
			t.Fatalf("重启后读取 %s: %v", hash, err)
		}
		_ = reader.Close()
		if entry.StyleHash != hash {
			t.Fatalf("重启后 StyleHash=%s，期望 %s", entry.StyleHash, hash)
		}
	}

	removed, err := restarted.Purge(ctx, PurgeOpts{
		PolicyID:        uintPtr(policyID),
		StyleHashFamily: stringPtr(legacyHash),
	})
	if err != nil {
		t.Fatalf("按样式族清理: %v", err)
	}
	if removed != 2 {
		t.Fatalf("样式族应同时清理旧格式和版本化缓存，实际 %d 条", removed)
	}
}

func uintPtr(v uint) *uint       { return &v }
func stringPtr(v string) *string { return &v }
