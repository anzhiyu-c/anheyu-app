package config

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
)

type backupSecurityRepository struct {
	repository.SettingRepository
	values map[string]string
	writes map[string]string
}

func (r *backupSecurityRepository) FindAll(context.Context) ([]*model.Setting, error) {
	items := make([]*model.Setting, 0, len(r.values))
	for key, value := range r.values {
		items = append(items, &model.Setting{ConfigKey: key, Value: value})
	}
	return items, nil
}

func (r *backupSecurityRepository) Upsert(_ context.Context, values map[string]string) error {
	r.writes = values
	for key, value := range values {
		// Model PAD SPACE and case-insensitive collations matching an existing row.
		for stored := range r.values {
			if strings.EqualFold(strings.TrimRight(key, " "), strings.TrimRight(stored, " ")) {
				key = stored
				break
			}
		}
		r.values[key] = value
	}
	return nil
}

type backupSecuritySettings struct{ setting.SettingService }

func (backupSecuritySettings) LoadAllSettings(context.Context) error { return nil }

type backupSecurityPayment struct {
	items []PaymentConfigExportItem
}

func (p *backupSecurityPayment) ExportPayment(context.Context) ([]PaymentConfigExportItem, error) {
	return p.items, nil
}

func (p *backupSecurityPayment) ImportPayment(_ context.Context, items []PaymentConfigExportItem) error {
	p.items = items
	return nil
}

func newBackupSecurityRepository() *backupSecurityRepository {
	return &backupSecurityRepository{values: map[string]string{
		constant.KeyJWTSecret.String():              "fixture-current-jwt-key",
		constant.KeyLocalFileSigningSecret.String(): "fixture-current-file-key",
		"site_name":      "Current site",
		"EMAIL_PASSWORD": "fixture-mail-password",
	}}
}

func TestExportConfigExcludesRuntimeSigningKeys(t *testing.T) {
	for _, extended := range []bool{false, true} {
		t.Run(map[bool]string{false: "legacy", true: "pro extension"}[extended], func(t *testing.T) {
			payment := &backupSecurityPayment{items: []PaymentConfigExportItem{{
				Provider: "fixture", IsEnabled: true, ConfigData: `{"key":"fixture-payment-key"}`,
			}}}
			var extension ConfigExportImportExtension
			if extended {
				extension = payment
			}
			service := NewImportExportService(newBackupSecurityRepository(), backupSecuritySettings{}, &extension)
			data, err := service.ExportConfig(context.Background())
			if err != nil {
				t.Fatal(err)
			}
			var settings map[string]string
			if extended {
				var payload exportPayload
				if err := json.Unmarshal(data, &payload); err != nil {
					t.Fatal(err)
				}
				settings = payload.Settings
				if !reflect.DeepEqual(payload.PaymentConfigs, payment.items) {
					t.Fatal("payment configuration changed during export")
				}
			} else if err := json.Unmarshal(data, &settings); err != nil {
				t.Fatal(err)
			}
			assertNoRuntimeSigningKeys(t, settings)
			if settings["site_name"] != "Current site" || settings["EMAIL_PASSWORD"] != "fixture-mail-password" {
				t.Fatal("ordinary configuration must remain restorable")
			}
		})
	}
}

func TestImportConfigPreservesCurrentRuntimeSigningKeys(t *testing.T) {
	for _, extended := range []bool{false, true} {
		t.Run(map[bool]string{false: "legacy", true: "pro extension"}[extended], func(t *testing.T) {
			repo := newBackupSecurityRepository()
			payment := &backupSecurityPayment{}
			var extension ConfigExportImportExtension = payment
			service := NewImportExportService(repo, backupSecuritySettings{}, &extension)
			settings := map[string]string{
				constant.KeyJWTSecret.String():              "fixture-obsolete-jwt-key",
				constant.KeyLocalFileSigningSecret.String(): "fixture-obsolete-file-key",
				"site_name": "Restored site",
			}
			var payload any = settings
			payments := []PaymentConfigExportItem{{Provider: "fixture", ConfigData: `{"key":"fixture-payment-key"}`}}
			if extended {
				payload = exportPayload{Settings: settings, PaymentConfigs: payments}
			}
			data, err := json.Marshal(payload)
			if err != nil {
				t.Fatal(err)
			}
			if err := service.ImportConfig(context.Background(), strings.NewReader(string(data))); err != nil {
				t.Fatal(err)
			}
			if repo.values[constant.KeyJWTSecret.String()] != "fixture-current-jwt-key" ||
				repo.values[constant.KeyLocalFileSigningSecret.String()] != "fixture-current-file-key" {
				t.Fatal("import replaced current runtime signing keys")
			}
			if repo.values["site_name"] != "Restored site" {
				t.Fatal("ordinary configuration was not restored")
			}
			if extended && !reflect.DeepEqual(payment.items, payments) {
				t.Fatal("payment configuration was not restored")
			}
		})
	}
}

func TestImportConfigRejectsRuntimeSigningKeyAliases(t *testing.T) {
	for _, extended := range []bool{false, true} {
		for _, key := range []string{
			"JWT_SECRET ", "jwt_secret", " Jwt_Secret\t",
			"LOCAL_FILE_SIGNING_SECRET ", "local_file_signing_secret", "\tLocal_File_Signing_Secret ",
		} {
			t.Run(map[bool]string{false: "legacy", true: "pro extension"}[extended]+"/"+key, func(t *testing.T) {
				repo := newBackupSecurityRepository()
				service := NewImportExportService(repo, backupSecuritySettings{}, nil)
				settings := map[string]string{key: "fixture-obsolete-key", "site_name": "Restored site"}
				var payload any = settings
				if extended {
					payload = exportPayload{Settings: settings}
				}
				data, err := json.Marshal(payload)
				if err != nil {
					t.Fatal(err)
				}
				if err := service.ImportConfig(context.Background(), strings.NewReader(string(data))); err != nil {
					t.Fatal(err)
				}
				if repo.values[constant.KeyJWTSecret.String()] != "fixture-current-jwt-key" ||
					repo.values[constant.KeyLocalFileSigningSecret.String()] != "fixture-current-file-key" {
					t.Error("database-equivalent alias replaced an active signing key")
				}
				if !reflect.DeepEqual(repo.writes, map[string]string{"site_name": "Restored site"}) {
					t.Error("signing key alias reached the database upsert")
				}
			})
		}
	}
}

func TestAutomaticBackupProtectsSigningKeysAndNewFilePermissions(t *testing.T) {
	backupDir := filepath.Join(t.TempDir(), "backup")
	service := NewBackupService(backupDir, NewImportExportService(newBackupSecurityRepository(), backupSecuritySettings{}, nil))
	backup, err := service.CreateBackup(context.Background(), "fixture automatic backup", true)
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(backupDir, backup.Filename))
	if err != nil {
		t.Fatal(err)
	}
	var settings map[string]string
	if err := json.Unmarshal(data, &settings); err != nil {
		t.Fatal(err)
	}
	assertNoRuntimeSigningKeys(t, settings)
	for name, want := range map[string]os.FileMode{
		backupDir: 0700,
		filepath.Join(backupDir, backup.Filename):                                           0600,
		filepath.Join(backupDir, strings.TrimSuffix(backup.Filename, ".json")+".meta.json"): 0600,
	} {
		info, err := os.Stat(name)
		if err != nil {
			t.Fatal(err)
		}
		if got := info.Mode().Perm(); got != want {
			t.Errorf("new backup resource mode = %o, want %o", got, want)
		}
	}
}

func TestBackupInitializationPreservesExistingDirectoryPermissions(t *testing.T) {
	backupDir := filepath.Join(t.TempDir(), "backup")
	if err := os.Mkdir(backupDir, 0755); err != nil {
		t.Fatal(err)
	}
	before, err := os.Stat(backupDir)
	if err != nil {
		t.Fatal(err)
	}
	NewBackupService(backupDir, nil)
	after, err := os.Stat(backupDir)
	if err != nil {
		t.Fatal(err)
	}
	if before.Mode().Perm() != after.Mode().Perm() {
		t.Fatal("initialization changed an existing backup directory's permissions")
	}
}

func assertNoRuntimeSigningKeys(t *testing.T, settings map[string]string) {
	t.Helper()
	for _, key := range []string{constant.KeyJWTSecret.String(), constant.KeyLocalFileSigningSecret.String()} {
		if _, exists := settings[key]; exists {
			t.Errorf("runtime signing key %s was included in backup", key)
		}
	}
}
