/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-02-01 14:41:22
 * @LastEditTime: 2026-02-06 10:56:47
 * @LastEditors: 安知鱼
 */
"use client";

import { useEffect, useRef } from "react";

/**
 * 初始加载动画控制器
 * 初始加载动画的 HTML/CSS 在 layout.tsx 中内联
 * 这个组件只负责在 React hydration 完成后隐藏它
 *
 * 注意：初始加载动画只显示一次，之后永久隐藏
 * 路由切换的加载动画由其他组件处理
 */
export function GlobalLoading() {
  const hasHiddenRef = useRef(false);

  useEffect(() => {
    // 只执行一次：React hydration 完成后立即隐藏初始加载动画
    if (!hasHiddenRef.current) {
      hasHiddenRef.current = true;
      // 短暂延迟确保页面渲染
      const timer = setTimeout(() => {
        document.documentElement.setAttribute("data-loaded", "true");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  return null;
}
