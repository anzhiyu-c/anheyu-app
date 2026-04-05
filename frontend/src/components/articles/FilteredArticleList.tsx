"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { FaFileLines, FaTriangleExclamation } from "react-icons/fa6";
import { useFeedList } from "@/hooks/queries";
import { useSiteConfigStore } from "@/store/site-config-store";
import { FeedArticleCard } from "@/components/home/FeedArticleList";
import { Pagination } from "@/components/home";
import { cn } from "@/lib/utils";
import styles from "@/components/home/FeedArticleList/FeedArticleList.module.css";

type FilterType = "category" | "tag";

interface FilteredArticleListProps {
  filterType: FilterType;
  filterValue: string;
  page?: number;
  onPageChange?: (nextPage: number) => void;
}

function buildFilteredPath(filterType: FilterType, filterValue: string, page: number) {
  const encodedValue = encodeURIComponent(filterValue);
  if (page <= 1) {
    return `/${filterType === "category" ? "categories" : "tags"}/${encodedValue}/`;
  }
  return `/${filterType === "category" ? "categories" : "tags"}/${encodedValue}/page/${page}`;
}

export function FilteredArticleList({ filterType, filterValue, page = 1, onPageChange }: FilteredArticleListProps) {
  const router = useRouter();
  const siteConfig = useSiteConfigStore(state => state.siteConfig);

  const isDoubleColumn = useMemo(() => {
    const value = siteConfig?.post?.default?.double_column;
    if (value === undefined) return true;
    return value === true || value === "true";
  }, [siteConfig]);

  const pageSize = useMemo(() => {
    return siteConfig?.post?.default?.page_size || 12;
  }, [siteConfig]);

  const queryParams = useMemo(() => {
    return filterType === "category" ? { page, pageSize, category: filterValue } : { page, pageSize, tag: filterValue };
  }, [filterType, filterValue, page, pageSize]);

  const { data, isLoading, isError } = useFeedList(queryParams);
  const feedItems = useMemo(() => data?.list || [], [data]);
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (onPageChange) {
        onPageChange(nextPage);
      } else {
        const path = buildFilteredPath(filterType, filterValue, nextPage);
        router.push(path);
      }
      const element = document.querySelector(`.${styles.feedArticleList}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [filterType, filterValue, router, onPageChange]
  );

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

  if (feedItems.length === 0) {
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
      <div className={cn(styles.articleList, isDoubleColumn && styles.doubleColumnContainer)}>
        {feedItems.map((article, index) => (
          <FeedArticleCard
            key={article.id}
            article={article}
            isDoubleColumn={isDoubleColumn}
            isNewest={page === 1 && index === 0}
            animationOrder={index}
          />
        ))}
      </div>

      {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} />}
    </div>
  );
}
