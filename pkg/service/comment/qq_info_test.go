package comment

import (
	"context"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"net/http"
	"net/http/httptest"
	"testing"
)

type qqSettings struct {
	setting.SettingService
	values map[string]string
}

func (s qqSettings) Get(key string) string { return s.values[key] }
func TestQQAvatarIndependentOfNicknameProvider(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(503) }))
	defer server.Close()
	for _, values := range []map[string]string{{}, {constant.KeyCommentQQAPIURL.String(): server.URL, constant.KeyCommentQQAPIKey.String(): "key"}} {
		svc := &Service{settingSvc: qqSettings{values: values}}
		result, err := svc.GetQQInfo(context.Background(), "123456", "")
		if err != nil || result.Avatar != "https://q.qlogo.cn/headimg_dl?dst_uin=123456&spec=640&img_type=jpg" || result.Nickname != "" {
			t.Fatalf("result=%+v err=%v", result, err)
		}
		if _, err := svc.GetQQInfo(context.Background(), "bad&qq=42", ""); err == nil {
			t.Fatal("invalid QQ accepted")
		}
	}
}
