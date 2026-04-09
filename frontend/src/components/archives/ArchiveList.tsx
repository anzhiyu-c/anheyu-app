"use client";

/* eslint-disable @next/next/no-img-element */
import { useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FaClock, FaFileLines, FaHashtag, FaTriangleExclamation } from "react-icons/fa6";
import { useArticleList } from "@/hooks/queries";
import { useSiteConfigStore } from "@/store/site-config-store";
import { Pagination } from "@/components/home";
import type { Article } from "@/types/article";
import styles from "./ArchiveList.module.css";

const FALLBACK_COVER = "/images/default-cover.webp";

interface ArchiveListProps {
  year?: number;
  month?: number;
  page?: number;
}

function formatMonthDay(dateString: string) {
  const date = new Date(dateString);
  const monthValue = (date.getMonth() + 1).toString().padStart(2, "0");
  const dayValue = date.getDate().toString().padStart(2, "0");
  return `${monthValue}-${dayValue}`;
}

function buildArchivePath({ year, month, page }: { year?: number; month?: number; page: number }) {
  if (year && month) {
    return page > 1 ? `/archives/${year}/${month}/page/${page}` : `/archives/${year}/${month}/`;
  }
  if (year) {
    return page > 1 ? `/archives/${year}/page/${page}` : `/archives/${year}/`;
  }
  return page > 1 ? `/archives/page/${page}` : "/archives";
}

export function ArchiveList({ year, month, page = 1 }: ArchiveListProps) {
  const router = useRouter();
  const siteConfig = useSiteConfigStore(state => state.siteConfig);

  const pageSize = useMemo(() => {
    return siteConfig?.post?.default?.page_size || 12;
  }, [siteConfig]);

  const { data, isLoading, isError } = useArticleList({
    page,
    pageSize,
    year,
    month,
  });

  const articles = useMemo(() => data?.list || [], [data]);
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const defaultCover = useMemo(() => {
    return siteConfig?.post?.default?.default_cover || FALLBACK_COVER;
  }, [siteConfig]);

  const isOneImageEnabled = useMemo(() => {
    const pageConfig = siteConfig?.page?.one_image?.config || siteConfig?.page?.oneImageConfig;
    return pageConfig?.archives?.enable || false;
  }, [siteConfig]);

  const groupedArticles = useMemo(() => {
    const groups: Record<string, Article[]> = {};
    if (!articles) return groups;
    articles.forEach(article => {
      const yearKey = new Date(article.created_at).getFullYear().toString();
      if (!groups[yearKey]) {
        groups[yearKey] = [];
      }
      groups[yearKey].push(article);
    });
    return groups;
  }, [articles]);

  const sortedYears = useMemo(() => {
    return Object.keys(groupedArticles).sort((a, b) => parseInt(b) - parseInt(a));
  }, [groupedArticles]);

  const goToPost = useCallback(
    (article: Article) => {
      if (article.is_doc) {
        router.push(`/doc/${article.id}`);
        return;
      }
      router.push(`/posts/${article.id}`);
    },
    [router]
  );

  const goToTag = useCallback(
    (event: React.MouseEvent, tagName: string) => {
      event.stopPropagation();
      router.push(`/tags/${encodeURIComponent(tagName)}/`);
    },
    [router]
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      const path = buildArchivePath({ year, month, page: nextPage });
      router.push(path);
      const element = document.querySelector(`.${styles.archivePage}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [router, year, month]
  );

  return (
    <div className={styles.archivePage}>
      {!isOneImageEnabled && (
        <div className={styles.articleSortTitle}>
          文章<sup>{total}</sup>
        </div>
      )}

      {isLoading ? (
        <div className={styles.loadingList}>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`skeleton-${index}`} className={styles.skeletonItem}>
              <div className={styles.skeletonCover} />
              <div className={styles.skeletonInfo}>
                <div className={styles.skeletonLine} />
                <div className={styles.skeletonLineWide} />
                <div className={styles.skeletonLine} />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className={styles.errorState}>
          <FaTriangleExclamation aria-hidden="true" />
          <p>加载归档失败，请稍后重试</p>
        </div>
      ) : articles.length === 0 ? (
        <div className={styles.emptyState}>
          <FaFileLines aria-hidden="true" />
          <p>暂无文章</p>
        </div>
      ) : (
        <div className={styles.articleSort}>
          {sortedYears.map(yearKey => (
            <div key={yearKey} className={styles.articleSortGroup}>
              <div className={styles.articleSortItemYear}>{yearKey}</div>
              {groupedArticles[yearKey].map(article => (
                <div key={article.id} className={styles.articleSortItem} onClick={() => goToPost(article)}>
                  <div className={styles.articleSortItemImg}>
                    <img
                      src={article.cover_url || defaultCover}
                      alt={article.title}
                      onError={event => {
                        event.currentTarget.src = defaultCover;
                      }}
                    />
                  </div>
                  <div className={styles.articleSortItemInfo}>
                    <div className={styles.articleSortItemTime}>
                      <FaClock aria-hidden="true" />
                      <time dateTime={article.created_at}>{formatMonthDay(article.created_at)}</time>
                    </div>
                    <div className={styles.articleSortItemTitle}>{article.title}</div>
                    <div className={styles.articleSortItemTags}>
                      {article.post_tags?.map(tag => (
                        <span
                          key={tag.id}
                          className={styles.articleMetaTags}
                          onClick={event => goToTag(event, tag.name)}
                        >
                          <span className={styles.tagsPunctuation}>
                            <FaHashtag aria-hidden="true" />
                            {tag.name}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} />}
    </div>
  );
}
