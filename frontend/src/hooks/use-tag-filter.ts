/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-02-07 11:24:12
 * @LastEditTime: 2026-02-07 11:38:36
 * @LastEditors: 安知鱼
 */
"use client";

import { createContext, useContext } from "react";

interface TagFilterContextValue {
  /** 当前选中的标签名称 */
  selectedTag: string;
  /** 切换标签的回调函数 */
  onTagChange: (tagName: string) => void;
}

export const TagFilterContext = createContext<TagFilterContextValue | null>(null);

/**
 * 获取标签筛选上下文
 * 只在标签详情页内使用时返回值，其他页面返回 null
 */
export function useTagFilter() {
  return useContext(TagFilterContext);
}
