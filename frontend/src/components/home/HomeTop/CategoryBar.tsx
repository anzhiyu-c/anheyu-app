"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaAnglesRight } from "react-icons/fa6";
import { useCategories } from "@/hooks/queries";
import { cn } from "@/lib/utils";
import styles from "./CategoryBar.module.css";

interface CategoryBarProps {
  /** 状态驱动模式：当前选中的分类名称 */
  selectedCategory?: string;
  /** 状态驱动模式：分类变化回调 */
  onCategoryChange?: (categoryName: string | null) => void;
}

export function CategoryBar({ selectedCategory: controlledCategory, onCategoryChange }: CategoryBarProps = {}) {
  const pathname = usePathname();
  const catalogBarRef = useRef<HTMLDivElement>(null);
  const [isScrolledToEnd, setIsScrolledToEnd] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const { data: categories = [] } = useCategories();

  // 是否为状态驱动模式
  const isControlled = controlledCategory !== undefined && onCategoryChange !== undefined;

  // 从路径中获取当前选中的分类名称（路由模式）
  const currentCategoryName = pathname?.startsWith("/categories/")
    ? decodeURIComponent(pathname.split("/")[2] || "")
    : null;

  // 根据模式确定选中的分类
  const activeCategoryName = isControlled ? controlledCategory : currentCategoryName;
  const selectedCategoryObj = categories.find(c => c.name === activeCategoryName);
  const selectedId = selectedCategoryObj?.id || null;
  const isHomePage = pathname === "/" || pathname === "";

  const checkScrollPosition = useCallback(() => {
    const el = catalogBarRef.current;
    if (!el) return;
    setIsScrolledToEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  const updateScrollVisibility = useCallback(() => {
    const el = catalogBarRef.current;
    if (!el) return;
    setShowScrollButton(el.scrollWidth > el.clientWidth);
    checkScrollPosition();
  }, [checkScrollPosition]);

  useEffect(() => {
    updateScrollVisibility();
    window.addEventListener("resize", updateScrollVisibility);
    return () => {
      window.removeEventListener("resize", updateScrollVisibility);
    };
  }, [updateScrollVisibility, categories]);

  const handleScrollNext = () => {
    const el = catalogBarRef.current;
    if (!el) return;
    if (isScrolledToEnd) {
      el.scrollTo({ left: 0, behavior: "smooth" });
    } else {
      el.scrollBy({ left: el.clientWidth, behavior: "smooth" });
    }
  };

  // 点击分类处理（状态驱动模式）
  const handleCategoryClick = (e: React.MouseEvent, categoryName: string | null) => {
    if (isControlled) {
      e.preventDefault();
      onCategoryChange(categoryName);
    }
  };

  return (
    <div className={styles.categoryBarContainer}>
      <div className={styles.categoryBar}>
        <div ref={catalogBarRef} className={styles.catalogBar} onScroll={checkScrollPosition}>
          <div className={styles.catalogList}>
            {/* 首页 */}
            <Link
              href="/"
              onClick={e => handleCategoryClick(e, null)}
              className={cn(styles.catalogListItem, isHomePage && !selectedId && styles.select)}
            >
              <span>首页</span>
            </Link>
            {/* 分类列表 */}
            {categories.map(category => (
              <Link
                key={category.id}
                href={`/categories/${category.slug || encodeURIComponent(category.name)}/`}
                prefetch={false}
                onClick={e => handleCategoryClick(e, category.name)}
                className={cn(styles.catalogListItem, selectedId === category.id && styles.select)}
              >
                <span>{category.name}</span>
              </Link>
            ))}
          </div>
        </div>
        {showScrollButton && (
          <button
            className={styles.categoryBarNext}
            onClick={handleScrollNext}
            aria-label={isScrolledToEnd ? "滚动到开始" : "滚动到更多"}
          >
            <FaAnglesRight className={cn(styles.scrollIcon, isScrolledToEnd && styles.isRotated)} aria-hidden="true" />
          </button>
        )}
        <Link href="/categories" prefetch={false} className={styles.catalogMore}>
          更多
        </Link>
      </div>
    </div>
  );
}
