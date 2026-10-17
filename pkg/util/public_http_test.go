package util

import (
	"context"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestPublicDownloadIPBlocksPrivateAndSpecialAddresses(t *testing.T) {
	for _, address := range []string{"0.0.0.0", "0.1.2.3", "127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.100.100.200", "198.18.0.1", "192.0.2.1", "224.0.0.1", "240.0.0.1", "::", "::1", "::ffff:127.0.0.1", "fd00::1", "fe80::1", "ff02::1", "64:ff9b::7f00:1", "2002:7f00:1::", "2001:db8::1"} {
		if isPublicDownloadIP(net.ParseIP(address)) {
			t.Errorf("accepted non-public IP %s", address)
		}
	}
	for _, address := range []string{"1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"} {
		if !isPublicDownloadIP(net.ParseIP(address)) {
			t.Errorf("rejected public IP %s", address)
		}
	}
}

type redirectTestTransport func(*http.Request) (*http.Response, error)

func (f redirectTestTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestPublicHTTPClientRejectsUnsafeRedirectBeforeSecondRequest(t *testing.T) {
	for _, target := range []string{"https://127.0.0.1/private", "https://169.254.169.254/metadata", "https://[::1]/private", "http://example.com/theme.zip"} {
		t.Run(target, func(t *testing.T) {
			client := NewPublicHTTPClient(time.Second, true)
			calls := 0
			client.Transport = redirectTestTransport(func(req *http.Request) (*http.Response, error) {
				calls++
				if calls == 1 {
					return &http.Response{StatusCode: http.StatusFound, Header: http.Header{"Location": []string{target}}, Body: io.NopCloser(strings.NewReader("")), Request: req}, nil
				}
				return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader("should not be requested")), Request: req}, nil
			})
			req, err := http.NewRequest(http.MethodGet, "https://example.com/theme.zip", nil)
			if err != nil {
				t.Fatal(err)
			}
			resp, err := client.Do(req)
			if resp != nil && resp.Body != nil {
				if closeErr := resp.Body.Close(); closeErr != nil {
					t.Fatal(closeErr)
				}
			}
			if err == nil || calls != 1 {
				t.Fatalf("unsafe redirect reached transport: calls=%d err=%v", calls, err)
			}
		})
	}
}

func TestPublicHTTPClientFollowsPublicHTTPSRedirect(t *testing.T) {
	client := NewPublicHTTPClient(time.Second, true)
	const target = "https://cdn.example.com/theme.zip"
	var requested []string
	client.Transport = redirectTestTransport(func(req *http.Request) (*http.Response, error) {
		requested = append(requested, req.URL.String())
		if len(requested) == 1 {
			return &http.Response{StatusCode: http.StatusFound, Header: http.Header{"Location": []string{target}}, Body: io.NopCloser(strings.NewReader("")), Request: req}, nil
		}
		return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader("safe archive")), Request: req}, nil
	})
	req, err := http.NewRequest(http.MethodGet, "https://example.com/theme.zip", nil)
	if err != nil {
		t.Fatal(err)
	}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	body, readErr := io.ReadAll(resp.Body)
	closeErr := resp.Body.Close()
	if readErr != nil || closeErr != nil {
		t.Fatalf("read=%v close=%v", readErr, closeErr)
	}
	if len(requested) != 2 || requested[1] != target || resp.StatusCode != http.StatusOK || string(body) != "safe archive" {
		t.Fatalf("public redirect failed: requested=%v status=%d body=%s", requested, resp.StatusCode, body)
	}
}

func TestPublicHTTPClientChecksRedirectsAndActualDial(t *testing.T) {
	client := NewPublicHTTPClient(time.Second, true)
	if client.Transport.(*http.Transport).Proxy != nil {
		t.Fatal("environment proxy would bypass address validation")
	}
	for _, target := range []string{"http://example.com/theme.zip", "https://127.0.0.1/", "https://example.com:8443/", "https://user:pass@example.com/", "https://localhost./", "https://[fe80::1%25en0]/"} {
		u, err := url.Parse(target)
		if err != nil {
			t.Fatal(err)
		}
		if err := client.CheckRedirect(&http.Request{URL: u}, nil); err == nil {
			t.Errorf("allowed redirect %s", target)
		}
	}
	for _, address := range []string{"127.0.0.1:443", "[::1]:80", "100.100.100.200:80", "example.com:8080"} {
		conn, err := PublicHTTPDialContext(context.Background(), "tcp", address)
		if conn != nil {
			if closeErr := conn.Close(); closeErr != nil {
				t.Error(closeErr)
			}
		}
		if err == nil {
			t.Errorf("allowed non-public connection %s", address)
		}
	}
	if err := ValidatePublicHTTPURL("https://example.com/theme.zip?token=test", true); err != nil {
		t.Fatal(err)
	}
	if err := ValidatePublicHTTPURL("http://example.com/image.png", false); err != nil {
		t.Fatal(err)
	}
}
