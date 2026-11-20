package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

func TestUpyunListReadsAllPages(t *testing.T) {
	for _, tc := range []struct{ name, basePath, virtualPath, wantPath string }{
		{"root", "", "/files", "/bucket"},
		{"nested", "/photos/", "/files/album", "/bucket/photos/album"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			requests := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				requests++
				if r.Method != http.MethodGet || r.URL.Path != tc.wantPath || r.Header.Get("Accept") != "application/json" {
					t.Errorf("request = %s %s, Accept=%q", r.Method, r.URL.Path, r.Header.Get("Accept"))
				}
				var body string
				switch r.Header.Get("X-List-Iter") {
				case "":
					body = `{"files":[{"name":"folder","type":"folder","length":0,"last_modified":1792713600}],"iter":"next"}`
				case "next":
					w.Header().Set("X-Upyun-List-Iter", "last")
					body = `{"files":[]}`
				case "last":
					body = `{"files":[{"name":"last.jpg","type":"image/jpeg","length":42,"last_modified":1792713600}],"iter":"g2gCZAAEbmV4dGQAA2VvZg"}`
				default:
					t.Errorf("unexpected iterator %q", r.Header.Get("X-List-Iter"))
					w.WriteHeader(http.StatusBadRequest)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				if _, err := fmt.Fprint(w, body); err != nil {
					t.Errorf("write response: %v", err)
				}
			}))
			defer server.Close()
			policy := &model.StoragePolicy{Server: server.URL, BucketName: "bucket", AccessKey: "operator", SecretKey: "password", VirtualPath: "/files", BasePath: tc.basePath}
			files, err := (&UpyunProvider{client: server.Client()}).List(context.Background(), policy, tc.virtualPath)
			if err != nil {
				t.Fatalf("List: %v", err)
			}
			if len(files) != 2 || files[0].Name != "folder" || !files[0].IsDir || files[1].Name != "last.jpg" || files[1].Size != 42 || files[1].ModTime.IsZero() {
				t.Fatalf("List = %+v, want directory and last-page file with length", files)
			}
			if requests != 3 {
				t.Fatalf("requests = %d, want 3", requests)
			}
		})
	}
}

func TestUpyunListRejectsIncompletePages(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status int
		body   string
	}{
		{"missing-next-page", http.StatusNotFound, `missing`},
		{"server-error", http.StatusInternalServerError, `unavailable`},
		{"malformed-json", http.StatusOK, `{"files":[`},
		{"missing-files", http.StatusOK, `{"iter":"g2gCZAAEbmV4dGQAA2VvZg"}`},
		{"missing-iterator", http.StatusOK, `{"files":[]}`},
		{"repeated-iterator", http.StatusOK, `{"files":[],"iter":"next"}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			requests := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				requests++
				if requests > 2 {
					t.Error("invalid iterator was followed")
					w.WriteHeader(http.StatusInternalServerError)
					return
				}
				body := `{"files":[{"name":"first.txt","length":1}],"iter":"next"}`
				if requests > 1 {
					body = tc.body
					w.WriteHeader(tc.status)
				}
				if _, err := fmt.Fprint(w, body); err != nil {
					t.Errorf("write response: %v", err)
				}
			}))
			defer server.Close()
			policy := &model.StoragePolicy{Server: server.URL, BucketName: "bucket", AccessKey: "operator", SecretKey: "password"}
			files, err := (&UpyunProvider{client: server.Client()}).List(context.Background(), policy, "/")
			if !errors.Is(err, ErrIncompleteListing) || files != nil {
				t.Fatalf("List = %+v, %v; want nil, ErrIncompleteListing", files, err)
			}
		})
	}
}

func TestUpyunListEmptyDirectory(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := fmt.Fprint(w, `{"files":[],"iter":"g2gCZAAEbmV4dGQAA2VvZg"}`); err != nil {
			t.Errorf("write response: %v", err)
		}
	}))
	defer server.Close()
	policy := &model.StoragePolicy{Server: server.URL, BucketName: "bucket", AccessKey: "operator", SecretKey: "password"}
	files, err := (&UpyunProvider{client: server.Client()}).List(context.Background(), policy, "/")
	if err != nil || len(files) != 0 {
		t.Fatalf("List = %+v, %v; want successful empty directory", files, err)
	}
}

type upyunListTransport func(*http.Request) (*http.Response, error)

func (f upyunListTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestUpyunListCancellationDiscardsPartialResults(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	requests := 0
	client := &http.Client{Transport: upyunListTransport(func(req *http.Request) (*http.Response, error) {
		requests++
		cancel()
		body := `{"files":[{"name":"first.txt","length":1}],"iter":"next"}`
		return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}, nil
	})}
	policy := &model.StoragePolicy{Server: "https://upyun.test", BucketName: "bucket", AccessKey: "operator", SecretKey: "password"}
	files, err := (&UpyunProvider{client: client}).List(ctx, policy, "/")
	if files != nil || !errors.Is(err, context.Canceled) || !errors.Is(err, ErrIncompleteListing) || requests != 1 {
		t.Fatalf("List = %+v, %v, requests = %d; want canceled incomplete listing", files, err, requests)
	}
}
