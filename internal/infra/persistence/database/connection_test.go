package database

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestPingWithRetryRecoversAndHonorsCancellation(t *testing.T) {
	attempts := 0
	err := pingWithRetry(context.Background(), func(context.Context) error {
		attempts++
		if attempts < 3 {
			return errors.New("temporary DNS failure")
		}
		return nil
	}, 4, time.Millisecond)
	if err != nil || attempts != 3 {
		t.Fatalf("err=%v attempts=%d", err, attempts)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	err = pingWithRetry(ctx, func(context.Context) error { t.Fatal("ping after cancel"); return nil }, 4, time.Second)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected cancellation, got %v", err)
	}
}

func TestConnectionErrorDoesNotRevealPassword(t *testing.T) {
	err := safeConnectionError("postgres", "postgres.local", "5432", "private-pass", errors.New("invalid DSN password=private-pass"))
	if strings.Contains(err.Error(), "private-pass") || !strings.Contains(err.Error(), "postgres.local") {
		t.Fatal(err)
	}
}
