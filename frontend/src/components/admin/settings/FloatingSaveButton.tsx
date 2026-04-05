/*
 * @Author: 安知鱼
 * @Date: 2026-02-11 10:34:32
 * @Description:
 * @LastEditTime: 2026-02-12 12:07:46
 * @LastEditors: 安知鱼
 */
"use client";

import { useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Save } from "lucide-react";
import { Button } from "@/components/ui";

interface FloatingSaveButtonProps {
  hasChanges: boolean;
  loading?: boolean;
  onSave: () => void;
}

export function FloatingSaveButton({ hasChanges, loading, onSave }: FloatingSaveButtonProps) {
  const isMac = useMemo(() => typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC"), []);

  const handleSave = useCallback(() => {
    if (hasChanges && !loading) {
      onSave();
    }
  }, [hasChanges, loading, onSave]);

  // 监听 Cmd/Ctrl + S 快捷键
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [handleSave]);

  return (
    <AnimatePresence>
      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-4 px-5 py-3 bg-background/90 backdrop-blur-lg rounded-full shadow-sm border border-border/60 max-md:bottom-4 max-md:right-4 max-md:left-4 max-md:gap-3 max-md:px-4 max-md:rounded-xl max-sm:bottom-3 max-sm:right-3 max-sm:left-3"
        >
          {/* 保存内容 */}
          <div className="flex items-center gap-3 flex-1">
            <span className="text-sm text-muted-foreground whitespace-nowrap">有未保存的更改</span>
            <Button size="sm" disabled={loading} onClick={onSave} className="gap-1.5 shadow-lg shadow-primary/20">
              {loading ? (
                <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {loading ? "保存中..." : "保存设置"}
            </Button>
          </div>

          {/* 快捷键提示 - 移动端隐藏 */}
          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 font-sans text-[11px] bg-muted border border-border/60 rounded">
              {isMac ? "⌘" : "Ctrl"}
            </kbd>
            <span>+</span>
            <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 font-sans text-[11px] bg-muted border border-border/60 rounded">
              S
            </kbd>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
