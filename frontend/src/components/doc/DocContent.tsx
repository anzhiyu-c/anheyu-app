"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar, Clock, Eye } from "lucide-react";
import { PostContent } from "@/components/post/PostContent";
import { cn } from "@/lib/utils";
import type { Article } from "@/types/article";
import type { DocArticleItem } from "@/types/doc-series";
import styles from "./doc.module.css";

interface DocContentProps {
  article: Article;
  prevDoc: DocArticleItem | null;
  nextDoc: DocArticleItem | null;
  onNavigate: (docId: string) => void;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}

function formatReadingTime(time: number) {
  return time < 1 ? "< 1 分钟" : `${time} 分钟`;
}

export function DocContent({ article, prevDoc, nextDoc, onNavigate }: DocContentProps) {
  const readingTime = useMemo(() => formatReadingTime(article.reading_time || 1), [article.reading_time]);

  return (
    <article className={styles.docContent}>
      {/* 文档标题 */}
      <header className={styles.docHeader}>
        <h1 className={styles.docContentTitle}>{article.title}</h1>
        {article.summaries && article.summaries.length > 0 && (
          <p className={styles.docSubtitle}>{article.summaries[0]}</p>
        )}
        <div className={styles.docMeta}>
          <span className={styles.metaItem}>
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(article.created_at)}
          </span>
          <span className={styles.metaItem}>
            <Clock className="w-3.5 h-3.5" />
            {readingTime} 阅读
          </span>
          <span className={styles.metaItem}>
            <Eye className="w-3.5 h-3.5" />
            {article.view_count} 次阅读
          </span>
        </div>
      </header>

      {/* 正文 */}
      <div className={styles.docBody} id="doc-article-container">
        <PostContent content={article.content_html || ""} />
      </div>

      {/* 上下篇导航 */}
      {(prevDoc || nextDoc) && (
        <nav className={styles.docNavFooter}>
          {prevDoc ? (
            <div className={cn(styles.navItem, styles.navPrev)} onClick={() => onNavigate(prevDoc.id)}>
              <span className={styles.navLabel}>
                <ChevronLeft className="w-3 h-3" />
                上一篇
              </span>
              <span className={styles.navTitleText}>{prevDoc.title}</span>
            </div>
          ) : (
            <div className={cn(styles.navItem, styles.navPlaceholder)} />
          )}

          {nextDoc ? (
            <div className={cn(styles.navItem, styles.navNext)} onClick={() => onNavigate(nextDoc.id)}>
              <span className={styles.navLabel}>
                下一篇
                <ChevronRight className="w-3 h-3" />
              </span>
              <span className={styles.navTitleText}>{nextDoc.title}</span>
            </div>
          ) : (
            <div className={cn(styles.navItem, styles.navPlaceholder)} />
          )}
        </nav>
      )}

      {/* 页脚 */}
      <footer className={styles.docFooter}>
        <div className={styles.updateInfo}>最后更新于 {formatDate(article.updated_at)}</div>
      </footer>
    </article>
  );
}
