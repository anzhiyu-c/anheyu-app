/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-02-06 23:09:03
 * @LastEditTime: 2026-02-06 23:09:16
 * @LastEditors: 安知鱼
 */
"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import { floatingBarVariants } from "@/lib/motion";

export interface FloatingSelectionBarAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
}

interface FloatingSelectionBarProps {
  count: number;
  actions: FloatingSelectionBarAction[];
  onClear: () => void;
}

/**
 * 浮动选择操作栏 - 选中行后底部弹出的批量操作条
 *
 * 使用示例:
 * ```tsx
 * <FloatingSelectionBar
 * count={selectedIds.size}
 * actions={[
 * { key: "export", label: "导出", icon: <Download />, onClick: handleExport },
 * { key: "delete", label: "删除", icon: <Trash2 />, onClick: onDelete, variant: "danger" },
 * ]}
 * onClear={() => setSelectedIds(new Set())}
 * />
 * ```
 */
export function FloatingSelectionBar({ count, actions, onClear }: FloatingSelectionBarProps) {
  return (
    <motion.div
      variants={floatingBarVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed bottom-6 left-1/2 lg:left-[calc(50%+8rem)] -translate-x-1/2 z-50"
    >
      <div className="flex items-center gap-3 px-5 py-2.5 bg-foreground/90 dark:bg-card rounded-2xl shadow-2xl backdrop-blur-xl border border-border/10">
        {/* 计数 */}
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <span className="text-[10px] font-bold text-primary-foreground tabular-nums">{count}</span>
          </div>
          <span className="text-sm font-medium text-background dark:text-foreground">已选</span>
        </div>

        <div className="w-px h-5 bg-background/20 dark:bg-border/30" />

        {/* 操作按钮 */}
        <div className="flex items-center gap-1">
          {actions.map(action => (
            <button
              key={action.key}
              onClick={action.onClick}
              disabled={action.disabled}
              className={
                action.variant === "danger"
                  ? "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-300 hover:text-red-200 hover:bg-red-500/15 transition-colors cursor-pointer"
                  : "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-background/80 dark:text-foreground/70 hover:text-background dark:hover:text-foreground hover:bg-background/10 dark:hover:bg-muted/30 transition-colors disabled:opacity-40 cursor-pointer"
              }
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-background/20 dark:bg-border/30" />

        {/* 清除按钮 */}
        <button
          onClick={onClear}
          className="p-1.5 rounded-lg text-background/50 dark:text-foreground/40 hover:text-background dark:hover:text-foreground hover:bg-background/10 dark:hover:bg-muted/30 transition-colors cursor-pointer"
          aria-label="清除选择"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
