/**
 * 动画效果组件
 * 包含 FloatingElement, AnimatedCounter, FadeInView, GradientBorder, PulseRings
 */
"use client";

import { useRef, useState, useEffect, memo } from "react";
import { motion, useScroll } from "framer-motion";
import { usePrefersReducedMotion } from "./hooks";

// ============================
// FloatingElement - 悬浮元素
// ============================

interface FloatingElementProps {
  children: React.ReactNode;
  /** 悬浮距离 */
  distance?: number;
  /** 额外的 className */
  className?: string;
}

/**
 * 悬浮元素
 * 优化版：使用 CSS 动画
 */
export const FloatingElement = memo(function FloatingElement({
  children,
  distance = 20,
  className = "",
}: FloatingElementProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={`animate-float ${className}`}
      style={
        {
          "--float-distance": `${distance}px`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
});

// ============================
// AnimatedCounter - 数字计数动画
// ============================

interface AnimatedCounterProps {
  /** 目标数值 */
  value: number;
  /** 后缀 */
  suffix?: string;
  /** 额外的 className */
  className?: string;
}

/**
 * 数字计数动画
 * 随滚动显示数字递增效果
 */
export function AnimatedCounter({ value, suffix = "", className = "" }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [displayValue, setDisplayValue] = useState(0);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.9", "start 0.6"],
  });

  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (progress: number) => {
      setDisplayValue(Math.round(progress * value));
    });
    return unsubscribe;
  }, [scrollYProgress, value]);

  return (
    <span ref={ref} className={`relative ${className}`}>
      {displayValue.toLocaleString()}
      {suffix}
    </span>
  );
}

// ============================
// FadeInView - 淡入动画
// ============================

interface FadeInViewProps {
  children: React.ReactNode;
  /** 额外的 className */
  className?: string;
  /** 延迟时间 */
  delay?: number;
}

/**
 * 淡入动画组件
 * 进入视口时触发淡入效果
 */
export function FadeInView({ children, className = "", delay = 0 }: FadeInViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay, ease: "easeOut" }}
      viewport={{ once: true, margin: "-50px" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================
// GradientBorder - 渐变边框
// ============================

interface GradientBorderProps {
  children: React.ReactNode;
  /** 额外的 className */
  className?: string;
}

/**
 * 渐变边框动画
 * 动态旋转的渐变边框效果
 */
export function GradientBorder({ children, className = "" }: GradientBorderProps) {
  return (
    <div className={`relative p-px rounded-2xl overflow-hidden ${className}`}>
      <motion.div
        className="absolute inset-0"
        style={{
          background: "conic-gradient(from 0deg, var(--primary), var(--green), var(--primary))",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />
      <div className="relative bg-card rounded-2xl">{children}</div>
    </div>
  );
}

// ============================
// PulseRings - 脉冲环效果
// ============================

interface PulseRingsProps {
  /** 额外的 className */
  className?: string;
}

/**
 * 脉冲环效果
 * 多层扩散的脉冲动画
 */
export function PulseRings({ className = "" }: PulseRingsProps) {
  return (
    <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${className}`}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute border rounded-full border-primary/30"
          style={{ width: 200 + i * 100, height: 200 + i * 100 }}
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            delay: i * 0.5,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}
