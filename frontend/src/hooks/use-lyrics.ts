"use client";

/**
 * @Description: 歌词处理逻辑 hook
 * @Author: 安知鱼
 * 1:1 移植自 anheyu-app composables/useLyrics.ts
 */
import { useState, useRef, useCallback, useEffect } from "react";
import type { LyricLine, LyricsState, LyricInput } from "@/types/music";

export function useLyrics(
  currentTimeRef: React.MutableRefObject<number>,
  isDraggingRef?: React.MutableRefObject<boolean>
) {
  const LYRIC_ADVANCE_TIME = 0.3;
  const DRAG_LYRIC_ADVANCE_TIME = 0.1;

  const [lyrics, setLyricsData] = useState<LyricLine[]>([]);
  const lyricsRef = useRef<LyricLine[]>([]);

  const [lyricsState, setLyricsState] = useState<LyricsState>({
    currentIndex: -1,
    translateY: 0,
    shouldScroll: [],
  });
  const lyricsStateRef = useRef<LyricsState>(lyricsState);

  // Sync refs via effects to avoid updating refs during render
  useEffect(() => {
    lyricsRef.current = lyrics;
  }, [lyrics]);

  useEffect(() => {
    lyricsStateRef.current = lyricsState;
  }, [lyricsState]);

  const lyricRefsArr = useRef<(HTMLElement | null)[]>([]);
  const lyricScrollTimerRef = useRef<number | null>(null);
  const textScrollStartTimerRef = useRef<number | null>(null);
  const timeUpdateDebounceTimerRef = useRef<number | null>(null);
  const prevTimeRef = useRef<number>(0);

  // 验证和标准化歌词文本格式
  const validateAndNormalizeLyrics = useCallback((input: LyricInput): string => {
    try {
      if (typeof input === "string") {
        return input;
      }

      if (typeof input === "object" && input !== null) {
        if ("data" in input && input.data && typeof input.data === "object" && "lrc" in input.data) {
          return input.data.lrc;
        }

        if ("lrc" in input && typeof input.lrc === "string") {
          return input.lrc;
        }

        if ("lyric" in input && typeof input.lyric === "string") {
          return input.lyric;
        }
      }

      return "";
    } catch {
      return "";
    }
  }, []);

  // 解析歌词文本
  const parseLyrics = useCallback(
    (lrcInput: LyricInput): LyricLine[] => {
      const lrcText = validateAndNormalizeLyrics(lrcInput);

      if (!lrcText || typeof lrcText !== "string") {
        return [];
      }

      const lines = lrcText.split("\n");
      const result: LyricLine[] = [];

      lines.forEach(line => {
        // 格式1: [00:12.34] 或 [00:12.345]
        let match = line.match(/\[(\d{1,2}):(\d{2})\.(\d{2,3})\](.*)/);

        if (!match) {
          // 格式2: [00:12:34]
          match = line.match(/\[(\d{1,2}):(\d{2}):(\d{2})\](.*)/);
          if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            const centiseconds = parseInt(match[3]);
            const time = minutes * 60 + seconds + centiseconds / 100;
            const text = match[4].trim();

            if (text) {
              result.push({ time, text });
            }
            return;
          }
        }

        if (!match) {
          // 格式3: [00:12]
          match = line.match(/\[(\d{1,2}):(\d{2})\](.*)/);
          if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            const time = minutes * 60 + seconds;
            const text = match[3].trim();

            if (text) {
              result.push({ time, text });
            }
            return;
          }
        }

        // 标准格式处理
        if (match) {
          const minutes = parseInt(match[1]);
          const seconds = parseInt(match[2]);
          const milliseconds = parseInt(match[3].padEnd(3, "0"));
          const time = minutes * 60 + seconds + milliseconds / 1000;
          const text = match[4].trim();

          if (text && text.length > 0) {
            result.push({ time, text });
          }
        }
      });

      // 按时间排序并去重
      const sortedResult = result.sort((a, b) => a.time - b.time);
      const uniqueResult = sortedResult.filter((item, index) => {
        return index === 0 || Math.abs(item.time - sortedResult[index - 1].time) > 0.1;
      });

      return uniqueResult;
    },
    [validateAndNormalizeLyrics]
  );

  // 查找当前歌词索引
  const findCurrentLyricIndex = useCallback((): number => {
    const currentLyrics = lyricsRef.current;
    if (currentLyrics.length === 0) {
      return -1;
    }

    const advanceTime = isDraggingRef?.current ? DRAG_LYRIC_ADVANCE_TIME : LYRIC_ADVANCE_TIME;
    const current = currentTimeRef.current + advanceTime;

    let foundIndex = -1;
    for (let i = currentLyrics.length - 1; i >= 0; i--) {
      if (current >= currentLyrics[i].time) {
        foundIndex = i;
        break;
      }
    }

    return foundIndex;
  }, [currentTimeRef, isDraggingRef]);

  // 计算歌词滚动位置
  const calculateLyricsPosition = useCallback((currentIndex: number) => {
    const currentLyrics = lyricsRef.current;
    if (currentLyrics.length === 0 || currentIndex < 0) {
      return 0;
    }

    const lineHeight = 20;
    return 0 - currentIndex * lineHeight;
  }, []);

  // 获取单句歌词的持续时间
  const getLyricDuration = useCallback((currentIndex: number): number => {
    const currentLyrics = lyricsRef.current;
    if (currentIndex < 0 || currentIndex >= currentLyrics.length) {
      return 0;
    }

    if (currentIndex === currentLyrics.length - 1) {
      return 8;
    }

    const currentTime = currentLyrics[currentIndex].time;
    const nextTime = currentLyrics[currentIndex + 1].time;
    const duration = nextTime - currentTime;

    return Math.max(2, Math.min(20, duration));
  }, []);

  // 检测当前播放歌词是否需要滚动
  const checkCurrentLyricScrollNeed = useCallback(
    (targetIndex: number) => {
      if (lyricScrollTimerRef.current) {
        clearTimeout(lyricScrollTimerRef.current);
      }
      if (textScrollStartTimerRef.current) {
        clearTimeout(textScrollStartTimerRef.current);
        textScrollStartTimerRef.current = null;
      }

      lyricScrollTimerRef.current = window.setTimeout(() => {
        const currentLyrics = lyricsRef.current;

        // 先清除所有歌词的滚动状态
        currentLyrics.forEach((_, i) => {
          const lyricEl = lyricRefsArr.current[i];
          if (lyricEl) {
            lyricEl.classList.remove("text-scrolling");
            lyricEl.removeAttribute("data-long-text");
            lyricEl.style.removeProperty("--scroll-duration");
          }
        });

        // 重置滚动状态
        const newShouldScroll = new Array(currentLyrics.length).fill(false);

        // 只检测当前播放的歌词
        if (targetIndex >= 0 && targetIndex < currentLyrics.length) {
          const lyricEl = lyricRefsArr.current[targetIndex];
          if (lyricEl && lyricEl.parentElement) {
            const container = lyricEl.parentElement;
            const containerWidth = container.clientWidth;
            const textWidth = lyricEl.scrollWidth;

            const threshold = 10;
            const needsScroll = textWidth > containerWidth + threshold;

            newShouldScroll[targetIndex] = needsScroll;

            if (needsScroll) {
              const textLength = currentLyrics[targetIndex]?.text?.length || 0;
              const overflowRatio = textWidth / containerWidth;
              const lyricDuration = getLyricDuration(targetIndex);

              let scrollDuration: number;
              let startDelay: number;

              if (overflowRatio <= 1.5) {
                scrollDuration = lyricDuration * 0.7;
                startDelay = lyricDuration * 0.3;
              } else if (overflowRatio <= 2.5) {
                scrollDuration = lyricDuration * 0.8;
                startDelay = lyricDuration * 0.2;
              } else {
                scrollDuration = lyricDuration * 0.9;
                startDelay = lyricDuration * 0.1;
              }

              const lengthFactor = Math.max(0.8, Math.min(1.2, textLength / 40));
              scrollDuration = scrollDuration * lengthFactor;

              scrollDuration = Math.max(3, Math.min(18, scrollDuration));
              startDelay = Math.max(0.5, Math.min(3, startDelay));

              lyricEl.style.setProperty("--scroll-duration", `${scrollDuration}s`);

              if (textLength > 50 || overflowRatio > 2.5) {
                lyricEl.setAttribute("data-long-text", "true");
              }

              textScrollStartTimerRef.current = window.setTimeout(() => {
                if (lyricEl.parentElement && lyricsStateRef.current.currentIndex === targetIndex) {
                  lyricEl.classList.add("text-scrolling");
                }
                textScrollStartTimerRef.current = null;
              }, startDelay * 1000);
            }
          }
        }

        setLyricsState(prev => ({
          ...prev,
          shouldScroll: newShouldScroll,
        }));
      }, 72);
    },
    [getLyricDuration]
  );

  // 更新当前歌词索引
  const updateCurrentLyricIndex = useCallback(() => {
    const currentLyrics = lyricsRef.current;
    if (currentLyrics.length === 0) return;

    const oldIndex = lyricsStateRef.current.currentIndex;
    const newLyricIndex = findCurrentLyricIndex();

    if (newLyricIndex !== oldIndex) {
      const newTranslateY = calculateLyricsPosition(newLyricIndex);

      setLyricsState(prev => ({
        ...prev,
        currentIndex: newLyricIndex,
        translateY: newTranslateY,
      }));

      checkCurrentLyricScrollNeed(newLyricIndex);
    }
  }, [findCurrentLyricIndex, calculateLyricsPosition, checkCurrentLyricScrollNeed]);

  // 设置歌词
  const setLyrics = useCallback(
    (lrcInput: LyricInput) => {
      // 清理定时器
      if (lyricScrollTimerRef.current) {
        clearTimeout(lyricScrollTimerRef.current);
        lyricScrollTimerRef.current = null;
      }
      if (textScrollStartTimerRef.current) {
        clearTimeout(textScrollStartTimerRef.current);
        textScrollStartTimerRef.current = null;
      }
      if (timeUpdateDebounceTimerRef.current) {
        clearTimeout(timeUpdateDebounceTimerRef.current);
        timeUpdateDebounceTimerRef.current = null;
      }

      // 解析歌词
      const parsedLyrics = parseLyrics(lrcInput);
      setLyricsData(parsedLyrics);
      lyricsRef.current = parsedLyrics;
      lyricRefsArr.current = new Array(parsedLyrics.length).fill(null);

      // 查找当前歌词索引
      const newCurrentIndex = findCurrentLyricIndex();
      const newTranslateY = calculateLyricsPosition(newCurrentIndex);

      setLyricsState({
        currentIndex: newCurrentIndex,
        translateY: newTranslateY,
        shouldScroll: new Array(parsedLyrics.length).fill(false),
      });

      // 延迟检查滚动需求
      setTimeout(() => {
        checkCurrentLyricScrollNeed(newCurrentIndex);
      }, 100);
    },
    [parseLyrics, findCurrentLyricIndex, calculateLyricsPosition, checkCurrentLyricScrollNeed]
  );

  // 设置歌词行的DOM引用
  const setLyricRef = useCallback((el: HTMLElement | null, index: number) => {
    if (el && el instanceof HTMLElement) {
      lyricRefsArr.current[index] = el;
    }
  }, []);

  // 清空歌词
  const clearLyrics = useCallback(() => {
    if (textScrollStartTimerRef.current) {
      clearTimeout(textScrollStartTimerRef.current);
      textScrollStartTimerRef.current = null;
    }
    setLyricsData([]);
    lyricsRef.current = [];
    lyricRefsArr.current = [];
    setLyricsState({
      currentIndex: -1,
      translateY: 0,
      shouldScroll: [],
    });
  }, []);

  // 监听时间变化的 tick 方法（由外部调用）
  const onTimeUpdate = useCallback(() => {
    const currentLyrics = lyricsRef.current;
    if (currentLyrics.length === 0) return;

    const newTime = currentTimeRef.current;
    const oldTime = prevTimeRef.current;
    prevTimeRef.current = newTime;

    const timeDiff = Math.abs(newTime - oldTime);
    const isSignificantTimeChange = timeDiff > 1;
    const isDraggingNow = isDraggingRef?.current || false;

    if (timeUpdateDebounceTimerRef.current) {
      clearTimeout(timeUpdateDebounceTimerRef.current);
    }

    if (isDraggingNow || isSignificantTimeChange) {
      updateCurrentLyricIndex();
      timeUpdateDebounceTimerRef.current = null;
      return;
    }

    timeUpdateDebounceTimerRef.current = window.setTimeout(() => {
      updateCurrentLyricIndex();
      timeUpdateDebounceTimerRef.current = null;
    }, 50);
  }, [currentTimeRef, isDraggingRef, updateCurrentLyricIndex]);

  // 清理资源
  const cleanup = useCallback(() => {
    if (lyricScrollTimerRef.current) {
      clearTimeout(lyricScrollTimerRef.current);
      lyricScrollTimerRef.current = null;
    }
    if (textScrollStartTimerRef.current) {
      clearTimeout(textScrollStartTimerRef.current);
      textScrollStartTimerRef.current = null;
    }
    if (timeUpdateDebounceTimerRef.current) {
      clearTimeout(timeUpdateDebounceTimerRef.current);
      timeUpdateDebounceTimerRef.current = null;
    }
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    lyrics,
    lyricsState,
    lyricRefs: lyricRefsArr,
    parseLyrics,
    validateAndNormalizeLyrics,
    setLyrics,
    clearLyrics,
    setLyricRef,
    updateCurrentLyricIndex,
    onTimeUpdate,
    findCurrentLyricIndex,
    calculateLyricsPosition,
    checkCurrentLyricScrollNeed,
    getLyricDuration,
    cleanup,
  };
}
