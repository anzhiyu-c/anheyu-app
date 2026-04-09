"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import type { LyricLine, LyricsState } from "@/types/music";
import styles from "../music.module.css";

interface LyricsScrollProps {
  lyrics: LyricLine[];
  lyricsState: LyricsState;
  dominantColor: string;
  currentTime?: number;
  isDragging?: boolean;
  onLyricClick: (index: number) => void;
}

export function LyricsScroll({ lyrics, lyricsState, dominantColor, onLyricClick }: LyricsScrollProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lyricsContentRef = useRef<HTMLDivElement>(null);
  const lyricRefsArr = useRef<(HTMLElement | null)[]>([]);
  const isAutoScrollingRef = useRef(false);
  const userScrollingRef = useRef(false);
  const scrollAnimationIdRef = useRef<number | null>(null);
  const userScrollResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTouchingRef = useRef(false);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => {
    if (typeof window === "undefined") return 1280;
    return window.innerWidth;
  });

  useEffect(() => {
    const updateViewportWidth = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", updateViewportWidth);
    window.addEventListener("orientationchange", updateViewportWidth);
    return () => {
      window.removeEventListener("resize", updateViewportWidth);
      window.removeEventListener("orientationchange", updateViewportWidth);
    };
  }, []);

  // 容器内边距
  const containerPadding = useMemo(() => {
    const width = viewportWidth;
    if (width <= 480) return 80;
    if (width <= 768) return 100;
    if (width <= 1024) return 240;
    return 300;
  }, [viewportWidth]);

  const containerPaddingStyle = useMemo(() => {
    if (lyrics.length === 0) {
      return { paddingTop: "0px", paddingBottom: "0px" };
    }
    const isMobile = viewportWidth <= 768;
    if (isMobile) {
      const mobilePadding = viewportWidth <= 480 ? 80 : 100;
      return { paddingTop: `${mobilePadding}px`, paddingBottom: `${mobilePadding}px` };
    }
    return { paddingTop: `${containerPadding}px`, paddingBottom: `${containerPadding}px` };
  }, [lyrics.length, containerPadding, viewportWidth]);

  // 设置歌词元素引用
  const setLyricRef = useCallback((el: HTMLElement | null, index: number) => {
    if (el) {
      lyricRefsArr.current[index] = el;
    }
  }, []);

  // 计算目标滚动位置
  const calculateTargetScrollTop = useCallback(
    (lyricElement: HTMLElement, containerHeight: number, lyricHeight: number): number => {
      const lyricOffsetTop = lyricElement.offsetTop;
      const isMobile = viewportWidth <= 768;

      if (isMobile) {
        const targetPosition = containerHeight * 0.25;
        return lyricOffsetTop - targetPosition + lyricHeight / 2;
      }
      return lyricOffsetTop - containerHeight / 2 + lyricHeight / 2;
    },
    [viewportWidth]
  );

  // 平滑滚动到指定歌词
  const scrollToCurrentLyricCenter = useCallback(
    (targetIndex: number) => {
      const container = scrollContainerRef.current;
      if (!container || targetIndex < 0 || targetIndex >= lyricRefsArr.current.length) return;

      const lyricEl = lyricRefsArr.current[targetIndex];
      if (!lyricEl) return;

      const containerHeight = container.clientHeight;
      const lyricHeight = lyricEl.offsetHeight;
      const targetScrollTop = calculateTargetScrollTop(lyricEl, containerHeight, lyricHeight);

      if (scrollAnimationIdRef.current) {
        cancelAnimationFrame(scrollAnimationIdRef.current);
      }

      isAutoScrollingRef.current = true;
      setIsAutoScrolling(true);
      const startScrollTop = container.scrollTop;
      const distance = targetScrollTop - startScrollTop;
      const duration = 600;
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        container.scrollTop = startScrollTop + distance * easeProgress;

        if (progress < 1) {
          scrollAnimationIdRef.current = requestAnimationFrame(animate);
        } else {
          isAutoScrollingRef.current = false;
          setIsAutoScrolling(false);
          scrollAnimationIdRef.current = null;
        }
      };

      scrollAnimationIdRef.current = requestAnimationFrame(animate);
    },
    [calculateTargetScrollTop]
  );

  // 监听歌词索引变化
  const prevIndexRef = useRef(-1);
  useEffect(() => {
    const currentIndex = lyricsState.currentIndex;
    if (currentIndex !== prevIndexRef.current && currentIndex >= 0) {
      prevIndexRef.current = currentIndex;
      if (!userScrollingRef.current) {
        // 双 rAF：等待歌词行 ref 挂载后再算 offset（对齐旧版 Vue 行为）
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollToCurrentLyricCenter(currentIndex);
          });
        });
      }
    }
  }, [lyricsState.currentIndex, scrollToCurrentLyricCenter]);

  // 歌词列表变化时重置
  useEffect(() => {
    lyricRefsArr.current = new Array(lyrics.length).fill(null);
    prevIndexRef.current = -1;
  }, [lyrics]);

  // 处理歌词点击
  const handleLyricClick = useCallback(
    (index: number) => {
      onLyricClick(index);
      userScrollingRef.current = false;
      isAutoScrollingRef.current = false;
      if (scrollAnimationIdRef.current) {
        cancelAnimationFrame(scrollAnimationIdRef.current);
      }
      scrollToCurrentLyricCenter(index);
    },
    [onLyricClick, scrollToCurrentLyricCenter]
  );

  // 处理鼠标滚轮
  const handleWheel = useCallback(() => {
    userScrollingRef.current = true;
    isAutoScrollingRef.current = false;

    if (scrollAnimationIdRef.current) {
      cancelAnimationFrame(scrollAnimationIdRef.current);
      scrollAnimationIdRef.current = null;
    }

    if (userScrollResetTimerRef.current) {
      clearTimeout(userScrollResetTimerRef.current);
    }

    userScrollResetTimerRef.current = setTimeout(() => {
      userScrollingRef.current = false;
      userScrollResetTimerRef.current = null;
      const currentIndex = lyricsState.currentIndex;
      if (currentIndex >= 0) {
        scrollToCurrentLyricCenter(currentIndex);
      }
    }, 4000);
  }, [lyricsState.currentIndex, scrollToCurrentLyricCenter]);

  // 处理触摸事件
  const handleTouchStart = useCallback(() => {
    isTouchingRef.current = true;
    if (userScrollResetTimerRef.current) {
      clearTimeout(userScrollResetTimerRef.current);
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (!isTouchingRef.current) return;
    userScrollingRef.current = true;
    isAutoScrollingRef.current = false;
    if (scrollAnimationIdRef.current) {
      cancelAnimationFrame(scrollAnimationIdRef.current);
      scrollAnimationIdRef.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    isTouchingRef.current = false;
    if (userScrollResetTimerRef.current) {
      clearTimeout(userScrollResetTimerRef.current);
    }
    userScrollResetTimerRef.current = setTimeout(() => {
      userScrollingRef.current = false;
      userScrollResetTimerRef.current = null;
      const currentIndex = lyricsState.currentIndex;
      if (currentIndex >= 0) {
        scrollToCurrentLyricCenter(currentIndex);
      }
    }, 4000);
  }, [lyricsState.currentIndex, scrollToCurrentLyricCenter]);

  // 处理滚动事件
  const handleScroll = useCallback(() => {
    if (isAutoScrollingRef.current) return;
    if (userScrollingRef.current) return;
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      if (scrollAnimationIdRef.current) {
        cancelAnimationFrame(scrollAnimationIdRef.current);
      }
      if (userScrollResetTimerRef.current) {
        clearTimeout(userScrollResetTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={scrollContainerRef}
      className={styles.lyricsScroll}
      style={{ "--dominant-color": dominantColor } as React.CSSProperties}
      onScroll={handleScroll}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        ref={lyricsContentRef}
        className={`${styles.lyricsScrollContent} ${isAutoScrolling ? styles.autoScrolling : ""}`}
        style={containerPaddingStyle}
      >
        {lyrics.length === 0 ? (
          <div className={`${styles.lyricItem} ${styles.noLyrics}`}>
            <div className={styles.lyricText}>♪ 暂无歌词 ♪</div>
          </div>
        ) : (
          lyrics.map((lyric, index) => (
            <div
              key={index}
              ref={el => setLyricRef(el, index)}
              className={`${styles.lyricItem} ${
                index === lyricsState.currentIndex
                  ? styles.isCurrent
                  : index < lyricsState.currentIndex
                    ? styles.isPassed
                    : styles.isUpcoming
              }`}
              data-index={index}
              onClick={() => handleLyricClick(index)}
            >
              <div className={styles.lyricText}>{lyric.text}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
