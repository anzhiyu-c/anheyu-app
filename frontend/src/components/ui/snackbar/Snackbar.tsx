"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import styles from "./snackbar.module.css";

export interface SnackbarProps {
  text: string;
  duration?: number;
  actionText?: string;
  onActionClick?: () => void;
  onClose?: () => void;
}

export function Snackbar({ text, duration = 2000, actionText, onActionClick, onClose }: SnackbarProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  const close = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, 300);
  }, [onClose]);

  useEffect(() => {
    // 入场
    requestAnimationFrame(() => setVisible(true));

    // 自动关闭
    const timer = setTimeout(close, duration);
    return () => clearTimeout(timer);
  }, [duration, close]);

  const handleAction = useCallback(() => {
    onActionClick?.();
    close();
  }, [onActionClick, close]);

  if (typeof window === "undefined") return null;

  return createPortal(
    <div className={cn(styles.snackbar, visible && !exiting && styles.show, exiting && styles.exit)}>
      <div className={styles.inner}>
        <span className={styles.text}>{text}</span>
        {actionText && onActionClick && (
          <button className={styles.action} onClick={handleAction}>
            {actionText}
          </button>
        )}
      </div>
      <div className={styles.progress} style={{ animationDuration: `${duration}ms` }} />
    </div>,
    document.body
  );
}
