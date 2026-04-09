/**
 * 滚动相关效果组件
 * 包含 ScrollIndicator
 */
"use client";

import { motion, useScroll } from "framer-motion";

interface ScrollIndicatorProps {
  /** 额外的 className */
  className?: string;
}

/**
 * 滚动进度指示器
 * 显示在页面顶部的滚动进度条
 */
export function ScrollIndicator({ className = "" }: ScrollIndicatorProps) {
  const { scrollYProgress } = useScroll();

  return (
    <motion.div
      className={`fixed top-0 left-0 right-0 h-1 bg-primary z-50 origin-left ${className}`}
      style={{ scaleX: scrollYProgress }}
    />
  );
}

export default ScrollIndicator;
