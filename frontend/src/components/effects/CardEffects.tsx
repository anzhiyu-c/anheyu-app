/**
 * 卡片特效组件
 * 包含 3D 透视卡片效果
 */
"use client";

import { useRef, useCallback, memo } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { usePrefersReducedMotion, useIsTouchDevice } from "./hooks";

interface PerspectiveCardProps {
  children: React.ReactNode;
  /** 额外的 className */
  className?: string;
  /** 是否禁用效果 */
  disabled?: boolean;
}

/**
 * 3D 透视卡片
 * 优化版：添加节流和触摸设备检测
 */
export const PerspectiveCard = memo(function PerspectiveCard({
  children,
  className = "",
  disabled = false,
}: PerspectiveCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const isTouchDevice = useIsTouchDevice();

  const isDisabled = disabled || prefersReducedMotion || isTouchDevice;

  const lastMoveTime = useRef(0);
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDisabled || !ref.current) return;

      const now = Date.now();
      if (now - lastMoveTime.current < 16) return;
      lastMoveTime.current = now;

      const rect = ref.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const mouseX = e.clientX - centerX;
      const mouseY = e.clientY - centerY;

      rotateX.set(mouseY / 25);
      rotateY.set(-mouseX / 25);
    },
    [isDisabled, rotateX, rotateY]
  );

  const handleMouseLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  const springConfig = { stiffness: 200, damping: 25 };
  const springRotateX = useSpring(rotateX, springConfig);
  const springRotateY = useSpring(rotateY, springConfig);

  if (isDisabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        rotateX: springRotateX,
        rotateY: springRotateY,
        transformPerspective: 1000,
        willChange: "transform",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </motion.div>
  );
});

export default PerspectiveCard;
