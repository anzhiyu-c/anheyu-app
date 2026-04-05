/*
 * @Description: 前台页面加载状态
 * @Author: 安知鱼
 * @Date: 2026-02-01
 */

import { Header, Footer } from "@/components/layout";

/**
 * 文章卡片骨架屏
 */
function ArticleCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse">
      {/* 封面骨架 */}
      <div className="aspect-16/10 bg-muted" />
      {/* 内容骨架 */}
      <div className="p-5 sm:p-6 space-y-4">
        <div className="h-6 bg-muted rounded w-3/4" />
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-2/3" />
        </div>
        <div className="flex justify-between pt-4 border-t border-border/50">
          <div className="h-4 bg-muted rounded w-24" />
          <div className="flex gap-4">
            <div className="h-4 bg-muted rounded w-12" />
            <div className="h-4 bg-muted rounded w-12" />
          </div>
        </div>
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
      {/* 作者卡片骨架 */}
      <div className="card-widget p-4 animate-pulse">
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full bg-muted" />
          <div className="h-5 bg-muted rounded w-24" />
          <div className="h-4 bg-muted rounded w-32" />
        </div>
      </div>
      {/* 其他卡片骨架 */}
      <div className="card-widget p-4 h-32 animate-pulse">
        <div className="h-full bg-muted rounded" />
      </div>
    </aside>
  );
}

export default function FrontendLoading() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="content-inner">
          {/* 主内容区骨架 */}
          <div className="main-content">
            {/* 分类栏骨架 */}
            <div className="h-12 bg-card border border-border rounded-xl animate-pulse mb-2" />
            {/* 文章列表骨架 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <ArticleCardSkeleton key={i} />
              ))}
            </div>
          </div>
          {/* 侧边栏骨架 */}
          <SidebarSkeleton />
        </div>
      </main>
      <Footer />
    </>
  );
}
