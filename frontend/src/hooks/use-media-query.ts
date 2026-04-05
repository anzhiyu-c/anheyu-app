"use client";

import { useSyncExternalStore, useCallback } from "react";
import { BREAKPOINTS } from "@/lib/constants/app";

/**
 * 通用媒体查询 Hook
 * @param query 媒体查询字符串
 * @returns 是否匹配
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", callback);
      return () => media.removeEventListener("change", callback);
    },
    [query]
  );

  const getSnapshot = useCallback(() => {
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * 判断是否为移动端
 * @returns 屏幕宽度 <= 768px
 */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.MOBILE}px)`);
}

/**
 * 判断是否为平板端
 * @returns 屏幕宽度 <= 1024px
 */
export function useIsTablet(): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.TABLET}px)`);
}

/**
 * 判断是否为桌面端
 * @returns 屏幕宽度 > 1024px
 */
export function useIsDesktop(): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS.TABLET + 1}px)`);
}
