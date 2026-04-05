"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import { formatNumber, cn } from "@/lib/utils";

interface RecentArticle {
  id: number | string;
  title: string;
  views: number;
  date: string;
}

interface RecentArticlesProps {
  articles: RecentArticle[];
  title?: string;
  description?: string;
  className?: string;
}

export function RecentArticles({
  articles,
  title = "最近文章",
  description = "最近发布的 5 篇文章",
  className,
}: RecentArticlesProps) {
  return (
    <div className={cn("bg-card border border-border rounded-2xl overflow-hidden", className)}>
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
        <Link
          href="/admin/post-management"
          className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
        >
          查看全部
          <Icon icon="ri:arrow-right-s-line" className="w-4 h-4" />
        </Link>
      </div>
      <div className="divide-y divide-border/50">
        {articles.length > 0 ? (
          articles.map(article => (
            <div
              key={article.id}
              className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group"
            >
              <div className="flex-1 min-w-0 pr-4">
                <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                  {article.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{article.date}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                <Icon icon="ri:eye-line" className="w-3.5 h-3.5" />
                <span>{formatNumber(article.views)}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-muted-foreground text-sm">暂无文章</div>
        )}
      </div>
    </div>
  );
}
