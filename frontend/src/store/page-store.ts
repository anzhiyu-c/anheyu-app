/**
 * 页面状态管理
 * 用于存储当前页面的标题等信息
 */
import { create } from "zustand";

interface PageState {
  // 当前页面标题（例如文章标题）
  pageTitle: string | null;
  // 设置页面标题
  setPageTitle: (title: string | null) => void;
  // 清除页面标题
  clearPageTitle: () => void;
}

export const usePageStore = create<PageState>(set => ({
  pageTitle: null,
  setPageTitle: title => set({ pageTitle: title }),
  clearPageTitle: () => set({ pageTitle: null }),
}));
