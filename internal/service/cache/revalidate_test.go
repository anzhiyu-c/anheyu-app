package cache

import "testing"

func TestRevalidateConfigurationMatchesBuiltInAndExternalFrontend(t *testing.T) {
	for _, key := range []string{"FRONTEND_URL", "ANHEYU_FRONTEND_URL", "ANHEYU_FRONTEND_PORT", "ANHEYU_MODE", "REVALIDATE_TOKEN"} {
		t.Setenv(key, "")
	}
	if NewRevalidateService().IsEnabled() {
		t.Fatal("missing token enabled refresh")
	}
	t.Setenv("REVALIDATE_TOKEN", "private-test-secret")
	if svc := NewRevalidateService(); !svc.IsEnabled() || svc.baseURL != "http://127.0.0.1:3000/revalidate" {
		t.Fatal("built-in target incorrect")
	}
	t.Setenv("ANHEYU_FRONTEND_PORT", "3100")
	if got := NewRevalidateService().baseURL; got != "http://127.0.0.1:3100/revalidate" {
		t.Fatal(got)
	}
	t.Setenv("ANHEYU_FRONTEND_URL", "https://frontend.test/")
	if got := NewRevalidateService().baseURL; got != "https://frontend.test/revalidate" {
		t.Fatal(got)
	}
}
