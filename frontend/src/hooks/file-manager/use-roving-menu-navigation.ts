"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseRovingMenuNavigationOptions {
  /** 可键盘导航的条目数（不含分隔符等） */
  length: number;
  onClose: () => void;
  /** 扁平游标 0..length-1 对应到 ref 数组中的下标（右键菜单为 items 下标） */
  flatToRefIndex: (flat: number) => number;
  /** Enter / Space：提交当前扁平游标 */
  onCommitFlat: (flat: number) => void;
  /** Escape 是否 stopPropagation，与全局浮层约定保持一致 */
  escapeStopPropagation?: boolean;
}

/**
 * 纵向菜单的漫游焦点：方向键、Home/End、Enter/Space、Escape（document 捕获），以及双 rAF 聚焦减少首帧尺寸为 0 的问题。
 */
export function useRovingMenuNavigation({
  length: n,
  onClose,
  flatToRefIndex,
  onCommitFlat,
  escapeStopPropagation = true,
}: UseRovingMenuNavigationOptions) {
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const [navCursor, setNavCursor] = useState(0);
  const safe = n === 0 ? 0 : Math.min(navCursor, n - 1);
  const focusedDomIndex = n === 0 ? -1 : flatToRefIndex(safe);

  useEffect(() => {
    if (focusedDomIndex < 0) return;
    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        itemRefs.current[focusedDomIndex]?.focus();
      });
    });
    return () => {
      cancelAnimationFrame(outerRaf);
      cancelAnimationFrame(innerRaf);
    };
  }, [focusedDomIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (escapeStopPropagation) e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose, escapeStopPropagation]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (n === 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setNavCursor(c => {
          const cur = Math.min(c, n - 1);
          return (cur + 1) % n;
        });
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setNavCursor(c => {
          const cur = Math.min(c, n - 1);
          return (cur - 1 + n) % n;
        });
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        setNavCursor(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        setNavCursor(n - 1);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onCommitFlat(safe);
      }
    },
    [n, onCommitFlat, safe]
  );

  const setNavToFlat = useCallback((flat: number) => {
    if (flat >= 0 && flat < n) setNavCursor(flat);
  }, [n]);

  return {
    itemRefs,
    focusedDomIndex,
    handleKeyDown,
    setNavToFlat,
  };
}
