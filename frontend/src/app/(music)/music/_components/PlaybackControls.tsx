"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  RefreshCw,
  Loader2,
  VolumeX,
  Volume2,
  Volume1,
  Volume,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  List,
  Shuffle,
  Repeat1,
  ListOrdered,
} from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import type { AudioState, AudioLoadingState } from "@/types/music";
import styles from "../music.module.css";

type PlayMode = "sequence" | "shuffle" | "repeat";

interface PlaybackControlsProps {
  audioState: AudioState;
  audioLoadingState: AudioLoadingState;
  playedPercentage: number;
  loadedPercentage: number;
  hasPlaylist: boolean;
  currentSong: boolean;
  playMode: PlayMode;
  cacheIsLoading: boolean;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onSetVolume: (volume: number) => void;
  onTogglePlaylist: () => void;
  onTogglePlayMode: () => void;
  onRefreshCache: () => void;
  formatTime: (seconds: number) => string;
}

export function PlaybackControls({
  audioState,
  audioLoadingState,
  playedPercentage,
  loadedPercentage,
  hasPlaylist,
  currentSong,
  playMode,
  cacheIsLoading,
  onPlayPause,
  onPrevious,
  onNext,
  onSeek,
  onSetVolume,
  onTogglePlaylist,
  onTogglePlayMode,
  onRefreshCache,
  formatTime,
}: PlaybackControlsProps) {
  const [showProgressThumb, setShowProgressThumb] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const [thumbPosition, setThumbPosition] = useState(0);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const volumeControlRef = useRef<HTMLDivElement>(null);
  const dragMouseMoveRef = useRef<((event: MouseEvent) => void) | null>(null);
  const dragMouseUpRef = useRef<((event: MouseEvent) => void) | null>(null);

  const cleanupDragListeners = useCallback(() => {
    if (dragMouseMoveRef.current) {
      document.removeEventListener("mousemove", dragMouseMoveRef.current);
      dragMouseMoveRef.current = null;
    }
    if (dragMouseUpRef.current) {
      document.removeEventListener("mouseup", dragMouseUpRef.current);
      dragMouseUpRef.current = null;
    }
  }, []);

  // 进度条点击
  const handleProgressClick = useCallback(
    (event: React.MouseEvent) => {
      const target = event.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const percentage = (event.clientX - rect.left) / rect.width;
      const newTime = percentage * audioState.duration;
      onSeek(newTime);
    },
    [audioState.duration, onSeek]
  );

  // 进度条拖拽
  const handleProgressMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      setIsDragging(true);

      const progressTrack = event.currentTarget as HTMLElement;
      const cachedRect = progressTrack.getBoundingClientRect();

      const calculatePercentage = (clientX: number) => {
        return Math.max(0, Math.min(100, ((clientX - cachedRect.left) / cachedRect.width) * 100));
      };

      const updateDragState = (percentage: number) => {
        setDragProgress(percentage);
        setThumbPosition(percentage);
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const percentage = calculatePercentage(moveEvent.clientX);
        updateDragState(percentage);
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        const finalPercentage = calculatePercentage(upEvent.clientX);
        const newTime = (finalPercentage / 100) * audioState.duration;

        setIsDragging(false);
        cleanupDragListeners();

        if (audioState.duration) {
          onSeek(newTime);
        }
      };

      cleanupDragListeners();
      dragMouseMoveRef.current = handleMouseMove;
      dragMouseUpRef.current = handleMouseUp;
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      const initialPercentage = calculatePercentage(event.clientX);
      updateDragState(initialPercentage);
    },
    [audioState.duration, onSeek, cleanupDragListeners]
  );

  // 同步 thumb 位置
  const currentThumbPosition = isDragging ? thumbPosition : playedPercentage;

  // 音量控制
  const toggleVolumeSlider = useCallback(() => {
    setShowVolumeSlider(prev => !prev);
  }, []);

  const handleVerticalVolumeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const volume = parseFloat(event.target.value) / 100;
      onSetVolume(volume);
    },
    [onSetVolume]
  );

  // 音量图标
  const VolumeIcon = audioState.isMuted
    ? VolumeX
    : audioState.volume > 0.6
      ? Volume2
      : audioState.volume > 0.3
        ? Volume1
        : Volume;

  // 播放模式图标和标题
  const PlayModeIcon = playMode === "shuffle" ? Shuffle : playMode === "repeat" ? Repeat1 : ListOrdered;
  const playModeTitle = playMode === "shuffle" ? "随机播放" : playMode === "repeat" ? "单曲循环" : "顺序播放";
  const playPauseTitle = audioLoadingState.isLoading ? "加载中..." : audioState.isPlaying ? "暂停" : "播放";

  useEffect(() => {
    return () => {
      cleanupDragListeners();
    };
  }, [cleanupDragListeners]);

  return (
    <div className={styles.playbackControls}>
      {/* 进度条 */}
      <div className={styles.progressContainer}>
        <span className={styles.timeLabel}>{formatTime(audioState.currentTime)}</span>
        <div
          className={`${styles.progressTrack} ${isDragging ? styles.dragging : ""} ${audioLoadingState.isLoading ? styles.isLoading : ""}`}
          onClick={handleProgressClick}
          onMouseEnter={() => setShowProgressThumb(true)}
          onMouseLeave={() => setShowProgressThumb(false)}
          onMouseDown={handleProgressMouseDown}
        >
          {/* 加载进度 */}
          {audioLoadingState.isLoading && (
            <div className={styles.progressLoading} style={{ width: `${audioLoadingState.progress}%` }} />
          )}
          {/* 缓冲进度 */}
          <div
            className={`${styles.progressBuffer} ${loadedPercentage > 0 ? styles.hasContent : ""}`}
            style={{ width: `${loadedPercentage}%` }}
          />
          {/* 播放进度 */}
          <div className={styles.progressFill} style={{ width: `${isDragging ? dragProgress : playedPercentage}%` }} />
          {/* Thumb */}
          <div
            className={`${styles.progressThumb} ${showProgressThumb || isDragging ? styles.show : ""}`}
            style={{ left: `${currentThumbPosition}%` }}
          />
        </div>
        <span className={styles.timeLabel}>{formatTime(audioState.duration)}</span>
      </div>

      {/* 控制按钮 */}
      <div className={styles.controlButtons}>
        {/* 1. 刷新缓存 */}
        <Tooltip content={cacheIsLoading ? "加载中..." : "刷新缓存"} placement="top" showArrow={false} delay={120}>
          <button
            className={`${styles.controlBtn} ${styles.secondary} ${styles.mobileHidden}`}
            aria-label={cacheIsLoading ? "加载中..." : "刷新缓存"}
            disabled={cacheIsLoading}
            onClick={onRefreshCache}
          >
            {cacheIsLoading ? <Loader2 className={styles.loadingIcon} size={20} /> : <RefreshCw size={20} />}
          </button>
        </Tooltip>

        {/* 2. 音量 */}
        <div ref={volumeControlRef} className={`${styles.volumeControlWrapper} ${styles.mobileHidden}`}>
          <Tooltip content="音量控制" placement="top" showArrow={false} delay={120}>
            <button
              className={`${styles.controlBtn} ${styles.secondary}`}
              aria-label="音量控制"
              onClick={toggleVolumeSlider}
            >
              <VolumeIcon size={20} />
            </button>
          </Tooltip>
          <div className={`${styles.verticalVolumeSlider} ${showVolumeSlider ? styles.show : ""}`}>
            <div className={styles.volumeTrack}>
              <input
                type="range"
                min="0"
                max="100"
                className={styles.volumeRange}
                value={audioState.volume * 100}
                onChange={handleVerticalVolumeChange}
              />
            </div>
          </div>
        </div>

        {/* 3. 上一曲 */}
        <Tooltip content="上一曲" placement="top" showArrow={false} delay={120}>
          <button
            className={`${styles.controlBtn} ${styles.secondary} ${styles.mobileOrder2}`}
            aria-label="上一曲"
            disabled={!hasPlaylist}
            onClick={onPrevious}
          >
            <SkipBack size={20} />
          </button>
        </Tooltip>

        {/* 4. 播放/暂停 */}
        <Tooltip content={playPauseTitle} placement="top" showArrow={false} delay={120}>
          <button
            className={`${styles.controlBtn} ${styles.primary} ${styles.mobileOrder3} ${audioLoadingState.isLoading ? styles.isLoadingBtn : ""}`}
            aria-label={playPauseTitle}
            disabled={!currentSong}
            onClick={onPlayPause}
          >
            {audioLoadingState.isLoading ? (
              <Loader2 className={styles.loadingIcon} size={24} />
            ) : audioState.isPlaying ? (
              <Pause size={24} />
            ) : (
              <Play size={24} />
            )}
          </button>
        </Tooltip>

        {/* 5. 下一曲 */}
        <Tooltip content="下一曲" placement="top" showArrow={false} delay={120}>
          <button
            className={`${styles.controlBtn} ${styles.secondary} ${styles.mobileOrder4}`}
            aria-label="下一曲"
            disabled={!hasPlaylist}
            onClick={onNext}
          >
            <SkipForward size={20} />
          </button>
        </Tooltip>

        {/* 6. 播放列表 */}
        <Tooltip content="播放列表" placement="top" showArrow={false} delay={120}>
          <button
            className={`${styles.controlBtn} ${styles.secondary} ${styles.mobileOrder5}`}
            aria-label="播放列表"
            onClick={onTogglePlaylist}
          >
            <List size={20} />
          </button>
        </Tooltip>

        {/* 7. 播放模式 */}
        <Tooltip content={playModeTitle} placement="top" showArrow={false} delay={120}>
          <button
            className={`${styles.controlBtn} ${styles.secondary} ${styles.mobileOrder1}`}
            aria-label={playModeTitle}
            onClick={onTogglePlayMode}
          >
            <PlayModeIcon size={20} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
