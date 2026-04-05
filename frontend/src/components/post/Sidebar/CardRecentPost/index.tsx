/**
 * 最近文章组件
 * 显示最近发布的文章列表
 */
"use client";

import Link from "next/link";
import Image from "next/image";
import { formatDate } from "@/utils/date";
import type { RecentArticle } from "@/types/article";
import styles from "./CardRecentPost.module.css";

interface CardRecentPostProps {
  articles: RecentArticle[];
  currentArticleId?: number | string;
  defaultCover?: string;
  maxCount?: number;
}

export function CardRecentPost({
  articles,
  currentArticleId,
  defaultCover = "/images/default-cover.webp",
  maxCount = 5,
}: CardRecentPostProps) {
  // 过滤掉当前文章并限制数量
  const filteredArticles = articles.filter(article => article.id !== currentArticleId).slice(0, maxCount);

  // 获取文章链接
  const getArticleLink = (article: RecentArticle) => {
    if (article.is_doc) {
      return `/doc/${article.id}`;
    }
    return `/posts/${article.abbrlink || article.id}`;
  };

  if (filteredArticles.length === 0) {
    return null;
  }

  return (
    <div className={styles.cardRecentPost}>
      <div className={styles.cardTitle}>最近发布</div>

      <div className={styles.articleList}>
        {filteredArticles.map(article => (
          <Link key={article.id} href={getArticleLink(article)} className={styles.articleItem}>
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
    </div>
  );
}

export default CardRecentPost;
