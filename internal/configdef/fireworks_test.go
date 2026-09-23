package configdef

import (
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
)

func TestFireworksDefaultsArePublicAndOptIn(t *testing.T) {
	for key, value := range map[constant.SettingKey]string{
		constant.KeyFireworksEnable:     "false",
		constant.KeyFireworksButtonText: "节日快乐",
		constant.KeyFireworksMessage:    "愿你的每一天都有新的惊喜",
	} {
		found := false
		for _, definition := range AllSettings {
			if definition.Key == key {
				found = true
				if definition.Value != value || !definition.IsPublic {
					t.Errorf("%s: expected public default %q, got %#v", key, value, definition)
				}
			}
		}
		if !found {
			t.Errorf("missing setting %s", key)
		}
	}
}
