/*
 * @Description: 骨架屏组件库
 * @Author: 安知鱼
 * @Date: 2026-02-01
 */
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

/**
 * 基础骨架屏组件
 */
export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("animate-pulse bg-muted rounded", className)} />;
}

/**
 * 文章卡片骨架屏
 */
export function ArticleCardSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("bg-card border border-border rounded-2xl overflow-hidden", className)}>
      {/* 封面骨架 */}
      <Skeleton className="aspect-[16/10] rounded-none" />
      {/* 内容骨架 */}
      <div className="p-5 sm:p-6 space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="flex justify-between pt-4 border-t border-border/50">
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 文章列表骨架屏
 */
export function ArticleListSkeleton({ count = 4, className }: SkeletonProps & { count?: number }) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <ArticleCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * 侧边栏骨架屏
 */
export function SidebarSkeleton({ className }: SkeletonProps) {
  return (
    <aside className={cn("hidden lg:flex flex-col gap-2.5 w-[300px] shrink-0", className)}>
      {/* 作者卡片骨架 */}
      <div className="card-widget p-4">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="w-20 h-20 rounded-full" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      {/* 标签卡片骨架 */}
      <div className="card-widget p-4">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-16" />
          ))}
        </div>
      </div>
    </aside>
  );
}

/**
 * 文本行骨架屏
 */
export function TextLineSkeleton({ lines = 3, className }: SkeletonProps & { lines?: number }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

/**
 * 头像骨架屏
 */
export function AvatarSkeleton({ size = "md", className }: SkeletonProps & { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-20 h-20",
  };

  return <Skeleton className={cn("rounded-full", sizeClasses[size], className)} />;
}

/**
 * 按钮骨架屏
 */
export function ButtonSkeleton({ className }: SkeletonProps) {
  return <Skeleton className={cn("h-10 w-24 rounded-full", className)} />;
}

/**
 * 卡片骨架屏
 */
export function CardSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("card-widget p-4", className)}>
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
