package database

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// pingWithRetry bounds startup delays and allows a dependency that starts a few
// seconds later to become ready. Runtime reconnection remains the driver's job.
func pingWithRetry(ctx context.Context, ping func(context.Context) error, attempts int, delay time.Duration) error {
	var lastErr error
	for attempt := 0; attempt < attempts; attempt++ {
		if err := ctx.Err(); err != nil {
			return err
		}
		attemptCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
		lastErr = ping(attemptCtx)
		cancel()
		if lastErr == nil {
			return nil
		}
		if attempt+1 < attempts {
			timer := time.NewTimer(delay)
			select {
			case <-ctx.Done():
				timer.Stop()
				return ctx.Err()
			case <-timer.C:
			}
		}
	}
	return lastErr
}

func safeConnectionError(driver, host, port, password string, err error) error {
	detail := err.Error()
	if password != "" {
		detail = strings.ReplaceAll(detail, password, "[redacted]")
	}
	// Do not attach the original error: a driver may include credentials in it.
	return fmt.Errorf("数据库连接失败 (驱动=%s, 主机=%s, 端口=%s): %s", driver, host, port, detail)
}
