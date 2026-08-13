package plugin

import (
	"os"
	"path/filepath"
	"testing"
)

func TestStateStorePersistence(t *testing.T) {
	dir := t.TempDir()

	s := newStateStore(dir)
	if err := s.SetDisabled("plugin-a", true); err != nil {
		t.Fatalf("SetDisabled 失败: %v", err)
	}
	if err := s.SetConfig("plugin-b", map[string]string{"key": "value"}); err != nil {
		t.Fatalf("SetConfig 失败: %v", err)
	}

	// 重新加载，模拟应用重启
	s2 := newStateStore(dir)
	if !s2.IsDisabled("plugin-a") {
		t.Error("重启后 plugin-a 应保持禁用")
	}
	if s2.IsDisabled("plugin-b") {
		t.Error("plugin-b 不应被禁用")
	}
	if got := s2.GetConfig("plugin-b")["key"]; got != "value" {
		t.Errorf("重启后配置丢失: got %q", got)
	}

	// 启用后再重启
	if err := s2.SetDisabled("plugin-a", false); err != nil {
		t.Fatalf("SetDisabled(false) 失败: %v", err)
	}
	s3 := newStateStore(dir)
	if s3.IsDisabled("plugin-a") {
		t.Error("启用状态未持久化")
	}
}

func TestStateStoreRemove(t *testing.T) {
	dir := t.TempDir()
	s := newStateStore(dir)
	if err := s.SetDisabled("p", true); err != nil {
		t.Fatalf("SetDisabled 失败: %v", err)
	}
	if err := s.SetConfig("p", map[string]string{"a": "1"}); err != nil {
		t.Fatalf("SetConfig 失败: %v", err)
	}
	if err := s.Remove("p"); err != nil {
		t.Fatalf("Remove 失败: %v", err)
	}

	s2 := newStateStore(dir)
	if s2.IsDisabled("p") || len(s2.GetConfig("p")) != 0 {
		t.Error("Remove 后状态应被清空")
	}
}

func TestStateStoreCorruptedFile(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, StateFileName), []byte("{invalid json"), 0644); err != nil {
		t.Fatalf("写入损坏文件失败: %v", err)
	}

	s := newStateStore(dir)
	if s.IsDisabled("any") {
		t.Error("损坏的状态文件应以空状态启动")
	}
	// 仍可正常写入
	if err := s.SetDisabled("x", true); err != nil {
		t.Fatalf("损坏文件恢复后写入失败: %v", err)
	}
}

func TestSubscriptionMatches(t *testing.T) {
	cases := []struct {
		subs []string
		name string
		want bool
	}{
		{nil, "article.published", true},                                   // 空订阅 = 全部
		{[]string{"*"}, "comment.created", true},                           // 通配
		{[]string{"article.published"}, "article.published", true},         // 精确匹配
		{[]string{"article.published"}, "article.deleted", false},          // 不匹配
		{[]string{"a.b", "article.deleted"}, "article.deleted", true},      // 多订阅
	}
	for _, c := range cases {
		if got := subscriptionMatches(c.subs, c.name); got != c.want {
			t.Errorf("subscriptionMatches(%v, %q) = %v, 期望 %v", c.subs, c.name, got, c.want)
		}
	}
}

func TestBuildConfigEnv(t *testing.T) {
	env := buildConfigEnv(map[string]string{"webhook-url": "https://example.com"})
	var hasJSON, hasItem bool
	for _, e := range env {
		if e == `ANHEYU_PLUGIN_CONFIG={"webhook-url":"https://example.com"}` {
			hasJSON = true
		}
		if e == "ANHEYU_PLUGIN_CONFIG_WEBHOOK_URL=https://example.com" {
			hasItem = true
		}
	}
	if !hasJSON {
		t.Errorf("缺少整体 JSON 环境变量: %v", env)
	}
	if !hasItem {
		t.Errorf("缺少逐项环境变量（key 应规范化为大写下划线）: %v", env)
	}

	if got := buildConfigEnv(nil); got != nil {
		t.Errorf("空配置应返回 nil: %v", got)
	}
}
