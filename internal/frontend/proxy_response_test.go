package frontend

import (
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestStaticProxyResponseDoesNotCacheErrorsOrForwardHTML(t *testing.T) {
	ps := newProxyState(&Launcher{})
	for _, tc := range []struct {
		name, contentType, encoding string
		status                      int
	}{
		{"compressed html", "text/html; charset=utf-8", "gzip", 200},
		{"brotli html", "text/html", "br", 404},
		{"missing chunk", "text/plain", "", 404},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "http://localhost/_next/static/chunks/missing.js", nil)
			if err != nil {
				t.Fatal(err)
			}
			resp := &http.Response{StatusCode: tc.status, Header: http.Header{"Content-Type": {tc.contentType}, "Content-Encoding": {tc.encoding}, "Etag": {"old"}}, Body: io.NopCloser(strings.NewReader("<html>oops</html>")), Request: req}
			if err := ps.proxy.ModifyResponse(resp); err != nil {
				t.Fatal(err)
			}
			if resp.StatusCode != http.StatusNotFound || resp.Header.Get("Cache-Control") != "no-store" {
				t.Fatalf("error cached or status wrong: %d %v", resp.StatusCode, resp.Header)
			}
			if strings.Contains(tc.contentType, "text/html") {
				body, err := io.ReadAll(resp.Body)
				if err != nil {
					t.Fatal(err)
				}
				if string(body) != "not found\n" || resp.Header.Get("Content-Encoding") != "" || resp.Header.Get("Etag") != "" {
					t.Fatalf("replacement has invalid entity headers/body: %q %v", body, resp.Header)
				}
			}
		})
	}
}

func TestStaticProxyResponseCachesSuccessfulAsset(t *testing.T) {
	ps := newProxyState(&Launcher{})
	req, err := http.NewRequest(http.MethodGet, "http://localhost/_next/static/chunks/current.js", nil)
	if err != nil {
		t.Fatal(err)
	}
	resp := &http.Response{StatusCode: 200, Header: http.Header{"Content-Type": {"application/javascript"}, "Content-Encoding": {"br"}}, Body: io.NopCloser(strings.NewReader("asset")), Request: req}
	if err := ps.proxy.ModifyResponse(resp); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(resp.Header.Get("Cache-Control"), "immutable") || resp.Header.Get("Content-Encoding") != "br" {
		t.Fatal(resp.Header)
	}
}
