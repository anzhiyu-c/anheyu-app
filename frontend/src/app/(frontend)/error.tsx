/*
 * @Description: 前台错误边界
 * @Author: 安知鱼
 * @Date: 2026-02-01
 */
"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";
import { Header, Footer } from "@/components/layout";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function FrontendError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[Frontend Error]", error);
  }, [error]);

  return (
    <>
      <Header />
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          {/* 错误图标 */}
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 rounded-full bg-red/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red" />
            </div>
          </div>

          {/* 错误信息 */}
          <h1 className="text-xl font-bold text-foreground mb-2">加载失败</h1>
          <p className="text-muted-foreground mb-6 text-sm">页面内容加载时出现问题，请尝试刷新或稍后再试。</p>

          {/* 错误详情（仅开发环境） */}
          {process.env.NODE_ENV === "development" && (
            <div className="mb-6 p-3 bg-muted rounded-lg text-left">
              <p className="text-xs font-mono text-red break-all">{error.message}</p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-medium transition-all hover:opacity-90"
            >
              <RefreshCw className="w-4 h-4" />
              重试
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-secondary text-secondary-foreground rounded-full text-sm font-medium transition-all hover:bg-muted"
            >
              <Home className="w-4 h-4" />
              首页
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
