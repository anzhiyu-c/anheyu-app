"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { statisticsApi } from "@/lib/api/admin";

function shouldSkipPath(pathname: string): boolean {
  if (!pathname) return true;
  // 仅排除后台：/admin 与 /admin/*，避免误伤 /administrator 等前台路径
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api")) return true;
  return false;
}

/**
 * Next.js 为客户端路由，页面请求不经过 Go；需主动 POST /api/public/statistics/visit 写入 visitor_log。
 * 后台 /admin 不统计。
 */
export function VisitStatisticsTracker() {
  const pathname = usePathname();
  const lastSentRef = useRef<string>("");
  const prevTrackedRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !pathname) return;

    if (shouldSkipPath(pathname)) {
      prevTrackedRef.current = pathname;
      return;
    }

    if (pathname === lastSentRef.current) return;
    lastSentRef.current = pathname;

    const prev = prevTrackedRef.current;
    prevTrackedRef.current = pathname;

    let referer = "";
    if (prev && !shouldSkipPath(prev)) {
      referer = `${window.location.origin}${prev}`;
    } else {
      referer = document.referrer || "";
    }

    const id = requestAnimationFrame(() => {
      void statisticsApi.recordVisit({
        url_path: pathname,
        page_title: document.title || "",
        referer,
        duration: 0,
      });
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
