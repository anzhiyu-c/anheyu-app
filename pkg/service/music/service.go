/*
 * @Description: 音乐服务 - 整合外部音乐API并提供统一接口
 * @Author: 安知鱼
 * @Date: 2025-09-22 15:00:00
 */
package music

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
)

// Song 歌曲结构体
type Song struct {
	ID        string `json:"id"`
	NeteaseID string `json:"neteaseId"`
	Name      string `json:"name"`
	Artist    string `json:"artist"`
	URL       string `json:"url"`
	Pic       string `json:"pic"`
	Lrc       string `json:"lrc"`
}

// PlaylistApiResponse 新的播放列表API响应结构
type PlaylistApiResponse struct {
	Data struct {
		Playlist struct {
			CoverImgURL string `json:"coverImgUrl"`
			Creator     string `json:"creator"`
			Description string `json:"description"`
			ID          int64  `json:"id"`
			Name        string `json:"name"`
			TrackCount  int    `json:"trackCount"`
			Tracks      []struct {
				Album   string `json:"album"`
				Artists string `json:"artists"`
				ID      int64  `json:"id"`
				Name    string `json:"name"`
				PicURL  string `json:"picUrl"`
			} `json:"tracks"`
		} `json:"playlist"`
	} `json:"data"`
}

// SongV1ApiResponse 新的单曲解析API响应结构
type SongV1ApiResponse struct {
	Status  int    `json:"status"`
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		ID     string `json:"id"`
		Name   string `json:"name"`
		ArName string `json:"ar_name"` // 歌手名
		AlName string `json:"al_name"` // 专辑名
		Pic    string `json:"pic"`     // 封面图
		URL    string `json:"url"`     // 音频URL
		Lyric  string `json:"lyric"`   // 歌词
		TLyric string `json:"tlyric"`  // 翻译歌词
		Level  string `json:"level"`   // 音质等级
		Size   string `json:"size"`    // 文件大小
	} `json:"data"`
}

// SongResourceResponse 歌曲资源响应结构
type SongResourceResponse struct {
	AudioURL   string `json:"audioUrl"`
	LyricsText string `json:"lyricsText"`
}

// MusicService 定义音乐服务接口
type MusicService interface {
	// 获取播放列表
	FetchPlaylist(ctx context.Context) ([]Song, error)
	// 获取歌曲资源（音频和歌词）
	FetchSongResources(ctx context.Context, song Song) (SongResourceResponse, error)
}

// musicService 音乐服务实现
type musicService struct {
	settingSvc setting.SettingService
	httpClient *http.Client
	// 图片URL缓存，key: 原始URL, value: 优化后的URL
	picUrlCache sync.Map
	// 并发控制
	concurrencyLimit int
}

// NewMusicService 创建新的音乐服务
func NewMusicService(settingSvc setting.SettingService) MusicService {
	// 创建自定义 Transport，跳过 SSL 证书验证
	// 注意：这是为了兼容外部 API（metings.qjqq.cn）的临时解决方案
	// 该 API 的证书由未知的证书颁发机构签名，导致验证失败
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: true, // 跳过证书验证
		},
	}

	return &musicService{
		settingSvc:       settingSvc,
		httpClient:       &http.Client{Timeout: 15 * time.Second, Transport: transport},
		picUrlCache:      sync.Map{},
		concurrencyLimit: 20, // 限制并发数量为20
	}
}

func normalizeAPIBaseURL(apiBaseURL string) string {
	return strings.TrimRight(strings.TrimSpace(apiBaseURL), "/")
}

func buildMusicAPIURL(apiBaseURL, endpoint string) string {
	return normalizeAPIBaseURL(apiBaseURL) + "/" + strings.TrimLeft(endpoint, "/")
}

func (s *musicService) getMusicAPIBaseURL() string {
	apiBaseURL := normalizeAPIBaseURL(s.settingSvc.Get(constant.KeyMusicAPIBaseURL.String()))
	if apiBaseURL == "" {
		return "https://metings.qjqq.cn"
	}
	return apiBaseURL
}

func (s *musicService) getMusicAPIURL(endpoint string) string {
	return buildMusicAPIURL(s.getMusicAPIBaseURL(), endpoint)
}

// logRequest 记录请求日志
func (s *musicService) logRequest(method, url string, requestBody []byte) {
	log.Printf("[MUSIC_API] ==================== API 请求开始 ====================")
	log.Printf("[MUSIC_API] 请求方法: %s", method)
	log.Printf("[MUSIC_API] 请求URL: %s", url)
	log.Printf("[MUSIC_API] 请求时间: %s", time.Now().Format("2006-01-02 15:04:05.000"))

	// 解析URL获取更多信息
	s.logURLInfo(url)

	if len(requestBody) > 0 {
		log.Printf("[MUSIC_API] 请求体长度: %d bytes", len(requestBody))
		log.Printf("[MUSIC_API] 请求体内容: %s", string(requestBody))

		// 尝试解析请求体JSON
		s.logRequestBodyInfo(requestBody)
	} else {
		log.Printf("[MUSIC_API] 请求体: 无")
	}
}

// logResponse 记录响应日志
func (s *musicService) logResponse(url string, statusCode int, responseBody []byte, duration time.Duration) {
	log.Printf("[MUSIC_API] ==================== API 响应完成 ====================")
	log.Printf("[MUSIC_API] 响应URL: %s", url)
	log.Printf("[MUSIC_API] 响应状态码: %d", statusCode)
	log.Printf("[MUSIC_API] 响应耗时: %v", duration)
	log.Printf("[MUSIC_API] 响应时间: %s", time.Now().Format("2006-01-02 15:04:05.000"))

	// 评估响应性能
	s.logPerformanceMetrics(duration, len(responseBody))

	if len(responseBody) == 0 {
		log.Printf("[MUSIC_API] 响应体: 空")
		return
	}

	responseStr := string(responseBody)
	responseSize := len(responseBody)

	// 记录响应体大小
	log.Printf("[MUSIC_API] 响应体长度: %d bytes", responseSize)

	// 根据响应大小决定记录策略
	if responseSize <= 2048 {
		// 小响应直接完整记录
		log.Printf("[MUSIC_API] 完整响应体: %s", responseStr)
	} else {
		// 大响应记录前500字符和后200字符
		prefix := ""
		suffix := ""

		if responseSize > 500 {
			prefix = responseStr[:500]
		} else {
			prefix = responseStr
		}

		if responseSize > 700 {
			suffix = responseStr[responseSize-200:]
		}

		log.Printf("[MUSIC_API] 响应体摘要(前500字符): %s", prefix)
		if suffix != "" {
			log.Printf("[MUSIC_API] 响应体摘要(后200字符): %s", suffix)
		}

		// 尝试解析JSON结构并记录关键信息
		s.logJSONStructure(responseStr)
	}

	log.Printf("[MUSIC_API] ==================== API 调用结束 ====================")
}

// logError 记录错误日志
func (s *musicService) logError(operation, url string, err error) {
	log.Printf("[MUSIC_API] ==================== API 错误 ====================")
	log.Printf("[MUSIC_API] 错误时间: %s", time.Now().Format("2006-01-02 15:04:05.000"))
	log.Printf("[MUSIC_API] 失败操作: %s", operation)
	log.Printf("[MUSIC_API] 请求URL: %s", url)
	log.Printf("[MUSIC_API] 错误类型: %T", err)
	log.Printf("[MUSIC_API] 错误详情: %v", err)

	// 识别错误类型
	errorType := "unknown"
	if strings.Contains(err.Error(), "timeout") {
		errorType = "timeout"
	} else if strings.Contains(err.Error(), "connection") {
		errorType = "connection"
	} else if strings.Contains(err.Error(), "json") {
		errorType = "json-parse"
	} else if strings.Contains(err.Error(), "unmarshal") {
		errorType = "data-parse"
	} else if strings.Contains(err.Error(), "context deadline exceeded") {
		errorType = "context-timeout"
	}

	log.Printf("[MUSIC_API] 错误分类: %s", errorType)
	log.Printf("[MUSIC_API] ==================== 错误记录结束 ====================")
}

// logJSONStructure 解析并记录JSON结构的关键信息
func (s *musicService) logJSONStructure(jsonStr string) {
	var jsonData map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &jsonData); err != nil {
		// 尝试解析为数组
		var jsonArray []interface{}
		if err2 := json.Unmarshal([]byte(jsonStr), &jsonArray); err2 == nil {
			log.Printf("[MUSIC_API] JSON结构: 数组, 元素数量: %d", len(jsonArray))
			if len(jsonArray) > 0 {
				// 记录第一个元素的结构（如果是对象）
				if firstElement, ok := jsonArray[0].(map[string]interface{}); ok {
					keys := make([]string, 0, len(firstElement))
					for key := range firstElement {
						keys = append(keys, key)
					}
					log.Printf("[MUSIC_API] 数组元素字段: %v", keys)
				}
			}
		} else {
			log.Printf("[MUSIC_API] JSON解析失败，可能不是有效的JSON格式")
		}
		return
	}

	// 记录JSON对象的关键字段
	summary := make(map[string]interface{})

	// 记录常见的API响应字段
	if code, exists := jsonData["code"]; exists {
		summary["code"] = code
	}
	if msg, exists := jsonData["msg"]; exists {
		summary["msg"] = msg
	}
	if message, exists := jsonData["message"]; exists {
		summary["message"] = message
	}
	if timestamp, exists := jsonData["timestamp"]; exists {
		summary["timestamp"] = timestamp
	}

	// 分析data字段
	if data, exists := jsonData["data"]; exists {
		if dataArray, ok := data.([]interface{}); ok {
			summary["data"] = fmt.Sprintf("数组(%d个元素)", len(dataArray))

			// 记录第一个元素的字段（如果是对象）
			if len(dataArray) > 0 {
				if firstItem, ok := dataArray[0].(map[string]interface{}); ok {
					keys := make([]string, 0, len(firstItem))
					for key := range firstItem {
						keys = append(keys, key)
					}
					summary["dataFields"] = keys
				}
			}
		} else if dataObj, ok := data.(map[string]interface{}); ok {
			keys := make([]string, 0, len(dataObj))
			for key := range dataObj {
				keys = append(keys, key)
			}
			summary["data"] = fmt.Sprintf("对象(字段: %v)", keys)
		} else if data == nil {
			summary["data"] = "null"
		} else {
			summary["data"] = fmt.Sprintf("%T", data)
		}
	}

	// 记录顶级字段
	allFields := make([]string, 0, len(jsonData))
	for key := range jsonData {
		allFields = append(allFields, key)
	}
	summary["allFields"] = allFields

	summaryJson, _ := json.Marshal(summary)
	log.Printf("[MUSIC_API] JSON结构摘要: %s", string(summaryJson))
}

// logURLInfo 解析并记录URL信息
func (s *musicService) logURLInfo(url string) {
	// 识别API类型
	apiType := "unknown"
	if strings.Contains(url, "metings.qjqq.cn") {
		apiType = "metings-api"
		if strings.Contains(url, "/Playlist") {
			apiType = "metings-playlist"
		} else if strings.Contains(url, "/Song_V1") {
			apiType = "metings-song"
		}
	}

	log.Printf("[MUSIC_API] API类型: %s", apiType)

	// 提取URL参数
	if strings.Contains(url, "?") {
		parts := strings.Split(url, "?")
		if len(parts) > 1 {
			log.Printf("[MUSIC_API] URL参数: %s", parts[1])
		}
	}
}

// logRequestBodyInfo 解析并记录请求体信息
func (s *musicService) logRequestBodyInfo(requestBody []byte) {
	var jsonData map[string]interface{}
	if err := json.Unmarshal(requestBody, &jsonData); err != nil {
		log.Printf("[MUSIC_API] 请求体不是有效的JSON格式")
		return
	}

	// 记录请求参数摘要
	summary := make(map[string]interface{})
	for key, value := range jsonData {
		// 对于敏感信息，只记录类型不记录值
		if key == "id" || key == "neteaseId" {
			summary[key] = value
		} else {
			summary[key] = fmt.Sprintf("%T", value)
		}
	}

	summaryJson, _ := json.Marshal(summary)
	log.Printf("[MUSIC_API] 请求参数摘要: %s", string(summaryJson))
}

// logPerformanceMetrics 记录性能指标
func (s *musicService) logPerformanceMetrics(duration time.Duration, responseSize int) {
	// 评估性能等级
	performanceLevel := "excellent"
	if duration > 2*time.Second {
		performanceLevel = "slow"
	} else if duration > 1*time.Second {
		performanceLevel = "normal"
	} else if duration > 500*time.Millisecond {
		performanceLevel = "good"
	}

	log.Printf("[MUSIC_API] 性能评级: %s", performanceLevel)

	// 计算平均速度
	if responseSize > 0 && duration > 0 {
		speed := float64(responseSize) / duration.Seconds() / 1024 // KB/s
		log.Printf("[MUSIC_API] 传输速度: %.2f KB/s", speed)
	}

	// 记录响应大小分类
	sizeCategory := "small"
	if responseSize > 100*1024 {
		sizeCategory = "large"
	} else if responseSize > 10*1024 {
		sizeCategory = "medium"
	}

	log.Printf("[MUSIC_API] 响应大小分类: %s (%d bytes)", sizeCategory, responseSize)
}

// getPlaylistID 获取播放列表ID
func (s *musicService) getPlaylistID() string {
	// 从多个配置键尝试获取播放列表ID
	playlistID := s.settingSvc.Get("music.player.playlist_id")
	if playlistID == "" {
		playlistID = s.settingSvc.Get("MUSIC_PLAYER_PLAYLIST_ID")
	}
	if playlistID == "" {
		playlistID = "8152976493" // 默认值
	}
	return playlistID
}

// buildPlaylistAPI 构建播放列表API URL
func (s *musicService) buildPlaylistAPI() string {
	playlistID := s.getPlaylistID()
	return fmt.Sprintf("%s?id=%s", s.getMusicAPIURL("Playlist"), playlistID)
}

// isValidSong 验证歌曲数据是否有效
func (s *musicService) isValidSong(song map[string]interface{}) bool {
	name, nameOk := song["name"].(string)
	artist, artistOk := song["artist"].(string)
	url, urlOk := song["url"].(string)

	return nameOk && artistOk && urlOk && name != "" && artist != "" && url != ""
}

// FetchPlaylist 获取播放列表
func (s *musicService) FetchPlaylist(ctx context.Context) ([]Song, error) {
	playlistURL := s.buildPlaylistAPI()

	// 记录开始日志
	log.Printf("[MUSIC_API] 开始获取播放列表 - 播放列表ID: %s", s.getPlaylistID())

	// 记录请求日志
	s.logRequest("GET", playlistURL, nil)

	startTime := time.Now()

	// 创建请求
	req, err := http.NewRequestWithContext(ctx, "GET", playlistURL, nil)
	if err != nil {
		s.logError("创建播放列表请求", playlistURL, err)
		return nil, fmt.Errorf("创建播放列表请求失败: %w", err)
	}

	// 发送请求
	resp, err := s.httpClient.Do(req)
	if err != nil {
		s.logError("获取播放列表", playlistURL, err)
		return nil, fmt.Errorf("获取播放列表失败: %w", err)
	}
	defer resp.Body.Close()

	// 读取响应
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		s.logError("读取播放列表响应", playlistURL, err)
		return nil, fmt.Errorf("读取播放列表响应失败: %w", err)
	}

	duration := time.Since(startTime)
	s.logResponse(playlistURL, resp.StatusCode, responseBody, duration)

	// 检查状态码
	if resp.StatusCode != http.StatusOK {
		log.Printf("[MUSIC_API] 播放列表API返回错误状态码: %d", resp.StatusCode)
		return nil, fmt.Errorf("播放列表API返回错误状态码: %d", resp.StatusCode)
	}

	// 解析JSON - 新API返回的是嵌套结构
	var apiResponse PlaylistApiResponse
	if err := json.Unmarshal(responseBody, &apiResponse); err != nil {
		s.logError("解析播放列表JSON", playlistURL, err)
		return nil, fmt.Errorf("解析播放列表JSON失败: %w", err)
	}

	// 验证数据
	tracks := apiResponse.Data.Playlist.Tracks
	if len(tracks) == 0 {
		log.Printf("[MUSIC_API] 播放列表为空")
		return []Song{}, nil
	}

	// 转换数据
	var songs []Song
	validCount := 0

	for i, track := range tracks {
		// 验证必要字段
		if track.Name == "" || track.Artists == "" || track.ID == 0 {
			log.Printf("[MUSIC_API] 跳过无效歌曲数据，索引: %d", i)
			continue
		}

		// 将ID转换为字符串
		songID := fmt.Sprintf("%d", track.ID)

		song := Song{
			ID:        songID,
			NeteaseID: songID, // 网易云ID
			Name:      track.Name,
			Artist:    track.Artists,
			URL:       "",           // 播放列表不提供URL，需要通过Song_V1 API获取
			Pic:       track.PicURL, // 封面图
			Lrc:       "",           // 播放列表不提供歌词，需要通过Song_V1 API获取
		}

		songs = append(songs, song)
		validCount++
	}

	log.Printf("[MUSIC_API] 播放列表解析完成 - 播放列表: %s, 总数: %d, 有效: %d",
		apiResponse.Data.Playlist.Name, len(tracks), validCount)

	return songs, nil
}

// extractNeteaseID 从歌曲数据中提取网易云音乐ID
func (s *musicService) extractNeteaseID(song map[string]interface{}) string {
	// 尝试从URL中提取ID
	if url, ok := song["url"].(string); ok && url != "" {
		if id := s.extractIDFromURL(url); id != "" && s.isValidNeteaseID(id) {
			return id
		}
	}

	// 尝试从歌词URL中提取ID
	if lrc, ok := song["lrc"].(string); ok && lrc != "" {
		if id := s.extractIDFromURL(lrc); id != "" && s.isValidNeteaseID(id) {
			return id
		}
	}

	// 尝试从图片URL中提取ID
	if pic, ok := song["pic"].(string); ok && pic != "" {
		if id := s.extractIDFromURL(pic); id != "" && s.isValidNeteaseID(id) {
			return id
		}
	}

	log.Printf("[MUSIC_API] 未能从歌曲数据中提取有效的网易云音乐ID - 歌曲: %v", song["name"])
	return ""
}

// extractIDFromURL 从URL中提取ID
func (s *musicService) extractIDFromURL(url string) string {
	re := regexp.MustCompile(`[?&]id=(\d+)`)
	matches := re.FindStringSubmatch(url)
	if len(matches) > 1 {
		return matches[1]
	}
	return ""
}

// FetchSongResources 获取歌曲的高质量资源
func (s *musicService) FetchSongResources(ctx context.Context, song Song) (SongResourceResponse, error) {
	log.Printf("[MUSIC_API] 开始获取歌曲资源 - 网易云ID: %s", song.NeteaseID)

	// 验证网易云ID
	if song.NeteaseID == "" {
		return SongResourceResponse{}, fmt.Errorf("网易云音乐ID不能为空")
	}

	if !s.isValidNeteaseID(song.NeteaseID) {
		return SongResourceResponse{}, fmt.Errorf("网易云音乐ID格式无效: %s", song.NeteaseID)
	}

	// 先尝试获取 exhigh 音质
	log.Printf("[MUSIC_API] 尝试获取 exhigh 音质 - 网易云ID: %s", song.NeteaseID)
	response, err := s.fetchSongV1(ctx, song.NeteaseID, "exhigh")

	// 如果 exhigh 失败或返回空，尝试 standard 音质
	if err != nil || response.AudioURL == "" {
		if err != nil {
			log.Printf("[MUSIC_API] exhigh 音质获取失败，尝试 standard 音质 - 网易云ID: %s, 错误: %v", song.NeteaseID, err)
		} else {
			log.Printf("[MUSIC_API] exhigh 音质返回空，尝试 standard 音质 - 网易云ID: %s", song.NeteaseID)
		}

		response, err = s.fetchSongV1(ctx, song.NeteaseID, "standard")
		if err != nil {
			log.Printf("[MUSIC_API] standard 音质获取失败 - 网易云ID: %s, 错误: %v", song.NeteaseID, err)
			return SongResourceResponse{}, fmt.Errorf("获取歌曲资源失败: %w", err)
		}
	}

	if response.AudioURL == "" {
		log.Printf("[MUSIC_API] 所有音质都返回空URL - 网易云ID: %s", song.NeteaseID)
		return SongResourceResponse{
			AudioURL:   "",
			LyricsText: "",
		}, nil
	}

	log.Printf("[MUSIC_API] 成功获取歌曲资源 - 网易云ID: %s, 有歌词: %v", song.NeteaseID, response.LyricsText != "")

	return response, nil
}

// isValidLRCFormat 验证LRC格式
func (s *musicService) isValidLRCFormat(lrcText string) bool {
	if lrcText == "" {
		return false
	}

	// 检查是否包含LRC时间标签
	lrcPattern := regexp.MustCompile(`\[\d{1,2}:\d{2}[\.:]?\d{0,3}\]`)
	return lrcPattern.MatchString(lrcText)
}

// isValidNeteaseID 验证网易云音乐ID格式是否有效
func (s *musicService) isValidNeteaseID(neteaseID string) bool {
	if neteaseID == "" {
		return false
	}

	// 网易云音乐ID应该是纯数字格式，长度通常在6-12位
	neteaseIDPattern := regexp.MustCompile(`^\d{6,12}$`)
	return neteaseIDPattern.MatchString(neteaseID)
}

// fetchSongV1 使用 Song_V1 API 获取歌曲资源（音频和歌词）
func (s *musicService) fetchSongV1(ctx context.Context, neteaseID string, level string) (SongResourceResponse, error) {
	log.Printf("[MUSIC_API] 调用 Song_V1 API - 网易云ID: %s, 音质: %s", neteaseID, level)
	apiBaseURL := s.getMusicAPIBaseURL()
	songAPI := buildMusicAPIURL(apiBaseURL, "Song_V1")

	// 构建请求参数（使用 form-urlencoded 格式）
	formData := fmt.Sprintf("url=%s&level=%s&type=json", neteaseID, level)

	// 记录请求日志
	s.logRequest("POST", songAPI, []byte(formData))

	startTime := time.Now()

	// 创建请求
	req, err := http.NewRequestWithContext(ctx, "POST", songAPI, strings.NewReader(formData))
	if err != nil {
		s.logError("创建 Song_V1 请求", songAPI, err)
		return SongResourceResponse{}, fmt.Errorf("创建 Song_V1 请求失败: %w", err)
	}

	// 设置请求头（模拟浏览器请求）
	req.Header.Set("Accept", "application/json, text/javascript, */*; q=0.01")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9")
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
	req.Header.Set("Origin", apiBaseURL)
	req.Header.Set("Pragma", "no-cache")
	req.Header.Set("Referer", apiBaseURL+"/")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36")
	req.Header.Set("X-Requested-With", "XMLHttpRequest")

	// 发送请求
	resp, err := s.httpClient.Do(req)
	if err != nil {
		s.logError("获取 Song_V1 数据", songAPI, err)
		return SongResourceResponse{}, fmt.Errorf("Song_V1 请求失败: %w", err)
	}
	defer resp.Body.Close()

	// 读取响应
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		s.logError("读取 Song_V1 响应", songAPI, err)
		return SongResourceResponse{}, fmt.Errorf("读取 Song_V1 响应失败: %w", err)
	}

	duration := time.Since(startTime)
	s.logResponse(songAPI, resp.StatusCode, responseBody, duration)

	// 检查状态码
	if resp.StatusCode != http.StatusOK {
		log.Printf("[MUSIC_API] Song_V1 API返回错误状态码: %d", resp.StatusCode)
		return SongResourceResponse{}, fmt.Errorf("Song_V1 API返回错误状态码: %d", resp.StatusCode)
	}

	// 解析响应
	var apiResponse SongV1ApiResponse
	if err := json.Unmarshal(responseBody, &apiResponse); err != nil {
		log.Printf("[MUSIC_API] JSON解析失败，响应内容: %s", string(responseBody))
		s.logError("解析 Song_V1 JSON", songAPI, err)
		return SongResourceResponse{}, fmt.Errorf("解析 Song_V1 JSON失败: %w", err)
	}

	// 检查响应状态
	if apiResponse.Status != 200 || !apiResponse.Success {
		log.Printf("[MUSIC_API] Song_V1 API返回错误 - 状态码: %d, 成功: %v, 消息: %s",
			apiResponse.Status, apiResponse.Success, apiResponse.Message)
		return SongResourceResponse{}, fmt.Errorf("Song_V1 API返回错误: %s", apiResponse.Message)
	}

	// 返回结果
	result := SongResourceResponse{
		AudioURL:   apiResponse.Data.URL,
		LyricsText: apiResponse.Data.Lyric, // 注意字段名是 lyric 不是 lrc
	}

	log.Printf("[MUSIC_API] Song_V1 API调用成功 - 网易云ID: %s, 音质: %s (大小: %s), 有URL: %v, 有歌词: %v",
		neteaseID, level, apiResponse.Data.Size, result.AudioURL != "", result.LyricsText != "")

	return result, nil
}

// optimizePicUrlsWithTimeout 在指定时间内并发优化图片URL
func (s *musicService) optimizePicUrlsWithTimeout(ctx context.Context, songs []Song, timeout time.Duration) int {
	var wg sync.WaitGroup
	var optimizedCount int32

	// 创建信号量控制并发数量
	semaphore := make(chan struct{}, s.concurrencyLimit)

	// 创建带超时的context
	timeoutCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	optimizeStartTime := time.Now()

	for i := range songs {
		wg.Add(1)

		go func(songIndex int) {
			defer wg.Done()

			// 检查是否已经超时
			select {
			case <-timeoutCtx.Done():
				return
			default:
			}

			// 获取信号量
			select {
			case semaphore <- struct{}{}:
				defer func() { <-semaphore }()
			case <-timeoutCtx.Done():
				return
			}

			originalURL := songs[songIndex].Pic
			optimizedURL, err := s.optimizePicUrl(timeoutCtx, originalURL)
			if err != nil {
				// 如果优化失败，尝试智能构造高质量URL
				if smartURL := s.constructHighQualityURL(originalURL); smartURL != "" {
					songs[songIndex].Pic = smartURL
					atomic.AddInt32(&optimizedCount, 1)
				} else {
					// 如果都失败了，设置为空字符串，让前端处理默认图片
					songs[songIndex].Pic = ""
				}
				return
			}

			// 更新歌曲的图片URL
			songs[songIndex].Pic = optimizedURL

			// 增加成功计数（原子操作）
			atomic.AddInt32(&optimizedCount, 1)
		}(i)
	}

	// 等待所有goroutine完成或超时
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		// 所有任务完成
	case <-timeoutCtx.Done():
		// 超时，但goroutine会自行结束
		log.Printf("[MUSIC_API] 图片URL优化达到时间限制: %v", timeout)
	}

	totalDuration := time.Since(optimizeStartTime)
	log.Printf("[MUSIC_API] 快速图片URL优化完成 - 耗时: %v", totalDuration)

	return int(optimizedCount)
}

// optimizePicUrl 优化图片URL尺寸，将90y90升级为150y150（支持缓存）
func (s *musicService) optimizePicUrl(ctx context.Context, originalPicUrl string) (string, error) {
	if originalPicUrl == "" {
		return "", nil
	}

	// 首先检查缓存
	if cached, ok := s.picUrlCache.Load(originalPicUrl); ok {
		if cachedURL, ok := cached.(string); ok {
			return cachedURL, nil
		}
	}

	// 检查是否是meting API的pic URL
	if !strings.Contains(originalPicUrl, "meting.qjqq.cn") || !strings.Contains(originalPicUrl, "type=pic") {
		// 如果不是meting API，尝试智能构造高质量URL
		if smartURL := s.constructHighQualityURL(originalPicUrl); smartURL != "" {
			s.picUrlCache.Store(originalPicUrl, smartURL)
			return smartURL, nil
		}
		// 如果无法构造，返回错误而不是原始URL
		return "", fmt.Errorf("无法处理非meting API的图片URL")
	}

	// 创建不跟随重定向的HTTP客户端
	// 配置跳过 SSL 证书验证以兼容外部 API
	client := &http.Client{
		Timeout: 3 * time.Second, // 快速超时
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true, // 跳过证书验证
			},
		},
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			// 不跟随重定向，我们手动处理
			return http.ErrUseLastResponse
		},
	}

	// 发送HEAD请求获取重定向信息
	req, err := http.NewRequestWithContext(ctx, "HEAD", originalPicUrl, nil)
	if err != nil {
		// 尝试智能构造高质量URL
		if smartURL := s.constructHighQualityURL(originalPicUrl); smartURL != "" {
			s.picUrlCache.Store(originalPicUrl, smartURL)
			return smartURL, nil
		}
		return "", err
	}

	resp, err := client.Do(req)
	if err != nil {
		// 尝试智能构造高质量URL
		if smartURL := s.constructHighQualityURL(originalPicUrl); smartURL != "" {
			s.picUrlCache.Store(originalPicUrl, smartURL)
			return smartURL, nil
		}
		return "", err
	}
	defer resp.Body.Close()

	// 检查是否是重定向状态码
	if resp.StatusCode != http.StatusFound && resp.StatusCode != http.StatusMovedPermanently {
		// 尝试智能构造高质量URL
		if smartURL := s.constructHighQualityURL(originalPicUrl); smartURL != "" {
			s.picUrlCache.Store(originalPicUrl, smartURL)
			return smartURL, nil
		}
		return "", fmt.Errorf("图片URL未返回重定向，状态码: %d", resp.StatusCode)
	}

	// 获取重定向的Location
	redirectURL := resp.Header.Get("Location")
	if redirectURL == "" {
		// 尝试智能构造高质量URL
		if smartURL := s.constructHighQualityURL(originalPicUrl); smartURL != "" {
			s.picUrlCache.Store(originalPicUrl, smartURL)
			return smartURL, nil
		}
		return "", fmt.Errorf("重定向响应中没有Location头")
	}

	// 优化图片尺寸参数
	optimizedURL := s.upgradePicSize(redirectURL)

	// 缓存优化结果
	s.picUrlCache.Store(originalPicUrl, optimizedURL)

	return optimizedURL, nil
}

// upgradePicSize 将图片URL中的尺寸参数从90y90升级为150y150
func (s *musicService) upgradePicSize(picURL string) string {
	// 网易云音乐图片URL格式：https://p3.music.126.net/xxx/xxx.jpg?param=90y90

	// 使用正则表达式匹配并替换param参数
	// 匹配 param=数字y数字 的模式
	paramPattern := regexp.MustCompile(`(\?|&)param=\d+y\d+`)

	if paramPattern.MatchString(picURL) {
		// 替换为150y150
		optimizedURL := paramPattern.ReplaceAllString(picURL, "${1}param=150y150")
		log.Printf("[MUSIC_API] 图片尺寸参数已优化: %s -> %s", picURL, optimizedURL)
		return optimizedURL
	}

	// 如果URL中没有param参数，尝试添加
	if strings.Contains(picURL, "?") {
		// 已有其他参数，追加param
		return picURL + "&param=150y150"
	} else {
		// 没有参数，添加param
		return picURL + "?param=150y150"
	}
}

// constructHighQualityURL 智能构造高质量图片URL
func (s *musicService) constructHighQualityURL(originalURL string) string {
	if originalURL == "" {
		return ""
	}

	// 如果已经是网易云音乐的URL，直接升级参数
	if strings.Contains(originalURL, "p3.music.126.net") || strings.Contains(originalURL, "music.163.com") {
		return s.upgradePicSize(originalURL)
	}

	// 对于meting API URL，我们不尝试构造，因为没有真实的hash值
	// 返回空字符串，让前端处理默认图片
	return ""
}

// validateJSONResponse 验证HTTP响应是否为有效的JSON格式
func (s *musicService) validateJSONResponse(resp *http.Response, responseBody []byte, apiName string) error {
	// 检查响应状态码
	if resp.StatusCode != http.StatusOK {
		log.Printf("[MUSIC_API] %s API返回错误状态码: %d", apiName, resp.StatusCode)
		log.Printf("[MUSIC_API] 响应内容: %s", string(responseBody))
		return fmt.Errorf("%s API返回错误状态码: %d", apiName, resp.StatusCode)
	}

	// 检查Content-Type是否为JSON
	contentType := resp.Header.Get("Content-Type")
	if contentType != "" && !strings.Contains(strings.ToLower(contentType), "application/json") {
		log.Printf("[MUSIC_API] %s 响应Content-Type不是JSON: %s", apiName, contentType)
		log.Printf("[MUSIC_API] 响应内容预览: %.200s", string(responseBody))
		return fmt.Errorf("%s API返回非JSON响应，Content-Type: %s", apiName, contentType)
	}

	// 验证响应是否为有效的JSON格式
	responseStr := strings.TrimSpace(string(responseBody))
	if len(responseStr) == 0 {
		log.Printf("[MUSIC_API] %s API返回空响应", apiName)
		return fmt.Errorf("%s API返回空响应", apiName)
	}

	// 检查响应是否以JSON开始符号开头
	if !strings.HasPrefix(responseStr, "{") && !strings.HasPrefix(responseStr, "[") {
		log.Printf("[MUSIC_API] %s 响应不是有效的JSON格式，开始字符: %c", apiName, responseStr[0])
		log.Printf("[MUSIC_API] 响应内容预览: %.300s", responseStr)

		// 检查是否是HTML错误页面
		if strings.HasPrefix(responseStr, "<") {
			log.Printf("[MUSIC_API] 疑似收到HTML错误页面而非JSON响应")
			return fmt.Errorf("%s API返回HTML页面而非JSON数据，可能是服务器错误或API地址变更", apiName)
		}

		return fmt.Errorf("%s API返回无效的JSON格式", apiName)
	}

	return nil
}

// getString 安全地获取字符串值
func getString(v interface{}) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}
