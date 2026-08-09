package utility

import (
	"context"
	"strings"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
)

type emailTestSettingService struct {
	values map[string]string
}

func (s *emailTestSettingService) LoadAllSettings(context.Context) error { return nil }

func (s *emailTestSettingService) Get(key string) string { return s.values[key] }

func (s *emailTestSettingService) GetBool(key string) bool { return s.values[key] == "true" }

func (s *emailTestSettingService) GetByKeys(keys []string) map[string]interface{} {
	values := make(map[string]interface{}, len(keys))
	for _, key := range keys {
		values[key] = s.values[key]
	}
	return values
}

func (s *emailTestSettingService) GetSiteConfig() map[string]interface{} { return nil }

func (s *emailTestSettingService) GetConfigVersion() int64 { return 0 }

func (s *emailTestSettingService) UpdateSettings(context.Context, map[string]string) error {
	return nil
}

func (s *emailTestSettingService) RegisterPublicSettings([]string) {}

func (s *emailTestSettingService) IsPublicSetting(string) bool { return false }

func TestBuildResetPasswordLinkUsesForgotPasswordRoute(t *testing.T) {
	got := buildResetPasswordLink("https://example.com/", "user_public_id", "signed-token")
	want := "https://example.com/forgot-password?id=user_public_id&sign=signed-token"

	if got != want {
		t.Fatalf("reset link = %q, want %q", got, want)
	}
}

func TestBuildFriendLinkAdminURLUsesCurrentAdminFriendsRoute(t *testing.T) {
	got := buildFriendLinkAdminURL("https://example.com/")
	want := "https://example.com/admin/friends"

	if got != want {
		t.Fatalf("friend link admin URL = %q, want %q", got, want)
	}
}

func TestAuthEmailMethodsRenderDocumentedVariablesAndReturnSMTPErrors(t *testing.T) {
	baseValues := map[string]string{
		constant.KeyAppName.String():         "Example Site",
		constant.KeySiteURL.String():         "https://example.com",
		constant.KeySmtpHost.String():        "smtp.example.com",
		constant.KeySmtpPort.String():        "invalid-port",
		constant.KeySmtpSenderName.String():  "Example Site",
		constant.KeySmtpSenderEmail.String(): "noreply@example.com",
	}

	tests := []struct {
		name       string
		additional map[string]string
		send       func(EmailService) error
	}{
		{
			name: "password reset documented variables",
			additional: map[string]string{
				constant.KeyResetPasswordSubject.String():  "[{{site_name}}] Password reset",
				constant.KeyResetPasswordTemplate.String(): "{{nick}}|{{reset_link}}|{{expire_minutes}}",
			},
			send: func(service EmailService) error {
				return service.SendForgotPasswordEmail(context.Background(), "user@example.com", "User", "public-id", "token")
			},
		},
		{
			name: "account activation documented variables",
			additional: map[string]string{
				constant.KeyActivateAccountSubject.String():  "[{{site_name}}] Account activation",
				constant.KeyActivateAccountTemplate.String(): "{{nick}}|{{activate_link}}|{{expire_minutes}}",
			},
			send: func(service EmailService) error {
				return service.SendActivationEmail(context.Background(), "user@example.com", "User", "public-id", "token")
			},
		},
		{
			name: "legacy Go template variables",
			additional: map[string]string{
				constant.KeyResetPasswordSubject.String():  "[{{.AppName}}] Password reset",
				constant.KeyResetPasswordTemplate.String(): "{{.Nickname}}|{{.ResetLink}}",
			},
			send: func(service EmailService) error {
				return service.SendForgotPasswordEmail(context.Background(), "user@example.com", "User", "public-id", "token")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			values := make(map[string]string, len(baseValues)+len(tt.additional))
			for key, value := range baseValues {
				values[key] = value
			}
			for key, value := range tt.additional {
				values[key] = value
			}

			service := NewEmailService(&emailTestSettingService{values: values}, nil, nil)
			err := tt.send(service)
			if err == nil || !strings.Contains(err.Error(), "SMTP端口配置无效") {
				t.Fatalf("send error = %v, want SMTP port validation error after template rendering", err)
			}
		})
	}
}

func TestRenderAuthEmailTemplateSupportsDocumentedAndLegacyVariables(t *testing.T) {
	data := authEmailTemplateData{
		"Nickname":      "User",
		"AppName":       "Example Site",
		"ResetLink":     "https://example.com/forgot-password?id=user&sign=reset",
		"ActivateLink":  "https://example.com/activate?id=user&sign=activate",
		"ExpireMinutes": 60,
	}
	want := "User|Example Site|https://example.com/forgot-password?id=user&amp;sign=reset|https://example.com/activate?id=user&amp;sign=activate|60"

	tests := []struct {
		name     string
		template string
	}{
		{
			name:     "documented variables",
			template: "{{nick}}|{{site_name}}|{{reset_link}}|{{activate_link}}|{{expire_minutes}}",
		},
		{
			name:     "legacy variables",
			template: "{{.Nickname}}|{{.AppName}}|{{.ResetLink}}|{{.ActivateLink}}|{{.ExpireMinutes}}",
		},
		{
			name:     "legacy map index variables",
			template: `{{index . "Nickname"}}|{{index . "AppName"}}|{{index . "ResetLink"}}|{{index . "ActivateLink"}}|{{index . "ExpireMinutes"}}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := renderAuthEmailTemplate(tt.template, data)
			if err != nil {
				t.Fatalf("renderAuthEmailTemplate() error = %v", err)
			}
			if got != want {
				t.Fatalf("renderAuthEmailTemplate() = %q, want %q", got, want)
			}
		})
	}
}

func TestAuthEmailTokenTTLMinutes(t *testing.T) {
	if constant.ActivationTokenTTLMinutes != 1440 {
		t.Fatalf("activation token TTL = %d minutes, want 1440", constant.ActivationTokenTTLMinutes)
	}
	if constant.PasswordResetTokenTTLMinutes != 60 {
		t.Fatalf("password reset token TTL = %d minutes, want 60", constant.PasswordResetTokenTTLMinutes)
	}
}
