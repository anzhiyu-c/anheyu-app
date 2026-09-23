package music

import (
	"context"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMetingPlaylistMapsProtocolWithoutLegacyFallback(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("server") != "tencent" || r.URL.Query().Get("type") != "playlist" || r.URL.Query().Get("id") != "00123" || r.URL.Query().Get("token") != "public" {
			t.Errorf("query=%s", r.URL.RawQuery)
		}
		w.Header().Set("Content-Type", "application/json")
		if _, err := w.Write([]byte(`[{"name":"测试歌曲","artist":"作者","url":"https://audio.test/song.mp3","pic":"https://audio.test/cover.jpg","lrc":"https://audio.test/lyric.lrc"}]`)); err != nil {
			t.Error(err)
		}
	}))
	defer server.Close()
	svc := NewMusicService(fakeSettingService{values: map[string]string{
		constant.KeyMusicAPIProtocol.String(): "meting", constant.KeyMusicMetingServer.String(): "tencent", constant.KeyMusicAPIBaseURL.String(): server.URL + "?token=public", "music.player.playlist_id": "00123",
	}})
	songs, err := svc.FetchPlaylist(context.Background())
	if err != nil || len(songs) != 1 || songs[0].Name != "测试歌曲" || songs[0].URL != "https://audio.test/song.mp3" {
		t.Fatalf("songs=%v error=%v", songs, err)
	}
	resources, err := svc.FetchSongResources(context.Background(), songs[0])
	if err != nil || resources.AudioURL != songs[0].URL {
		t.Fatalf("resources=%v %v", resources, err)
	}
}

func TestMetingRejectsInvalidEndpoint(t *testing.T) {
	for _, endpoint := range []string{"", "javascript:alert(1)", "file:///etc/passwd"} {
		if _, err := metingURL(endpoint, "", "playlist", "1"); err == nil {
			t.Errorf("accepted %q", endpoint)
		}
	}
}
