"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import styles from "./doc.module.css";

interface TocItem {
  id: string;
  uniqueId: string;
  text: string;
  level: number;
  index: number;
}

interface DocTocProps {
  contentHtml: string;
}

export function DocToc({ contentHtml }: DocTocProps) {
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [activeTocId, setActiveTocId] = useState<string | null>(null);
  const activeTocIdRef = useRef<string | null>(null);
  const tocRef = useRef<HTMLDivElement>(null);
  const headingElementsRef = useRef<HTMLElement[]>([]);
  const isClickScrollingRef = useRef(false);
  const scrollTimerRef = useRef<number | null>(null);
  const hashTimerRef = useRef<number | null>(null);
  const lastActiveIdRef = useRef<string | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const parseHeadings = useCallback(() => {
    if (!contentHtml || typeof document === "undefined") {
      setTocItems([]);
      return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(contentHtml, "text/html");
    const headings = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const items: TocItem[] = [];
    const idCountMap = new Map<string, number>();

    let idx = 0;
    headings.forEach(heading => {
      const originalId =
        heading.id || heading.textContent?.trim().replace(/\s+/g, "-").toLowerCase() || `heading-${idx}`;
      const text = heading.textContent?.trim() || "";

      if (text) {
        const count = idCountMap.get(originalId) || 0;
        idCountMap.set(originalId, count + 1);
        const uniqueId = count === 0 ? originalId : `${originalId}-${count}`;

        items.push({
          id: originalId,
          uniqueId,
          text,
          level: parseInt(heading.tagName.substring(1), 10),
          index: idx,
        });
        idx++;
      }
    });

    setTocItems(items);
  }, [contentHtml]);

  const initHeadingElements = useCallback(() => {
    const headingSelector = "h1, h2, h3, h4, h5, h6";
    const contentEl = document.querySelector("#doc-article-container") || document.querySelector(".post-content");
    const allHeadings = Array.from((contentEl || document).querySelectorAll(headingSelector));
    const elements = allHeadings.filter(el => el.textContent?.trim()) as HTMLElement[];

    elements.forEach((el, index) => {
      if (!el.id) {
        el.id = el.textContent?.trim().replace(/\s+/g, "-").toLowerCase() || `heading-${index}`;
      }
    });

    headingElementsRef.current = elements;
  }, []);

  const tocItemsRef = useRef(tocItems);
  tocItemsRef.current = tocItems;

  const updateActiveHeading = useCallback(() => {
    const elements = headingElementsRef.current;
    const items = tocItemsRef.current;
    if (elements.length === 0) return;

    let activeIndex = -1;
    const headerOffset = 100;

    for (let i = 0; i < elements.length; i++) {
      const rect = elements[i].getBoundingClientRect();
      if (rect.top <= headerOffset) {
        activeIndex = i;
      } else {
        break;
      }
    }

    if (activeIndex === -1 && elements.length > 0) activeIndex = 0;

    if (activeIndex >= 0 && items[activeIndex]) {
      const item = items[activeIndex];
      if (activeTocIdRef.current !== item.uniqueId) {
        activeTocIdRef.current = item.uniqueId;
        setActiveTocId(item.uniqueId);

        if (item.id !== lastActiveIdRef.current) {
          lastActiveIdRef.current = item.id;
          if (hashTimerRef.current) clearTimeout(hashTimerRef.current);
          hashTimerRef.current = window.setTimeout(() => {
            history.replaceState(history.state, "", `#${item.id}`);
          }, 500);
        }
      }
    }
  }, []);

  useEffect(() => {
    parseHeadings();
    const timer = setTimeout(initHeadingElements, 300);
    return () => clearTimeout(timer);
  }, [contentHtml, parseHeadings, initHeadingElements]);

  useEffect(() => {
    const onScroll = () => {
      if (rafIdRef.current !== null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (!isClickScrollingRef.current) updateActiveHeading();
      });
    };

    const onScrollEnd = () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = window.setTimeout(() => {
        isClickScrollingRef.current = false;
      }, 150);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScrollEnd, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScrollEnd);
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      if (hashTimerRef.current) clearTimeout(hashTimerRef.current);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, [updateActiveHeading]);

  useEffect(() => {
    if (!activeTocId || !tocRef.current) return;
    const container = tocRef.current;
    const activeLink = container.querySelector(`a[data-unique-id="${activeTocId}"]`) as HTMLElement | null;
    if (!activeLink) return;

    const linkTop = activeLink.offsetTop;
    const linkBottom = linkTop + activeLink.offsetHeight;
    const visibleTop = container.scrollTop;
    const visibleBottom = visibleTop + container.clientHeight;
    const padding = 40;

    if (linkTop < visibleTop + padding) {
      container.scrollTo({ top: Math.max(linkTop - padding, 0), behavior: "smooth" });
    } else if (linkBottom > visibleBottom - padding) {
      container.scrollTo({ top: linkBottom - container.clientHeight + padding, behavior: "smooth" });
    }
  }, [activeTocId]);

  const scrollToHeading = useCallback((e: React.MouseEvent, item: TocItem) => {
    e.preventDefault();
    activeTocIdRef.current = item.uniqueId;
    setActiveTocId(item.uniqueId);
    lastActiveIdRef.current = item.id;
    history.replaceState(history.state, "", `#${item.id}`);
    isClickScrollingRef.current = true;

    const el = headingElementsRef.current[item.index];
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  const levelClass = useMemo(
    () =>
      ({
        3: styles.tocLevel3,
        4: styles.tocLevel4,
        5: styles.tocLevel5,
        6: styles.tocLevel6,
      }) as Record<number, string>,
    []
  );

  return (
    <div className={styles.docToc}>
      <div className={styles.tocHeader}>
        <span className={styles.tocTitle}>On this page</span>
      </div>

      <div className={styles.tocWrapper}>
        <div ref={tocRef} className={styles.tocContent}>
          {tocItems.length > 0 ? (
            <div className={styles.tocList}>
              {tocItems.map(item => (
                <a
                  key={item.uniqueId}
                  data-unique-id={item.uniqueId}
                  href={`#${item.id}`}
                  className={cn(
                    styles.tocLink,
                    levelClass[item.level],
                    activeTocId === item.uniqueId && styles.tocLinkActive
                  )}
                  onClick={e => scrollToHeading(e, item)}
                >
                  {item.text}
                </a>
              ))}
            </div>
          ) : (
            <div className={styles.tocEmpty}>暂无目录</div>
          )}
        </div>
      </div>
    </div>
  );
}
