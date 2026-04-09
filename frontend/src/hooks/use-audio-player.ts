"use client";

/**
 * @Description: 音频播放器逻辑 hook
 * @Author: 安知鱼
 * 1:1 移植自 anheyu-app composables/useAudioPlayer.ts
 */
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { Song, AudioState, AudioLoadingState } from "@/types/music";
import { useMusicAPI } from "./use-music-api";

// 播放模式类型
type PlayMode = "sequence" | "shuffle" | "repeat";

export function useAudioPlayer(
  playlistRef: React.MutableRefObject<Song[]>,
  playModeRef?: React.MutableRefObject<PlayMode>
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const musicAPI = useMusicAPI();
  const musicAPIRef = useRef(musicAPI);
  useEffect(() => {
    musicAPIRef.current = musicAPI;
  }, [musicAPI]);

  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const currentSongIndexRef = useRef(0);
  useEffect(() => {
    currentSongIndexRef.current = currentSongIndex;
  }, [currentSongIndex]);

  const [currentLyricsText, setCurrentLyricsText] = useState<string>("");
  const [audioState, setAudioState] = useState<AudioState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.7,
    isMuted: false,
  });
  const audioStateRef = useRef(audioState);
  useEffect(() => {
    audioStateRef.current = audioState;
  }, [audioState]);

  const [loadedPercentage, setLoadedPercentage] = useState(0);
  const [loadingPlaylistItem, setLoadingPlaylistItem] = useState(-1);
  const [audioLoadingState, setAudioLoadingState] = useState<AudioLoadingState>({
    isLoading: false,
    loadingType: "idle",
    progress: 0,
  });

  // 内部 refs
  const isAudioLoadedRef = useRef(false);
  const shouldAutoPlayRef = useRef(false);
  const isLoadingSongRef = useRef(false);
  const resourcesLoadedSongsRef = useRef(new Set<string>());
  const pendingRequestsRef = useRef(
    new Map<string, Promise<{ success: boolean; usingHighQuality: boolean; lyricsText?: string }>>()
  );
  const shuffleHistoryRef = useRef<number[]>([]);
  const MAX_SHUFFLE_HISTORY = 10;

  // 判断异步加载结果是否仍对应当前歌曲，避免旧请求回写状态
  const isSongCurrent = useCallback(
    (song: Song): boolean => {
      const activeSong = playlistRef.current[currentSongIndexRef.current];
      if (!activeSong) return false;

      const activeSongKey = activeSong.neteaseId || activeSong.id || activeSong.url;
      const targetSongKey = song.neteaseId || song.id || song.url;

      return Boolean(targetSongKey) && activeSongKey === targetSongKey;
    },
    [playlistRef]
  );

  // 当前歌曲（实时读取，避免 ref 对象稳定导致缓存失效）
  const currentSong = playlistRef.current[currentSongIndex] || null;

  // 播放进度百分比
  const playedPercentage = useMemo(() => {
    return audioState.duration > 0 ? (audioState.currentTime / audioState.duration) * 100 : 0;
  }, [audioState.currentTime, audioState.duration]);

  // 安全设置音量
  const safeSetVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      const clampedVolume = Math.max(0, Math.min(1, volume));
      audioRef.current.volume = audioStateRef.current.isMuted ? 0 : clampedVolume;
    }
  }, []);

  // 生成随机索引
  const generateRandomIndex = useCallback(
    (curIndex: number): number => {
      const playlistLength = playlistRef.current.length;
      if (playlistLength <= 1) return 0;

      const availableIndexes = Array.from({ length: playlistLength }, (_, i) => i).filter(index => {
        if (index === curIndex) return false;
        if (playlistLength <= 5) return true;
        return !shuffleHistoryRef.current.includes(index);
      });

      if (availableIndexes.length === 0) {
        shuffleHistoryRef.current = [];
        return Array.from({ length: playlistLength }, (_, i) => i).filter(i => i !== curIndex)[0] || 0;
      }

      const randomIndex = Math.floor(Math.random() * availableIndexes.length);
      return availableIndexes[randomIndex];
    },
    [playlistRef]
  );

  // 更新随机播放历史
  const updateShuffleHistory = useCallback(
    (index: number) => {
      if (!playModeRef?.current || playModeRef.current !== "shuffle") return;

      shuffleHistoryRef.current.push(index);
      if (shuffleHistoryRef.current.length > MAX_SHUFFLE_HISTORY) {
        shuffleHistoryRef.current.shift();
      }
    },
    [playModeRef]
  );

  // 格式化时间显示
  const formatTime = useCallback((seconds: number): string => {
    if (!seconds || seconds === 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }, []);

  // 加载音频资源
  const loadAudio = useCallback(
    async (song: Song): Promise<boolean> => {
      if (!audioRef.current || !song.url || !isSongCurrent(song)) {
        return false;
      }

      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = "";
        audioRef.current.load();

        const audioLoadPromise = new Promise<boolean>((resolve, reject) => {
          const audio = audioRef.current;
          if (!audio) {
            reject(new Error("音频元素未初始化"));
            return;
          }

          const timeout = setTimeout(() => {
            reject(new Error("音频加载超时"));
          }, 10000);

          const cleanup = () => {
            audio.removeEventListener("loadedmetadata", onLoadedMetadata);
            audio.removeEventListener("canplay", onCanPlay);
            audio.removeEventListener("error", onError);
          };

          const onLoadedMetadata = () => {
            if (!isSongCurrent(song)) return;
            if (audio) {
              setAudioState(prev => ({
                ...prev,
                duration: audio.duration || 0,
              }));
            }
          };

          const onCanPlay = () => {
            if (!isSongCurrent(song)) {
              clearTimeout(timeout);
              cleanup();
              resolve(false);
              return;
            }
            clearTimeout(timeout);
            cleanup();
            resolve(true);
          };

          const onError = (event: Event) => {
            if (!isSongCurrent(song)) {
              clearTimeout(timeout);
              cleanup();
              resolve(false);
              return;
            }
            clearTimeout(timeout);
            cleanup();
            const error = (event.target as HTMLAudioElement)?.error;
            let errorMessage = "音频加载失败";

            if (error) {
              switch (error.code) {
                case MediaError.MEDIA_ERR_ABORTED:
                  errorMessage = "音频加载被中止";
                  break;
                case MediaError.MEDIA_ERR_NETWORK:
                  errorMessage = "网络错误导致音频加载失败";
                  break;
                case MediaError.MEDIA_ERR_DECODE:
                  errorMessage = "音频解码失败";
                  break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                  errorMessage = "不支持的音频格式或源";
                  break;
                default:
                  errorMessage = `音频加载失败 (错误代码: ${error.code})`;
              }
            }

            reject(new Error(errorMessage));
          };

          audio.addEventListener("loadedmetadata", onLoadedMetadata);
          audio.addEventListener("canplay", onCanPlay);
          audio.addEventListener("error", onError);

          if (!isSongCurrent(song)) {
            clearTimeout(timeout);
            cleanup();
            resolve(false);
            return;
          }

          audio.src = song.url;
          safeSetVolume(audioStateRef.current.volume);
          audio.load();
        });

        const success = await audioLoadPromise;
        if (success) {
          isAudioLoadedRef.current = true;
          return true;
        }

        return false;
      } catch {
        return false;
      }
    },
    [safeSetVolume, isSongCurrent]
  );

  // 只加载音频元数据
  const loadAudioMetadata = useCallback(
    async (song: Song): Promise<boolean> => {
      if (!audioRef.current || !song.url || !isSongCurrent(song)) {
        return false;
      }

      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;

        if (audioRef.current.src === song.url && audioStateRef.current.duration > 0) {
          return true;
        }

        const metadataLoadPromise = new Promise<boolean>((resolve, reject) => {
          const audio = audioRef.current;
          if (!audio) {
            reject(new Error("音频元素未初始化"));
            return;
          }

          const timeout = setTimeout(() => {
            reject(new Error("音频元数据加载超时"));
          }, 5000);

          const cleanup = () => {
            audio.removeEventListener("loadedmetadata", onLoadedMetadata);
            audio.removeEventListener("error", onError);
          };

          const onLoadedMetadata = () => {
            if (!isSongCurrent(song)) {
              clearTimeout(timeout);
              cleanup();
              resolve(false);
              return;
            }
            if (audio) {
              setAudioState(prev => ({
                ...prev,
                duration: audio.duration || 0,
              }));
            }
            clearTimeout(timeout);
            cleanup();
            resolve(true);
          };

          const onError = () => {
            if (!isSongCurrent(song)) {
              clearTimeout(timeout);
              cleanup();
              resolve(false);
              return;
            }
            clearTimeout(timeout);
            cleanup();
            reject(new Error("音频元数据加载失败"));
          };

          audio.addEventListener("loadedmetadata", onLoadedMetadata);
          audio.addEventListener("error", onError);

          if (!isSongCurrent(song)) {
            clearTimeout(timeout);
            cleanup();
            resolve(false);
            return;
          }

          audio.src = song.url;
          audio.preload = "metadata";
          safeSetVolume(audioStateRef.current.volume);
          audio.load();
        });

        return await metadataLoadPromise;
      } catch {
        return false;
      }
    },
    [safeSetVolume, isSongCurrent]
  );

  // 智能加载歌曲资源
  const loadSongWithResources = useCallback(
    async (
      song: Song,
      loadFullAudio: boolean = false,
      forceReload: boolean = false
    ): Promise<{
      success: boolean;
      usingHighQuality: boolean;
      lyricsText?: string;
    }> => {
      if (!song) {
        return { success: false, usingHighQuality: false };
      }

      const songKey = `${song.neteaseId || song.id}`;

      // 检查是否已经获取过资源
      if (!forceReload && resourcesLoadedSongsRef.current.has(songKey)) {
        if (loadFullAudio && !isAudioLoadedRef.current) {
          setAudioLoadingState({
            isLoading: true,
            loadingType: "full",
            progress: 0,
          });
          const audioSuccess = await loadAudio(song);
          setAudioLoadingState({
            isLoading: false,
            loadingType: "idle",
            progress: audioSuccess ? 100 : 0,
          });
          return { success: audioSuccess, usingHighQuality: true };
        }
        return { success: true, usingHighQuality: true };
      }

      // 防止重复请求
      const requestKey = `${songKey}-${loadFullAudio ? "full" : "metadata"}-${forceReload}`;
      if (pendingRequestsRef.current.has(requestKey)) {
        return await pendingRequestsRef.current.get(requestKey)!;
      }

      const loadingPromise = (async () => {
        setAudioLoadingState({
          isLoading: true,
          loadingType: loadFullAudio ? "full" : "metadata",
          progress: 0,
        });

        let finalAudioUrl = "";
        let finalLyricsText = "";
        let usingHighQuality = false;

        try {
          // 第一步：调用统一API获取资源
          if (song.neteaseId) {
            try {
              const timeout = 5000;
              const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("资源获取超时")), timeout)
              );

              const resources = await Promise.race([musicAPIRef.current.fetchSongResources(song), timeoutPromise]);

              if (resources.audioUrl) {
                finalAudioUrl = resources.audioUrl;
                finalLyricsText = resources.lyricsText || "";
                usingHighQuality = true;
              } else {
                if (resources.lyricsText) {
                  finalLyricsText = resources.lyricsText;
                }
              }
            } catch {
              // 降级到基础资源
            }
          }

          // 第二步：降级到基础资源
          if (!finalAudioUrl && song.url) {
            finalAudioUrl = song.url;
            usingHighQuality = false;

            if (song.lrc) {
              if (song.lrc.startsWith("http")) {
                try {
                  const lyricsTimeout = 5000;
                  const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error("基础歌词获取超时")), lyricsTimeout)
                  );

                  const lyricsResponse = await Promise.race([fetch(song.lrc), timeoutPromise]);

                  if (lyricsResponse.ok) {
                    finalLyricsText = await lyricsResponse.text();
                  } else {
                    finalLyricsText = "";
                  }
                } catch {
                  finalLyricsText = "";
                }
              } else {
                finalLyricsText = song.lrc;
              }
            } else {
              finalLyricsText = "";
            }
          }

          // 第三步：检查是否有可用资源
          if (!finalAudioUrl) {
            throw new Error("无任何可用音频资源");
          }

          // 第四步：先同步歌词（与音频加载成功解耦，避免“有封面无歌词”）
          if (finalLyricsText && isSongCurrent(song)) {
            setCurrentLyricsText(finalLyricsText);
          }

          // 第五步：加载音频
          const songWithResources: Song = {
            ...song,
            url: finalAudioUrl,
          };

          let success = false;
          if (loadFullAudio) {
            success = await loadAudio(songWithResources);
          } else {
            success = await loadAudioMetadata(songWithResources);
          }

          if (!success) {
            throw new Error("音频加载失败");
          }

          // 第六步：更新状态
          if (usingHighQuality) {
            const songIndex = playlistRef.current.findIndex(s => s.neteaseId === song.neteaseId || s.id === song.id);
            if (songIndex !== -1) {
              playlistRef.current[songIndex].url = finalAudioUrl;
            }
          }

          if (finalLyricsText && isSongCurrent(song)) {
            setCurrentLyricsText(finalLyricsText);
          }
          resourcesLoadedSongsRef.current.add(songKey);

          return {
            success: true,
            usingHighQuality,
            lyricsText: finalLyricsText || undefined,
          };
        } catch {
          return {
            success: false,
            usingHighQuality: false,
            lyricsText: finalLyricsText || undefined,
          };
        } finally {
          setAudioLoadingState({
            isLoading: false,
            loadingType: "idle",
            progress: 0,
          });
        }
      })();

      pendingRequestsRef.current.set(requestKey, loadingPromise);

      try {
        const result = await loadingPromise;
        return result;
      } finally {
        pendingRequestsRef.current.delete(requestKey);
      }
    },
    [loadAudio, loadAudioMetadata, playlistRef, isSongCurrent]
  );

  // 下一首
  const nextSong = useCallback(
    async (forcePlay: boolean = false) => {
      const wasPlaying = audioStateRef.current.isPlaying || forcePlay;
      let nextIndex: number;

      if (playModeRef?.current === "shuffle") {
        nextIndex = generateRandomIndex(currentSongIndexRef.current);
      } else if (playModeRef?.current === "repeat") {
        nextIndex = currentSongIndexRef.current;
      } else {
        nextIndex = currentSongIndexRef.current + 1;
        if (nextIndex >= playlistRef.current.length) {
          nextIndex = 0;
        }
      }

      setCurrentSongIndex(nextIndex);
      currentSongIndexRef.current = nextIndex;
      updateShuffleHistory(nextIndex);

      const newSong = playlistRef.current[nextIndex];
      if (!newSong?.url && !newSong?.neteaseId) return;

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setAudioState(prev => ({
        ...prev,
        currentTime: 0,
        duration: 0,
      }));

      shouldAutoPlayRef.current = wasPlaying;

      if (!wasPlaying) {
        isAudioLoadedRef.current = false;
      }
    },
    [playlistRef, playModeRef, generateRandomIndex, updateShuffleHistory]
  );

  // 播放控制
  const togglePlay = useCallback(async () => {
    if (!audioRef.current) return;

    const curSong = playlistRef.current[currentSongIndexRef.current];
    if (!curSong) return;

    if (audioStateRef.current.isPlaying) {
      audioRef.current.pause();
    } else {
      try {
        if (!isAudioLoadedRef.current) {
          if (!curSong.url && !curSong.neteaseId) {
            setTimeout(() => {
              nextSong(true);
            }, 500);
            return;
          }

          isLoadingSongRef.current = true;
          const result = await loadSongWithResources(curSong, true, false);
          isLoadingSongRef.current = false;

          if (!result.success) {
            nextSong(true);
            return;
          }
        }

        await audioRef.current.play();
      } catch (error) {
        if (error instanceof DOMException) {
          if (error.name === "NotSupportedError" || error.name === "NotAllowedError" || error.name === "AbortError") {
            nextSong(true);
          }
        }
      }
    }
  }, [playlistRef, loadSongWithResources, nextSong]);

  // 上一首
  const previousSong = useCallback(async () => {
    const wasPlaying = audioStateRef.current.isPlaying;
    let prevIndex: number;

    if (playModeRef?.current === "shuffle") {
      prevIndex = generateRandomIndex(currentSongIndexRef.current);
    } else if (playModeRef?.current === "repeat") {
      prevIndex = currentSongIndexRef.current;
    } else {
      prevIndex = currentSongIndexRef.current - 1;
      if (prevIndex < 0) {
        prevIndex = playlistRef.current.length - 1;
      }
    }

    setCurrentSongIndex(prevIndex);
    currentSongIndexRef.current = prevIndex;
    updateShuffleHistory(prevIndex);

    const newSong = playlistRef.current[prevIndex];
    if (!newSong?.url && !newSong?.neteaseId) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setAudioState(prev => ({
      ...prev,
      currentTime: 0,
      duration: 0,
    }));

    try {
      if (wasPlaying) {
        const result = await loadSongWithResources(newSong, true, true);
        if (result.success && audioRef.current) {
          try {
            await audioRef.current.play();
          } catch {
            // 自动播放失败
          }
        }
      } else {
        const result = await loadSongWithResources(newSong, false, true);
        if (result.success) {
          isAudioLoadedRef.current = false;
        }
      }
    } catch {
      // 处理失败
    }
  }, [playlistRef, playModeRef, generateRandomIndex, updateShuffleHistory, loadSongWithResources]);

  // 切换静音
  const toggleMute = useCallback(() => {
    setAudioState(prev => {
      const newMuted = !prev.isMuted;
      if (audioRef.current) {
        audioRef.current.volume = newMuted ? 0 : Math.max(0, Math.min(1, prev.volume));
      }
      return { ...prev, isMuted: newMuted };
    });
  }, []);

  // 设置音量
  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    setAudioState(prev => ({ ...prev, volume: clampedVolume, isMuted: false }));
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }
  }, []);

  // 进度控制
  const seek = useCallback((time: number) => {
    if (!audioRef.current || !audioStateRef.current.duration) return;

    const targetTime = Math.max(0, Math.min(time, audioStateRef.current.duration));
    audioRef.current.currentTime = targetTime;
    setAudioState(prev => ({ ...prev, currentTime: targetTime }));
  }, []);

  // 尝试加载下一首可用歌曲
  const tryNextAvailableSong = useCallback(
    async (startIndex: number, shouldPlay: boolean) => {
      let fallbackIndex = startIndex + 1;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts && fallbackIndex < playlistRef.current.length) {
        setLoadingPlaylistItem(fallbackIndex);
        setCurrentSongIndex(fallbackIndex);
        currentSongIndexRef.current = fallbackIndex;
        const fallbackSong = playlistRef.current[fallbackIndex];

        if (fallbackSong?.neteaseId) {
          const result = await loadSongWithResources(fallbackSong, shouldPlay, true);

          if (result.success) {
            if (shouldPlay && audioRef.current) {
              try {
                await audioRef.current.play();
              } catch {
                // 自动播放失败
              }
            }
            return;
          }
        }

        fallbackIndex++;
        attempts++;
      }
    },
    [playlistRef, loadSongWithResources]
  );

  // 播放列表项点击
  const handlePlaylistItemClick = useCallback(
    async (index: number) => {
      if (loadingPlaylistItem !== -1) return;

      if (index === currentSongIndexRef.current) {
        togglePlay();
        return;
      }

      setLoadingPlaylistItem(index);
      const wasPlaying = audioStateRef.current.isPlaying;

      try {
        setCurrentSongIndex(index);
        currentSongIndexRef.current = index;
        const newSong = playlistRef.current[index];

        if (!newSong?.url && !newSong?.neteaseId) return;

        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        setAudioState(prev => ({
          ...prev,
          currentTime: 0,
          duration: 0,
        }));

        if (wasPlaying) {
          isLoadingSongRef.current = true;
          const result = await loadSongWithResources(newSong, true, false);
          isLoadingSongRef.current = false;

          if (result.success && audioRef.current) {
            try {
              await audioRef.current.play();
            } catch {
              // 自动播放失败
            }
          } else {
            // 尝试下一首
            await tryNextAvailableSong(index, wasPlaying);
          }
        } else {
          const result = await loadSongWithResources(newSong, false, false);

          if (!result.success) {
            if (newSong.lrc && !newSong.lrc.startsWith("http")) {
              setCurrentLyricsText(newSong.lrc);
            }
          }

          isAudioLoadedRef.current = false;
        }
      } catch {
        // 处理失败
      } finally {
        setLoadingPlaylistItem(-1);
      }
    },
    [loadingPlaylistItem, playlistRef, togglePlay, loadSongWithResources, tryNextAvailableSong]
  );

  // 音频事件处理
  const onTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setAudioState(prev => ({
        ...prev,
        currentTime: audioRef.current!.currentTime,
      }));

      if (audioRef.current.buffered.length > 0) {
        const bufferedEnd = audioRef.current.buffered.end(audioRef.current.buffered.length - 1);
        const duration = audioStateRef.current.duration;
        setLoadedPercentage(duration > 0 ? (bufferedEnd / duration) * 100 : 0);
      }
    }
  }, []);

  const onLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setAudioState(prev => ({
        ...prev,
        duration: audioRef.current!.duration || 0,
      }));
    }
  }, []);

  const onEnded = useCallback(() => {
    if (playModeRef?.current === "repeat") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } else {
      nextSong(true);
    }
  }, [playModeRef, nextSong]);

  const onError = useCallback(() => {
    setAudioState(prev => ({ ...prev, isPlaying: false }));

    setTimeout(() => {
      if (playlistRef.current.length > 1) {
        nextSong(true);
      }
    }, 1000);
  }, [playlistRef, nextSong]);

  // 监听歌曲变化，智能获取资源
  const prevSongIdRef = useRef<string | undefined>(undefined);
  const songLoadRequestIdRef = useRef(0);
  useEffect(() => {
    const curSong = currentSong;
    if (!curSong) return;

    const songId = curSong.neteaseId || curSong.id;
    if (songId === prevSongIdRef.current) return;
    prevSongIdRef.current = songId;
    const requestId = ++songLoadRequestIdRef.current;
    let cancelled = false;
    const isCurrentRequest = () => !cancelled && requestId === songLoadRequestIdRef.current;

    // 清空旧歌词
    setCurrentLyricsText("");
    isAudioLoadedRef.current = false;

    const loadResources = async () => {
      if (curSong.neteaseId) {
        try {
          const needAutoPlay = shouldAutoPlayRef.current;
          const result = await loadSongWithResources(curSong, needAutoPlay, false);
          if (!isCurrentRequest()) return;

          if (result.success) {
            if (needAutoPlay && audioRef.current) {
              shouldAutoPlayRef.current = false;
              try {
                await audioRef.current.play();
                if (!isCurrentRequest()) return;
              } catch {
                // 自动播放失败
              }
            }
          } else {
            shouldAutoPlayRef.current = false;
            if (result.lyricsText) {
              setCurrentLyricsText(result.lyricsText);
            } else if (curSong.lrc && !curSong.lrc.startsWith("http")) {
              setCurrentLyricsText(curSong.lrc);
            }
          }
        } catch {
          if (!isCurrentRequest()) return;
          shouldAutoPlayRef.current = false;
          if (curSong.lrc && !curSong.lrc.startsWith("http")) {
            setCurrentLyricsText(curSong.lrc);
          }
        }
      } else if (curSong.url) {
        const needAutoPlay = shouldAutoPlayRef.current;
        try {
          const success = await loadAudioMetadata(curSong);
          if (!isCurrentRequest()) return;
          if (success && needAutoPlay && audioRef.current) {
            shouldAutoPlayRef.current = false;
            try {
              await audioRef.current.play();
              if (!isCurrentRequest()) return;
            } catch {
              // 自动播放失败
            }
          } else {
            shouldAutoPlayRef.current = false;
          }
        } catch {
          if (!isCurrentRequest()) return;
          shouldAutoPlayRef.current = false;
        }

        if (!isCurrentRequest()) return;
        if (curSong.lrc && !curSong.lrc.startsWith("http")) {
          setCurrentLyricsText(curSong.lrc);
        } else {
          setCurrentLyricsText("");
        }
      } else {
        if (!isCurrentRequest()) return;
        shouldAutoPlayRef.current = false;
        setCurrentLyricsText("");
        setAudioState(prev => ({ ...prev, duration: 0 }));
      }
    };

    loadResources();
    return () => {
      cancelled = true;
    };
  }, [currentSong, currentSongIndex, loadSongWithResources, loadAudioMetadata]);

  // 设置音频事件监听
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      setAudioState(prev => ({ ...prev, isPlaying: true }));
    };
    const handlePause = () => {
      setAudioState(prev => ({ ...prev, isPlaying: false }));
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, []);

  // 清理
  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  }, []);

  return {
    audioRef,
    currentSongIndex,
    setCurrentSongIndex,
    currentSongIndexRef,
    currentLyricsText,
    audioState,
    loadedPercentage,
    loadingPlaylistItem,
    audioLoadingState,
    currentSong,
    playedPercentage,
    togglePlay,
    previousSong,
    nextSong,
    toggleMute,
    setVolume,
    seek,
    handlePlaylistItemClick,
    formatTime,
    onTimeUpdate,
    onLoadedMetadata,
    onEnded,
    onError,
    cleanup,
  };
}
