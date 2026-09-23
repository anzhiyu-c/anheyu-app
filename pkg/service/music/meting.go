package music

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
)

func (s *musicService) usesMeting() bool {
	return s.settingSvc.Get(constant.KeyMusicAPIProtocol.String()) == "meting"
}

func metingURL(endpoint, server, kind, id string) (string, error) {
	u, err := url.Parse(strings.TrimSpace(endpoint))
	if err != nil || u == nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return "", fmt.Errorf("Meting API 地址无效")
	}
	if server == "" {
		server = "netease"
	}
	q := u.Query()
	q.Set("server", server)
	q.Set("type", kind)
	q.Set("id", id)
	u.RawQuery = q.Encode()
	return u.String(), nil
}

func (s *musicService) fetchMetingPlaylist(ctx context.Context) ([]Song, error) {
	endpoint, err := metingURL(s.settingSvc.Get(constant.KeyMusicAPIBaseURL.String()), s.settingSvc.Get(constant.KeyMusicMetingServer.String()), "playlist", s.getPlaylistID())
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	// Standard TLS verification is kept for the optional Meting provider.
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Meting 服务连接失败")
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			log.Printf("[Meting] close response: %v", err)
		}
	}()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Meting 返回 HTTP %d", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, (2<<20)+1))
	if err != nil {
		return nil, err
	}
	if len(data) > 2<<20 {
		return nil, fmt.Errorf("Meting 歌单响应过大")
	}
	var tracks []struct {
		Name   string `json:"name"`
		Title  string `json:"title"`
		Artist string `json:"artist"`
		Author string `json:"author"`
		URL    string `json:"url"`
		Pic    string `json:"pic"`
		Cover  string `json:"cover"`
		Lrc    string `json:"lrc"`
	}
	if err := json.Unmarshal(data, &tracks); err != nil {
		return nil, fmt.Errorf("Meting 歌单必须为歌曲数组: %w", err)
	}
	songs := make([]Song, 0, len(tracks))
	for i, track := range tracks {
		name := track.Name
		if name == "" {
			name = track.Title
		}
		artist := track.Artist
		if artist == "" {
			artist = track.Author
		}
		pic := track.Pic
		if pic == "" {
			pic = track.Cover
		}
		if name == "" || track.URL == "" {
			continue
		}
		songs = append(songs, Song{ID: "meting-" + strconv.Itoa(i), Name: name, Artist: artist, URL: track.URL, Pic: pic, Lrc: track.Lrc})
	}
	return songs, nil
}
