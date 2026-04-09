"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { overlayVariants, modalVariants, springTransition, normalTransition } from "@/lib/motion";
import styles from "./Dialogs.module.css";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  tone?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "确定",
  cancelText = "取消",
  tone = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const prevOpenRef = useRef(false);

  const uniqueId = useId();
  const titleId = `confirm-dialog-title-${uniqueId}`;
  const descId = `confirm-dialog-desc-${uniqueId}`;

  // 当 open 从 false 变为 true 时，保存焦点并聚焦取消按钮
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setTimeout(() => cancelBtnRef.current?.focus(), 100);
    } else if (!open && prevOpenRef.current) {
      previousFocusRef.current?.focus();
    }
    prevOpenRef.current = open;
  }, [open]);

  // Focus Trap
  useEffect(() => {
    if (!open) return;
    const handleFocusTrap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusableElements = dialogRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusableElements?.length) return;
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };
    document.addEventListener("keydown", handleFocusTrap);
    return () => document.removeEventListener("keydown", handleFocusTrap);
  }, [open]);

  const handleClose = useCallback(() => {
    previousFocusRef.current?.focus();
    onCancel();
  }, [onCancel]);

  const handleConfirm = useCallback(() => {
    previousFocusRef.current?.focus();
    onConfirm();
  }, [onConfirm]);

  // 键盘事件
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
      else if (event.key === "Enter") handleConfirm();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleClose, handleConfirm]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={styles["dialog-overlay"]}
          onMouseDown={handleClose}
          aria-hidden="true"
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={normalTransition}
        >
          <motion.div
            ref={dialogRef}
            className={styles.dialog}
            onMouseDown={event => event.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={springTransition}
          >
            <div className={styles["dialog-header"]}>
              <div id={titleId} className={styles["dialog-title"]}>
                {title}
              </div>
              <div id={descId} className={styles["dialog-desc"]}>
                {description}
              </div>
            </div>
            <div className={styles["dialog-footer"]}>
              <button ref={cancelBtnRef} className={styles["dialog-button"]} onClick={handleClose} type="button">
                {cancelText}
              </button>
              <button
                className={`${styles["dialog-button"]} ${tone === "danger" ? styles.danger : styles.primary}`}
                onClick={handleConfirm}
                type="button"
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
