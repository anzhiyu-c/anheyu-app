package configdef

import (
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
)

func TestScheduledThemeDefinitions(t *testing.T) {
	tests := []struct {
		name      string
		key       constant.SettingKey
		wantValue string
	}{
		{name: "light start", key: constant.KeyThemeLightStartTime, wantValue: "08:00"},
		{name: "dark start", key: constant.KeyThemeDarkStartTime, wantValue: "20:00"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var found *Definition
			for i := range AllSettings {
				if AllSettings[i].Key == tt.key {
					found = &AllSettings[i]
					break
				}
			}

			if found == nil {
				t.Fatalf("setting definition %q not found", tt.key)
			}
			if found.Value != tt.wantValue {
				t.Errorf("setting definition %q value = %q, want %q", tt.key, found.Value, tt.wantValue)
			}
			if !found.IsPublic {
				t.Errorf("setting definition %q must be public", tt.key)
			}
		})
	}
}
