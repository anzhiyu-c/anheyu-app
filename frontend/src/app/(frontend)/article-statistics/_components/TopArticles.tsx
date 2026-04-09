"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Eye, Flame } from "lucide-react";
import type { TopViewedPostItem } from "@/types/article-statistics";
import styles from "../article-statistics.module.css";

interface TopArticlesProps {
  articles: TopViewedPostItem[];
}

const formatViews = (views: number): string => {
  if (views >= 1000) return (views / 1000).toFixed(1) + "K";
  return views.toString();
};

const getRankClass = (index: number): string => {
  if (index === 0) return styles.rankGold;
  if (index === 1) return styles.rankSilver;
  if (index === 2) return styles.rankBronze;
  return "";
};

export function TopArticles({ articles }: TopArticlesProps) {
  const safeArticles = useMemo(() => (Array.isArray(articles) ? articles : []), [articles]);

  return (
    <div className={styles.listCard} style={{ animationDelay: "0.3s" }}>
      <h3 className={styles.listCardTitle}>
        <Flame />
        热门文章
      </h3>
      <div className={styles.topArticles}>
        {safeArticles.length === 0 ? (
          <div className={styles.emptyState}>暂无热门文章数据</div>
        ) : (
          <div className={styles.articleList}>
            {safeArticles.map((article, index) => (
              <Link key={article.id} href={`/posts/${article.id}`} className={styles.articleItem}>
                <span className={`${styles.rank} ${getRankClass(index)}`}>{index + 1}</span>
                <div className={styles.articleInfo}>
                  <span className={styles.articleTitle} title={article.title}>
                    {article.title}
                  </span>
                  <span className={styles.articleViews}>
                    <Eye />
                    {formatViews(article.views)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
