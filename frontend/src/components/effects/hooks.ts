/**
 * 特效组件共用 Hooks
 */
"use client";

import { useRef, useEffect, useState, useCallback, useSyncExternalStore } from "react";
import { useScroll } from "framer-motion";
import { useSiteConfigStore } from "@/store/site-config-store";

/**
 * 检测元素是否在视口内
 */
export function useInViewport(ref: React.RefObject<HTMLElement | null>, rootMargin = "100px") {
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => setIsInView(entry.isIntersecting), { rootMargin });

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return isInView;
}

/**
 * 检测用户是否偏好减少动画
 * 使用 useSyncExternalStore 避免 hydration 问题
 *
 * 行为受后台配置 RESPECT_REDUCED_MOTION 控制：
 * - 配置为 false（默认）：始终返回 false，忽略系统偏好
 * - 配置为 true：返回系统 prefers-reduced-motion 的实际值
 */
export function usePrefersReducedMotion() {
  const respectReducedMotion = useRespectReducedMotionConfig();

  const subscribe = useCallback((callback: () => void) => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    mediaQuery.addEventListener("change", callback);
    return () => mediaQuery.removeEventListener("change", callback);
  }, []);

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const getServerSnapshot = useCallback(() => false, []);

  const osPreference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return respectReducedMotion && osPreference;
}

/**
 * 从站点配置中读取 RESPECT_REDUCED_MOTION 的值
 */
function useRespectReducedMotionConfig(): boolean {
  const value = useSiteConfigStore(s => s.siteConfig?.RESPECT_REDUCED_MOTION);
  return value === true || value === "true";
}

/**
 * 检测是否为触摸设备
 */
export function useIsTouchDevice() {
  const subscribe = useCallback(() => {
    return () => {};
  }, []);

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return false;
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }, []);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * 滚动视差 Hook
 */
export function useScrollParallax(
  offset: ["start start" | "end start", "start start" | "end start"] = ["start start", "end start"]
) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: offset as ["start start", "end start"],
  });

  return { ref, scrollYProgress };
}
