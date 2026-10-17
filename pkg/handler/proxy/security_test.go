package proxy

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestProxyRecognizesModernImagesWithoutTrustingContentType(t *testing.T) {
	for brand, expected := range map[string]string{"avif": "image/avif", "heic": "image/heic", "mp42": ""} {
		data := make([]byte, 24)
		binary.BigEndian.PutUint32(data[:4], uint32(len(data)))
		copy(data[4:8], "ftyp")
		copy(data[8:12], brand)
		if got := proxyImageContentType(data); got != expected {
			t.Errorf("brand %s got %q want %q", brand, got, expected)
		}
	}
	if got := proxyImageContentType([]byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`)); got != "" {
		t.Fatal("active SVG accepted")
	}
}

type responseTransport func(*http.Request) (*http.Response, error)

func (f responseTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestProxyChecksActualImageTypeAndLength(t *testing.T) {
	var pngData bytes.Buffer
	if err := png.Encode(&pngData, image.NewRGBA(image.Rect(0, 0, 1, 1))); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name   string
		body   []byte
		length int64
		status int
	}{
		{"real image", pngData.Bytes(), int64(pngData.Len()), 200},
		{"spoofed image header", []byte("<html>not an image</html>"), -1, 502},
		{"oversized image", pngData.Bytes(), maxProxyResponseBytes + 1, 502},
	} {
		t.Run(tc.name, func(t *testing.T) {
			original := proxyDownloadClient.Transport
			proxyDownloadClient.Transport = responseTransport(func(r *http.Request) (*http.Response, error) {
				return &http.Response{StatusCode: 200, Header: http.Header{"Content-Type": []string{"image/png"}}, ContentLength: tc.length, Body: io.NopCloser(bytes.NewReader(tc.body)), Request: r}, nil
			})
			t.Cleanup(func() { proxyDownloadClient.Transport = original })
			r := gin.New()
			r.GET("/download", NewHandler().HandleDownload)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/download?url=https://example.com/image", nil))
			if w.Code != tc.status {
				t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
			}
			if tc.status == 200 && !bytes.Equal(w.Body.Bytes(), tc.body) {
				t.Fatal("image bytes changed")
			}
		})
	}
}

func TestProxyRejectsUnsafeTargetsBeforeRequest(t *testing.T) {
	r := gin.New()
	r.GET("/download", NewHandler().HandleDownload)
	for _, target := range []string{"http://127.0.0.1:8080/", "https://user:password@127.0.0.1/", "http://169.254.169.254/", "http://[::1]/", "file:///tmp/test"} {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/download?url="+url.QueryEscape(target), nil))
		if w.Code != http.StatusBadRequest {
			t.Errorf("target %s returned %d, want 400", target, w.Code)
		}
	}
}
