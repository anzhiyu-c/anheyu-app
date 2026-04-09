"use client";

import { useState, useMemo } from "react";
import { FaFileLines, FaTriangleExclamation } from "react-icons/fa6";
import { useFeedList } from "@/hooks/queries";
import { useSiteConfigStore } from "@/store/site-config-store";
import { cn } from "@/lib/utils";
import { FeedArticleCard } from "./FeedArticleCard";
import { Pagination } from "../Pagination";
import styles from "./FeedArticleList.module.css";

interface FeedArticleListProps {
  category?: string;
  tag?: string;
  pageSize?: number;
}

export function FeedArticleList({ category, tag, pageSize: propPageSize }: FeedArticleListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const siteConfig = useSiteConfigStore(state => state.siteConfig);

  // 从配置读取是否双栏模式（默认为 true）
  const isDoubleColumn = useMemo(() => {
    const value = siteConfig?.post?.default?.double_column;
    // 如果没有配置，默认为 true
    if (value === undefined) return true;
    return value === true || value === "true";
  }, [siteConfig]);

  // 从配置读取每页数量
  const pageSize = useMemo(() => {
    return propPageSize || siteConfig?.post?.default?.page_size || 12;
  }, [propPageSize, siteConfig]);

  const { data, isLoading, isError } = useFeedList({
    page: currentPage,
    pageSize,
    category,
    tag,
  });

  const articles = useMemo(() => data?.list || [], [data]);
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  // 判断是否是最新文章（第一页第一条）
  const isNewest = (index: number) => currentPage === 1 && index === 0;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // 滚动到文章列表顶部
    const element = document.querySelector(`.${styles.feedArticleList}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // 加载状态 - 骨架屏
  if (isLoading) {
    return (
      <div className={styles.feedArticleList}>
        <div className={cn(styles.articleList, isDoubleColumn && styles.doubleColumnContainer)}>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className={cn(styles.skeletonCard, isDoubleColumn && styles.skeletonCardDouble)}>
              <div className={styles.skeletonCover} />
              <div className={styles.skeletonContent}>
                <div className={styles.skeletonTags} />
                <div className={styles.skeletonTitle} />
                <div className={styles.skeletonMeta} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 错误状态
  if (isError) {
    return (
      <div className={styles.feedArticleList}>
        <div className={styles.errorState}>
          <FaTriangleExclamation aria-hidden="true" />
          <p>加载文章列表失败，请稍后重试</p>
        </div>
      </div>
    );
  }

  // 空状态
  if (articles.length === 0) {
    return (
      <div className={styles.feedArticleList}>
        <div className={styles.emptyState}>
          <FaFileLines aria-hidden="true" />
          <p>暂无文章</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.feedArticleList}>
      {/* 文章列表 */}
      <div className={cn(styles.articleList, isDoubleColumn && styles.doubleColumnContainer)}>
        {articles.map((article, index) => (
          <FeedArticleCard
            key={article.id}
            article={article}
            isDoubleColumn={isDoubleColumn}
            isNewest={isNewest(index)}
            animationOrder={index}
          />
        ))}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
      )}
    </div>
  );
}
