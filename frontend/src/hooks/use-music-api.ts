"use client";

/**
 * @Description: 音乐API调用逻辑 hook
 * @Author: 安知鱼
 * 1:1 移植自 anheyu-app composables/useMusicAPI.ts
 */
import { useState, useCallback, useRef } from "react";
import type { Song, PlaylistCache } from "@/types/music";
import { getPlaylistApi } from "@/lib/api/music";
import { useSiteConfigStore } from "@/store/site-config-store";

/**
 * 确保URL使用HTTPS协议
 */
const ensureHttps = (url: string): string => {
  if (!url) return url;
  if (url.startsWith("http://")) {
    return url.replace("http://", "https://");
  }
  return url;
};

// 缓存配置
const CACHE_KEY = "anheyu-playlist-cache";
const CAPSULE_CACHE_KEY = "anheyu-capsule-playlist-cache";
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7天缓存

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
    if (typeof value === "number") {
      return String(value);
    }
  }
  return "";
}

export function useMusicAPI() {
  const [isLoading, setIsLoading] = useState(false);
  const siteConfig = useSiteConfigStore(state => state.siteConfig);
  const siteConfigRef = useRef(siteConfig);
  siteConfigRef.current = siteConfig;

  // 从配置获取音乐API基础地址
  const getMusicAPIBaseURL = useCallback((): string => {
    const config = siteConfigRef.current;
    const apiBaseURL = getConfigString(config, ["frontDesk.home.music.api.base_url", "music.api.base_url"]);
    return apiBaseURL || "https://metings.qjqq.cn";
  }, []);

  // 从配置获取当前播放列表ID
  const getCurrentPlaylistId = useCallback((): string => {
    const config = siteConfigRef.current;
    const configId = getConfigString(config, ["frontDesk.home.music.player.playlist_id", "music.player.playlist_id"]);
    if (configId) return configId;

    const localId = localStorage.getItem("music-playlist-id");
    if (localId) return localId;

    return "8152976493";
  }, []);

  // 从配置获取自定义歌单JSON链接（音乐馆页面使用）
  const getCustomPlaylistUrl = useCallback((): string | null => {
    const config = siteConfigRef.current;
    const customUrl = getConfigString(config, [
      "frontDesk.home.music.player.custom_playlist",
      "music.player.custom_playlist",
    ]);
    return customUrl && customUrl.trim() !== "" ? customUrl.trim() : null;
  }, []);

  // 从配置获取音乐胶囊专用的自定义歌单JSON链接
  const getCapsuleCustomPlaylistUrl = useCallback((): string | null => {
    const config = siteConfigRef.current;
    const customUrl = getConfigString(config, [
      "frontDesk.home.music.capsule.custom_playlist",
      "music.capsule.custom_playlist",
    ]);
    return customUrl && customUrl.trim() !== "" ? customUrl.trim() : null;
  }, []);

  // 获取缓存
  const getPlaylistCache = useCallback((): PlaylistCache | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const cache: PlaylistCache = JSON.parse(cached);

      if (Date.now() - cache.timestamp > CACHE_DURATION) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      const currentId = getCurrentPlaylistId();
      const currentCustomUrl = getCustomPlaylistUrl();
      const cachedCustomUrl = cache.customPlaylistUrl || null;

      if (cache.playlistId !== currentId || cachedCustomUrl !== currentCustomUrl) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      return cache;
    } catch {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
  }, [getCurrentPlaylistId, getCustomPlaylistUrl]);

  // 设置缓存
  const setPlaylistCache = useCallback(
    (data: Song[]): void => {
      try {
        const cache: PlaylistCache = {
          data,
          playlistId: getCurrentPlaylistId(),
          customPlaylistUrl: getCustomPlaylistUrl(),
          timestamp: Date.now(),
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      } catch (error) {
        console.error("[MUSIC_CACHE] 设置缓存失败:", error);
      }
    },
    [getCurrentPlaylistId, getCustomPlaylistUrl]
  );

  // 清除缓存
  const clearPlaylistCache = useCallback((): void => {
    localStorage.removeItem(CACHE_KEY);
  }, []);

  // 获取歌词内容（支持URL和直接内容）
  const fetchLyricContent = useCallback(async (lrcValue: string, songName: string = "未知歌曲"): Promise<string> => {
    if (!lrcValue || lrcValue.trim() === "") return "";

    const isUrl = lrcValue.startsWith("http://") || lrcValue.startsWith("https://");

    if (isUrl) {
      try {
        const response = await fetch(lrcValue);
        if (!response.ok) return "";
        return await response.text();
      } catch {
        console.warn(`[MUSIC_API] 歌词文件获取失败 - 歌曲: ${songName}`);
        return "";
      }
    } else {
      return lrcValue;
    }
  }, []);

  // 从自定义JSON链接获取歌单数据
  const fetchPlaylistFromJson = useCallback(
    async (url: string): Promise<Song[]> => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const jsonData = await response.json();

        if (!Array.isArray(jsonData)) {
          throw new Error("JSON数据格式错误：期望数组格式");
        }

        const songPromises = jsonData.map(async (item: Record<string, string>, index: number) => {
          const songName = item.name || item.title || `未知歌曲-${index}`;
          const lrcContent = await fetchLyricContent(item.lrc || "", songName);

          return {
            id: item.id || `custom-${index}`,
            name: songName,
            artist: item.artist || "未知艺术家",
            url: ensureHttps(item.url || ""),
            pic: ensureHttps(item.cover || item.pic || ""),
            lrc: lrcContent,
          };
        });

        return await Promise.all(songPromises);
      } catch (error) {
        console.error(`[MUSIC_API] 从JSON链接获取歌单失败:`, error);
        throw error;
      }
    },
    [fetchLyricContent]
  );

  // 获取歌单数据
  const fetchPlaylist = useCallback(
    async (forceRefresh = false): Promise<Song[]> => {
      try {
        if (!forceRefresh) {
          const cached = getPlaylistCache();
          if (cached && cached.data.length > 0) {
            return cached.data;
          }
        }

        setIsLoading(true);

        // 优先检查是否有自定义JSON链接
        const customUrl = getCustomPlaylistUrl();

        if (customUrl) {
          try {
            const songs = await fetchPlaylistFromJson(customUrl);
            setPlaylistCache(songs);
            return songs;
          } catch {
            // 降级到后端API
          }
        }

        // 调用后端API获取播放列表
        try {
          const response = await getPlaylistApi();
          if (response.code === 200 && response.data && response.data.songs) {
            const songs = response.data.songs;
            const formattedSongs: Song[] = songs.map((song: Song) => ({
              id: song.id || song.neteaseId || "",
              name: song.name || "未知歌曲",
              artist: song.artist || "未知歌手",
              url: ensureHttps(song.url || ""),
              pic: ensureHttps(song.pic || ""),
              lrc: song.lrc || "",
              neteaseId: song.neteaseId || song.id || "",
            }));

            setPlaylistCache(formattedSongs);
            return formattedSongs;
          } else {
            return [];
          }
        } catch {
          return [];
        }
      } catch {
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [getPlaylistCache, getCustomPlaylistUrl, fetchPlaylistFromJson, setPlaylistCache]
  );

  // 音乐胶囊专用缓存操作
  const getCapsulePlaylistCache = useCallback((): PlaylistCache | null => {
    try {
      const cached = localStorage.getItem(CAPSULE_CACHE_KEY);
      if (!cached) return null;

      const cache: PlaylistCache = JSON.parse(cached);

      if (Date.now() - cache.timestamp > CACHE_DURATION) {
        localStorage.removeItem(CAPSULE_CACHE_KEY);
        return null;
      }

      const currentCustomUrl = getCapsuleCustomPlaylistUrl();
      const cachedCustomUrl = cache.customPlaylistUrl || null;

      if (cachedCustomUrl !== currentCustomUrl) {
        localStorage.removeItem(CAPSULE_CACHE_KEY);
        return null;
      }

      return cache;
    } catch {
      localStorage.removeItem(CAPSULE_CACHE_KEY);
      return null;
    }
  }, [getCapsuleCustomPlaylistUrl]);

  const setCapsulePlaylistCache = useCallback(
    (data: Song[]): void => {
      try {
        const cache: PlaylistCache = {
          data,
          playlistId: getCurrentPlaylistId(),
          customPlaylistUrl: getCapsuleCustomPlaylistUrl(),
          timestamp: Date.now(),
        };
        localStorage.setItem(CAPSULE_CACHE_KEY, JSON.stringify(cache));
      } catch (error) {
        console.error("[CAPSULE_CACHE] 设置缓存失败:", error);
      }
    },
    [getCurrentPlaylistId, getCapsuleCustomPlaylistUrl]
  );

  // 获取音乐胶囊专用的歌单数据
  const fetchCapsulePlaylist = useCallback(
    async (forceRefresh = false): Promise<Song[]> => {
      try {
        if (!forceRefresh) {
          const cached = getCapsulePlaylistCache();
          if (cached && cached.data.length > 0) {
            return cached.data;
          }
        }

        setIsLoading(true);

        // 优先检查胶囊专用的自定义JSON链接
        const capsuleCustomUrl = getCapsuleCustomPlaylistUrl();

        if (capsuleCustomUrl) {
          try {
            const songs = await fetchPlaylistFromJson(capsuleCustomUrl);
            setCapsulePlaylistCache(songs);
            return songs;
          } catch {
            // 降级到后端API
          }
        }

        // 降级：调用后端API获取播放列表
        try {
          const response = await getPlaylistApi();

          if (response.code === 200 && response.data && response.data.songs) {
            const songs = response.data.songs;
            const formattedSongs: Song[] = songs.map((song: Song) => ({
              id: song.id || song.neteaseId || "",
              name: song.name || "未知歌曲",
              artist: song.artist || "未知歌手",
              url: ensureHttps(song.url || ""),
              pic: ensureHttps(song.pic || ""),
              lrc: song.lrc || "",
              neteaseId: song.neteaseId || song.id || "",
            }));

            setCapsulePlaylistCache(formattedSongs);
            return formattedSongs;
          } else {
            return [];
          }
        } catch {
          return [];
        }
      } catch {
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [getCapsulePlaylistCache, getCapsuleCustomPlaylistUrl, fetchPlaylistFromJson, setCapsulePlaylistCache]
  );

  // 直接调用 Song_V1 API 获取单曲资源
  const fetchSongV1 = useCallback(
    async (
      songId: string,
      level: "exhigh" | "standard"
    ): Promise<{
      url: string;
      lyric: string;
      level: string;
      size: string;
      error?: "server_error" | "not_found";
    } | null> => {
      try {
        const formData = new URLSearchParams();
        formData.append("url", songId);
        formData.append("level", level);
        formData.append("type", "json");

        const apiBaseURL = getMusicAPIBaseURL();
        const response = await fetch(`${apiBaseURL}/Song_V1`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData,
        });

        if (!response.ok) {
          if (response.status >= 500) {
            return { url: "", lyric: "", level: "", size: "", error: "server_error" };
          }
          return { url: "", lyric: "", level: "", size: "", error: "not_found" };
        }

        const data = await response.json();

        if (data.status !== 200 || !data.success) {
          return { url: "", lyric: "", level: "", size: "", error: "not_found" };
        }

        return {
          url: ensureHttps(data.data.url || ""),
          lyric: data.data.lyric || "",
          level: data.data.level,
          size: data.data.size,
        };
      } catch {
        return { url: "", lyric: "", level: "", size: "", error: "server_error" };
      }
    },
    [getMusicAPIBaseURL]
  );

  // 获取歌曲的音频和歌词资源（带音质自动降级）
  const fetchSongResources = useCallback(
    async (
      song: Song
    ): Promise<{
      audioUrl: string;
      lyricsText: string;
      errorType?: "network" | "server" | "no_resources" | "unknown";
      errorMessage?: string;
    }> => {
      const songName = song.name || "未知歌曲";

      // 优先使用歌曲自身的歌词内容（支持 URL 与文本）
      let lyricsText = "";
      if (song.lrc && song.lrc.trim()) {
        lyricsText = await fetchLyricContent(song.lrc, songName);
      }

      // 如果没有网易云ID，返回现有的歌词内容
      if (!song.neteaseId) {
        return {
          audioUrl: "",
          lyricsText,
          errorType: lyricsText ? undefined : "no_resources",
          errorMessage: lyricsText ? undefined : "歌曲缺少网易云ID",
        };
      }

      try {
        // 尝试 exhigh 音质
        let result = await fetchSongV1(song.neteaseId, "exhigh");

        if (result?.error === "server_error") {
          return {
            audioUrl: song.url || "",
            lyricsText,
            errorType: "server",
            errorMessage: "音乐服务暂时不可用",
          };
        }

        // 如果资源不存在，降级到 standard
        if (!result || !result.url) {
          result = await fetchSongV1(song.neteaseId, "standard");

          if (result?.error === "server_error") {
            return {
              audioUrl: song.url || "",
              lyricsText,
              errorType: "server",
              errorMessage: "音乐服务暂时不可用",
            };
          }
        }

        if (!result || !result.url) {
          return {
            audioUrl: song.url || "",
            lyricsText,
            errorType: song.url ? undefined : "no_resources",
            errorMessage: song.url ? undefined : "该歌曲暂无可用音源",
          };
        }

        // 优先使用已有歌词，其次使用 Song_V1 返回歌词（可能为空）
        const finalLyricsText = lyricsText || (result.lyric ? await fetchLyricContent(result.lyric, songName) : "");

        return {
          audioUrl: result.url,
          lyricsText: finalLyricsText,
        };
      } catch (error) {
        let errorType: "network" | "server" | "unknown" = "unknown";
        let errorMessage = "获取资源失败";

        if (error instanceof Error) {
          if (error.message.includes("502") || error.message.includes("503") || error.message.includes("500")) {
            errorType = "server";
            errorMessage = "音乐服务暂时不可用";
          } else if (error.message.includes("Network") || error.message.includes("timeout")) {
            errorType = "network";
            errorMessage = "网络连接异常";
          } else {
            errorMessage = error.message;
          }
        }

        return {
          audioUrl: "",
          lyricsText,
          errorType: lyricsText ? undefined : errorType,
          errorMessage: lyricsText ? undefined : errorMessage,
        };
      }
    },
    [fetchSongV1, fetchLyricContent]
  );

  return {
    isLoading,
    fetchPlaylist,
    fetchSongResources,
    fetchPlaylistFromJson,
    fetchCapsulePlaylist,
    getCurrentPlaylistId,
    getCustomPlaylistUrl,
    getCapsuleCustomPlaylistUrl,
    clearPlaylistCache,
  };
}
