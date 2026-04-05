"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { overlayVariants, modalVariants, springTransition, normalTransition } from "@/lib/motion";
import styles from "./Dialogs.module.css";

interface PromptDialogProps {
  open: boolean;
  title: string;
  description?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  validator?: (value: string) => string | true;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function PromptDialog({
  open,
  title,
  description,
  defaultValue,
  confirmText = "确定",
  cancelText = "取消",
  validator,
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue || "");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const prevOpenRef = useRef(false);

  const uniqueId = useId();
  const titleId = `dialog-title-${uniqueId}`;
  const descId = `dialog-desc-${uniqueId}`;
  const inputId = `dialog-input-${uniqueId}`;
  const errorId = `dialog-error-${uniqueId}`;

  // 焦点管理：打开时保存焦点，关闭时恢复焦点
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // 延迟聚焦，等待动画开始后 input 已挂载
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
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
    if (validator) {
      const result = validator(value);
      if (result !== true) {
        setError(result || "输入不合法");
        setShake(true);
        setTimeout(() => setShake(false), 500);
        return;
      }
    }
    previousFocusRef.current?.focus();
    onConfirm(value.trim());
  }, [validator, value, onConfirm]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleConfirm();
    } else if (event.key === "Escape") {
      handleClose();
    }
  };

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
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
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
              {description ? (
                <div id={descId} className={styles["dialog-desc"]}>
                  {description}
                </div>
              ) : null}
            </div>
            <div className={styles["dialog-body"]}>
              <label htmlFor={inputId} className={styles["sr-only"]}>
                {title}
              </label>
              <motion.input
                ref={inputRef}
                id={inputId}
                className={styles["dialog-input"]}
                value={value}
                onChange={event => {
                  setValue(event.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="请输入..."
                aria-invalid={!!error}
                aria-describedby={error ? errorId : undefined}
                animate={shake ? { x: [0, -6, 6, -4, 4, -2, 2, 0] } : { x: 0 }}
                transition={{ duration: 0.4 }}
              />
              <AnimatePresence>
                {error ? (
                  <motion.div
                    id={errorId}
                    className={styles["dialog-error"]}
                    role="alert"
                    aria-live="assertive"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {error}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
            <div className={styles["dialog-footer"]}>
              <button className={styles["dialog-button"]} onClick={handleClose} type="button">
                {cancelText}
              </button>
              <button className={`${styles["dialog-button"]} ${styles.primary}`} onClick={handleConfirm} type="button">
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
