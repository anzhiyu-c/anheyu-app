"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Volume2, VolumeX, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSiteConfigStore } from "@/store/site-config-store";
import type { PageOneImageItem } from "@/types/site-config";
import styles from "./OneImageBanner.module.css";

type OneImageRouteKey = "home" | "link" | "categories" | "tags" | "archives";

function getRouteKey(pathname: string | null): OneImageRouteKey | null {
  if (!pathname) return null;
  if (pathname === "/") return "home";
  if (pathname === "/link") return "link";
  if (pathname === "/categories") return "categories";
  if (pathname === "/tags") return "tags";
  if (pathname.startsWith("/archives")) return "archives";
  return null;
}

export function OneImageBanner() {
  const pathname = usePathname();
  const siteConfig = useSiteConfigStore(state => state.siteConfig);
  const routeKey = useMemo(() => getRouteKey(pathname), [pathname]);

  const [isMobile, setIsMobile] = useState(false);
  const [displaySubtitle, setDisplaySubtitle] = useState("");
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [showUnmuteHint, setShowUnmuteHint] = useState(false);

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingIdRef = useRef(0);
  const fetchControllerRef = useRef<AbortController | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoPlayAttemptedRef = useRef(false);

  const pageConfig = useMemo(() => {
    return siteConfig?.page?.one_image?.config || siteConfig?.page?.oneImageConfig;
  }, [siteConfig]);

  const currentConfig = useMemo<PageOneImageItem | undefined>(() => {
    if (!routeKey) return undefined;
    return pageConfig?.[routeKey];
  }, [pageConfig, routeKey]);

  const isEnabled = Boolean(currentConfig?.enable);

  const effectiveBackground = useMemo(() => {
    if (!currentConfig) return "";
    if (isMobile && currentConfig.mobileBackground) {
      return currentConfig.mobileBackground;
    }
    return currentConfig.background || "";
  }, [currentConfig, isMobile]);

  const effectiveMediaType = useMemo(() => {
    if (!currentConfig) return "image";
    if (isMobile && currentConfig.mobileBackground) {
      return currentConfig.mobileMediaType || "image";
    }
    return currentConfig.mediaType || "image";
  }, [currentConfig, isMobile]);

  const effectiveVideoAutoplay = useMemo(() => {
    if (!currentConfig) return true;
    if (isMobile && currentConfig.mobileBackground) {
      return currentConfig.mobileVideoAutoplay ?? true;
    }
    return currentConfig.videoAutoplay ?? true;
  }, [currentConfig, isMobile]);

  const effectiveVideoLoop = useMemo(() => {
    if (!currentConfig) return true;
    if (isMobile && currentConfig.mobileBackground) {
      return currentConfig.mobileVideoLoop ?? true;
    }
    return currentConfig.videoLoop ?? true;
  }, [currentConfig, isMobile]);

  const effectiveVideoMuted = useMemo(() => {
    if (!currentConfig) return true;
    if (isMobile && currentConfig.mobileBackground) {
      return currentConfig.mobileVideoMuted ?? true;
    }
    return currentConfig.videoMuted ?? true;
  }, [currentConfig, isMobile]);

  const hitokotoApi = useMemo(() => {
    return siteConfig?.page?.one_image?.hitokoto_api || "https://v1.hitokoto.cn/";
  }, [siteConfig]);

  const typingSpeed = useMemo(() => {
    return Number(siteConfig?.page?.one_image?.typing_speed) || 100;
  }, [siteConfig]);

  const clearTypingTimer = useCallback(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }, []);

  const typeWriter = useCallback(
    (text: string) => {
      clearTypingTimer();
      typingIdRef.current += 1;
      const currentId = typingIdRef.current;
      setDisplaySubtitle("");

      let index = 0;
      const type = () => {
        if (typingIdRef.current !== currentId) return;
        if (index <= text.length) {
          setDisplaySubtitle(text.slice(0, index));
          index += 1;
          typingTimerRef.current = setTimeout(type, typingSpeed);
        }
      };
      type();
    },
    [clearTypingTimer, typingSpeed]
  );

  const fetchHitokoto = useCallback(async () => {
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
    }
    const controller = new AbortController();
    fetchControllerRef.current = controller;

    try {
      const response = await fetch(hitokotoApi, { signal: controller.signal });
      const data = await response.json();
      return data.hitokoto || "";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return "";
      }
      return "";
    } finally {
      if (fetchControllerRef.current === controller) {
        fetchControllerRef.current = null;
      }
    }
  }, [hitokotoApi]);

  const updateSubtitle = useCallback(async () => {
    if (!currentConfig?.enable) {
      setDisplaySubtitle("");
      return;
    }

    typingIdRef.current += 1;
    const currentId = typingIdRef.current;

    let text = currentConfig.subTitle || siteConfig?.SUB_TITLE || "";

    if (currentConfig.hitokoto) {
      const hitokotoText = await fetchHitokoto();
      if (typingIdRef.current !== currentId) return;
      text = hitokotoText || text;
    }

    if (currentConfig.typingEffect) {
      typeWriter(text);
    } else {
      setDisplaySubtitle(text);
    }
  }, [currentConfig, fetchHitokoto, siteConfig, typeWriter]);

  const tryPlayVideo = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    const shouldAutoplay = effectiveVideoAutoplay;
    const shouldMute = effectiveVideoMuted;

    if (!shouldAutoplay) {
      video.muted = shouldMute;
      setIsVideoMuted(shouldMute);
      setShowUnmuteHint(false);
      return;
    }

    if (shouldMute) {
      video.muted = true;
      setIsVideoMuted(true);
      setShowUnmuteHint(false);
      try {
        await video.play();
      } catch {
        // 忽略自动播放失败
      }
      return;
    }

    video.muted = false;
    try {
      await video.play();
      setIsVideoMuted(false);
      setShowUnmuteHint(false);
    } catch {
      // 浏览器策略阻止带声音自动播放，切换静音并提示
      video.muted = true;
      setIsVideoMuted(true);
      setShowUnmuteHint(true);
      try {
        await video.play();
      } catch {
        // 忽略播放失败
      }
    }
  }, [effectiveVideoAutoplay, effectiveVideoMuted]);

  const handleVideoLoaded = useCallback(async () => {
    if (videoPlayAttemptedRef.current) return;
    videoPlayAttemptedRef.current = true;
    await tryPlayVideo();
  }, [tryPlayVideo]);

  const handleVideoCanPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused && !videoPlayAttemptedRef.current) {
      videoPlayAttemptedRef.current = true;
      await tryPlayVideo();
    }
  }, [tryPlayVideo]);

  const handleVideoLoadedData = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      try {
        await video.play();
      } catch {
        // 忽略错误
      }
    }
  }, []);

  const toggleVideoMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !isVideoMuted;
    video.muted = nextMuted;
    setIsVideoMuted(nextMuted);
    if (!nextMuted) {
      setShowUnmuteHint(false);
    }
  }, [isVideoMuted]);

  const scrollToMain = useCallback(() => {
    const mainEl = document.getElementById("frontend-main");
    if (!mainEl) return;
    const mainTop = mainEl.getBoundingClientRect().top + window.pageYOffset;
    const offsetPosition = mainTop - 70;
    window.scrollTo({ top: offsetPosition, behavior: "smooth" });
  }, []);

  const isWechatBrowser = useCallback(() => {
    return typeof navigator !== "undefined" && /micromessenger/i.test(navigator.userAgent);
  }, []);

  const handleWechatVideoPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    setIsVideoMuted(true);
    video.play().catch(() => {});
  }, []);

  const handleUserInteraction = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.paused) return;
    video.muted = true;
    setIsVideoMuted(true);
    video.play().catch(() => {});
  }, []);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);
    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  useEffect(() => {
    if (!isWechatBrowser() || effectiveMediaType !== "video" || !effectiveBackground) return;

    const win = typeof window !== "undefined" ? window : null;
    if (win && "WeixinJSBridge" in win) {
      handleWechatVideoPlay();
    } else {
      document.addEventListener("WeixinJSBridgeReady", handleWechatVideoPlay, false);
    }

    document.addEventListener("touchstart", handleUserInteraction, { once: true, passive: true });
    document.addEventListener("click", handleUserInteraction, { once: true });

    const retryIntervals = [100, 300, 500, 1000, 2000];
    const timers = retryIntervals.map(delay =>
      setTimeout(() => {
        if (videoRef.current?.paused) handleWechatVideoPlay();
      }, delay)
    );

    return () => {
      document.removeEventListener("WeixinJSBridgeReady", handleWechatVideoPlay);
      document.removeEventListener("touchstart", handleUserInteraction);
      document.removeEventListener("click", handleUserInteraction);
      timers.forEach(clearTimeout);
    };
  }, [isWechatBrowser, effectiveMediaType, effectiveBackground, handleWechatVideoPlay, handleUserInteraction]);

  useEffect(() => {
    const layout = document.getElementById("frontend-layout");
    if (!layout) return;

    if (isEnabled && effectiveMediaType === "image" && effectiveBackground) {
      document.documentElement.style.setProperty("--one-image-background", `url(${effectiveBackground})`);
      layout.classList.add("one-image-active");
    } else {
      layout.classList.remove("one-image-active");
      document.documentElement.style.removeProperty("--one-image-background");
    }

    return () => {
      layout.classList.remove("one-image-active");
    };
  }, [isEnabled, effectiveBackground, effectiveMediaType]);

  useEffect(() => {
    if (!currentConfig?.enable) {
      setDisplaySubtitle("");
      return;
    }
    setShowUnmuteHint(false);
    videoPlayAttemptedRef.current = false;
    setIsVideoMuted(effectiveVideoMuted);
    updateSubtitle();
    return () => {
      clearTypingTimer();
    };
  }, [currentConfig, effectiveVideoMuted, updateSubtitle, clearTypingTimer]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isVideoMuted;
    }
  }, [isVideoMuted]);

  if (!isEnabled) return null;

  return (
    <section className={styles.oneImageBanner}>
      {effectiveMediaType === "video" && effectiveBackground && (
        <video
          ref={videoRef}
          key={effectiveBackground}
          className={styles.videoBackground}
          src={effectiveBackground}
          autoPlay={effectiveVideoAutoplay}
          loop={effectiveVideoLoop}
          muted={isVideoMuted}
          playsInline
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
          onLoadedMetadata={handleVideoLoaded}
          onCanPlay={handleVideoCanPlay}
          onLoadedData={handleVideoLoadedData}
        />
      )}

      {effectiveMediaType === "video" && (
        <button
          className={cn(styles.videoSoundControl, showUnmuteHint && styles.videoSoundControlHint)}
          onClick={toggleVideoMute}
          aria-label="视频声音控制"
        >
          {isVideoMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          {showUnmuteHint && <span>点击开启声音</span>}
        </button>
      )}

      <div className={styles.siteInfo}>
        <h1 className={styles.siteTitle}>{currentConfig?.mainTitle || siteConfig?.APP_NAME}</h1>
        <div className={styles.siteSubtitle}>
          <span>{displaySubtitle}</span>
          {currentConfig?.typingEffect && <span className={styles.typedCursor}>|</span>}
        </div>
      </div>

      {routeKey === "home" && (
        <button className={styles.scrollDown} onClick={scrollToMain} aria-label="滚动到内容">
          <ChevronDown className={styles.scrollDownIcon} size={28} />
        </button>
      )}
    </section>
  );
}
