"use client";

/**
 * @Description: 音乐播放器主容器组件
 * @Author: 安知鱼
 */
import { useState, useRef, useEffect, useCallback } from "react";
import type { Song } from "@/types/music";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { useLyrics } from "@/hooks/use-lyrics";
import { useColorExtraction } from "@/hooks/use-color-extraction";
import { useMusicAPI } from "@/hooks/use-music-api";
import { useUiStore } from "@/store/ui-store";
import { MusicCapsule } from "./MusicCapsule";
import { Playlist } from "./Playlist";
import styles from "./styles/MusicPlayer.module.css";

export function MusicPlayer() {
  // UI 状态
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [isInFooterArea, setIsInFooterArea] = useState(false);
  const [isCollapsing, setIsCollapsing] = useState(false);
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const isMusicPlayerVisible = useUiStore(s => s.isMusicPlayerVisible);

  // Refs
  const playlistRef = useRef<Song[]>([]);
  const playModeRef = useRef<"sequence" | "shuffle" | "repeat">("sequence");
  const currentTimeRef = useRef(0);
  const hoverTimerRef = useRef<number | null>(null);

  // Hooks
  const musicAPI = useMusicAPI();
  const audioPlayer = useAudioPlayer(playlistRef, playModeRef);
  const lyricsHook = useLyrics(currentTimeRef);
  const colorExtraction = useColorExtraction();

  // Stable refs for hook methods (prevent infinite loops in useEffect)
  const audioPlayerRef = useRef(audioPlayer);
  const lyricsHookRef = useRef(lyricsHook);
  const colorExtractionRef = useRef(colorExtraction);
  useEffect(() => {
    audioPlayerRef.current = audioPlayer;
  }, [audioPlayer]);
  useEffect(() => {
    lyricsHookRef.current = lyricsHook;
  }, [lyricsHook]);
  useEffect(() => {
    colorExtractionRef.current = colorExtraction;
  }, [colorExtraction]);

  // 同步 currentTime ref + 歌词时间更新
  const currentTime = audioPlayer.audioState.currentTime;
  useEffect(() => {
    currentTimeRef.current = currentTime;
    lyricsHookRef.current.onTimeUpdate();
  }, [currentTime]);

  // 监听歌词文本变化，设置歌词
  const currentLyricsText = audioPlayer.currentLyricsText;
  useEffect(() => {
    if (currentLyricsText) {
      lyricsHookRef.current.setLyrics(currentLyricsText);
    } else {
      lyricsHookRef.current.clearLyrics();
    }
  }, [currentLyricsText]);

  // 监听歌曲变化，提取主色调
  const currentSongPic = audioPlayer.currentSong?.pic;
  useEffect(() => {
    if (currentSongPic) {
      colorExtractionRef.current.extractAndSetDominantColor(currentSongPic);
    } else {
      colorExtractionRef.current.resetToDefaultColor();
    }
  }, [currentSongPic]);

  // 初始化播放器 - 获取歌单，随机选曲，预加载资源
  useEffect(() => {
    if (isInitialized) return;

    const init = async () => {
      try {
        const songs = await musicAPI.fetchCapsulePlaylist();
        if (songs.length === 0) return;

        // 1. 先填充 playlistRef（useAudioPlayer 的 effect 读取它）
        playlistRef.current = songs;
        setPlaylist(songs);

        // 2. 随机选择第一首歌曲（与 anheyu-app 一致）
        const randomIndex = Math.floor(Math.random() * songs.length);
        const firstSong = songs[randomIndex];

        // 3. 预提取封面主色调
        if (firstSong?.pic) {
          await colorExtractionRef.current.extractAndSetDominantColor(firstSong.pic);
        } else {
          colorExtractionRef.current.resetToDefaultColor();
        }

        // 4. 设置 currentSongIndex 触发 useAudioPlayer 的 song-change effect
        audioPlayerRef.current.setCurrentSongIndex(randomIndex);
        audioPlayerRef.current.currentSongIndexRef.current = randomIndex;

        setIsInitialized(true);
      } catch {
        console.error("[MusicPlayer] 初始化失败");
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Footer 区域检测 - IntersectionObserver
  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          setIsInFooterArea(entry.isIntersecting);
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(footer);

    return () => {
      observer.disconnect();
    };
  }, []);

  // 全局事件监听 - 音乐控制 + 右键菜单事件（stable via ref）
  useEffect(() => {
    const handleMusicToggle = () => {
      audioPlayerRef.current.togglePlay();
    };

    const handleMusicNext = () => {
      audioPlayerRef.current.nextSong();
    };

    const handleMusicPrev = () => {
      audioPlayerRef.current.previousSong();
    };

    // 右键菜单专用事件（与 anheyu-app handleMusicControlEvents 一致）
    const handleGetPlayStatus = () => {
      window.dispatchEvent(
        new CustomEvent("music-player-play-status-response", {
          detail: { isPlaying: audioPlayerRef.current.audioState.isPlaying },
        })
      );
    };

    const handleGetSongName = () => {
      const currentSong = audioPlayerRef.current.currentSong;
      if (currentSong) {
        window.dispatchEvent(
          new CustomEvent("music-player-song-name-response", {
            detail: { songName: currentSong.name, artist: currentSong.artist },
          })
        );
      }
    };

    window.addEventListener("music-toggle", handleMusicToggle);
    window.addEventListener("music-next", handleMusicNext);
    window.addEventListener("music-prev", handleMusicPrev);
    window.addEventListener("music-player-toggle-play", handleMusicToggle);
    window.addEventListener("music-player-previous", handleMusicPrev);
    window.addEventListener("music-player-next", handleMusicNext);
    window.addEventListener("music-player-get-play-status", handleGetPlayStatus);
    window.addEventListener("music-player-get-song-name", handleGetSongName);

    return () => {
      window.removeEventListener("music-toggle", handleMusicToggle);
      window.removeEventListener("music-next", handleMusicNext);
      window.removeEventListener("music-prev", handleMusicPrev);
      window.removeEventListener("music-player-toggle-play", handleMusicToggle);
      window.removeEventListener("music-player-previous", handleMusicPrev);
      window.removeEventListener("music-player-next", handleMusicNext);
      window.removeEventListener("music-player-get-play-status", handleGetPlayStatus);
      window.removeEventListener("music-player-get-song-name", handleGetSongName);
    };
  }, []);

  // 音频元素事件（setup once, delegate via ref）
  useEffect(() => {
    const audio = audioPlayerRef.current.audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => audioPlayerRef.current.onTimeUpdate();
    const handleLoadedMetadata = () => audioPlayerRef.current.onLoadedMetadata();
    const handleEnded = () => audioPlayerRef.current.onEnded();
    const handleError = () => audioPlayerRef.current.onError();

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, []);

  // 暂停时自动收起（与 anheyu-app 一致）
  const isPlaying = audioPlayer.audioState.isPlaying;
  useEffect(() => {
    if (!isPlaying) {
      setIsExpanded(false);
    }
  }, [isPlaying]);

  // 展开时重新计算歌词位置（与 anheyu-app 一致）
  useEffect(() => {
    if (isExpanded) {
      const timer = setTimeout(() => {
        const hook = lyricsHookRef.current;
        const idx = hook.lyricsState.currentIndex;
        hook.calculateLyricsPosition(idx);
        hook.checkCurrentLyricScrollNeed(idx);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  // 点击外部关闭播放列表
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!showPlaylist) return;
      const target = event.target as HTMLElement;
      const playlistContainer = document.querySelector("[data-playlist-container]");
      if (playlistContainer && !playlistContainer.contains(target)) {
        setShowPlaylist(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showPlaylist]);

  // 处理展开/收起（带收起动画，与 anheyu-app 一致）
  const handleToggleExpand = useCallback(() => {
    if (isExpanded) {
      setIsCollapsing(true);
      setTimeout(() => {
        setIsExpanded(false);
        setTimeout(() => {
          setIsCollapsing(false);
        }, 500);
      }, 50);
    } else {
      setIsExpanded(true);
      setIsCollapsing(false);
    }
    if (showPlaylist) {
      setShowPlaylist(false);
    }
  }, [isExpanded, showPlaylist]);

  // 处理播放列表切换
  const handleTogglePlaylist = useCallback(() => {
    setShowPlaylist(prev => !prev);
  }, []);

  // hover 处理
  const handleMouseEnter = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hoverTimerRef.current = window.setTimeout(() => {
      setIsHovered(false);
      setShowPlaylist(false);
    }, 300);
  }, []);

  // 清理（stable via ref, run only on unmount）
  useEffect(() => {
    return () => {
      audioPlayerRef.current.cleanup();
      lyricsHookRef.current.cleanup();
      colorExtractionRef.current.cleanup();
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  const isReady = isInitialized && playlist.length > 0;

  const containerClasses = [
    styles.navMusic,
    !isMusicPlayerVisible ? styles.musicHidden : "",
    isInFooterArea ? styles.inFooterArea : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      id="nav-music"
      className={containerClasses}
      style={!isReady ? { display: "none" } : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 音频元素 - 始终在同一树位置，避免被 React 销毁重建 */}
      <audio ref={audioPlayer.audioRef} preload="metadata" />

      {/* 播放列表 */}
      <Playlist
        isVisible={showPlaylist}
        playlist={playlist}
        currentSongIndex={audioPlayer.currentSongIndex}
        isPlaying={audioPlayer.audioState.isPlaying}
        loadingPlaylistItem={audioPlayer.loadingPlaylistItem}
        playlistStyle={colorExtraction.getPlaylistStyle()}
        onClose={() => setShowPlaylist(false)}
        onSelectSong={audioPlayer.handlePlaylistItemClick}
      />

      {/* 音乐胶囊 */}
      <MusicCapsule
        isExpanded={isExpanded}
        isPlaying={audioPlayer.audioState.isPlaying}
        isHovered={isHovered}
        isLoading={audioPlayer.audioLoadingState.isLoading}
        isCollapsing={isCollapsing}
        isMuted={audioPlayer.audioState.isMuted}
        volume={audioPlayer.audioState.volume}
        currentSong={audioPlayer.currentSong}
        lyrics={lyricsHook.lyrics}
        lyricsState={lyricsHook.lyricsState}
        dominantColor={colorExtraction.dominantColor}
        playedPercentage={audioPlayer.playedPercentage}
        setLyricRef={lyricsHook.setLyricRef}
        onToggleExpand={handleToggleExpand}
        onTogglePlay={audioPlayer.togglePlay}
        onPrevious={audioPlayer.previousSong}
        onNext={() => audioPlayer.nextSong()}
        onToggleMute={audioPlayer.toggleMute}
        onVolumeChange={audioPlayer.setVolume}
        onTogglePlaylist={handleTogglePlaylist}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}
