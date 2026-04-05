"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import type { ArticleStatistics } from "@/types/article-statistics";
import type { CategoryStatItem, TagStatItem, TopViewedPostItem, PublishTrendItem } from "@/types/article-statistics";
import dynamic from "next/dynamic";
import styles from "../article-statistics.module.css";

const OverviewCards = dynamic<{ statistics: ArticleStatistics }>(
  () => import("./OverviewCards").then(m => ({ default: m.OverviewCards })),
  {
    ssr: false,
  }
);
const CategoryChart = dynamic<{ data: CategoryStatItem[] }>(
  () => import("./CategoryChart").then(m => ({ default: m.CategoryChart })),
  {
    ssr: false,
  }
);
const PublishTrend = dynamic<{ data: PublishTrendItem[] }>(
  () => import("./PublishTrend").then(m => ({ default: m.PublishTrend })),
  { ssr: false }
);
const TopArticles = dynamic<{ articles: TopViewedPostItem[] }>(
  () => import("./TopArticles").then(m => ({ default: m.TopArticles })),
  { ssr: false }
);
const TagCloud = dynamic<{ tags: TagStatItem[] }>(() => import("./TagCloud").then(m => ({ default: m.TagCloud })), {
  ssr: false,
});

export function ArticleStatisticsContent() {
  const router = useRouter();
  const [statistics, setStatistics] = useState<ArticleStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatistics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<ArticleStatistics>("/api/public/articles/statistics");
      if (response.code === 200 && response.data) {
        setStatistics(response.data);
      } else {
        throw new Error(response.message || "获取统计数据失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取统计数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  return (
    <div className={styles.page}>
      {/* 页面头部 */}
      <div className={styles.pageHeader}>
        <button className={styles.backBtn} onClick={() => router.push("/about")}>
          <ArrowLeft />
          <span>返回</span>
        </button>
        <h1 className={styles.pageTitle}>文章统计</h1>
        <div className={styles.headerSpacer} />
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner} />
          <p>正在加载统计数据...</p>
        </div>
      )}

      {/* 错误状态 */}
      {!loading && error && (
        <div className={styles.errorContainer}>
          <div className={styles.errorIcon}>😕</div>
          <p>{error}</p>
          <button className={styles.retryBtn} onClick={fetchStatistics}>
            重试
          </button>
        </div>
      )}

      {/* 数据展示 */}
      {!loading && !error && statistics && (
        <div className={styles.statisticsContent}>
          <OverviewCards statistics={statistics} />

          <div className={styles.chartsGrid}>
            <CategoryChart data={statistics.category_stats} />
            <PublishTrend data={statistics.publish_trend} />
          </div>

          <div className={styles.bottomGrid}>
            <TopArticles articles={statistics.top_viewed_posts} />
            <TagCloud tags={statistics.tag_stats} />
          </div>
        </div>
      )}
    </div>
  );
}
