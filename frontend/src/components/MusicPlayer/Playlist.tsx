/*
 * @Author: 安知鱼
 * @Date: 2026-02-12 16:48:46
 * @Description:
 * @LastEditTime: 2026-02-12 18:05:40
 * @LastEditors: 安知鱼
 */
"use client";

/**
 * @Description: 播放列表组件
 * @Author: 安知鱼
 * 1:1 移植自 anheyu-app components/MusicPlayer/Playlist.vue
 */
import type { Song } from "@/types/music";
import styles from "./styles/Playlist.module.css";

interface PlaylistProps {
  isVisible: boolean;
  playlist: Song[];
  currentSongIndex: number;
  isPlaying: boolean;
  loadingPlaylistItem: number;
  playlistStyle: React.CSSProperties;
  onClose: () => void;
  onSelectSong: (index: number) => void;
}

export function Playlist({
  isVisible,
  playlist,
  currentSongIndex,
  isPlaying,
  loadingPlaylistItem,
  playlistStyle,
  onClose,
  onSelectSong,
}: PlaylistProps) {
  if (!isVisible) return null;

  return (
    <div data-playlist-container className={styles.playlistContainer} style={playlistStyle}>
      <div className={styles.playlistHeader}>
        <span>播放列表 ({playlist.length})</span>
        <div className={styles.closePlaylist} onClick={onClose}>
          ×
        </div>
      </div>
      <div className={styles.playlistContent}>
        {playlist.map((song, index) => {
          const isActive = index === currentSongIndex;
          const isPlayingItem = isActive && isPlaying;
          const isLoadingItem = index === loadingPlaylistItem;

          const itemClasses = [
            styles.playlistItem,
            isActive ? styles.active : "",
            isPlayingItem ? styles.playing : "",
            isLoadingItem ? styles.loading : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div key={song.id || index} className={itemClasses} onClick={() => onSelectSong(index)}>
              <span className={styles.itemIndex}>{index + 1}</span>

              {/* 播放指示器 */}
              <div className={styles.playIndicator}>
                <div className={styles.playBars}>
                  <div className={styles.bar} />
                  <div className={styles.bar} />
                  <div className={styles.bar} />
                  <div className={styles.bar} />
                </div>
              </div>

              {/* Loading指示器 */}
              <div className={styles.loadingIndicator}>
                <div className={styles.loadingSpinner} />
              </div>

              <div className={styles.itemContent}>
                <span className={styles.itemTitle}>{song.name}</span>
                <span className={styles.itemArtist}>{song.artist}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
