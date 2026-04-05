"use client";

import { useScrollForHeader } from "@/store";

interface HeaderState {
  isHeaderTransparent: boolean;
  isScrolled: boolean;
  scrollPercent: number;
  isFooterVisible: boolean;
}

/**
 * Header 专用滚动状态 Hook
 * 使用全局 scrollStore，避免重复监听滚动事件
 *
 * @deprecated 推荐直接使用 useScrollForHeader() from '@/store'
 */
export function useHeader(): HeaderState {
  return useScrollForHeader();
}
