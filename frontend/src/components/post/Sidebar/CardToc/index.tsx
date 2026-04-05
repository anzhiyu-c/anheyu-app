/**
 * 文章目录组件
 * 显示文章标题目录，支持滚动监听和点击跳转
 * 使用全局 scrollStore 避免重复滚动监听
 */
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { FaBars } from "react-icons/fa6";
import { useScrollY } from "@/store";
import styles from "./CardToc.module.css";

interface TocItem {
  id: string;
  uniqueId: string;
  text: string;
  level: number;
  index: number;
}

interface CardTocProps {
  contentHtml: string;
  collapseMode?: boolean;
}

const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6";
const POST_CONTENT_SELECTOR = '[data-post-content="true"]';

function getPostContentHeadings(): HTMLElement[] {
  if (typeof window === "undefined") return [];

  const postContent = document.querySelector(POST_CONTENT_SELECTOR);
  if (!postContent) return [];

  return Array.from(postContent.querySelectorAll(HEADING_SELECTOR)).filter(
    (heading): heading is HTMLElement => heading instanceof HTMLElement
  );
}

function buildTocItems(headings: HTMLElement[]): TocItem[] {
  const idCountMap: Record<string, number> = {};
  const items: TocItem[] = [];

  headings.forEach((heading, index) => {
    const headingId = heading.id?.trim();
    let baseId =
      headingId || heading.textContent?.trim().replace(/\s+/g, "-").toLowerCase() || `heading-${index}`;

    // 处理重复 ID，避免 React key 和激活态冲突
    if (idCountMap[baseId] !== undefined) {
      idCountMap[baseId]++;
      baseId = `${baseId}-${idCountMap[baseId]}`;
    } else {
      idCountMap[baseId] = 0;
    }

    items.push({
      id: headingId || baseId,
      uniqueId: baseId,
      text: heading.textContent?.trim() || "",
      level: parseInt(heading.tagName.charAt(1), 10),
      index,
    });
  });

  return items;
}

/**
 * 解析 HTML 提取标题
 * 仅在客户端调用（DOMParser 是浏览器 API）
 */
function parseTocItems(contentHtml: string): TocItem[] {
  // SSR 环境下返回空数组
  if (typeof window === "undefined" || !contentHtml) return [];

  // 优先使用真实渲染 DOM，确保目录项与页面中的 heading 一一对应
  const domHeadings = getPostContentHeadings();
  if (domHeadings.length > 0) {
    return buildTocItems(domHeadings);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(contentHtml, "text/html");
  const headings = Array.from(doc.querySelectorAll(HEADING_SELECTOR)).filter(
    (heading): heading is HTMLElement => heading instanceof HTMLElement
  );

  return buildTocItems(headings);
}

function getHeadingElement(item: TocItem, headings: HTMLElement[]): HTMLElement | null {
  // 优先按顺序索引定位，避免特殊字符/重复 id 导致命中错误元素
  if (item.index >= 0 && item.index < headings.length) {
    return headings[item.index];
  }

  if (!item.id) return null;
  const element = document.getElementById(item.id);
  return element instanceof HTMLElement ? element : null;
}

/**
 * 计算当前激活的标题 ID
 * 基于滚动位置和标题元素位置
 */
function computeActiveId(tocItems: TocItem[]): string {
  if (tocItems.length === 0) return "";

  const headerOffset = 80;
  // 使用 window.scrollY 与 top 计算保持一致，避免 store 节流导致 scrollY 滞后时误激活下方标题
  const currentScrollY = window.scrollY;
  const headings = getPostContentHeadings();
  let currentId = "";

  for (const item of tocItems) {
    const element = getHeadingElement(item, headings);
    if (element) {
      const top = element.getBoundingClientRect().top + window.scrollY - headerOffset;
      if (currentScrollY >= top - 10) {
        currentId = item.uniqueId;
      }
    }
  }

  return currentId;
}

export function CardToc({ contentHtml, collapseMode = false }: CardTocProps) {
  const [activeId, setActiveId] = useState<string>("");
  const [isScrolling, setIsScrolling] = useState(false);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const tocContainerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 使用全局滚动状态
  const scrollY = useScrollY();

  // 解析 HTML 提取标题（仅在客户端执行，避免 SSR 时 DOMParser 不可用）
  useEffect(() => {
    const updateTocItems = () => {
      const items = parseTocItems(contentHtml);
      setTocItems(items);
    };

    updateTocItems();
    const rafId = window.requestAnimationFrame(updateTocItems);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [contentHtml]);

  // 滚动监听，高亮当前标题
  // 这里需要在 scrollY 变化时同步 activeId 状态，是合理的外部同步模式
  useEffect(() => {
    if (tocItems.length === 0 || isScrolling) return;

    const newActiveId = computeActiveId(tocItems);
    if (newActiveId && newActiveId !== activeId) {
      setActiveId(newActiveId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 响应外部状态 scrollY 变化是合理的
  }, [tocItems, scrollY, isScrolling]);

  // 指示器 ref
  const indicatorRef = useRef<HTMLDivElement>(null);

  // 更新指示器位置
  const updateIndicator = useCallback(() => {
    if (!tocContainerRef.current || !indicatorRef.current) return;

    const activeElement = tocContainerRef.current.querySelector(`[data-id="${activeId}"]`) as HTMLElement;
    if (activeElement) {
      const indicatorHeight = activeElement.offsetHeight / 2;
      const topOffset = activeElement.offsetTop + (activeElement.offsetHeight - indicatorHeight) / 2;
      indicatorRef.current.style.top = `${topOffset}px`;
      indicatorRef.current.style.height = `${indicatorHeight}px`;
      indicatorRef.current.style.opacity = "1";
    } else {
      indicatorRef.current.style.opacity = "0";
    }
  }, [activeId]);

  // 自动滚动目录到激活项并更新指示器
  useEffect(() => {
    if (!activeId || !tocContainerRef.current) return;

    const activeElement = tocContainerRef.current.querySelector(`[data-id="${activeId}"]`);
    if (activeElement) {
      activeElement.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }

    // 更新指示器位置
    updateIndicator();
  }, [activeId, updateIndicator]);

  // 点击跳转
  const handleClick = useCallback((item: TocItem) => {
    const headings = getPostContentHeadings();
    const element = getHeadingElement(item, headings);
    if (element) {
      // 标记正在滚动，暂停滚动监听
      setIsScrolling(true);
      setActiveId(item.uniqueId);

      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      const maxScrollTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const targetTop = Math.min(Math.max(0, elementPosition - headerOffset), maxScrollTop);

      window.scrollTo({
        top: targetTop,
        behavior: "smooth",
      });

      // 清除之前的定时器
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // 延迟恢复滚动监听
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 1000);
    }
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // 折叠模式：计算可见项
  const visibleTocItems = useMemo(() => {
    if (!collapseMode || tocItems.length === 0) return tocItems;

    const activeIndex = tocItems.findIndex(item => item.uniqueId === activeId);
    if (activeIndex === -1) return tocItems;

    const activeItem = tocItems[activeIndex];
    const minLevel = Math.min(...tocItems.map(item => item.level));

    return tocItems.filter((item, index) => {
      // 顶级标题始终显示
      if (item.level === minLevel) return true;
      // 激活项始终显示
      if (item.uniqueId === activeId) return true;
      // 激活项的父级显示
      if (index < activeIndex && item.level < activeItem.level) return true;
      // 激活项的直接子项显示
      if (index > activeIndex && index <= activeIndex + 3 && item.level > activeItem.level) return true;
      return false;
    });
  }, [tocItems, activeId, collapseMode]);

  if (tocItems.length === 0) {
    return null;
  }

  return (
    <div className={styles.cardToc}>
      <div className={styles.cardTitle}>
        <FaBars aria-hidden="true" />
        <span>目录</span>
        <span className={styles.count}>{tocItems.length}</span>
      </div>
      <div ref={tocContainerRef} className={styles.tocContainer}>
        <div className={styles.tocList}>
          {visibleTocItems.map(item => (
            <div
              key={item.uniqueId}
              data-id={item.uniqueId}
              data-level={item.level}
              className={`${styles.tocItem} ${item.uniqueId === activeId ? styles.active : ""}`}
              onClick={() => handleClick(item)}
            >
              <span className={styles.tocText}>{item.text}</span>
            </div>
          ))}
          {/* 激活指示器 */}
          <div ref={indicatorRef} className={styles.indicator} />
        </div>
      </div>
    </div>
  );
}

export default CardToc;
