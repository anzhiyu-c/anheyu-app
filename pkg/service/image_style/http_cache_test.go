package image_style

import "testing"

func TestMatchesIfNoneMatch(t *testing.T) {
	current := `"0123456789abcdef-fedcba9876543210"`
	tests := []struct {
		name   string
		header string
		want   bool
	}{
		{name: "exact", header: current, want: true},
		{name: "weak", header: "W/" + current, want: true},
		{name: "list", header: `"other", W/` + current + `, "last"`, want: true},
		{name: "wildcard", header: "*", want: true},
		{name: "comma inside opaque tag", header: `"a,b", "other"`, want: false},
		{name: "mismatch", header: `"other"`, want: false},
		{name: "empty", header: "", want: false},
		{name: "invalid token", header: "0123456789abcdef", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := MatchesIfNoneMatch(tt.header, current); got != tt.want {
				t.Fatalf("MatchesIfNoneMatch(%q, %q)=%v，期望 %v", tt.header, current, got, tt.want)
			}
		})
	}
}
