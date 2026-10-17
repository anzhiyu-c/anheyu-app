package captcha

import (
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
)

type imageSettings struct {
	setting.SettingService
	length string
}

func (s imageSettings) Get(key string) string {
	switch key {
	case constant.KeyCaptchaProvider.String():
		return "image"
	case constant.KeyImageCaptchaLength.String():
		return s.length
	default:
		return ""
	}
}

func TestImageCaptchaConfigurationReportsEffectiveLength(t *testing.T) {
	for _, tc := range []struct {
		configured string
		want       int
	}{{"4", 6}, {"6", 6}, {"8", 8}, {"invalid", 6}} {
		svc := NewCaptchaService(imageSettings{length: tc.configured}, nil, nil, nil)
		if got := svc.GetConfig().ImageCaptchaLength; got != tc.want {
			t.Fatalf("configured=%s length=%d want=%d", tc.configured, got, tc.want)
		}
	}
}
