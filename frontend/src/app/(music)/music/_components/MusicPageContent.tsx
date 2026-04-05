"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import type { Song } from "@/types/music";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { useMusicAPI } from "@/hooks/use-music-api";
import { useLyrics } from "@/hooks/use-lyrics";
import { useColorExtraction } from "@/hooks/use-color-extraction";
import { useSiteConfigStore } from "@/store/site-config-store";
import { VinylPlayer } from "./VinylPlayer";
import { LyricsScroll } from "./LyricsScroll";
import { PlaybackControls } from "./PlaybackControls";
import { PlaylistPanel } from "./PlaylistPanel";
import styles from "../music.module.css";

type PlayMode = "sequence" | "shuffle" | "repeat";

function getConfigValue(config: unknown, path: string): unknown {
  if (!config || typeof config !== "object") {
    return undefined;
  }

  const record = config as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(record, path)) {
    return record[path];
  }

  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[key];
  }, config);
}

function getConfigString(config: unknown, paths: string[]): string {
  for (const path of paths) {
    const value = getConfigValue(config, path);
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return "";
}

function getRgbFromColor(color: string): { r: number; g: number; b: number } | null {
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!rgbMatch) return null;

  return {
    r: Number(rgbMatch[1]),
    g: Number(rgbMatch[2]),
    b: Number(rgbMatch[3]),
  };
}

export function MusicPageContent() {
  // 播放列表数据
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const playlistRef = useRef<Song[]>([]);

  // 播放模式
  const [playMode, setPlayMode] = useState<PlayMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("music-play-mode") as PlayMode) || "sequence";
    }
    return "sequence";
  });
  const playModeRef = useRef<PlayMode>(playMode);

  // 播放列表面板
  const [showPlaylist, setShowPlaylist] = useState(false);

  // 进度条拖拽
  const isDraggingRef = useRef(false);

  // 站点配置
  const siteConfig = useSiteConfigStore(state => state.siteConfig);

  // 唱片素材 URL（从配置或默认值）
  const vinylImages = {
    background:
      getConfigString(siteConfig, ["frontDesk.home.music.vinyl.background", "music.vinyl.background"]) ||
      "/static/img/music-vinyl-background.png",
    outer:
      getConfigString(siteConfig, ["frontDesk.home.music.vinyl.outer", "music.vinyl.outer"]) ||
      "/static/img/music-vinyl-outer.png",
    inner:
      getConfigString(siteConfig, ["frontDesk.home.music.vinyl.inner", "music.vinyl.inner"]) ||
      "/static/img/music-vinyl-inner.png",
    needle:
      getConfigString(siteConfig, ["frontDesk.home.music.vinyl.needle", "music.vinyl.needle"]) ||
      "/static/img/music-vinyl-needle.png",
    groove:
      getConfigString(siteConfig, ["frontDesk.home.music.vinyl.groove", "music.vinyl.groove"]) ||
      "/static/img/music-vinyl-groove.png",
  };

  // hooks
  const { isLoading: musicApiIsLoading, fetchPlaylist, clearPlaylistCache } = useMusicAPI();

  const {
    audioRef,
    currentSongIndex,
    currentLyricsText,
    audioState,
    loadedPercentage,
    audioLoadingState,
    currentSong,
    playedPercentage,
    togglePlay,
    previousSong,
    nextSong,
    setVolume,
    seek,
    handlePlaylistItemClick,
    formatTime,
    onTimeUpdate,
    onLoadedMetadata,
    onEnded,
    onError,
    cleanup,
  } = useAudioPlayer(playlistRef, playModeRef);

  // 歌词 currentTime ref
  const currentTimeRef = useRef(0);

  // 解构 useLyrics，只取稳定的函数引用，避免整个对象作为依赖导致无限循环
  const lyricsHook = useLyrics(currentTimeRef, isDraggingRef);
  const {
    lyrics,
    lyricsState,
    setLyrics: setLyricsFromHook,
    clearLyrics: clearLyricsFromHook,
    onTimeUpdate: lyricsOnTimeUpdate,
    cleanup: lyricsCleanup,
  } = lyricsHook;

  // 解构 useColorExtraction，同理
  const colorExtraction = useColorExtraction();
  const { dominantColor, extractAndSetDominantColor, resetToDefaultColor, cleanup: colorCleanup } = colorExtraction;

  // 同步 playlistRef
  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  // 同步 playModeRef
  useEffect(() => {
    playModeRef.current = playMode;
    if (typeof window !== "undefined") {
      localStorage.setItem("music-play-mode", playMode);
    }
  }, [playMode]);

  // 歌词文本变化时解析歌词
  useEffect(() => {
    if (currentLyricsText) {
      setLyricsFromHook(currentLyricsText);
    } else {
      clearLyricsFromHook();
    }
  }, [currentLyricsText, setLyricsFromHook, clearLyricsFromHook]);

  // 监听当前歌曲变化，提取主色调
  useEffect(() => {
    if (currentSong?.pic) {
      extractAndSetDominantColor(currentSong.pic);
    } else {
      resetToDefaultColor();
    }
  }, [currentSong?.pic, extractAndSetDominantColor, resetToDefaultColor]);

  // 音频时间更新时，同步歌词
  const handleAudioTimeUpdate = useCallback(() => {
    onTimeUpdate();
    // 直接更新 ref（不依赖 effect），确保歌词 hook 读到最新时间
    if (audioRef.current) {
      currentTimeRef.current = audioRef.current.currentTime;
    }
    lyricsOnTimeUpdate();
  }, [onTimeUpdate, lyricsOnTimeUpdate, audioRef]);

  // 初始化加载歌单
  useEffect(() => {
    const loadPlaylist = async () => {
      try {
        const songs = await fetchPlaylist(false);
        if (songs.length > 0) {
          setPlaylist(songs);
          playlistRef.current = songs;
        }
      } catch {
        console.error("[MUSIC_PAGE] 加载歌单失败");
      }
    };

    loadPlaylist();
  }, [fetchPlaylist]);

  // 清理
  useEffect(() => {
    return () => {
      cleanup();
      lyricsCleanup();
      colorCleanup();
    };
  }, [cleanup, lyricsCleanup, colorCleanup]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 如果焦点在输入框上，忽略
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      switch (event.code) {
        case "Space":
          event.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          event.preventDefault();
          previousSong();
          break;
        case "ArrowRight":
          event.preventDefault();
          nextSong();
          break;
        case "ArrowUp":
          event.preventDefault();
          setVolume(Math.min(1, audioState.volume + 0.1));
          break;
        case "ArrowDown":
          event.preventDefault();
          setVolume(Math.max(0, audioState.volume - 0.1));
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, previousSong, nextSong, setVolume, audioState.volume]);

  // 切换播放模式
  const handleTogglePlayMode = useCallback(() => {
    setPlayMode(prev => {
      if (prev === "sequence") return "shuffle";
      if (prev === "shuffle") return "repeat";
      return "sequence";
    });
  }, []);

  // 刷新缓存
  const handleRefreshCache = useCallback(async () => {
    try {
      clearPlaylistCache();
      const songs = await fetchPlaylist(true);
      if (songs.length > 0) {
        setPlaylist(songs);
        playlistRef.current = songs;
      }
    } catch {
      console.error("[MUSIC_PAGE] 刷新歌单失败");
    }
  }, [clearPlaylistCache, fetchPlaylist]);

  // 切换播放列表面板
  const togglePlaylistPanel = useCallback(() => {
    setShowPlaylist(prev => !prev);
  }, []);

  const closePlaylistPanel = useCallback(() => {
    setShowPlaylist(false);
  }, []);

  // 歌词点击处理
  const handleLyricClick = useCallback(
    (index: number) => {
      const targetLyric = lyrics[index];
      if (targetLyric) {
        seek(targetLyric.time);
      }
    },
    [lyrics, seek]
  );

  const backgroundPalette = useMemo(() => {
    const fallback = { r: 102, g: 126, b: 234 };
    const rgb = getRgbFromColor(dominantColor) ?? fallback;

    return {
      solid: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
      glowStrong: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.72)`,
      glowSoft: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.48)`,
      tintPrimary: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.44)`,
      tintSecondary: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`,
      border: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7)`,
    };
  }, [dominantColor]);

  const musicBackgroundStyle = useMemo<CSSProperties>(() => {
    const songPic = currentSong?.pic;
    if (!songPic) {
      return {
        backgroundImage: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        backgroundColor: "rgb(102, 126, 234)",
      };
    }

    return {
      backgroundImage: `url("${songPic}")`,
      backgroundColor: backgroundPalette.solid,
    };
  }, [backgroundPalette.solid, currentSong]);

  const musicBackgroundAuraStyle = useMemo<CSSProperties>(() => {
    if (!currentSong?.pic) {
      return {
        backgroundImage:
          "radial-gradient(circle at 18% 22%, rgb(102 126 234 / 48%) 0%, rgb(0 0 0 / 0%) 52%), radial-gradient(circle at 82% 78%, rgb(118 75 162 / 38%) 0%, rgb(0 0 0 / 0%) 56%)",
      };
    }

    return {
      backgroundImage: `radial-gradient(circle at 20% 18%, ${backgroundPalette.glowStrong} 0%, rgb(0 0 0 / 0%) 50%), radial-gradient(circle at 82% 80%, ${backgroundPalette.glowSoft} 0%, rgb(0 0 0 / 0%) 56%), linear-gradient(145deg, ${backgroundPalette.tintPrimary} 0%, rgb(0 0 0 / 0%) 62%), linear-gradient(325deg, ${backgroundPalette.tintSecondary} 6%, rgb(0 0 0 / 0%) 65%)`,
    };
  }, [
    backgroundPalette.glowSoft,
    backgroundPalette.glowStrong,
    backgroundPalette.tintPrimary,
    backgroundPalette.tintSecondary,
    currentSong,
  ]);

  const backgroundOverlayStyle = useMemo(
    () =>
      ({
        "--music-overlay-soft": backgroundPalette.glowSoft,
        "--music-overlay-accent": backgroundPalette.glowStrong,
        "--music-overlay-shadow": "rgba(0, 0, 0, 0.46)",
      }) as CSSProperties,
    [backgroundPalette.glowSoft, backgroundPalette.glowStrong]
  );

  // 背景色
  const borderColor = backgroundPalette.border;

  const hasSong = !!currentSong;

  return (
    <div className={`${styles.musicHome} ${!hasSong ? styles.noSong : ""}`}>
      {/* 音频元素 */}
      <audio
        ref={audioRef}
        preload="metadata"
        crossOrigin="anonymous"
        onTimeUpdate={handleAudioTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
        onError={onError}
      />

      {/* 动态背景 */}
      <div className={styles.musicBackground} style={musicBackgroundStyle} />
      <div className={styles.musicBackgroundAura} style={musicBackgroundAuraStyle} />
      <div className={styles.backgroundOverlay} style={backgroundOverlayStyle} />

      {/* 主容器 */}
      <div className={styles.musicContainer}>
        {/* 播放器区域 */}
        <div className={styles.playerSection}>
          {/* 唱片机 */}
          <VinylPlayer
            currentSong={currentSong}
            isPlaying={audioState.isPlaying}
            borderColor={borderColor}
            vinylImages={vinylImages}
            onPlayPause={togglePlay}
          />

          {/* 歌词区域 */}
          <div className={styles.lyricsSection}>
            <LyricsScroll
              lyrics={lyrics}
              lyricsState={lyricsState}
              dominantColor={dominantColor}
              onLyricClick={handleLyricClick}
            />
          </div>
        </div>

        {/* 播放控制 */}
        <PlaybackControls
          audioState={audioState}
          audioLoadingState={audioLoadingState}
          playedPercentage={playedPercentage}
          loadedPercentage={loadedPercentage}
          hasPlaylist={playlist.length > 1}
          currentSong={hasSong}
          playMode={playMode}
          cacheIsLoading={musicApiIsLoading || false}
          onPlayPause={togglePlay}
          onPrevious={previousSong}
          onNext={() => nextSong()}
          onSeek={seek}
          onSetVolume={setVolume}
          onTogglePlaylist={togglePlaylistPanel}
          onTogglePlayMode={handleTogglePlayMode}
          onRefreshCache={handleRefreshCache}
          formatTime={formatTime}
        />
      </div>

      {/* 播放列表面板 */}
      <PlaylistPanel
        show={showPlaylist}
        playlist={playlist}
        currentSongIndex={currentSongIndex}
        audioState={audioState}
        onClose={closePlaylistPanel}
        onSelectSong={handlePlaylistItemClick}
      />
    </div>
  );
}
