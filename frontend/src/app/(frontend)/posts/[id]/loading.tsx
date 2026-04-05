/*
 * @Description: 文章详情页加载状态
 * @Author: 安知鱼
 * @Date: 2026-02-03
 */

import { Header, Footer } from "@/components/layout";

/**
 * 文章头部骨架屏
 */
function PostHeaderSkeleton() {
  return (
    <div className="relative w-full h-120 min-h-[300px] -mt-[60px] pt-[60px] overflow-hidden bg-muted animate-pulse">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full max-w-[1400px] px-15 py-8">
          <div className="space-y-4">
            {/* 分类标签 */}
            <div className="h-6 w-20 bg-white/20 rounded" />
            {/* 标题 */}
            <div className="h-10 w-3/4 bg-white/20 rounded" />
            {/* 元信息 */}
            <div className="flex gap-4 mt-4">
              <div className="h-5 w-24 bg-white/20 rounded" />
              <div className="h-5 w-24 bg-white/20 rounded" />
              <div className="h-5 w-24 bg-white/20 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 文章内容骨架屏
 */
function PostContentSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 animate-pulse">
      <div className="space-y-4">
        {/* 段落骨架 */}
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-5/6" />
        <div className="h-4 bg-muted rounded w-4/5" />
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-3/4" />
        {/* 空行 */}
        <div className="h-8" />
        {/* 更多段落 */}
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-5/6" />
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-2/3" />
      </div>
    </div>
  );
}

/**
 * 侧边栏骨架屏
 */
function SidebarSkeleton() {
  return (
    <aside className="hidden lg:flex flex-col gap-2.5 w-[300px] shrink-0">
      {/* 目录卡片骨架 */}
      <div className="card-widget p-4 animate-pulse">
        <div className="h-5 bg-muted rounded w-16 mb-4" />
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-4/5 ml-4" />
          <div className="h-4 bg-muted rounded w-3/4 ml-4" />
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-5/6 ml-4" />
        </div>
      </div>
      {/* 最近文章卡片骨架 */}
      <div className="card-widget p-4 animate-pulse">
        <div className="h-5 bg-muted rounded w-20 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-16 h-12 bg-muted rounded shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

export default function PostDetailLoading() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* 文章头部骨架 */}
        <PostHeaderSkeleton />

        {/* 文章内容区域 */}
        <div className="content-inner mt-6">
          <div className="main-content">
            <PostContentSkeleton />
          </div>
          <SidebarSkeleton />
        </div>
      </main>
      <Footer />
    </>
  );
}
