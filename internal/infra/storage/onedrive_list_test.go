package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"golang.org/x/oauth2"
)

type oneDriveListTransport func(*http.Request) (*http.Response, error)

func (f oneDriveListTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func oneDriveListContext(ctx context.Context, handler oneDriveListTransport) context.Context {
	client := &http.Client{Transport: oneDriveListTransport(func(req *http.Request) (*http.Response, error) {
		if req.Method == http.MethodPost && req.URL.Host == "login.live.com" {
			return oneDriveListResponse(http.StatusOK, `{"access_token":"test-token","token_type":"Bearer","expires_in":3600}`), nil
		}
		return handler(req)
	})}
	return context.WithValue(ctx, oauth2.HTTPClient, client)
}

func oneDriveListResponse(status int, body string) *http.Response {
	return &http.Response{StatusCode: status, Header: http.Header{"Content-Type": {"application/json"}}, Body: io.NopCloser(strings.NewReader(body))}
}

func oneDriveListPolicy() *model.StoragePolicy {
	return &model.StoragePolicy{Server: "https://graph.test/v1.0", BucketName: "client-id", SecretKey: "secret", AccessKey: "refresh-token", VirtualPath: "/drive"}
}

type oneDriveTrackedBody struct {
	io.Reader
	closed bool
}

func (b *oneDriveTrackedBody) Close() error {
	b.closed = true
	return nil
}

func TestOneDriveListReadsAllPages(t *testing.T) {
	for _, tc := range []struct {
		name, basePath, virtualPath, wantPath string
	}{
		{"root", "", "/drive", "/v1.0/me/drive/root/children"},
		{"nested", "/photos", "/drive/album", "/v1.0/me/drive/root:/photos/album:/children"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			policy := oneDriveListPolicy()
			policy.BasePath = tc.basePath
			var requests int
			var bodies []*oneDriveTrackedBody
			ctx := oneDriveListContext(context.Background(), func(req *http.Request) (*http.Response, error) {
				requests++
				if len(bodies) > 0 && !bodies[len(bodies)-1].closed {
					t.Error("previous page body was not closed before requesting the next page")
				}
				if req.URL.Path != tc.wantPath {
					t.Errorf("path = %q, want %q", req.URL.Path, tc.wantPath)
				}
				if req.Header.Get("Authorization") != "Bearer test-token" {
					t.Error("listing request is missing OAuth authorization")
				}
				var payload string
				switch requests {
				case 1:
					if req.URL.Query().Get("$select") != "id,name,size,folder,file,lastModifiedDateTime" {
						t.Error("first page must retain the existing field selection")
					}
					payload = fmt.Sprintf(`{"value":[{"name":"folder","folder":{}}],"@odata.nextLink":"https://graph.test%s?$skiptoken=opaque%%2Btoken"}`, tc.wantPath)
				case 2:
					if req.URL.RawQuery != "$skiptoken=opaque%2Btoken" {
						t.Errorf("nextLink query was changed: %s", req.URL.RawQuery)
					}
					payload = fmt.Sprintf(`{"value":[],"@odata.nextLink":"https://graph.test%s?$skiptoken=last"}`, tc.wantPath)
				case 3:
					payload = `{"value":[{"name":"last.jpg","size":42,"file":{},"lastModifiedDateTime":"2026-10-23T00:00:00Z"}]}`
				default:
					return nil, errors.New("unexpected extra page")
				}
				body := &oneDriveTrackedBody{Reader: strings.NewReader(payload)}
				bodies = append(bodies, body)
				return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: body}, nil
			})
			files, err := NewOneDriveProvider(nil).List(ctx, policy, tc.virtualPath)
			if err != nil {
				t.Fatalf("List: %v", err)
			}
			if len(files) != 2 || files[0].Name != "folder" || !files[0].IsDir || files[1].Name != "last.jpg" || files[1].Size != 42 || files[1].ModTime.IsZero() {
				t.Fatalf("List = %+v, want directory and last-page file", files)
			}
			if requests != 3 || !bodies[len(bodies)-1].closed {
				t.Fatalf("requests = %d, final body closed = %v", requests, bodies[len(bodies)-1].closed)
			}
		})
	}
}

func TestOneDriveListRejectsIncompletePages(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status int
		body   string
	}{
		{"missing-next-page", http.StatusNotFound, `{"error":{"message":"gone"}}`},
		{"server-error", http.StatusInternalServerError, `{"error":{"message":"unavailable"}}`},
		{"malformed-json", http.StatusOK, `{"value":[`},
		{"missing-value", http.StatusOK, `{}`},
		{"repeated-next-link", http.StatusOK, `{"value":[],"@odata.nextLink":"https://graph.test/v1.0/me/drive/root/children?$skiptoken=next"}`},
		{"cross-origin", http.StatusOK, `{"value":[],"@odata.nextLink":"https://untrusted.test/steal"}`},
		{"relative-link", http.StatusOK, `{"value":[],"@odata.nextLink":"/v1.0/me/drive/root/children"}`},
		{"malformed-link", http.StatusOK, `{"value":[],"@odata.nextLink":"https://graph.test/%zz"}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			requests := 0
			ctx := oneDriveListContext(context.Background(), func(req *http.Request) (*http.Response, error) {
				requests++
				if requests == 1 {
					return oneDriveListResponse(http.StatusOK, `{"value":[{"name":"first.txt","size":1}],"@odata.nextLink":"https://graph.test/v1.0/me/drive/root/children?$skiptoken=next"}`), nil
				}
				if requests > 2 {
					t.Error("invalid nextLink was followed")
					return nil, errors.New("unexpected request")
				}
				return oneDriveListResponse(tc.status, tc.body), nil
			})
			files, err := NewOneDriveProvider(nil).List(ctx, oneDriveListPolicy(), "/drive")
			if !errors.Is(err, ErrIncompleteListing) || files != nil {
				t.Fatalf("List = %+v, %v; want nil, ErrIncompleteListing", files, err)
			}
		})
	}
}

func TestOneDriveListPreservesInitialNotFound(t *testing.T) {
	ctx := oneDriveListContext(context.Background(), func(req *http.Request) (*http.Response, error) {
		return oneDriveListResponse(http.StatusNotFound, `{"error":{"message":"not found"}}`), nil
	})
	files, err := NewOneDriveProvider(nil).List(ctx, oneDriveListPolicy(), "/drive")
	if files != nil || err == nil || !strings.Contains(err.Error(), "404") || errors.Is(err, ErrIncompleteListing) {
		t.Fatalf("List = %+v, %v; want initial 404 without incomplete marker", files, err)
	}
}

func TestOneDriveListCancellationDiscardsPartialResults(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	requests := 0
	ctx = oneDriveListContext(ctx, func(req *http.Request) (*http.Response, error) {
		requests++
		if requests == 1 {
			cancel()
			return oneDriveListResponse(http.StatusOK, `{"value":[{"name":"first.txt"}],"@odata.nextLink":"https://graph.test/v1.0/me/drive/root/children?$skiptoken=next"}`), nil
		}
		return nil, errors.New("request after cancellation")
	})
	files, err := NewOneDriveProvider(nil).List(ctx, oneDriveListPolicy(), "/drive")
	if files != nil || !errors.Is(err, context.Canceled) || !errors.Is(err, ErrIncompleteListing) {
		t.Fatalf("List = %+v, %v; want canceled incomplete listing", files, err)
	}
	if requests != 1 {
		t.Fatalf("requests = %d, want 1", requests)
	}
}

func TestOneDriveListEmptyDirectory(t *testing.T) {
	ctx := oneDriveListContext(context.Background(), func(req *http.Request) (*http.Response, error) {
		return oneDriveListResponse(http.StatusOK, `{"value":[]}`), nil
	})
	files, err := NewOneDriveProvider(nil).List(ctx, oneDriveListPolicy(), "/drive")
	if err != nil || len(files) != 0 {
		t.Fatalf("List = %+v, %v; want successful empty directory", files, err)
	}
}

func TestOneDriveListRejectsCrossOriginRedirect(t *testing.T) {
	requests := 0
	ctx := oneDriveListContext(context.Background(), func(req *http.Request) (*http.Response, error) {
		requests++
		if req.URL.Host != "graph.test" {
			t.Error("OAuth request was sent to another origin")
			return nil, errors.New("unexpected origin")
		}
		resp := oneDriveListResponse(http.StatusFound, "")
		resp.Header.Set("Location", "https://untrusted.test/steal")
		return resp, nil
	})
	files, err := NewOneDriveProvider(nil).List(ctx, oneDriveListPolicy(), "/drive")
	if files != nil || !errors.Is(err, ErrIncompleteListing) || requests != 1 {
		t.Fatalf("List = %+v, %v, requests = %d; want blocked redirect", files, err, requests)
	}
}

type oneDriveReadErrorBody struct {
	closed bool
}

func (b *oneDriveReadErrorBody) Read(p []byte) (int, error) {
	return copy(p, `{"value":[]}`), io.ErrUnexpectedEOF
}

func (b *oneDriveReadErrorBody) Close() error {
	b.closed = true
	return nil
}

func TestOneDriveListRejectsReadFailure(t *testing.T) {
	body := &oneDriveReadErrorBody{}
	ctx := oneDriveListContext(context.Background(), func(req *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: body}, nil
	})
	files, err := NewOneDriveProvider(nil).List(ctx, oneDriveListPolicy(), "/drive")
	if files != nil || !errors.Is(err, io.ErrUnexpectedEOF) || !errors.Is(err, ErrIncompleteListing) || !body.closed {
		t.Fatalf("List = %+v, %v, body closed = %v; want failed closed response", files, err, body.closed)
	}
}
