"use client";

/**
 * @Description: 歌词显示组件
 * @Author: 安知鱼
 * 1:1 移植自 anheyu-app components/MusicPlayer/LyricsDisplay.vue
 */
import { useCallback } from "react";
import type { LyricLine, LyricsState } from "@/types/music";
import styles from "./styles/LyricsDisplay.module.css";

interface LyricsDisplayProps {
  lyrics: LyricLine[];
  lyricsState: LyricsState;
  dominantColor: string;
  setLyricRef: (el: HTMLElement | null, index: number) => void;
}

export function LyricsDisplay({ lyrics, lyricsState, dominantColor, setLyricRef }: LyricsDisplayProps) {
  const getLineClassName = useCallback(
    (index: number) => {
      const classes = [styles.lyricLine];
      if (index === lyricsState.currentIndex) classes.push(styles.current);
      else if (index < lyricsState.currentIndex) classes.push(styles.passed);
      else if (index > lyricsState.currentIndex) classes.push(styles.upcoming);
      return classes.join(" ");
    },
    [lyricsState.currentIndex]
  );

  return (
    <div className={styles.lyricsContainer} style={{ "--dominant-color": dominantColor } as React.CSSProperties}>
      <div className={styles.lyricsContent} style={{ transform: `translateY(${lyricsState.translateY}px)` }}>
        {lyrics.length === 0 ? (
          <div className={`${styles.lyricLine} ${styles.noLyrics}`}>
            <div className={styles.lyricText}>♪ 暂无歌词 ♪</div>
          </div>
        ) : (
          lyrics.map((lyric, index) => (
            <div key={index} className={getLineClassName(index)}>
              <div
                ref={el => setLyricRef(el, index)}
                className={`${styles.lyricText}${lyricsState.shouldScroll[index] ? ` ${styles.textScrolling}` : ""}`}
              >
                {lyric.text}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
