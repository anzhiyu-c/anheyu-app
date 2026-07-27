package music

import (
	"context"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
)

type fakeSettingService struct {
	values map[string]string
}

func (f fakeSettingService) LoadAllSettings(ctx context.Context) error { return nil }

func (f fakeSettingService) Get(key string) string {
	return f.values[key]
}

func (f fakeSettingService) GetBool(key string) bool { return false }

func (f fakeSettingService) GetByKeys(keys []string) map[string]interface{} {
	return map[string]interface{}{}
}

func (f fakeSettingService) GetSiteConfig() map[string]interface{} {
	return map[string]interface{}{}
}

func (f fakeSettingService) GetConfigVersion() int64 { return 0 }

func (f fakeSettingService) UpdateSettings(ctx context.Context, settingsToUpdate map[string]string) error {
	return nil
}

func (f fakeSettingService) RegisterPublicSettings(keys []string) {}

func (f fakeSettingService) IsPublicSetting(key string) bool { return false }

func TestNewMusicServiceTrimsConfiguredAPIBaseURL(t *testing.T) {
	svc := NewMusicService(fakeSettingService{
		values: map[string]string{
			constant.KeyMusicAPIBaseURL.String(): " https://metings.qjqq.cn/ ",
		},
	})

	ms, ok := svc.(*musicService)
	if !ok {
		t.Fatalf("NewMusicService returned %T, want *musicService", svc)
	}

	if got, want := ms.getMusicAPIURL("Playlist"), "https://metings.qjqq.cn/Playlist"; got != want {
		t.Fatalf("getMusicAPIURL(Playlist) = %q, want %q", got, want)
	}
	if got, want := ms.getMusicAPIURL("Song_V1"), "https://metings.qjqq.cn/Song_V1"; got != want {
		t.Fatalf("getMusicAPIURL(Song_V1) = %q, want %q", got, want)
	}
}

func TestMusicServiceUsesLatestConfiguredAPIBaseURL(t *testing.T) {
	values := map[string]string{
		constant.KeyMusicAPIBaseURL.String(): "https://metings.qjqq.cn",
		"music.player.playlist_id":           "8152976493",
	}
	svc := NewMusicService(fakeSettingService{values: values})

	ms, ok := svc.(*musicService)
	if !ok {
		t.Fatalf("NewMusicService returned %T, want *musicService", svc)
	}

	values[constant.KeyMusicAPIBaseURL.String()] = " https://musicapi.acacia-ma.com/ "

	if got, want := ms.buildPlaylistAPI(), "https://musicapi.acacia-ma.com/Playlist?id=8152976493"; got != want {
		t.Fatalf("buildPlaylistAPI() = %q, want %q", got, want)
	}
}
