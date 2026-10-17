package ssr

import (
	"archive/tar"
	"bytes"
	"context"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type downloadRoundTripper func(*http.Request) (*http.Response, error)

func (f downloadRoundTripper) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestSSRInstallRejectsUnsafeDownloadsBeforeRequest(t *testing.T) {
	for _, target := range []string{"http://example.com/theme.tgz", "https://100.100.100.200/theme.tgz", "https://example.com:8443/theme.tgz", "https://user:pass@example.com/theme.tgz"} {
		t.Run(target, func(t *testing.T) {
			calls := 0
			original := ssrDownloadClient.Transport
			ssrDownloadClient.Transport = downloadRoundTripper(func(r *http.Request) (*http.Response, error) {
				calls++
				return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader("not a theme")), Request: r}, nil
			})
			t.Cleanup(func() { ssrDownloadClient.Transport = original })
			err := NewManager(t.TempDir()).Install(context.Background(), "theme-safe", target)
			if err == nil || calls != 0 {
				t.Fatalf("unsafe target reached request: calls=%d err=%v", calls, err)
			}
		})
	}
}

func TestSSRInstallAcceptsPublicHTTPSTheme(t *testing.T) {
	archive := ssrArchive(t, "theme-safe/server.js", tar.TypeReg, "theme-safe/public/main.css")
	calls := 0
	original := ssrDownloadClient.Transport
	ssrDownloadClient.Transport = downloadRoundTripper(func(req *http.Request) (*http.Response, error) {
		calls++
		if req.URL.String() != "https://example.com/theme.tgz" {
			t.Errorf("unexpected URL: %s", req.URL)
		}
		return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), ContentLength: int64(len(archive)), Body: io.NopCloser(bytes.NewReader(archive)), Request: req}, nil
	})
	t.Cleanup(func() { ssrDownloadClient.Transport = original })
	base := t.TempDir()
	if err := NewManager(base).Install(context.Background(), "theme-safe", "https://example.com/theme.tgz"); err != nil {
		t.Fatal(err)
	}
	if calls != 1 {
		t.Fatalf("download calls=%d, want 1", calls)
	}
	for _, name := range []string{"server.js", "public/main.css"} {
		data, err := os.ReadFile(filepath.Join(base, "theme-safe", filepath.FromSlash(name)))
		if err != nil || string(data) != "harmless test content" {
			t.Fatalf("installed %s incorrectly: body=%q err=%v", name, data, err)
		}
	}
}
