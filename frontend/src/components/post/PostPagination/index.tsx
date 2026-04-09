/**
 * 文章上下篇导航组件
 * 参考 anheyu-app 实现
 */
"use client";

import Link from "next/link";
import type { ArticleLink } from "@/types/article";
import styles from "./PostPagination.module.css";

interface PostPaginationProps {
  prevArticle?: ArticleLink | null;
  nextArticle?: ArticleLink | null;
}

function getArticleHref(link: ArticleLink): string {
  if (link.is_doc) {
    return `/doc/${link.id}`;
  }
  return `/posts/${link.abbrlink || link.id}`;
}

export function PostPagination({ prevArticle, nextArticle }: PostPaginationProps) {
  if (!prevArticle && !nextArticle) {
    return null;
  }

  return (
    <nav className={styles.paginationPost}>
      {prevArticle && (
        <Link href={getArticleHref(prevArticle)} className={`${styles.paginationItem} ${styles.left}`}>
          <div className={styles.paginationInfo}>
            <div className={styles.label}>上一篇</div>
            <div className={styles.infoTitle}>{prevArticle.title}</div>
          </div>
        </Link>
      )}

      {nextArticle && (
        <Link href={getArticleHref(nextArticle)} className={`${styles.paginationItem} ${styles.right}`}>
          <div className={styles.paginationInfo}>
            <div className={styles.label}>下一篇</div>
            <div className={styles.infoTitle}>{nextArticle.title}</div>
          </div>
        </Link>
      )}
    </nav>
  );
}

export default PostPagination;
