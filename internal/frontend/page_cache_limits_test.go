package frontend

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestPageCacheDoesNotCaptureBypassRequests(t *testing.T) {
	for _, tc := range []struct {
		name, method, path, header, value string
	}{
		{"static", "GET", "/_next/static/chunk.js", "", ""},
		{"admin", "GET", "/admin", "", ""},
		{"rsc", "GET", "/posts/example", "RSC", "1"},
		{"authenticated", "GET", "/posts/example", "Cookie", "access_token=token"},
		{"authorization", "GET", "/posts/example", "Authorization", "Bearer token"},
		{"post", "POST", "/posts/example", "", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, nil)
			req.Header.Set(tc.header, tc.value)
			dst := &countingResponseWriter{header: make(http.Header)}
			writer, _ := wrapForCaching(dst, req)
			if _, err := writer.Write(bytes.Repeat([]byte("x"), 2<<20)); err != nil {
				t.Fatal(err)
			}
			if writer.body != nil && writer.body.Len() > 0 {
				t.Fatalf("uncacheable request retained %d response bytes", writer.body.Len())
			}
			if dst.written != 2<<20 {
				t.Fatalf("forwarded %d bytes, want %d", dst.written, 2<<20)
			}
		})
	}
}

func TestPageCacheDropsOversizedCaptureAndForwardsWholeResponse(t *testing.T) {
	ClearPageCache()
	t.Cleanup(ClearPageCache)
	dst := &countingResponseWriter{header: make(http.Header)}
	writer, save := wrapForCaching(dst, httptest.NewRequest("GET", "/posts/large", nil))
	chunk := bytes.Repeat([]byte("x"), 32<<10)
	for i := 0; i < 64; i++ {
		if _, err := writer.Write(chunk); err != nil {
			t.Fatal(err)
		}
	}
	save()
	if writer.body != nil && writer.body.Len() > 0 {
		t.Fatalf("oversized response retained %d bytes", writer.body.Len())
	}
	if sharedPageCache.get("/posts/large") != nil {
		t.Fatal("oversized response was cached")
	}
	if dst.written != 2<<20 {
		t.Fatalf("forwarded %d bytes, want %d", dst.written, 2<<20)
	}
}

func TestPageCacheDoesNotCapturePrivateOrErrorResponse(t *testing.T) {
	for _, tc := range []struct {
		name, header, value string
		status              int
	}{
		{"private", "Cache-Control", "private, max-age=60", 200},
		{"no-store", "Cache-Control", "no-store", 200},
		{"cookie", "Set-Cookie", "session=abc", 200},
		{"error", "", "", 503},
	} {
		t.Run(tc.name, func(t *testing.T) {
			dst := &countingResponseWriter{header: make(http.Header)}
			writer, _ := wrapForCaching(dst, httptest.NewRequest("GET", "/", nil))
			writer.Header().Set(tc.header, tc.value)
			writer.WriteHeader(tc.status)
			if _, err := writer.Write([]byte("response")); err != nil {
				t.Fatal(err)
			}
			if writer.body != nil && writer.body.Len() > 0 {
				t.Fatal("uncacheable response retained body")
			}
			if dst.written != 8 {
				t.Fatalf("forwarded %d bytes, want 8", dst.written)
			}
		})
	}
}

func TestPageCacheEnforcesLiveEntryLimit(t *testing.T) {
	pc := &pageCache{items: make(map[string]*cacheEntry)}
	for i := 0; i < 600; i++ {
		pc.set(fmt.Sprintf("/posts/example?variant=%d", i), []byte("page"), http.Header{}, 200)
	}
	if len(pc.items) > 512 {
		t.Fatalf("cache retained %d live entries, want at most 512", len(pc.items))
	}
}

func TestPageCacheEnforcesBodyBudget(t *testing.T) {
	pc := &pageCache{items: make(map[string]*cacheEntry)}
	body := bytes.Repeat([]byte("x"), 512<<10)
	for i := 0; i < 80; i++ {
		pc.set(fmt.Sprintf("/posts/example?variant=%d", i), body, http.Header{}, 200)
	}
	if total := cachedBodyBytes(pc); total > 32<<20 {
		t.Fatalf("cache retained %d body bytes, want at most %d", total, 32<<20)
	}
	if pc.get("/posts/example?variant=79") == nil {
		t.Fatal("latest response was not cached")
	}
}

func TestPageCacheRejectsOversizedEntry(t *testing.T) {
	pc := &pageCache{items: make(map[string]*cacheEntry)}
	pc.set("/posts/large", bytes.Repeat([]byte("x"), (1<<20)+1), http.Header{}, 200)
	if pc.get("/posts/large") != nil {
		t.Fatal("cache accepted body exceeding 1 MiB")
	}
}

func TestPageCacheReplacementAndExpiryKeepBudgetAccurate(t *testing.T) {
	pc := &pageCache{items: make(map[string]*cacheEntry)}
	pc.set("/posts/example", []byte("old body"), http.Header{}, 200)
	pc.set("/posts/example", []byte("new"), http.Header{}, 200)
	if pc.bodyBytes != 3 {
		t.Fatalf("replacement retained accounting for old body: %d", pc.bodyBytes)
	}
	pc.items["/posts/example"].expiresAt = time.Now().Add(-time.Second)
	if pc.get("/posts/example") != nil || pc.bodyBytes != 0 {
		t.Fatal("expired body was not released from budget")
	}
}

func TestPageCacheStoresAndServesPublicResponse(t *testing.T) {
	ClearPageCache()
	t.Cleanup(ClearPageCache)
	req := httptest.NewRequest("GET", "/album?category=photos", nil)
	writer, save := wrapForCaching(httptest.NewRecorder(), req)
	writer.Header().Set("Content-Type", "text/html")
	if _, err := writer.Write([]byte("public page")); err != nil {
		t.Fatal(err)
	}
	save()
	recorder := httptest.NewRecorder()
	if !tryServeFromCache(recorder, req) || recorder.Body.String() != "public page" || recorder.Header().Get("X-Cache") != "HIT" {
		t.Fatalf("response was not served intact from cache: %v %q", recorder.Header(), recorder.Body.String())
	}
	ClearPageCache()
	if sharedPageCache.bodyBytes != 0 || tryServeFromCache(httptest.NewRecorder(), req) {
		t.Fatal("cache clear did not release body and budget")
	}
}

func cachedBodyBytes(pc *pageCache) int {
	total := 0
	for _, entry := range pc.items {
		total += len(entry.body)
	}
	return total
}

type countingResponseWriter struct {
	header  http.Header
	written int
}

func (w *countingResponseWriter) Header() http.Header { return w.header }
func (w *countingResponseWriter) WriteHeader(int)     {}
func (w *countingResponseWriter) Write(b []byte) (int, error) {
	w.written += len(b)
	return len(b), nil
}

func BenchmarkProxyResponseCapture(b *testing.B) {
	for _, path := range []string{"/_next/static/chunk.js", "/posts/large"} {
		b.Run(path, func(b *testing.B) {
			chunk := bytes.Repeat([]byte("x"), 32<<10)
			req := httptest.NewRequest("GET", path, nil)
			b.ReportAllocs()
			b.SetBytes(2 << 20)
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				dst := &countingResponseWriter{header: make(http.Header)}
				writer, _ := wrapForCaching(dst, req)
				for j := 0; j < 64; j++ {
					if _, err := writer.Write(chunk); err != nil {
						b.Fatal(err)
					}
				}
			}
		})
	}
}
