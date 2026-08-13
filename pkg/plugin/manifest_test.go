package plugin

import (
	"strings"
	"testing"
)

func validManifestJSON() string {
	return `{
		"manifest_version": 1,
		"id": "test-plugin",
		"name": "测试插件",
		"version": "1.0.0",
		"types": ["eventhook"],
		"entry": {"` + CurrentPlatform() + `": "bin/test-plugin"}
	}`
}

func TestParseManifestValid(t *testing.T) {
	m, err := ParseManifest([]byte(validManifestJSON()))
	if err != nil {
		t.Fatalf("解析合法 manifest 失败: %v", err)
	}
	if m.ID != "test-plugin" {
		t.Errorf("ID = %q, 期望 test-plugin", m.ID)
	}
	rel, err := m.EntryForCurrentPlatform()
	if err != nil {
		t.Fatalf("EntryForCurrentPlatform 失败: %v", err)
	}
	if rel != "bin/test-plugin" {
		t.Errorf("entry = %q, 期望 bin/test-plugin", rel)
	}
}

func TestParseManifestInvalid(t *testing.T) {
	cases := []struct {
		name string
		json string
	}{
		{"错误的 manifest_version", `{"manifest_version": 2, "id": "a-b", "name": "x", "version": "1.0", "entry": {"linux-amd64": "bin/x"}}`},
		{"非法 id 大写", `{"manifest_version": 1, "id": "Bad-ID", "name": "x", "version": "1.0", "entry": {"linux-amd64": "bin/x"}}`},
		{"非法 id 过短", `{"manifest_version": 1, "id": "a", "name": "x", "version": "1.0", "entry": {"linux-amd64": "bin/x"}}`},
		{"缺少 name", `{"manifest_version": 1, "id": "a-b", "name": " ", "version": "1.0", "entry": {"linux-amd64": "bin/x"}}`},
		{"缺少 entry", `{"manifest_version": 1, "id": "a-b", "name": "x", "version": "1.0", "entry": {}}`},
		{"entry 绝对路径", `{"manifest_version": 1, "id": "a-b", "name": "x", "version": "1.0", "entry": {"linux-amd64": "/bin/x"}}`},
		{"entry 路径穿越", `{"manifest_version": 1, "id": "a-b", "name": "x", "version": "1.0", "entry": {"linux-amd64": "../x"}}`},
		{"config_schema 非法类型", `{"manifest_version": 1, "id": "a-b", "name": "x", "version": "1.0", "entry": {"linux-amd64": "bin/x"}, "config_schema": [{"key": "k", "label": "K", "type": "json"}]}`},
		{"select 缺少 options", `{"manifest_version": 1, "id": "a-b", "name": "x", "version": "1.0", "entry": {"linux-amd64": "bin/x"}, "config_schema": [{"key": "k", "label": "K", "type": "select"}]}`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, err := ParseManifest([]byte(c.json)); err == nil {
				t.Errorf("期望校验失败，实际通过")
			}
		})
	}
}

func TestManifestEntryMissingPlatform(t *testing.T) {
	m, err := ParseManifest([]byte(`{
		"manifest_version": 1, "id": "a-b", "name": "x", "version": "1.0",
		"entry": {"plan9-386": "bin/x"}
	}`))
	if err != nil {
		t.Fatalf("解析失败: %v", err)
	}
	if _, err := m.EntryForCurrentPlatform(); err == nil {
		t.Error("期望返回平台不支持错误，实际成功")
	} else if !strings.Contains(err.Error(), CurrentPlatform()) {
		t.Errorf("错误信息应包含当前平台标识: %v", err)
	}
}

func TestManifestToMetadata(t *testing.T) {
	m, err := ParseManifest([]byte(`{
		"manifest_version": 1, "id": "a-b", "name": "插件", "version": "2.0",
		"description": "desc", "author": "me", "homepage": "https://example.com",
		"types": ["searcher", "eventhook"],
		"entry": {"linux-amd64": "bin/x"}
	}`))
	if err != nil {
		t.Fatalf("解析失败: %v", err)
	}
	meta := m.ToMetadata()
	if meta.ID != "a-b" || meta.Name != "插件" || meta.Version != "2.0" {
		t.Errorf("基础字段转换错误: %+v", meta)
	}
	if meta.Type != "searcher" {
		t.Errorf("Type 应取 Types 首项，实际 %q", meta.Type)
	}
	if len(meta.Types) != 2 || meta.Homepage != "https://example.com" {
		t.Errorf("Types/Homepage 转换错误: %+v", meta)
	}
}
