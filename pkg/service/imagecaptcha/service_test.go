package imagecaptcha

import (
	"context"
	"errors"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"
)

type captchaSettings struct {
	setting.SettingService
	length string
}

func (s captchaSettings) Get(key string) string {
	if key == constant.KeyImageCaptchaLength.String() {
		return s.length
	}
	return "300"
}

func memoryCache(t *testing.T) utility.CacheService {
	t.Helper()
	cache := utility.NewMemoryCacheService()
	t.Cleanup(func() { cache.(interface{ Stop() }).Stop() })
	return cache
}

func TestGeneratedCaptchaRaisesLegacyShortLengthAndVerifiesOnce(t *testing.T) {
	for _, tc := range []struct {
		configured string
		want       int
	}{{"", 6}, {"1", 6}, {"4", 6}, {"invalid", 6}, {"6", 6}, {"8", 8}, {"10", 10}} {
		t.Run(tc.configured, func(t *testing.T) {
			cache := memoryCache(t)
			svc := NewImageCaptchaService(captchaSettings{length: tc.configured}, cache)
			id, image, err := svc.Generate(context.Background())
			if err != nil {
				t.Fatal(err)
			}
			answer, err := cache.Get(context.Background(), "captcha:image:"+id)
			if err != nil {
				t.Fatal(err)
			}
			if len(answer) != tc.want || strings.Trim(answer, "0123456789") != "" || !strings.HasPrefix(image, "data:image/png;base64,") {
				t.Fatalf("weak or invalid captcha: answer length=%d image length=%d", len(answer), len(image))
			}
			if err := svc.Verify(context.Background(), id, answer); err != nil {
				t.Fatal(err)
			}
			if err := svc.Verify(context.Background(), id, answer); err == nil {
				t.Fatal("captcha was replayed")
			}
		})
	}
}

func TestCaptchaWrongAnswerConsumesChallenge(t *testing.T) {
	cache := memoryCache(t)
	svc := NewImageCaptchaService(captchaSettings{}, cache)
	ctx := context.Background()
	if err := cache.Set(ctx, "captcha:image:challenge", "123456", time.Minute); err != nil {
		t.Fatal(err)
	}
	if err := svc.Verify(ctx, "challenge", "654321"); err == nil {
		t.Fatal("wrong answer accepted")
	}
	if err := svc.Verify(ctx, "challenge", "123456"); err == nil {
		t.Fatal("failed challenge was reusable")
	}
}

type failingDeleteCache struct{ utility.CacheService }

func (failingDeleteCache) Get(context.Context, string) (string, error) { return "123456", nil }
func (failingDeleteCache) Delete(context.Context, ...string) error {
	return errors.New("cache unavailable")
}

func TestCaptchaFailsClosedWhenConsumptionUnavailable(t *testing.T) {
	svc := NewImageCaptchaService(captchaSettings{}, failingDeleteCache{})
	if err := svc.Verify(context.Background(), "challenge", "123456"); err == nil {
		t.Fatal("captcha accepted without one-time consumption")
	}
}

func TestConcurrentCaptchaVerificationHasOnlyOneWinner(t *testing.T) {
	cache := memoryCache(t)
	svc := NewImageCaptchaService(captchaSettings{}, cache)
	ctx := context.Background()
	if err := cache.Set(ctx, "captcha:image:challenge", "123456", time.Minute); err != nil {
		t.Fatal(err)
	}
	var winners atomic.Int32
	var group sync.WaitGroup
	start := make(chan struct{})
	for i := 0; i < 64; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			<-start
			if err := svc.Verify(ctx, "challenge", "123456"); err == nil {
				winners.Add(1)
			}
		}()
	}
	close(start)
	group.Wait()
	if winners.Load() != 1 {
		t.Fatalf("concurrent successful verifications=%d, want one", winners.Load())
	}
}
