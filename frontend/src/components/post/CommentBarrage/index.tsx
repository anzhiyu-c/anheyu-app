"use client";

import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useCommentsByPath } from "@/hooks/queries";
import { useSiteConfigStore } from "@/store/site-config-store";
import { useUiStore } from "@/store/ui-store";
import { addToast } from "@heroui/react";
import { gsap } from "gsap";
import md5 from "blueimp-md5";
import type { Comment } from "@/lib/api/comment";
import { sanitizeCommentHtml } from "../Comment/comment-utils";
import styles from "./CommentBarrage.module.css";

/** 首条弹幕展示前延迟（ms） */
const FIRST_BARrage_DELAY_MS = 1500;
/** 滚动稳定器：静默多久后认为稳定（ms） */
const STABILIZER_SETTLE_MS = 300;
/** 滚动稳定器：最长运行时间（ms） */
const STABILIZER_MAX_DURATION_MS = 3000;
/** 滚动到评论区时默认的顶部偏移（px） */
const SCROLL_HEADER_OFFSET_DEFAULT = 80;
/** 评论区进入视口超过此比例时隐藏弹幕 */
const COMMENT_SECTION_IO_HIDE_THRESHOLD = 0.2;
/** 评论区进入视口低于此比例时显示弹幕（滞后区间，避免边界抖动） */
const COMMENT_SECTION_IO_SHOW_THRESHOLD = 0.12;
/** 等待 #post-comment 出现的最大时间（ms） */
const OBSERVER_WAIT_FALLBACK_MS = 10_000;
/** 点击跳转评论区后等待目标出现的超时（ms） */
const SCROLL_TO_COMMENT_MO_TIMEOUT_MS = 5000;

function getCommentReplies(item: Comment): Comment[] {
  const list: Comment[] = [];
  if (item.content_html) {
    list.push(item);
  }
  if (item.children && item.children.length > 0) {
    for (const reply of item.children) {
      list.push(...getCommentReplies(reply));
    }
  }
  return list;
}

function flattenComments(commentTree: Comment[]): Comment[] {
  const flatList: Comment[] = [];
  for (const item of commentTree) {
    flatList.push(...getCommentReplies(item));
  }
  return flatList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function processCommentHtml(html: string): string {
  let processed = html;
  processed = processed.replace(/<pre[^>]*>[\s\S]*?<\/pre>/gi, "【代码】");
  processed = processed.replace(/<img(?![^>]*class=["'][^"']*tk-owo-emotion[^"']*["'])[^>]*>/gi, "【图片】");
  return processed;
}

function getAvatarSrc(comment: Comment, gravatarUrl: string, defaultGravatarType: string): string {
  if (comment.avatar_url) {
    const isAbsoluteUrl = /^https?:\/\//i.test(comment.avatar_url);
    if (isAbsoluteUrl) {
      return comment.avatar_url;
    }
    return `${gravatarUrl}${comment.avatar_url}`;
  }
  if (comment.is_anonymous) {
    return `${gravatarUrl}avatar/anonymous?d=mp&s=140&f=y`;
  }
  const isQQ = /^[1-9]\d{4,10}$/.test(comment.nickname?.trim() || "");
  if (isQQ) {
    const qqEmailMd5 = md5(`${comment.nickname?.trim()}@qq.com`).toLowerCase();
    if (comment.email_md5?.toLowerCase() === qqEmailMd5) {
      return `https://thirdqq.qlogo.cn/g?b=sdk&nk=${comment.nickname!.trim()}&s=140`;
    }
  }
  return `${gravatarUrl}avatar/${comment.email_md5}?d=${defaultGravatarType}`;
}

interface CommentBarrageProps {
  gravatarUrl: string;
  defaultGravatarType: string;
  masterTag?: string;
  adminAvatarUrl?: string;
  maxBarrage?: number;
  barrageTime?: number;
  observeTargetId?: string;
}

export function CommentBarrage({
  gravatarUrl,
  defaultGravatarType,
  masterTag = "博主",
  maxBarrage = 1,
  barrageTime = 5000,
  observeTargetId = "post-comment",
}: CommentBarrageProps) {
  const pathname = usePathname();
  const siteConfig = useSiteConfigStore(state => state.siteConfig);
  const toggleCommentBarrage = useUiStore(state => state.toggleCommentBarrage);
  const commentConfig = siteConfig?.comment;
  const pageSize = Number(commentConfig?.page_size ?? 10) || 10;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoverOnBarrage, setHoverOnBarrage] = useState(false);
  const hoverOnBarrageRef = useRef(false);
  useEffect(() => {
    hoverOnBarrageRef.current = hoverOnBarrage;
  }, [hoverOnBarrage]);
  const [displayedBarrages, setDisplayedBarrages] = useState<Comment[]>([]);
  const commentIndexRef = useRef(0);
  const isFirstBarrageRef = useRef(true);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const barrageHiddenRef = useRef(false);

  const { data } = useCommentsByPath({ target_path: pathname || "", pageSize }, { enabled: Boolean(pathname) });

  const barrageList = useMemo(() => {
    const raw = data?.pages.flatMap(page => page.list) ?? [];
    return flattenComments(raw);
  }, [data]);

  const [exitingItem, setExitingItem] = useState<Comment | null>(null);
  const itemRef = useRef<HTMLDivElement | null>(null);
  const exitingRef = useRef<HTMLDivElement | null>(null);

  const popCommentBarrage = useCallback(() => {
    if (barrageList.length === 0) return;
    const newComment = barrageList[commentIndexRef.current];
    commentIndexRef.current = (commentIndexRef.current + 1) % barrageList.length;
    setDisplayedBarrages(prev => {
      const next = [...prev, newComment];
      if (next.length > maxBarrage) {
        const toRemove = next[0];
        queueMicrotask(() => setExitingItem(toRemove));
        return next.slice(1);
      }
      return next;
    });
  }, [barrageList, maxBarrage]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (barrageList.length > 0) {
      commentIndexRef.current = 0;
      isFirstBarrageRef.current = true;
      queueMicrotask(() => setDisplayedBarrages([]));

      timeoutRef.current = window.setTimeout(() => {
        if (!hoverOnBarrageRef.current) {
          popCommentBarrage();
        }
        intervalRef.current = window.setInterval(() => {
          if (!hoverOnBarrageRef.current) {
            popCommentBarrage();
          }
        }, barrageTime);
      }, FIRST_BARrage_DELAY_MS);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [barrageList, barrageTime, popCommentBarrage]);

  const scrollToComment = useCallback(
    (commentId?: string | number) => {
      const targetId = commentId ? `comment-${commentId}` : observeTargetId;

      const getHeaderOffset = (el?: HTMLElement | null) => {
        let offset = SCROLL_HEADER_OFFSET_DEFAULT;
        const candidate =
          el ||
          (document.getElementById(targetId) as HTMLElement | null) ||
          (document.getElementById(observeTargetId) as HTMLElement | null);
        if (candidate) {
          const st = window.getComputedStyle(candidate);
          const smt = parseFloat((st as CSSStyleDeclaration & { scrollMarginTop?: string }).scrollMarginTop || "0");
          if (!Number.isNaN(smt) && smt > 0) {
            offset = Math.max(offset, smt);
          }
        }
        return offset;
      };

      const getTargetElement = () =>
        (document.getElementById(targetId) as HTMLElement | null) ||
        (document.getElementById(observeTargetId) as HTMLElement | null);

      const computeTargetTop = () => {
        const el = getTargetElement();
        if (!el) return window.scrollY;
        const rect = el.getBoundingClientRect();
        return rect.top + window.pageYOffset - getHeaderOffset(el);
      };

      const scrollToTop = (top: number, smooth = true) => {
        window.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
      };

      const startStabilizer = () => {
        const contentRoot = (document.querySelector("[data-post-content='true']") as HTMLElement) || document.body;
        const commentRoot = (document.getElementById(observeTargetId) as HTMLElement) || document.body;

        let settledTimer: number | null = null;
        const settleQuietMs = STABILIZER_SETTLE_MS;
        const maxDurationMs = STABILIZER_MAX_DURATION_MS;
        const startTime = Date.now();

        const reAlign = () => scrollToTop(computeTargetTop(), false);

        const imgs = [
          ...Array.from(contentRoot.querySelectorAll("img")),
          ...Array.from(commentRoot.querySelectorAll("img")),
        ] as HTMLImageElement[];
        imgs.forEach(img => {
          if (!img.complete) {
            const handler = () => reAlign();
            img.addEventListener("load", handler, { once: true });
            img.addEventListener("error", handler, { once: true });
          }
        });

        let resizeObserver: ResizeObserver | null = null;
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => {
            reAlign();
            if (settledTimer) window.clearTimeout(settledTimer);
            settledTimer = window.setTimeout(() => {
              if (Date.now() - startTime >= maxDurationMs) {
                cleanup();
                return;
              }
              cleanup();
            }, settleQuietMs);
          });
          resizeObserver.observe(contentRoot);
          if (commentRoot !== contentRoot) resizeObserver.observe(commentRoot);
        }

        const hardStopTimer = window.setTimeout(cleanup, maxDurationMs + STABILIZER_SETTLE_MS);

        function cleanup() {
          resizeObserver?.disconnect();
          if (settledTimer) window.clearTimeout(settledTimer);
          window.clearTimeout(hardStopTimer);
          reAlign();
        }
      };

      let targetElement = getTargetElement();
      if (!targetElement) {
        const container = document.getElementById(observeTargetId);
        if (container) {
          container.scrollIntoView({ behavior: "smooth", block: "start" });
          const mo = new MutationObserver(() => {
            targetElement = getTargetElement();
            if (targetElement) {
              mo.disconnect();
              scrollToTop(computeTargetTop(), true);
              startStabilizer();
            }
          });
          mo.observe(container, { childList: true, subtree: true });
          window.setTimeout(() => mo.disconnect(), SCROLL_TO_COMMENT_MO_TIMEOUT_MS);
        }
        return;
      }

      scrollToTop(computeTargetTop(), true);
      startStabilizer();
    },
    [observeTargetId]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent, commentId?: string | number) => {
      e.preventDefault();
      scrollToComment(commentId);
    },
    [scrollToComment]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      const entry = entries[0];
      if (!entry || !containerRef.current || document.body.clientWidth <= 768) return;
      const ratio = entry.intersectionRatio;
      const shouldHide = ratio >= COMMENT_SECTION_IO_HIDE_THRESHOLD;
      const shouldShow = ratio < COMMENT_SECTION_IO_SHOW_THRESHOLD;
      const nextHidden = barrageHiddenRef.current ? !shouldShow : shouldHide;
      if (nextHidden !== barrageHiddenRef.current) {
        barrageHiddenRef.current = nextHidden;
        requestAnimationFrame(() => {
          containerRef.current?.setAttribute("data-hidden", nextHidden ? "true" : "false");
        });
      }
    };

    const attachObserver = (observeTarget: HTMLElement) => {
      observerRef.current?.disconnect();
      observerRef.current = new IntersectionObserver(observerCallback, {
        threshold: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5],
      });
      observerRef.current.observe(observeTarget);
    };

    let observeTarget = document.getElementById(observeTargetId);
    if (observeTarget) {
      attachObserver(observeTarget);
      return () => observerRef.current?.disconnect();
    }

    // 评论区可能晚挂载（如懒渲染），等待 #post-comment 出现后再观察
    const mo = new MutationObserver(() => {
      observeTarget = document.getElementById(observeTargetId);
      if (observeTarget) {
        mo.disconnect();
        attachObserver(observeTarget);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    const fallback = window.setTimeout(() => mo.disconnect(), OBSERVER_WAIT_FALLBACK_MS);

    return () => {
      mo.disconnect();
      window.clearTimeout(fallback);
      observerRef.current?.disconnect();
    };
  }, [observeTargetId, pathname]);

  const customEase = "cubic-bezier(0.42, 0, 0.3, 1.11)";

  useLayoutEffect(() => {
    const item = displayedBarrages[displayedBarrages.length - 1];
    if (!item || !itemRef.current) return;
    const el = itemRef.current;
    if (isFirstBarrageRef.current) {
      isFirstBarrageRef.current = false;
      gsap.fromTo(
        el,
        { opacity: 0, y: 50, scale: 0.8, rotation: -5 },
        { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 0.6, ease: "back.out(1.7)" }
      );
    } else {
      gsap.fromTo(
        el,
        { opacity: 0, y: 30, scale: 1, rotation: 0 },
        { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 0.4, ease: customEase }
      );
    }
  }, [displayedBarrages]);

  useLayoutEffect(() => {
    if (!exitingItem || !exitingRef.current) return;
    const el = exitingRef.current;
    el.style.position = "absolute";
    el.style.width = `${el.offsetWidth}px`;
    gsap.to(el, {
      opacity: 0,
      y: 30,
      scale: 1,
      duration: 0.4,
      ease: customEase,
      onComplete: () => setExitingItem(null),
    });
  }, [exitingItem]);

  if (barrageList.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={styles.commentBarrage}
      data-hidden="false"
      onMouseEnter={() => setHoverOnBarrage(true)}
      onMouseLeave={() => setHoverOnBarrage(false)}
    >
      {displayedBarrages.map((item, i) => (
        <div
          key={item.id}
          ref={i === displayedBarrages.length - 1 ? itemRef : undefined}
          className={styles.commentBarrageItem}
        >
          <button
            type="button"
            className={styles.barrageClose}
            aria-label="关闭热评"
            onClick={e => {
              e.stopPropagation();
              toggleCommentBarrage(false);
              addToast({ title: "已关闭热评", color: "default", timeout: 2000 });
            }}
          />
          <div className={styles.barrageHead}>
            <span className={`${styles.barrageTitle} ${item.is_admin_comment ? styles.barrageBloggerTitle : ""}`}>
              {item.is_admin_comment ? masterTag : "热评"}
            </span>
            <div className={styles.barrageNick}>{item.nickname}</div>
            {/* eslint-disable-next-line @next/next/no-img-element -- 头像来自 Gravatar/QQ 等外部源，使用 img */}
            <img className={styles.barrageAvatar} src={getAvatarSrc(item, gravatarUrl, defaultGravatarType)} alt="" />
          </div>
          <a
            className={styles.barrageContent}
            href={`#comment-${item.id}`}
            onClick={e => handleClick(e, item.id)}
            dangerouslySetInnerHTML={{
              __html: sanitizeCommentHtml(processCommentHtml(item.content_html)),
            }}
          />
        </div>
      ))}
      {exitingItem && (
        <div key={`exiting-${exitingItem.id}`} ref={exitingRef} className={styles.commentBarrageItem}>
          <button
            type="button"
            className={styles.barrageClose}
            aria-label="关闭热评"
            onClick={e => {
              e.stopPropagation();
              toggleCommentBarrage(false);
              addToast({ title: "已关闭热评", color: "default", timeout: 2000 });
            }}
          />
          <div className={styles.barrageHead}>
            <span
              className={`${styles.barrageTitle} ${exitingItem.is_admin_comment ? styles.barrageBloggerTitle : ""}`}
            >
              {exitingItem.is_admin_comment ? masterTag : "热评"}
            </span>
            <div className={styles.barrageNick}>{exitingItem.nickname}</div>
            {/* eslint-disable-next-line @next/next/no-img-element -- 头像来自 Gravatar/QQ 等外部源 */}
            <img
              className={styles.barrageAvatar}
              src={getAvatarSrc(exitingItem, gravatarUrl, defaultGravatarType)}
              alt=""
            />
          </div>
          <a
            className={styles.barrageContent}
            href={`#comment-${exitingItem.id}`}
            onClick={e => handleClick(e, exitingItem.id)}
            dangerouslySetInnerHTML={{
              __html: sanitizeCommentHtml(processCommentHtml(exitingItem.content_html)),
            }}
          />
        </div>
      )}
    </div>
  );
}
