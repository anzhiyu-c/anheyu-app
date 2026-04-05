/*
 * @Description: 全局错误边界
 * @Author: 安知鱼
 * @Date: 2026-02-01
 */
"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // 可以在这里上报错误到监控服务
    console.error("[Error Boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full text-center">
        {/* 错误图标 */}
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 rounded-full bg-red/10 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-red" />
          </div>
        </div>

        {/* 错误信息 */}
        <h1 className="text-2xl font-bold text-foreground mb-2">出错了</h1>
        <p className="text-muted-foreground mb-6">抱歉，页面加载时发生了错误。请尝试刷新页面或返回首页。</p>

        {/* 错误详情（仅开发环境） */}
        {process.env.NODE_ENV === "development" && (
          <div className="mb-6 p-4 bg-muted rounded-lg text-left">
            <p className="text-sm font-mono text-red break-all">{error.message}</p>
            {error.digest && <p className="text-xs text-muted-foreground mt-2">Digest: {error.digest}</p>}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium transition-all hover:opacity-90 hover:scale-[1.02]"
          >
            <RefreshCw className="w-4 h-4" />
            重试
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-secondary-foreground rounded-full font-medium transition-all hover:bg-muted"
          >
            <Home className="w-4 h-4" />
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
