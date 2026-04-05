/*
 * @Description: 文章卡片 - 高级设计版本
 * @Author: 安知鱼
 * @Date: 2026-01-30 16:56:02
 * @LastEditTime: 2026-01-31 12:00:00
 * @LastEditors: 安知鱼
 */
"use client";

import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui";
import { Eye, MessageSquare, Calendar, ArrowUpRight } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { formatDateCN } from "@/utils/date";
import { PerspectiveCard } from "@/components/effects";
import type { Article } from "@/types";

interface ArticleCardProps {
  article: Article;
}

export function ArticleCard({ article }: ArticleCardProps) {
  return (
    <PerspectiveCard className="h-full">
      <Link href={`/posts/${article.slug}`} className="block h-full group">
        <div className="h-full bg-card border border-border rounded-2xl overflow-hidden transition-all duration-500 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5">
          {/* 封面图 */}
          {article.cover && (
            <div className="relative aspect-16/10 overflow-hidden">
              <Image
                src={article.cover}
                alt={article.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />
              {/* 悬浮遮罩 */}
              <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              {/* 悬浮图标 */}
              <div className="absolute top-4 right-4 p-2 rounded-full bg-white/10 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                <ArrowUpRight className="w-4 h-4 text-white" />
              </div>

              {/* 分类标签 - 悬浮在图片上 */}
              {article.category && (
                <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                  <Badge
                    variant="default"
                    size="sm"
                    className="bg-white/90 text-gray-900 backdrop-blur-sm border-0 shadow-lg"
                  >
                    {article.category.name}
                  </Badge>
                </div>
              )}
            </div>
          )}

          {/* 内容区域 */}
          <div className="p-5 sm:p-6">
            {/* 分类 - 无封面图时显示 */}
            {!article.cover && article.category && (
              <Badge variant="outline" size="sm" className="mb-3">
                {article.category.name}
              </Badge>
            )}

            {/* 标题 */}
            <h3 className="font-semibold text-lg sm:text-xl mb-3 line-clamp-2 group-hover:text-primary transition-colors duration-300">
              {article.title}
            </h3>

            {/* 摘要 */}
            <p className="text-muted-foreground text-sm sm:text-base line-clamp-2 mb-5 leading-relaxed">
              {article.excerpt}
            </p>

            {/* 底部信息 */}
            <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground pt-4 border-t border-border/50">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDateCN(article.published_at)}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  {formatNumber(article.views)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {article.comments_count}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </PerspectiveCard>
  );
}
