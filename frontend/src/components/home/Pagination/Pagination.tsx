"use client";

import { useState, useMemo } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import styles from "./Pagination.module.css";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const [jumpPage, setJumpPage] = useState("");

  // 计算要显示的中间页码（不包含第1页和最后一页）
  const pageNumbers = useMemo(() => {
    const page = currentPage;
    const total = totalPages;
    const showCount = 5;
    const arr: number[] = [];

    if (total <= showCount + 2) {
      for (let i = 2; i < total; i++) {
        arr.push(i);
      }
      return arr;
    }

    let start = Math.max(2, page - Math.floor((showCount - 3) / 2));
    let end = Math.min(total - 1, start + showCount - 3);

    if (page < showCount - 1) {
      start = 2;
      end = start + showCount - 3;
    }

    if (page > total - (showCount - 2)) {
      end = total - 1;
      start = end - showCount + 3;
    }

    for (let i = start; i <= end; i++) {
      arr.push(i);
    }

    return arr;
  }, [currentPage, totalPages]);

  const showStartEllipsis = pageNumbers.length > 0 && pageNumbers[0] > 2;
  const showEndEllipsis = pageNumbers.length > 0 && pageNumbers[pageNumbers.length - 1] < totalPages - 1;

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages && newPage !== currentPage) {
      onPageChange(newPage);
    }
  };

  const goToPage = () => {
    const pageNum = parseInt(jumpPage, 10);
    if (!isNaN(pageNum)) {
      handlePageChange(pageNum);
    }
    setJumpPage("");
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      goToPage();
    }
  };

  if (totalPages <= 1) return null;

  return (
    <nav id="pagination" className={styles.paginationNav}>
      {/* 上一页 */}
      {currentPage > 1 && (
        <div className={cn(styles.extend, styles.prev)} onClick={() => handlePageChange(currentPage - 1)}>
          <Icon icon="fa6-solid:chevron-left" />
          <div className={styles.paginationTipsPrev}>上页</div>
        </div>
      )}

      {/* 页码区域 */}
      <div className={styles.pagination}>
        {/* 第1页 */}
        <div className={cn(styles.pageNumber, currentPage === 1 && styles.current)} onClick={() => handlePageChange(1)}>
          1
        </div>

        {/* 开始省略号 */}
        {showStartEllipsis && <span className={styles.space}>…</span>}

        {/* 中间页码 */}
        {pageNumbers.map(p => (
          <div
            key={p}
            className={cn(styles.pageNumber, currentPage === p && styles.current)}
            onClick={() => handlePageChange(p)}
          >
            {p}
          </div>
        ))}

        {/* 结束省略号 */}
        {showEndEllipsis && <span className={styles.space}>…</span>}

        {/* 最后一页 */}
        {totalPages > 1 && (
          <div
            className={cn(styles.pageNumber, currentPage === totalPages && styles.current)}
            onClick={() => handlePageChange(totalPages)}
          >
            {totalPages}
          </div>
        )}

        {/* 跳转页码组件 */}
        <div className={styles.toPageGroup}>
          <div className={styles.toPageExtend}>
            <Icon icon="fa6-solid:angles-right" />
          </div>
          <input
            className={styles.toPageText}
            type="text"
            inputMode="numeric"
            maxLength={3}
            value={jumpPage}
            onChange={e => setJumpPage(e.target.value.replace(/\D/g, ""))}
            onKeyDown={handleInputKeyDown}
            aria-label="跳转页码"
          />
          <div className={styles.toPageButton} onClick={goToPage}>
            <Icon icon="fa6-solid:angles-right" />
          </div>
        </div>
      </div>

      {/* 下一页 */}
      {currentPage < totalPages && (
        <div className={cn(styles.extend, styles.next)} onClick={() => handlePageChange(currentPage + 1)}>
          <div className={styles.paginationTipsNext}>下页</div>
          <Icon icon="fa6-solid:chevron-right" />
        </div>
      )}
    </nav>
  );
}
