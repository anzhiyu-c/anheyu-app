"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import { cn, formatNumber } from "@/lib/utils";

interface TopArticle {
  id: string | number;
  title: string;
  url_path?: string;
  total_views: number;
  unique_views?: number;
  bounce_rate?: number;
  avg_duration?: number; // 秒
}

interface TopArticlesProps {
  articles: TopArticle[];
  className?: string;
  isLoading?: boolean;
}

// 格式化时长（秒数转为可读格式）
function formatDuration(seconds: number): string {
  // 处理浮点数和无效值
  const secs = Math.round(seconds);
  if (!secs || secs < 1) return "0秒";
  if (secs < 60) return `${secs}秒`;
  const minutes = Math.floor(secs / 60);
  const remainingSeconds = secs % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}时${remainingMinutes}分`;
}

// 解码并格式化标题
function formatTitle(title: string): string {
  try {
    // 尝试解码 URL 编码的标题
    const decoded = decodeURIComponent(title);
    // 移除 URL 路径前缀和锚点
    return (
      decoded
        .replace(/^\/posts\/[^#]*#?/, "")
        .replace(/^\/article\/[^#]*#?/, "")
        .replace(/^\//, "") || decoded
    );
  } catch {
    return title;
  }
}

export function TopArticles({ articles, className, isLoading }: TopArticlesProps) {
  const maxViews = Math.max(...articles.map(a => a.total_views), 1);

  if (isLoading) {
    return (
      <div className={cn("bg-card border border-border rounded-xl animate-pulse", className)}>
        <div className="flex items-center justify-between p-5 pb-0">
          <div>
            <div className="h-5 w-24 bg-muted rounded mb-2" />
            <div className="h-4 w-32 bg-muted rounded" />
          </div>
          <div className="h-4 w-16 bg-muted rounded" />
        </div>
        <div className="p-5 pt-4 space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-6 h-6 bg-muted rounded-md shrink-0" />
              <div className="flex-1">
                <div className="h-4 w-3/4 bg-muted rounded mb-2" />
                <div className="h-3 w-1/2 bg-muted rounded mb-2" />
                <div className="h-1 w-full bg-muted rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-card border border-border rounded-xl", className)}>
      {/* 头部 */}
      <div className="flex items-center justify-between p-5 pb-0">
        <div>
          <h3 className="text-base font-semibold">热门文章</h3>
          <p className="text-sm text-muted-foreground mt-0.5">浏览量最高的文章</p>
        </div>
        <Link
          href="/admin/post-management"
          className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
        >
          查看全部
          <Icon icon="ri:arrow-right-s-line" className="w-4 h-4" />
        </Link>
      </div>

      {/* 列表 */}
      <div className="p-5 pt-4">
        {articles.length > 0 ? (
          <div className="space-y-4">
            {articles.map((article, index) => {
              const widthPercent = (article.total_views / maxViews) * 100;

              return (
                <div key={article.id} className="group">
                  <div className="flex items-start gap-3">
                    {/* 排名 */}
                    <span
                      className={cn(
                        "shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-medium",
                        index === 0 && "bg-yellow-500/10 text-yellow-600",
                        index === 1 && "bg-slate-400/10 text-slate-500",
                        index === 2 && "bg-orange-500/10 text-orange-600",
                        index > 2 && "bg-muted text-muted-foreground"
                      )}
                    >
                      {index + 1}
                    </span>

                    {/* 内容 */}
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p
                        className="text-sm font-medium truncate group-hover:text-primary transition-colors cursor-pointer"
                        title={formatTitle(article.title)}
                      >
                        {formatTitle(article.title)}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Icon icon="ri:eye-line" className="w-3.5 h-3.5" />
                          {formatNumber(article.total_views)}
                        </span>
                        {article.unique_views !== undefined && (
                          <span className="flex items-center gap-1">
                            <Icon icon="ri:user-line" className="w-3.5 h-3.5" />
                            {formatNumber(article.unique_views)}
                          </span>
                        )}
                        {article.avg_duration !== undefined && (
                          <span className="flex items-center gap-1">
                            <Icon icon="ri:time-line" className="w-3.5 h-3.5" />
                            {formatDuration(article.avg_duration)}
                          </span>
                        )}
                      </div>

                      {/* 进度条 */}
                      <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/60 rounded-full transition-all duration-500"
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground text-sm">暂无数据</div>
        )}
      </div>
    </div>
  );
}
