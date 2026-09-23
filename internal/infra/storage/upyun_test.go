package storage

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

func TestUpyunGetDownloadURLPrefersCDNDomain(t *testing.T) {
	provider := NewUpyunProvider()
	policy := &model.StoragePolicy{
		Server: "https://v0.api.upyun.com",
		Settings: model.StoragePolicySettings{
			"cdn_domain": "https://cdn.example.com/",
		},
	}

	got, err := provider.GetDownloadURL(context.Background(), policy, "base/path/file name.jpg", DownloadURLOptions{})
	if err != nil {
		t.Fatalf("GetDownloadURL returned error: %v", err)
	}

	want := "https://cdn.example.com/base/path/file%20name.jpg"
	if got != want {
		t.Fatalf("GetDownloadURL = %q, want %q", got, want)
	}
}

func TestUpyunUploadHTTP(t *testing.T) {
	const payload = "test image bytes"
	var requests int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		if r.Method != http.MethodPut {
			t.Errorf("method = %s, want PUT", r.Method)
		}
		if got, want := r.URL.EscapedPath(), "/bucket/base/album/file%20%23%3F%25.png"; got != want {
			t.Errorf("escaped path = %q, want %q", got, want)
		}
		username, password, ok := r.BasicAuth()
		if !ok || username != "operator" || password != "test-password" {
			t.Error("request did not carry expected operator credentials")
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("read body: %v", err)
		}
		if string(body) != payload {
			t.Errorf("body = %q, want %q", body, payload)
		}
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()
	provider := &UpyunProvider{client: server.Client()}
	policy := &model.StoragePolicy{Server: server.URL, BucketName: "bucket", AccessKey: "operator", SecretKey: "test-password", VirtualPath: "/files", BasePath: "/base/"}
	result, err := provider.Upload(context.Background(), strings.NewReader(payload), policy, "/files/album/file #?%.png")
	if err != nil {
		t.Fatalf("Upload: %v", err)
	}
	if result.Source != "base/album/file #?%.png" || result.Size != int64(len(payload)) || result.MimeType != "image/png" {
		t.Fatalf("unexpected upload result: %+v", result)
	}
	if requests != 1 {
		t.Fatalf("requests = %d, want 1", requests)
	}
}

func TestUpyunPreviewURLPreservesObjectPathAndQuery(t *testing.T) {
	for _, tc := range []struct {
		name     string
		settings model.StoragePolicySettings
		want     string
	}{
		{"cdn", model.StoragePolicySettings{"cdn_domain": "https://cdn.example.com/"}, "https://cdn.example.com/base/file%20%23%3F%25.png?image/resize,w_200"},
		{"endpoint", nil, "https://storage.example.com/bucket/base/file%20%23%3F%25.png?image/resize,w_200"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			provider := NewUpyunProvider()
			policy := &model.StoragePolicy{Server: "storage.example.com/", BucketName: "bucket", Settings: tc.settings}
			got, err := provider.GetDownloadURL(context.Background(), policy, "base/file #?%.png", DownloadURLOptions{QueryParams: "?image/resize,w_200"})
			if err != nil {
				t.Fatalf("GetDownloadURL: %v", err)
			}
			if got != tc.want {
				t.Fatalf("URL = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestUpyunDeleteHTTPAcceptsMissingObjects(t *testing.T) {
	statuses := []int{http.StatusOK, http.StatusNoContent, http.StatusNotFound}
	var paths []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("method = %s, want DELETE", r.Method)
		}
		paths = append(paths, r.URL.EscapedPath())
		w.WriteHeader(statuses[len(paths)-1])
	}))
	defer server.Close()
	provider := &UpyunProvider{client: server.Client()}
	policy := &model.StoragePolicy{Server: server.URL, BucketName: "bucket", AccessKey: "operator", SecretKey: "test-password"}
	if err := provider.Delete(context.Background(), policy, []string{"base/one.png", "base/two #.png", "base/missing.png"}); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if got, want := strings.Join(paths, ","), "/bucket/base/one.png,/bucket/base/two%20%23.png,/bucket/base/missing.png"; got != want {
		t.Fatalf("paths = %q, want %q", got, want)
	}
}

func TestUpyunHTTPFailureDoesNotExposeResponseBody(t *testing.T) {
	const sensitiveBody = "operator=private-operator password=private-password Authorization=Basic c2VjcmV0"
	for _, operation := range []string{"upload", "delete", "get", "head", "list", "rename"} {
		t.Run(operation, func(t *testing.T) {
			var requests int
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				requests++
				w.WriteHeader(http.StatusForbidden)
				if _, err := fmt.Fprint(w, sensitiveBody); err != nil {
					t.Errorf("write mock response: %v", err)
				}
			}))
			defer server.Close()
			provider := &UpyunProvider{client: server.Client()}
			policy := &model.StoragePolicy{Server: server.URL, BucketName: "bucket", AccessKey: "private-operator", SecretKey: "private-password"}
			var err error
			switch operation {
			case "upload":
				_, err = provider.Upload(context.Background(), strings.NewReader("data"), policy, "/file.png")
			case "delete":
				err = provider.Delete(context.Background(), policy, []string{"file.png", "second.png"})
			case "get":
				_, err = provider.Get(context.Background(), policy, "file.png")
			case "head":
				_, err = provider.IsExist(context.Background(), policy, "file.png")
			case "list":
				_, err = provider.List(context.Background(), policy, "/")
			case "rename":
				err = provider.Rename(context.Background(), policy, "/file.png", "/renamed.png")
			}
			if err == nil || !strings.Contains(err.Error(), "HTTP 403") {
				t.Fatalf("error = %v, want HTTP 403", err)
			}
			for _, secret := range []string{"private-operator", "private-password", "Authorization", "c2VjcmV0"} {
				if strings.Contains(err.Error(), secret) {
					t.Errorf("error exposed sensitive upstream response field %q", secret)
				}
			}
			if requests != 1 {
				t.Errorf("requests = %d, want 1 (stop after failure)", requests)
			}
		})
	}
}
