package theme

import (
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
)

func TestThemeDownloadRejectsUnsafeURLBeforeRequest(t *testing.T) {
	for _, target := range []string{"http://example.com/theme.zip", "https://127.0.0.1/theme.zip", "https://[::1]/theme.zip", "https://169.254.169.254/theme.zip", "https://10.0.0.1/theme.zip", "https://example.com:8080/theme.zip", "https://user:password@example.com/theme.zip"} {
		t.Run(target, func(t *testing.T) {
			calls := 0
			original := themeDownloadClient.Transport
			themeDownloadClient.Transport = themeRoundTripper(func(r *http.Request) (*http.Response, error) {
				calls++
				return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader("not a zip")), Request: r}, nil
			})
			t.Cleanup(func() { themeDownloadClient.Transport = original })
			err := (&themeService{}).downloadAndExtractTheme(target, t.TempDir())
			if err == nil || calls != 0 {
				t.Fatalf("unsafe URL reached transport: calls=%d err=%v", calls, err)
			}
		})
	}
}

type trackedThemeDownloadBody struct {
	reads  int
	closed bool
}

func (b *trackedThemeDownloadBody) Read([]byte) (int, error) {
	b.reads++
	return 0, io.EOF
}

func (b *trackedThemeDownloadBody) Close() error {
	b.closed = true
	return nil
}

func TestThemeDownloadRejectsOversizedContentLengthBeforeReadingBody(t *testing.T) {
	body := &trackedThemeDownloadBody{}
	calls := 0
	original := themeDownloadClient.Transport
	themeDownloadClient.Transport = themeRoundTripper(func(req *http.Request) (*http.Response, error) {
		calls++
		return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), ContentLength: maxThemeDownloadBytes + 1, Body: body, Request: req}, nil
	})
	t.Cleanup(func() { themeDownloadClient.Transport = original })
	destination := t.TempDir()
	err := (&themeService{}).downloadAndExtractTheme("https://example.com/theme.zip", destination)
	if err == nil || !strings.Contains(err.Error(), "大小限制") {
		t.Fatalf("oversized download was not rejected: %v", err)
	}
	if calls != 1 || body.reads != 0 || !body.closed {
		t.Fatalf("invalid oversized download lifecycle: calls=%d reads=%d closed=%v", calls, body.reads, body.closed)
	}
	files, err := os.ReadDir(destination)
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 0 {
		t.Fatalf("oversized response was extracted: %v", files)
	}
}
