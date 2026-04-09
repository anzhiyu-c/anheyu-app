"use client";

import DOMPurify from "dompurify";
import { SiBilibili } from "react-icons/si";
import type { Article } from "@/types/article";
import styles from "./PostDetail.module.css";

function sanitize(html: string): string {
  if (typeof window === "undefined") return html;
  return DOMPurify.sanitize(html);
}

export function ArticleLeadSummary({ article }: { article: Article }) {
  const text = (article.summaries || []).map(s => s.trim()).filter(Boolean)[0];
  if (!text) return null;

  return (
    <div className={styles.articleLead} role="region" aria-label="文章摘要">
      <div className={styles.articleLeadTitle}>
        <SiBilibili className={styles.articleLeadIcon} aria-hidden="true" />
        <span className={styles.articleLeadTitleText}>文章摘要</span>
      </div>
      <div
        className={styles.articleLeadText}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: sanitize(text) }}
      />
    </div>
  );
}
