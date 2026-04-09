"use client";

/**
 * @Description: 播放控制组件
 * @Author: 安知鱼
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./styles/PlayControls.module.css";

interface PlayControlsProps {
  isVisible: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  dominantColor: string;
  onPrevious: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
  onTogglePlaylist: () => void;
}

export function PlayControls({
  isVisible,
  isPlaying,
  isMuted,
  volume,
  dominantColor,
  onPrevious,
  onTogglePlay,
  onNext,
  onToggleMute,
  onVolumeChange,
  onTogglePlaylist,
}: PlayControlsProps) {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [sliderPos, setSliderPos] = useState({ left: 0, bottom: 0 });
  const volumeBtnRef = useRef<HTMLDivElement>(null);
  const sliderPopupRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setShowVolumeSlider(false);
    }, 300);
  }, [clearHideTimer]);

  const updateSliderPosition = useCallback(() => {
    if (volumeBtnRef.current) {
      const rect = volumeBtnRef.current.getBoundingClientRect();
      setSliderPos({
        left: rect.left + rect.width / 2,
        bottom: window.innerHeight - rect.top + 4,
      });
    }
  }, []);

  const handleVolumeBtnEnter = useCallback(() => {
    clearHideTimer();
    updateSliderPosition();
    setShowVolumeSlider(true);
  }, [clearHideTimer, updateSliderPosition]);

  const handleVolumeBtnLeave = useCallback(() => {
    if (!isDragging) scheduleHide();
  }, [isDragging, scheduleHide]);

  const handleSliderEnter = useCallback(() => {
    clearHideTimer();
  }, [clearHideTimer]);

  const handleSliderLeave = useCallback(() => {
    if (!isDragging) scheduleHide();
  }, [isDragging, scheduleHide]);

  const handleVolumeInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onVolumeChange(parseFloat(e.target.value) / 100);
    },
    [onVolumeChange]
  );

  useEffect(() => {
    if (!isDragging) return;
    const onUp = (e: MouseEvent) => {
      setIsDragging(false);
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const overPopup = sliderPopupRef.current?.contains(target as Node);
      const overBtn = volumeBtnRef.current?.contains(target as Node);
      if (!overPopup && !overBtn) scheduleHide();
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [isDragging, scheduleHide]);

  if (!isVisible && showVolumeSlider) {
    setShowVolumeSlider(false);
  }

  useEffect(() => {
    if (!isVisible) clearHideTimer();
  }, [isVisible, clearHideTimer]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  const volumeValue = isMuted ? 0 : Math.round(volume * 100);

  return (
    <>
      <div
        data-music-controls
        className={`${styles.musicControls}${isVisible ? ` ${styles.visible}` : ""}`}
        style={{
          background: `linear-gradient(to left, ${dominantColor} 60%, transparent)`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 上一首 */}
        <div className={styles.controlBtn} onClick={onPrevious}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
          </svg>
        </div>

        {/* 播放/暂停 */}
        <div className={`${styles.controlBtn} ${styles.playPauseBtn}`} onClick={onTogglePlay}>
          {!isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          )}
        </div>

        {/* 下一首 */}
        <div className={styles.controlBtn} onClick={onNext}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
          </svg>
        </div>

        {/* 音量控制 — 点击静音切换，hover 显示音量滑块 */}
        <div
          ref={volumeBtnRef}
          className={styles.controlBtn}
          onClick={onToggleMute}
          onMouseEnter={handleVolumeBtnEnter}
          onMouseLeave={handleVolumeBtnLeave}
        >
          {!isMuted && volume > 0 ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
            </svg>
          )}
        </div>

        {/* 播放列表 */}
        <div className={styles.controlBtn} onClick={onTogglePlaylist}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">
            <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
          </svg>
        </div>
      </div>

      {showVolumeSlider &&
        createPortal(
          <div
            ref={sliderPopupRef}
            className={styles.volumeSliderPopup}
            style={{
              left: `${sliderPos.left}px`,
              bottom: `${sliderPos.bottom}px`,
            }}
            onMouseEnter={handleSliderEnter}
            onMouseLeave={handleSliderLeave}
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.volumeSliderTrack}>
              <div className={styles.volumeSliderFill} style={{ height: `${volumeValue}%` }} />
              <input
                type="range"
                min="0"
                max="100"
                className={styles.volumeRange}
                value={volumeValue}
                onChange={handleVolumeInputChange}
                onMouseDown={() => setIsDragging(true)}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
