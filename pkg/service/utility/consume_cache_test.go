package utility

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestCompareAndDeleteCacheHasOneWinner(t *testing.T) {
	cache := NewMemoryCacheService()
	defer cache.(*memoryCacheService).Stop()
	ctx := context.Background()
	if err := cache.Set(ctx, "proof", "digest", time.Minute); err != nil {
		t.Fatal(err)
	}
	if ok, err := CompareAndDeleteCache(ctx, cache, "proof", "wrong"); err != nil || ok {
		t.Fatalf("wrong digest accepted: %v %v", ok, err)
	}
	var winners atomic.Int32
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ok, err := CompareAndDeleteCache(ctx, cache, "proof", "digest")
			if err != nil {
				t.Error(err)
			}
			if ok {
				winners.Add(1)
			}
		}()
	}
	wg.Wait()
	if winners.Load() != 1 {
		t.Fatalf("winners=%d", winners.Load())
	}
	if err := cache.Set(ctx, "expired", "digest", -time.Second); err != nil {
		t.Fatal(err)
	}
	if err := cache.Expire(ctx, "expired", -time.Second); err != nil {
		t.Fatal(err)
	}
	if ok, err := CompareAndDeleteCache(ctx, cache, "expired", "digest"); err != nil || ok {
		t.Fatalf("expired=%v %v", ok, err)
	}
}
