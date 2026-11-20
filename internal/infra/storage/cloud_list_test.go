package storage

import (
	"context"
	"encoding/xml"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"sync/atomic"
	"testing"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

var cloudListProviders = []struct {
	name       string
	provider   IStorageProvider
	tokenParam string
}{
	{"s3", &AWSS3Provider{}, "continuation-token"},
	{"oss", &AliOSSProvider{}, "marker"},
	{"cos", &TencentCOSProvider{}, "marker"},
}

func cloudListPolicy(endpoint, basePath string) *model.StoragePolicy {
	return &model.StoragePolicy{
		Name:        "pagination-test",
		Server:      endpoint,
		BucketName:  "test-bucket",
		AccessKey:   "test-access-key",
		SecretKey:   "test-secret-key",
		VirtualPath: "/mount",
		BasePath:    basePath,
	}
}

func writeCloudListPage(t *testing.T, w http.ResponseWriter, r *http.Request, truncated bool, next string, files, directories []string) {
	t.Helper()
	encode := func(value string) string {
		if r.URL.Query().Get("encoding-type") == "url" {
			return url.QueryEscape(value)
		}
		return value
	}
	type object struct {
		Key          string
		Size         int64
		LastModified string
	}
	type commonPrefix struct {
		Prefix string
	}
	response := struct {
		XMLName               xml.Name `xml:"ListBucketResult"`
		Name                  string
		Prefix                string
		Delimiter             string
		EncodingType          string
		IsTruncated           bool
		NextMarker            string         `xml:",omitempty"`
		NextContinuationToken string         `xml:",omitempty"`
		Contents              []object       `xml:"Contents"`
		CommonPrefixes        []commonPrefix `xml:"CommonPrefixes"`
	}{
		Name:         "test-bucket",
		Prefix:       encode(r.URL.Query().Get("prefix")),
		Delimiter:    encode("/"),
		EncodingType: r.URL.Query().Get("encoding-type"),
		IsTruncated:  truncated,
	}
	if r.URL.Query().Get("list-type") == "2" {
		response.NextContinuationToken = next
	} else {
		response.NextMarker = encode(next)
	}
	for _, key := range files {
		response.Contents = append(response.Contents, object{encode(key), 17, "2026-10-23T01:02:03.000Z"})
	}
	for _, prefix := range directories {
		response.CommonPrefixes = append(response.CommonPrefixes, commonPrefix{encode(prefix)})
	}
	w.Header().Set("Content-Type", "application/xml")
	if err := xml.NewEncoder(w).Encode(response); err != nil {
		t.Errorf("write list response: %v", err)
	}
}

func writeCloudListFailure(t *testing.T, w http.ResponseWriter) {
	t.Helper()
	w.Header().Set("Content-Type", "application/xml")
	w.WriteHeader(http.StatusForbidden)
	if err := xml.NewEncoder(w).Encode(struct {
		XMLName xml.Name `xml:"Error"`
		Code    string
		Message string
	}{Code: "AccessDenied", Message: "list denied"}); err != nil {
		t.Errorf("write failure response: %v", err)
	}
}

func TestCloudListCollectsAllPages(t *testing.T) {
	for _, provider := range cloudListProviders {
		t.Run(provider.name, func(t *testing.T) {
			for _, tc := range []struct {
				name, basePath, virtualPath, prefix string
			}{
				{"bucket_root", "", "/mount", ""},
				{"relative_directory", "", "/mount/album", "album/"},
				{"base_root", "/base/", "/mount", "base/"},
				{"nested_directory", "/base/", "/mount/album", "base/album/"},
			} {
				t.Run(tc.name, func(t *testing.T) {
					var requests atomic.Int32
					server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						page := int(requests.Add(1))
						if got := r.URL.Query().Get("prefix"); got != tc.prefix {
							t.Errorf("page %d prefix = %q, want %q", page, got, tc.prefix)
						}
						if got := r.URL.Query().Get("delimiter"); got != "/" {
							t.Errorf("page %d delimiter = %q, want /", page, got)
						}
						wantTokens := []string{"", "page +/2", "page-3", "page-4"}
						if page > len(wantTokens) {
							t.Error("requested a page after the complete response")
							writeCloudListFailure(t, w)
							return
						}
						if got := r.URL.Query().Get(provider.tokenParam); got != wantTokens[page-1] {
							t.Errorf("page %d cursor = %q, want %q", page, got, wantTokens[page-1])
						}
						switch page {
						case 1:
							writeCloudListPage(t, w, r, true, "page +/2", []string{tc.prefix + "first.txt", tc.prefix + "placeholder/", tc.prefix + "nested/hidden.txt"}, nil)
						case 2:
							writeCloudListPage(t, w, r, true, "page-3", nil, []string{tc.prefix + "photos/"})
						case 3:
							writeCloudListPage(t, w, r, true, "page-4", nil, nil)
						case 4:
							writeCloudListPage(t, w, r, false, "ignored-after-final-page", []string{tc.prefix + "last.txt"}, nil)
						}
					}))
					defer server.Close()
					got, err := provider.provider.List(context.Background(), cloudListPolicy(server.URL, tc.basePath), tc.virtualPath)
					if err != nil {
						t.Fatalf("List: %v", err)
					}
					modTime := time.Date(2026, 10, 23, 1, 2, 3, 0, time.UTC)
					want := []FileInfo{
						{Name: "first.txt", Size: 17, ModTime: modTime},
						{Name: "photos", IsDir: true},
						{Name: "last.txt", Size: 17, ModTime: modTime},
					}
					if !reflect.DeepEqual(got, want) {
						t.Errorf("List = %+v, want %+v", got, want)
					}
					if got := requests.Load(); got != 4 {
						t.Errorf("requests = %d, want 4", got)
					}
				})
			}
		})
	}
}

func TestCloudListRejectsInvalidPagination(t *testing.T) {
	for _, provider := range cloudListProviders {
		t.Run(provider.name, func(t *testing.T) {
			for _, tc := range []struct {
				name   string
				tokens []string
			}{
				{"missing_cursor", []string{""}},
				{"repeated_cursor", []string{"page-a", "page-a"}},
				{"cyclic_cursor", []string{"page-a", "page-b", "page-a"}},
			} {
				t.Run(tc.name, func(t *testing.T) {
					var requests atomic.Int32
					server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						page := int(requests.Add(1))
						if page > len(tc.tokens) {
							t.Error("continued after an invalid pagination cursor")
							writeCloudListFailure(t, w)
							return
						}
						writeCloudListPage(t, w, r, true, tc.tokens[page-1], []string{"first.txt"}, nil)
					}))
					defer server.Close()
					got, err := provider.provider.List(context.Background(), cloudListPolicy(server.URL, ""), "/mount")
					if !errors.Is(err, ErrIncompleteListing) {
						t.Errorf("error = %v, want ErrIncompleteListing", err)
					}
					if got != nil {
						t.Errorf("List = %+v, want nil on incomplete pagination", got)
					}
					if got := int(requests.Load()); got != len(tc.tokens) {
						t.Errorf("requests = %d, want %d", got, len(tc.tokens))
					}
				})
			}
		})
	}
}

func TestCloudListReturnsNoPartialResultsOnFailure(t *testing.T) {
	for _, provider := range cloudListProviders {
		t.Run(provider.name, func(t *testing.T) {
			for _, failPage := range []int32{1, 2} {
				name := "initial_page"
				if failPage == 2 {
					name = "subsequent_page"
				}
				t.Run(name, func(t *testing.T) {
					var requests atomic.Int32
					server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						if requests.Add(1) >= failPage {
							writeCloudListFailure(t, w)
							return
						}
						writeCloudListPage(t, w, r, true, "next-page", []string{"first.txt"}, nil)
					}))
					defer server.Close()
					got, err := provider.provider.List(context.Background(), cloudListPolicy(server.URL, ""), "/mount")
					if err == nil || got != nil {
						t.Errorf("List = %+v, %v; want nil and error", got, err)
					}
					if errors.Is(err, ErrIncompleteListing) != (failPage == 2) {
						t.Errorf("error = %v; incomplete marker should appear only after a successful page", err)
					}
					if got := requests.Load(); got != failPage {
						t.Errorf("requests = %d, want %d", got, failPage)
					}
				})
			}
		})
	}
}

func TestCloudListHonorsCancellation(t *testing.T) {
	for _, provider := range cloudListProviders {
		t.Run(provider.name, func(t *testing.T) {
			for _, duringSecondPage := range []bool{false, true} {
				name := "before_first_page"
				if duringSecondPage {
					name = "during_second_page"
				}
				t.Run(name, func(t *testing.T) {
					ctx, cancel := context.WithCancel(context.Background())
					defer cancel()
					var requests atomic.Int32
					server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						page := requests.Add(1)
						if duringSecondPage && page == 1 {
							writeCloudListPage(t, w, r, true, "next-page", []string{"first.txt"}, nil)
							return
						}
						cancel()
						select {
						case <-r.Context().Done():
						case <-time.After(time.Second):
							t.Error("request did not observe context cancellation")
							writeCloudListFailure(t, w)
						}
					}))
					defer server.Close()
					if !duringSecondPage {
						cancel()
					}
					got, err := provider.provider.List(ctx, cloudListPolicy(server.URL, ""), "/mount")
					if err == nil || got != nil {
						t.Errorf("List = %+v, %v; want nil and cancellation error", got, err)
					}
					if errors.Is(err, ErrIncompleteListing) != duringSecondPage {
						t.Errorf("error = %v; incomplete marker should appear only after a successful page", err)
					}
					var wantRequests int32
					if duringSecondPage {
						wantRequests = 2
					}
					if got := requests.Load(); got != wantRequests {
						t.Errorf("requests = %d, want %d", got, wantRequests)
					}
				})
			}
		})
	}
}

func TestCloudListAllowsCompleteEmptyDirectory(t *testing.T) {
	for _, provider := range cloudListProviders {
		t.Run(provider.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				writeCloudListPage(t, w, r, false, "", nil, nil)
			}))
			defer server.Close()
			got, err := provider.provider.List(context.Background(), cloudListPolicy(server.URL, ""), "/mount")
			if err != nil || len(got) != 0 {
				t.Fatalf("List = %+v, %v; want empty successful listing", got, err)
			}
		})
	}
}
