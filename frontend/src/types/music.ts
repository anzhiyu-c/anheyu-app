/**
 * @Description: 音乐播放器相关类型定义
 * @Author: 安知鱼
 */

// 歌曲接口
export interface Song {
  id?: string;
  neteaseId?: string; // 网易云音乐歌曲ID，用于新API调用
  name: string;
  artist: string;
  url: string;
  pic: string;
  lrc: string;
}

// 歌词行接口
export interface LyricLine {
  time: number;
  text: string;
}

// 音频状态接口
export interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
}

// 歌词状态接口
export interface LyricsState {
  currentIndex: number;
  translateY: number;
  shouldScroll: boolean[];
}

// 颜色缓存接口
export interface ColorCache {
  [key: string]: string;
}

// 播放列表缓存接口
export interface PlaylistCache {
  data: Song[];
  playlistId: string;
  customPlaylistUrl: string | null;
  timestamp: number;
}

// 音频加载状态
export interface AudioLoadingState {
  isLoading: boolean;
  loadingType: "metadata" | "full" | "idle";
  progress: number;
}

// 支持的歌词输入格式类型
export type LyricInput = string | { lrc: string } | { lyric: string } | { data: { lrc: string } };
