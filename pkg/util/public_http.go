package util

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
	"time"
)

var nonPublicPrefixes = []netip.Prefix{
	netip.MustParsePrefix("0.0.0.0/8"),
	netip.MustParsePrefix("100.64.0.0/10"),
	netip.MustParsePrefix("192.0.0.0/24"),
	netip.MustParsePrefix("192.0.2.0/24"),
	netip.MustParsePrefix("198.18.0.0/15"),
	netip.MustParsePrefix("198.51.100.0/24"),
	netip.MustParsePrefix("203.0.113.0/24"),
	netip.MustParsePrefix("240.0.0.0/4"),
	netip.MustParsePrefix("64:ff9b::/96"),
	netip.MustParsePrefix("64:ff9b:1::/48"),
	netip.MustParsePrefix("100::/64"),
	netip.MustParsePrefix("2001::/23"),
	netip.MustParsePrefix("2001:db8::/32"),
	netip.MustParsePrefix("2002::/16"),
}

func isPublicDownloadIP(ip net.IP) bool {
	addr, ok := netip.AddrFromSlice(ip)
	if !ok {
		return false
	}
	addr = addr.Unmap()
	if !addr.IsGlobalUnicast() || addr.IsPrivate() || addr.IsLoopback() || addr.IsLinkLocalUnicast() {
		return false
	}
	for _, prefix := range nonPublicPrefixes {
		if prefix.Contains(addr) {
			return false
		}
	}
	return true
}

// ValidatePublicHTTPURL checks each request, including redirect targets. DNS is
// checked again at the actual connection boundary by PublicHTTPDialContext.
func ValidatePublicHTTPURL(target string, httpsOnly bool) error {
	u, err := url.Parse(target)
	if err != nil {
		return fmt.Errorf("无效的下载地址")
	}
	if u.Scheme != "https" && (httpsOnly || u.Scheme != "http") {
		return fmt.Errorf("不允许的下载协议")
	}
	if u.Hostname() == "" || u.User != nil || u.Opaque != "" || strings.Contains(u.Hostname(), "%") {
		return fmt.Errorf("无效的下载地址")
	}
	if port := u.Port(); port != "" && !(u.Scheme == "https" && port == "443") && !(u.Scheme == "http" && port == "80") {
		return fmt.Errorf("不允许的下载端口")
	}
	host := strings.TrimSuffix(strings.ToLower(u.Hostname()), ".")
	if host == "localhost" || strings.HasSuffix(host, ".localhost") || strings.HasSuffix(host, ".local") || strings.HasSuffix(host, ".internal") {
		return fmt.Errorf("目标地址不允许访问")
	}
	if ip := net.ParseIP(host); ip != nil && !isPublicDownloadIP(ip) {
		return fmt.Errorf("目标地址不允许访问")
	}
	return nil
}

// PublicHTTPDialContext pins the validated DNS result to the connection so a
// second resolution cannot turn a public URL into an internal request.
func PublicHTTPDialContext(ctx context.Context, network, address string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return nil, err
	}
	if port != "80" && port != "443" {
		return nil, fmt.Errorf("不允许的下载端口")
	}
	ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, fmt.Errorf("解析下载地址失败: %w", err)
	}
	if len(ips) == 0 {
		return nil, fmt.Errorf("下载地址无解析结果")
	}
	for _, ip := range ips {
		if ip.Zone != "" || !isPublicDownloadIP(ip.IP) {
			return nil, fmt.Errorf("目标地址不允许访问")
		}
	}
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	return dialer.DialContext(ctx, network, net.JoinHostPort(ips[0].IP.String(), port))
}

// NewPublicHTTPClient deliberately does not use environment proxies: a proxy
// could resolve a different, private address after our DNS validation.
func NewPublicHTTPClient(timeout time.Duration, httpsOnly bool) *http.Client {
	return &http.Client{
		Timeout: timeout,
		Transport: &http.Transport{
			DialContext:           PublicHTTPDialContext,
			TLSHandshakeTimeout:   10 * time.Second,
			ResponseHeaderTimeout: 20 * time.Second,
			IdleConnTimeout:       30 * time.Second,
			MaxIdleConns:          10,
		},
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return fmt.Errorf("重定向次数过多")
			}
			return ValidatePublicHTTPURL(req.URL.String(), httpsOnly)
		},
	}
}
