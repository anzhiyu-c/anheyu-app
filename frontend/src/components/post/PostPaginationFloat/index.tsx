/**
 * 文章上下篇导航 - 右下角浮动卡片
 * 位置与评论弹幕一致；开启弹幕时先弹幕下移，再卡片上移
 */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ArticleLink } from "@/types/article";
import styles from "./PostPaginationFloat.module.css";

const OBSERVE_TARGET_ID = "post-comment";
/** 评论区进入视口超过此比例时视为「进入评论区」（与 CommentBarrage 一致） */
const HIDE_THRESHOLD = 0.2;
/** 评论区低于此比例时视为离开（与 CommentBarrage 一致） */
const SHOW_THRESHOLD = 0.12;
/** 弹幕下移后，延迟多久再让卡片上移（ms） */
const CARD_UP_DELAY_MS = 350;

interface PostPaginationFloatProps {
  prevArticle?: ArticleLink | null;
  nextArticle?: ArticleLink | null;
  /** 是否开启了评论弹幕：为 true 时卡片仅在滚动到评论区后上移显示，与弹幕先后顺序 */
  commentBarrageEnabled?: boolean;
}

function getArticleHref(link: ArticleLink): string {
  if (link.is_doc) {
    return `/doc/${link.id}`;
  }
  return `/posts/${link.abbrlink || link.id}`;
}

export function PostPaginationFloat({
  prevArticle,
  nextArticle,
  commentBarrageEnabled = false,
}: PostPaginationFloatProps) {
  const [cardVisible, setCardVisible] = useState(!commentBarrageEnabled);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!commentBarrageEnabled) {
      const t = setTimeout(() => setCardVisible(true), 0);
      return () => clearTimeout(t);
    }
    const el = document.getElementById(OBSERVE_TARGET_ID);
    if (!el) return;

    let lastVisible = false;
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (!entry || typeof window === "undefined" || document.body.clientWidth <= 768) return;
        const ratio = entry.intersectionRatio;
        const inCommentSection = ratio >= HIDE_THRESHOLD;
        const outCommentSection = ratio < SHOW_THRESHOLD;
        const nextVisible = lastVisible ? !outCommentSection : inCommentSection;
        lastVisible = nextVisible;

        if (delayRef.current) {
          clearTimeout(delayRef.current);
          delayRef.current = null;
        }
        if (!nextVisible) {
          setCardVisible(false);
        } else {
          delayRef.current = setTimeout(() => {
            setCardVisible(true);
            delayRef.current = null;
          }, CARD_UP_DELAY_MS);
        }
      },
      { threshold: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5] }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (delayRef.current) clearTimeout(delayRef.current);
    };
  }, [commentBarrageEnabled]);

  const link = nextArticle ?? prevArticle;
  if (!link) return null;

  const label = nextArticle ? "下一篇" : "上一篇";

  return (
    <nav
      className={styles.floatWrap}
      aria-label="上下篇导航"
      data-visible={commentBarrageEnabled ? (cardVisible ? "true" : "false") : "true"}
    >
      <Link href={getArticleHref(link)} className={styles.floatCard}>
        <span className={styles.floatLabel}>{label}</span>
        <span className={styles.floatDivider} />
        <span className={styles.floatTitle}>{link.title}</span>
      </Link>
    </nav>
  );
}

export default PostPaginationFloat;
