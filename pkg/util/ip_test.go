package util

import "testing"

func TestExtractIPFromHeaderIgnoresSpoofedLeftmostAddress(t *testing.T) {
	header := "1.2.3.4, 198.51.100.20"
	if got := extractIPFromHeader(header); got != "198.51.100.20" {
		t.Fatalf("got %q", got)
	}
}

func TestExtractIPFromHeaderSkipsTrustedProxiesFromTheRight(t *testing.T) {
	header := "1.2.3.4, 203.0.113.8, 10.0.0.8"
	if got := extractIPFromHeader(header); got != "203.0.113.8" {
		t.Fatalf("got %q", got)
	}
}
