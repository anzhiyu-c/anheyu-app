package frontend

import (
	"net/http/httptest"
	"testing"
)

func TestPageCacheDoesNotStorePersonalizedResponses(t *testing.T) {
	for _, header := range []struct{ key, value string }{{"Cache-Control", "private, max-age=60"}, {"Cache-Control", "no-store"}, {"Set-Cookie", "session=abc"}} {
		ClearPageCache()
		req := httptest.NewRequest("GET", "/posts/example", nil)
		writer, save := wrapForCaching(httptest.NewRecorder(), req)
		writer.Header().Set(header.key, header.value)
		if _, err := writer.Write([]byte("personalized")); err != nil {
			t.Fatal(err)
		}
		save()
		if sharedPageCache.get("/posts/example") != nil {
			t.Errorf("cached %s response", header.key)
		}
	}
	for _, path := range []string{"/sw.js", "/manifest.json", "/offline.html"} {
		if isCacheablePath(path) {
			t.Errorf("cached %s", path)
		}
	}
}
