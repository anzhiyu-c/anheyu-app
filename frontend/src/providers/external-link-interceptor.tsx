/**
 * 外部链接拦截器 Provider
 * 根据 siteConfig.ENABLE_EXTERNAL_LINK_WARNING 决定是否启用
 * 在前台 layout 中挂载，全局拦截外链点击
 */
"use client";

import { useEffect } from "react";
import { useSiteConfigStore } from "@/store/site-config-store";
import { initExternalLinkInterceptor } from "@/lib/utils/external-link";

export function ExternalLinkInterceptor() {
  const rawValue = useSiteConfigStore(state => state.siteConfig?.ENABLE_EXTERNAL_LINK_WARNING);
  // 后端值可能是 boolean true 或 string "true"
  const enableWarning = rawValue === true || (rawValue as unknown) === "true";

  useEffect(() => {
    // 仅在开关启用时初始化拦截器
    if (!enableWarning) return;

    const cleanup = initExternalLinkInterceptor();
    return cleanup;
  }, [enableWarning]);

  return null;
}
