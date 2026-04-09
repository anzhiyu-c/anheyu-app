/**
 * Suspense 边界组件
 * 提供统一的加载状态和错误处理
 */
"use client";

import { Suspense, type ReactNode } from "react";
import { QueryErrorBoundary } from "../QueryErrorBoundary";
import { Skeleton, CardSkeleton, TextLineSkeleton, AvatarSkeleton } from "../Skeleton";

interface SuspenseBoundaryProps {
  children: ReactNode;
  /** 加载时的回退组件 */
  fallback?: ReactNode;
  /** 是否使用默认骨架屏 */
  useSkeleton?: boolean;
  /** 骨架屏类型 */
  skeletonType?: "card" | "list" | "text" | "avatar" | "custom";
  /** 骨架屏数量 */
  skeletonCount?: number;
  /** 是否包含错误边界 */
  withErrorBoundary?: boolean;
  /** 错误标题 */
  errorTitle?: string;
  /** 错误描述 */
  errorDescription?: string;
  /** 额外的 className */
  className?: string;
}

/**
 * 默认加载骨架屏
 */
function DefaultSkeleton({
  type = "card",
  count = 1,
}: {
  type?: "card" | "list" | "text" | "avatar" | "custom";
  count?: number;
}) {
  if (type === "card") {
    return (
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (type === "list") {
    return (
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (type === "text") {
    return <TextLineSkeleton lines={count} />;
  }

  if (type === "avatar") {
    return (
      <div className="flex gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <AvatarSkeleton key={i} />
        ))}
      </div>
    );
  }

  return <CardSkeleton />;
}

/**
 * Suspense 边界组件
 * 结合 React Suspense 和 QueryErrorBoundary
 */
export function SuspenseBoundary({
  children,
  fallback,
  useSkeleton = true,
  skeletonType = "card",
  skeletonCount = 1,
  withErrorBoundary = true,
  errorTitle,
  errorDescription,
  className,
}: SuspenseBoundaryProps) {
  const loadingFallback =
    fallback || (useSkeleton ? <DefaultSkeleton type={skeletonType} count={skeletonCount} /> : null);

  const suspenseContent = (
    <Suspense fallback={loadingFallback}>
      <div className={className}>{children}</div>
    </Suspense>
  );

  if (withErrorBoundary) {
    return (
      <QueryErrorBoundary title={errorTitle} description={errorDescription}>
        {suspenseContent}
      </QueryErrorBoundary>
    );
  }

  return suspenseContent;
}

export default SuspenseBoundary;
