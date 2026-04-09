/**
 * 滚动状态初始化器
 * 在应用启动时初始化全局滚动监听
 * 必须在客户端组件中使用
 */
"use client";

import { useEffect } from "react";
import { useScrollStore } from "@/store";

export function ScrollInitializer() {
  const initialize = useScrollStore(state => state.initialize);

  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, [initialize]);

  return null;
}

export default ScrollInitializer;
