/**
 * 发光效果组件
 * 包含 GlowingOrb 和 MouseFollowGlow
 */
"use client";

import { memo, useState, useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { usePrefersReducedMotion } from "./hooks";

// ============================
// GlowingOrb - 发光光环
// ============================

interface GlowingOrbProps {
  /** 光环大小 */
  size?: number;
  /** 颜色主题 */
  color?: "primary" | "blue" | "purple" | "cyan" | "emerald";
  /** 额外的 className */
  className?: string;
  /** 是否启用动画 */
  animate?: boolean;
}

const LIGHT_COLORS = {
  primary: "rgba(22, 59, 242, 0.08)",
  blue: "rgba(59, 130, 246, 0.08)",
  purple: "rgba(139, 92, 246, 0.08)",
  cyan: "rgba(34, 211, 238, 0.08)",
  emerald: "rgba(16, 185, 129, 0.08)",
};

const DARK_COLORS = {
  primary: "rgba(223, 166, 33, 0.12)",
  blue: "rgba(59, 130, 246, 0.15)",
  purple: "rgba(139, 92, 246, 0.15)",
  cyan: "rgba(34, 211, 238, 0.15)",
  emerald: "rgba(16, 185, 129, 0.15)",
};

/**
 * 发光光环组件
 * 优化版：使用 CSS 动画代替 framer-motion 无限循环
 */
export const GlowingOrb = memo(function GlowingOrb({
  size = 600,
  color = "primary",
  className = "",
  animate = true,
}: GlowingOrbProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const shouldAnimate = animate && !prefersReducedMotion;

  return (
    <>
      {/* Light mode */}
      <div
        className={`absolute rounded-full blur-[100px] pointer-events-none dark:hidden ${
          shouldAnimate ? "animate-glow-pulse" : ""
        } ${className}`}
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle, ${LIGHT_COLORS[color]} 0%, transparent 70%)`,
          willChange: shouldAnimate ? "transform, opacity" : "auto",
        }}
      />
      {/* Dark mode */}
      <div
        className={`absolute rounded-full blur-[100px] pointer-events-none hidden dark:block ${
          shouldAnimate ? "animate-glow-pulse" : ""
        } ${className}`}
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle, ${DARK_COLORS[color]} 0%, transparent 70%)`,
          willChange: shouldAnimate ? "transform, opacity" : "auto",
        }}
      />
    </>
  );
});

// ============================
// MouseFollowGlow - 鼠标跟随光晕
// ============================

interface MouseFollowGlowProps {
  /** 额外的 className */
  className?: string;
  /** 是否启用 */
  enabled?: boolean;
}

/**
 * 鼠标跟随光晕
 * 优化版：添加节流和可见性检测
 */
export const MouseFollowGlow = memo(function MouseFollowGlow({ className = "", enabled = true }: MouseFollowGlowProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isVisible, setIsVisible] = useState(true);

  const springConfig = { stiffness: 80, damping: 25 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  useEffect(() => {
    if (!enabled || prefersReducedMotion) return;

    let animationId: number;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
    };

    const updatePosition = () => {
      x.set(targetX);
      y.set(targetY);
      animationId = requestAnimationFrame(updatePosition);
    };

    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    animationId = requestAnimationFrame(updatePosition);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      cancelAnimationFrame(animationId);
    };
  }, [enabled, prefersReducedMotion, x, y]);

  if (!enabled || prefersReducedMotion || !isVisible) return null;

  return (
    <motion.div
      className={`fixed w-[300px] h-[300px] rounded-full pointer-events-none z-0 ${className}`}
      style={{
        x: springX,
        y: springY,
        translateX: "-50%",
        translateY: "-50%",
        background: "radial-gradient(circle, rgba(22, 59, 242, 0.06) 0%, transparent 70%)",
        willChange: "transform",
      }}
    />
  );
});
