"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { useSiteConfigStore } from "@/store/site-config-store";

const THEME_STORAGE_KEY = "theme";

/**
 * 将站点配置的「默认主题模式」同步到 next-themes。
 * 仅当用户从未在本地设置过主题（localStorage 无 theme）时执行一次，
 * 之后用户手动切换主题不会被覆盖。
 */
export function DefaultThemeSync() {
  const { setTheme } = useTheme();
  const siteConfig = useSiteConfigStore(state => state.siteConfig);
  const isLoaded = useSiteConfigStore(state => state.isLoaded);
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !isLoaded || hasSyncedRef.current) {
      return;
    }
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored != null && stored !== "") {
      return;
    }
    const mode = siteConfig?.DEFAULT_THEME_MODE;
    const theme =
      mode === "dark" || mode === "light"
        ? mode
        : mode === "system" || mode === "auto"
          ? "system"
          : "light";
    setTheme(theme);
    hasSyncedRef.current = true;
  }, [isLoaded, siteConfig?.DEFAULT_THEME_MODE, setTheme]);

  return null;
}
