"use client";

import { useEffect } from "react";
import { useSiteConfigStore } from "@/store/site-config-store";

const CLASS_NAME = "respect-reduced-motion";

/**
 * 根据站点配置 RESPECT_REDUCED_MOTION 同步 html 元素的 class。
 * 当配置为 true 时添加 .respect-reduced-motion，使 CSS 减弱动效规则生效。
 */
export function ReducedMotionSync() {
  const value = useSiteConfigStore(s => s.siteConfig?.RESPECT_REDUCED_MOTION);
  const isLoaded = useSiteConfigStore(s => s.isLoaded);

  useEffect(() => {
    if (typeof document === "undefined" || !isLoaded) return;

    const enabled = value === true || value === "true";
    const html = document.documentElement;

    if (enabled) {
      html.classList.add(CLASS_NAME);
    } else {
      html.classList.remove(CLASS_NAME);
    }

    return () => {
      html.classList.remove(CLASS_NAME);
    };
  }, [value, isLoaded]);

  return null;
}
