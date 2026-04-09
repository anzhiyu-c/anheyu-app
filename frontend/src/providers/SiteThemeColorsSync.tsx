"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useShallow } from "zustand/shallow";
import { useSiteConfigStore } from "@/store/site-config-store";
import type { SiteConfigData } from "@/types/site-config";
import { applySiteAppearanceFromConfig } from "@/utils/site-theme-colors";

/**
 * 将站点配置中的换肤预设与令牌同步到 :root（随 next-themes 解析的亮/暗模式切换）
 */
export function SiteThemeColorsSync() {
  const isLoaded = useSiteConfigStore(s => s.isLoaded);
  const { skin, tokens } = useSiteConfigStore(
    useShallow(s => ({
      skin: s.siteConfig.APPEARANCE_SKIN,
      tokens: s.siteConfig.APPEARANCE_TOKENS,
    }))
  );
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (typeof window === "undefined" || !isLoaded) return;
    if (!resolvedTheme) return;
    const partial: Pick<SiteConfigData, "APPEARANCE_SKIN" | "APPEARANCE_TOKENS"> = {
      APPEARANCE_SKIN: skin,
      APPEARANCE_TOKENS: tokens,
    };
    applySiteAppearanceFromConfig(partial, resolvedTheme === "dark");
  }, [isLoaded, skin, tokens, resolvedTheme]);

  return null;
}
