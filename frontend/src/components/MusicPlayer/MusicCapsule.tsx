"use client";

/**
 * @Description: 音乐胶囊组件
 * @Author: 安知鱼
 * 1:1 移植自 anheyu-app components/MusicPlayer/MusicCapsule.vue
 */
import type { Song, LyricLine, LyricsState } from "@/types/music";
import { AlbumCover } from "./AlbumCover";
import { LyricsDisplay } from "./LyricsDisplay";
import { PlayControls } from "./PlayControls";
import styles from "./styles/MusicCapsule.module.css";

interface MusicCapsuleProps {
  isExpanded: boolean;
  isPlaying: boolean;
  isHovered: boolean;
  isLoading: boolean;
  isCollapsing: boolean;
  isMuted: boolean;
  volume: number;
  currentSong: Song | null;
  lyrics: LyricLine[];
  lyricsState: LyricsState;
  dominantColor: string;
  playedPercentage: number;
  setLyricRef: (el: HTMLElement | null, index: number) => void;
  onToggleExpand: () => void;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
  onTogglePlaylist: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function MusicCapsule({
  isExpanded,
  isPlaying,
  isHovered,
  isLoading,
  isCollapsing,
  isMuted,
  volume,
  currentSong,
  lyrics,
  lyricsState,
  dominantColor,
  playedPercentage,
  setLyricRef,
  onToggleExpand,
  onTogglePlay,
  onPrevious,
  onNext,
  onToggleMute,
  onVolumeChange,
  onTogglePlaylist,
  onMouseEnter,
  onMouseLeave,
}: MusicCapsuleProps) {
  const containerClasses = [
    styles.musicCapsuleContainer,
    isExpanded ? styles.expanded : "",
    isPlaying ? styles.playing : "",
    isCollapsing ? styles.collapsing : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleCapsuleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    if (target.closest("[data-music-controls]")) return;
    onToggleExpand();
  };

  const handleIconClick = (e: React.MouseEvent) => {
    if (!isExpanded && isPlaying) {
      return;
    }
    e.stopPropagation();
    onTogglePlay();
  };

  return (
    <div
      className={containerClasses}
      style={
        {
          "--dominant-color": dominantColor,
          backgroundColor: isExpanded ? dominantColor : undefined,
        } as React.CSSProperties
      }
      onClick={handleCapsuleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* 封面 */}
      <AlbumCover imageUrl={currentSong?.pic} isPlaying={isPlaying} />

      {/* 收起状态信息 */}
      <div className={`${styles.collapsedInfo}${isExpanded ? ` ${styles.hidden}` : ""}`}>
        <div className={styles.collapsedTitle}>{currentSong?.name || "未知歌曲"}</div>

        <div className={styles.collapsedIcon} onClick={handleIconClick}>
          {isLoading ? (
            <div className={styles.loadingSpinnerWrap}>
              <div className={styles.spinnerRing} />
            </div>
          ) : isPlaying ? (
            <div className={`${styles.pauseBars} ${styles.pauseBarsPlaying}`}>
              <div className={styles.pauseBar} />
              <div className={styles.pauseBar} />
            </div>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </div>
      </div>

      {/* 展开状态 - 歌曲信息 */}
      <div className={`${styles.songInfo}${isExpanded ? ` ${styles.visible}` : ""}`} onClick={onToggleExpand}>
        <span className={styles.songTitle}>{currentSong?.name || "未播放"}</span>
        <LyricsDisplay
          lyrics={lyrics}
          lyricsState={lyricsState}
          dominantColor={dominantColor}
          setLyricRef={setLyricRef}
        />
      </div>

      {/* 播放控制 */}
      <PlayControls
        isVisible={isExpanded && isHovered}
        isPlaying={isPlaying}
        isMuted={isMuted}
        volume={volume}
        dominantColor={dominantColor}
        onPrevious={onPrevious}
        onTogglePlay={onTogglePlay}
        onNext={onNext}
        onToggleMute={onToggleMute}
        onVolumeChange={onVolumeChange}
        onTogglePlaylist={onTogglePlaylist}
      />

      {/* 进度条覆盖层 */}
      <div className={styles.progressOverlay} style={{ width: `${playedPercentage}%` }} />
    </div>
  );
}
