import type { Transition, Variants } from "framer-motion";

// ─── Spring 过渡配置 ───────────────────────────────────────────────
export const springTransition: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

export const gentleSpring: Transition = {
  type: "spring",
  stiffness: 200,
  damping: 20,
};

export const snappySpring: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
};

export const softSpring: Transition = {
  type: "spring",
  stiffness: 150,
  damping: 18,
};

// ─── 通用动画变体 ─────────────────────────────────────────────────
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const fadeInDown: Variants = {
  initial: { opacity: 0, y: -12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 12 },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const slideInRight: Variants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 24 },
};

export const slideInLeft: Variants = {
  initial: { opacity: 0, x: -24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
};

export const slideInFromBottom: Variants = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 40 },
};

// ─── 面板动画 ─────────────────────────────────────────────────────
export const panelSlideRight: Variants = {
  initial: { x: "100%" },
  animate: { x: 0 },
  exit: { x: "100%" },
};

export const panelSlideBottom: Variants = {
  initial: { y: "100%" },
  animate: { y: 0 },
  exit: { y: "100%" },
};

// ─── 遮罩层动画 ───────────────────────────────────────────────────
export const overlayVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const modalVariants: Variants = {
  initial: { opacity: 0, scale: 0.95, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 10 },
};

// ─── 交错动画 ─────────────────────────────────────────────────────
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.02,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.02,
      staggerDirection: -1,
    },
  },
};

export const staggerContainerSlow: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.04,
    },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95 },
};

export const staggerItemScale: Variants = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.92 },
};

// ─── 上下文菜单动画 ───────────────────────────────────────────────
export const contextMenuVariants: Variants = {
  initial: { opacity: 0, scale: 0.92, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.92, y: -4, transition: { duration: 0.12 } },
};

export const menuItemVariants: Variants = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -8 },
};

// ─── 过渡预设 ─────────────────────────────────────────────────────
export const fastTransition: Transition = { duration: 0.15, ease: "easeOut" };
export const normalTransition: Transition = { duration: 0.25, ease: [0.22, 1, 0.36, 1] };
export const slowTransition: Transition = { duration: 0.4, ease: [0.22, 1, 0.36, 1] };

// ─── 拖拽覆盖层动画 ──────────────────────────────────────────────
export const dragOverlayVariants: Variants = {
  initial: { opacity: 0, backdropFilter: "blur(0px)" },
  animate: { opacity: 1, backdropFilter: "blur(20px)" },
  exit: { opacity: 0, backdropFilter: "blur(0px)" },
};

// ─── Admin 页面专用变体 ──────────────────────────────────────────
export const adminContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

export const adminItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

export const adminRowVariants: Variants = {
  hidden: { opacity: 0, x: -4 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

export const floatingBarVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 400, damping: 30 } },
  exit: { opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.2 } },
};
