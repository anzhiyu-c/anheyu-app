package utility

import (
	"context"
	"fmt"
)

// CompareAndDeleteCache consumes a matching value once, including across Redis clients.
// Unknown cache implementations fail closed rather than emulate this with Get + Delete.
func CompareAndDeleteCache(ctx context.Context, cache CacheService, key, expected string) (bool, error) {
	switch c := cache.(type) {
	case *redisCacheService:
		result, err := c.client.Eval(ctx, `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0`, []string{key}, expected).Int64()
		return result == 1, err
	case *memoryCacheService:
		value, ok := c.data.Load(key)
		if !ok {
			return false, nil
		}
		item, ok := value.(*cacheItem)
		if !ok || item.isExpired() || item.value != expected {
			return false, nil
		}
		return c.data.CompareAndDelete(key, value), nil
	default:
		return false, fmt.Errorf("缓存不支持原子验证码消费")
	}
}
