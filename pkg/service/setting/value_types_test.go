package setting

import "testing"

func TestPublicOwnerNamePreservesText(t *testing.T) {
	for _, value := range []string{"0988", "0", "001a", "true", "false"} {
		t.Run(value, func(t *testing.T) {
			got := unflatten(map[string]string{"frontDesk.siteOwner.name": value})
			name := got["frontDesk"].(map[string]interface{})["siteOwner"].(map[string]interface{})["name"]
			if name != value {
				t.Fatalf("name = %#v (%T), want string %q", name, name, value)
			}
		})
	}
}

func TestPublicConfigKeepsNumericAndBooleanValues(t *testing.T) {
	got := unflatten(map[string]string{"PAGE_SIZE": "10", "sidebar.author.enable": "false", "HOME_TOP": `{"enable":true}`})
	if got["PAGE_SIZE"] != int64(10) || got["sidebar"].(map[string]interface{})["author"].(map[string]interface{})["enable"] != false {
		t.Fatalf("numeric/boolean config changed: %#v", got)
	}
	if got["HOME_TOP"].(map[string]interface{})["enable"] != true {
		t.Fatalf("JSON config changed: %#v", got)
	}
}
