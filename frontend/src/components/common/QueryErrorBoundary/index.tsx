/**
 * Query Error Boundary
 * 与 TanStack Query 集成的错误边界组件
 *
 * 使用方式：
 * 1. 包裹需要错误处理的组件
 * 2. 在 useQuery 中设置 throwOnError: true
 */
"use client";

import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface QueryErrorBoundaryProps {
  children: React.ReactNode;
  /** 自定义错误渲染 */
  fallback?: React.ComponentType<FallbackProps>;
  /** 错误标题 */
  title?: string;
  /** 错误描述 */
  description?: string;
  /** 额外的 className */
  className?: string;
}

/**
 * 默认错误回退组件
 */
function DefaultErrorFallback({
  error,
  resetErrorBoundary,
  title = "加载失败",
  description = "数据加载时出现问题，请尝试重试",
}: FallbackProps & { title?: string; description?: string }) {
  // 安全获取错误信息
  const errorMessage = error instanceof Error ? error.message : String(error);

  return (
    <div className={cn("flex flex-col items-center justify-center p-8 text-center")}>
      {/* 错误图标 */}
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
        <AlertTriangle className="h-6 w-6 text-red-500" />
      </div>

      {/* 错误信息 */}
      <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>

      {/* 错误详情（仅开发环境） */}
      {process.env.NODE_ENV === "development" && errorMessage && (
        <div className="mb-4 max-w-md rounded-lg bg-muted p-3 text-left">
          <p className="break-all font-mono text-xs text-red-500">{errorMessage}</p>
        </div>
      )}

      {/* 重试按钮 */}
      <button
        onClick={resetErrorBoundary}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-90"
      >
        <RefreshCw className="h-4 w-4" />
        重试
      </button>
    </div>
  );
}

/**
 * Query Error Boundary
 * 与 TanStack Query 的 QueryErrorResetBoundary 集成
 * 支持在重试时自动重置查询状态
 */
export function QueryErrorBoundary({
  children,
  fallback: CustomFallback,
  title,
  description,
  className,
}: QueryErrorBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={props =>
            CustomFallback ? (
              <CustomFallback {...props} />
            ) : (
              <div className={className}>
                <DefaultErrorFallback {...props} title={title} description={description} />
              </div>
            )
          }
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

export default QueryErrorBoundary;
