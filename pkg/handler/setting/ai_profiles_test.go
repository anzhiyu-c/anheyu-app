package setting_handler

import "testing"

func TestMaskAIProfilesSettingHidesPlaintextKeys(t *testing.T) {
	raw := `[{"id":"primary","name":"Primary","provider":"openai","api_url":"https://api.example.com/v1/chat/completions","model":"gpt-4o","enabled":true,"api_key":"sk-live-secret"},{"id":"draft","name":"Draft","provider":"custom","api_url":"https://custom.example.com/chat","model":"custom-model","enabled":false}]`

	masked := maskAIProfilesSetting(raw)

	if masked == "" {
		t.Fatal("expected masked profile JSON")
	}
	if masked == raw {
		t.Fatal("expected profile JSON to be transformed")
	}
	if containsSubstring(masked, "sk-live-secret") {
		t.Fatalf("masked profile JSON leaked plaintext key: %s", masked)
	}
	if !containsSubstring(masked, `"has_api_key":true`) {
		t.Fatalf("masked profile should expose key presence: %s", masked)
	}
	if !containsSubstring(masked, `"api_key_masked":"************cret"`) {
		t.Fatalf("masked profile should include masked key suffix: %s", masked)
	}
}

func TestPrepareAIProfilesSettingPreservesMaskedKeys(t *testing.T) {
	existing := `[{"id":"primary","name":"Primary","provider":"openai","api_url":"https://api.example.com/v1/chat/completions","model":"gpt-4o","enabled":true,"api_key":"sk-live-secret"},{"id":"fresh","name":"Fresh","provider":"glm","api_url":"https://glm.example.com","model":"glm-4","enabled":true,"api_key":"fresh-secret"}]`
	incoming := `[{"id":"primary","name":"Primary Updated","provider":"openai","api_url":"https://api.example.com/v1/chat/completions","model":"gpt-4o-mini","enabled":true,"api_key_masked":"************cret","has_api_key":true},{"id":"fresh","name":"Fresh","provider":"glm","api_url":"https://glm.example.com","model":"glm-4","enabled":true,"api_key":"new-secret"}]`

	prepared := prepareAIProfilesSettingForSave(incoming, existing)

	if !containsSubstring(prepared, `"api_key":"sk-live-secret"`) {
		t.Fatalf("expected masked key to preserve existing plaintext key: %s", prepared)
	}
	if !containsSubstring(prepared, `"api_key":"new-secret"`) {
		t.Fatalf("expected explicit new key to be saved: %s", prepared)
	}
	if containsSubstring(prepared, "api_key_masked") || containsSubstring(prepared, "has_api_key") {
		t.Fatalf("stored profile JSON should not include response-only key metadata: %s", prepared)
	}
}

func containsSubstring(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

func TestMaskSensitiveSettingsHandlesUnflattenedProfiles(t *testing.T) {
	// GetByKeys 经过 unflatten 后，ai_profiles 是 []interface{} 而不是字符串。
	settings := map[string]interface{}{
		aiProfilesSettingKey: []interface{}{
			map[string]interface{}{"id": "primary", "name": "Primary", "provider": "openai", "enabled": true, "api_key": "sk-live-secret"},
		},
	}

	maskSensitiveSettings(settings)

	profiles, ok := settings[aiProfilesSettingKey].([]interface{})
	if !ok || len(profiles) != 1 {
		t.Fatalf("expected masked profiles array, got %#v", settings[aiProfilesSettingKey])
	}
	profile := profiles[0].(map[string]interface{})
	if _, exists := profile["api_key"]; exists {
		t.Fatalf("masked profile leaked api_key: %#v", profile)
	}
	if profile["has_api_key"] != true || profile["api_key_masked"] != "************cret" {
		t.Fatalf("unexpected masked profile: %#v", profile)
	}
}
