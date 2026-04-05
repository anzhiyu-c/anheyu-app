/**
 * 系列文章组件
 * 显示当前文章所属系列的其他文章
 */
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { FaArrowRight, FaBook } from "react-icons/fa6";
import { formatDate } from "@/utils/date";
import styles from "./CardSeriesPost.module.css";

interface SeriesArticle {
  id: number | string;
  title: string;
  abbrlink: string;
  cover_url?: string;
  created_at: string;
}

interface SeriesCategory {
  id: number | string;
  name: string;
  is_series: boolean;
}

interface CardSeriesPostProps {
  seriesArticles: SeriesArticle[];
  seriesCategory: SeriesCategory | null;
  currentArticleId?: number | string;
  defaultCover?: string;
}

export function CardSeriesPost({
  seriesArticles,
  seriesCategory,
  currentArticleId,
  defaultCover = "/images/default-cover.webp",
}: CardSeriesPostProps) {
  const [isOverflow, setIsOverflow] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // 检测是否溢出
  useEffect(() => {
    const checkOverflow = () => {
      if (listRef.current) {
        const itemHeight = 64 + 12; // 4rem + gap
        const maxItems = 5.5;
        const maxHeight = itemHeight * maxItems;
        setIsOverflow(listRef.current.scrollHeight > maxHeight);
      }
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);

    return () => {
      window.removeEventListener("resize", checkOverflow);
    };
  }, [seriesArticles]);

  // 过滤掉当前文章
  const filteredArticles = useMemo(() => {
    return seriesArticles.filter(article => article.id !== currentArticleId);
  }, [seriesArticles, currentArticleId]);

  if (!seriesCategory || filteredArticles.length === 0) {
    return null;
  }

  return (
    <div className={styles.cardSeriesPost}>
      <div className={styles.cardTitle}>
        <FaBook aria-hidden="true" />
        <span>{seriesCategory.name}</span>
        <span className={styles.count}>{filteredArticles.length}</span>
      </div>

      <div className={`${styles.listContainer} ${isOverflow ? styles.overflow : ""}`}>
        <div ref={listRef} className={styles.articleList}>
          {filteredArticles.map(article => (
            <Link key={article.id} href={`/doc/${article.id}`} className={styles.articleItem}>
              <div className={styles.cover}>
                <Image
                  src={article.cover_url || defaultCover}
                  alt={article.title}
                  width={64}
                  height={64}
                  className={styles.coverImage}
                />
              </div>
              <div className={styles.info}>
                <h4 className={styles.title}>{article.title}</h4>
                <span className={styles.date}>{formatDate(article.created_at)}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* 溢出渐变遮罩 */}
        {isOverflow && <div className={styles.overflowMask} />}
      </div>

      {/* 查看更多按钮 */}
      {isOverflow && (
        <Link href={`/categories/${seriesCategory.name}/`} className={styles.moreLink}>
          <span>查看更多</span>
          <FaArrowRight aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export default CardSeriesPost;
