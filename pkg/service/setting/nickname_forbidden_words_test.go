package setting

import (
	"context"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
)

type nicknameSettingsRepository struct {
	repository.SettingRepository
	values map[string]string
}

func (r *nicknameSettingsRepository) FindAll(context.Context) ([]*model.Setting, error) {
	settings := make([]*model.Setting, 0, len(r.values))
	for key, value := range r.values {
		settings = append(settings, &model.Setting{ConfigKey: key, Value: value})
	}
	return settings, nil
}

func (r *nicknameSettingsRepository) Upsert(_ context.Context, values map[string]string) error {
	for key, value := range values {
		r.values[key] = value
	}
	return nil
}

func TestNicknameForbiddenWordsSettingsRoundTrip(t *testing.T) {
	key := constant.KeyCommentNicknameForbiddenWords.String()
	for _, value := range []string{"广告\n推广,spam，test", "00123", "true", "false", `["ad"]`, `{"ad":1}`, "  广告  \r\n", ""} {
		t.Run(value, func(t *testing.T) {
			ctx := context.Background()
			repo := &nicknameSettingsRepository{values: make(map[string]string)}
			svc := NewSettingService(repo, nil)
			if err := svc.LoadAllSettings(ctx); err != nil {
				t.Fatal(err)
			}
			if got := svc.Get(key); got != "" {
				t.Fatalf("default = %q, want empty", got)
			}
			if err := svc.UpdateSettings(ctx, map[string]string{key: value}); err != nil {
				t.Fatal(err)
			}
			if got := svc.Get(key); got != value {
				t.Fatalf("live value = %q, want %q", got, value)
			}

			reloaded := NewSettingService(repo, nil)
			if err := reloaded.LoadAllSettings(ctx); err != nil {
				t.Fatal(err)
			}
			if got := reloaded.Get(key); got != value {
				t.Fatalf("reloaded value = %q, want %q", got, value)
			}
			settings := reloaded.GetByKeys([]string{key})
			comment, ok := settings["comment"].(map[string]interface{})
			if !ok {
				t.Fatalf("missing comment settings: %#v", settings)
			}
			if got := comment["nickname_forbidden_words"]; got != value {
				t.Fatalf("admin value = %#v (%T), want string %q", got, got, value)
			}
			if reloaded.IsPublicSetting(key) {
				t.Fatal("nickname forbidden words must remain private")
			}
			if publicComment, ok := reloaded.GetSiteConfig()["comment"].(map[string]interface{}); ok {
				if _, exists := publicComment["nickname_forbidden_words"]; exists {
					t.Fatal("public configuration exposes nickname forbidden words")
				}
			}

			if err := reloaded.UpdateSettings(ctx, map[string]string{key: ""}); err != nil {
				t.Fatal(err)
			}
			if err := reloaded.LoadAllSettings(ctx); err != nil {
				t.Fatal(err)
			}
			if got := reloaded.Get(key); got != "" {
				t.Fatalf("cleared value = %q, want empty", got)
			}
		})
	}
}
