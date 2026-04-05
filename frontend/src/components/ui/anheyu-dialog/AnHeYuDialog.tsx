"use client";

import { useEffect, useState, useCallback, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import styles from "./AnHeYuDialog.module.css";

/** 与 CSS 中 200ms transition 对齐，略加长以避免未触发 transitionend 时卡住 */
const EXIT_COMPLETE_FALLBACK_MS = 320;

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(el => {
    if ("disabled" in el && (el as HTMLButtonElement).disabled) return false;
    if (el.getAttribute("aria-disabled") === "true") return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    return true;
  });
}

export interface AnHeYuDialogProps {
  open: boolean;
  /** 退出动画结束后调用（请将受控 open 设为 false） */
  onClose: () => void;
  title: React.ReactNode;
  /** 覆盖默认生成的 aria-labelledby */
  titleId?: string;
  children: React.ReactNode;
  /** 传入函数时可获得 `close()`，用于先执行业务再播放关闭动画 */
  footer?: React.ReactNode | ((api: { close: () => void }) => React.ReactNode);
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
  containerClassName?: string;
  containerStyle?: React.CSSProperties;
  contentClassName?: string;
  /** 覆盖 .wrapper 的 z-index */
  zIndex?: number;
}

/**
 * 前台通用弹窗壳（Portal + 与旧 OrderQueryDialog 相同的进入/退出过渡）。
 * 使用 queueMicrotask 设置 portal / 部分 state，以满足 effect 内 setState 的 lint 规则。
 */
export function AnHeYuDialog({
  open,
  onClose,
  title,
  titleId: titleIdProp,
  children,
  footer,
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className,
  containerClassName,
  containerStyle,
  contentClassName,
  zIndex,
}: AnHeYuDialogProps) {
  const reactId = useId();
  const titleId = titleIdProp ?? `anheyu-dialog-title-${reactId.replace(/:/g, "")}`;

  const [isExiting, setIsExiting] = useState(false);
  const [isEntered, setIsEntered] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const exitDoneRef = useRef(false);
  const exitFallbackTimerRef = useRef<number | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const didCaptureFocusRef = useRef(false);

  const clearExitFallback = useCallback(() => {
    if (exitFallbackTimerRef.current != null) {
      clearTimeout(exitFallbackTimerRef.current);
      exitFallbackTimerRef.current = null;
    }
  }, []);

  const completeExit = useCallback(() => {
    if (exitDoneRef.current) return;
    exitDoneRef.current = true;
    clearExitFallback();
    onClose();
    const toRestore = previousFocusRef.current;
    previousFocusRef.current = null;
    if (toRestore && typeof toRestore.focus === "function" && document.contains(toRestore)) {
      queueMicrotask(() => toRestore.focus());
    }
  }, [onClose, clearExitFallback]);

  const beginClose = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    exitFallbackTimerRef.current = window.setTimeout(() => {
      exitFallbackTimerRef.current = null;
      completeExit();
    }, EXIT_COMPLETE_FALLBACK_MS);
  }, [isExiting, completeExit]);

  /** 稳定引用，避免 footer render prop 在 render 中传入 beginClose 触发 react-hooks/refs */
  const beginCloseRef = useRef(beginClose);
  useEffect(() => {
    beginCloseRef.current = beginClose;
  }, [beginClose]);
  const requestClose = useCallback(() => {
    beginCloseRef.current();
  }, []);

  const handleTransitionEnd = useCallback(
    (e: React.TransitionEvent) => {
      if (e.target !== e.currentTarget) return;
      if (!isExiting) return;
      clearExitFallback();
      completeExit();
    },
    [isExiting, completeExit, clearExitFallback]
  );

  const handlePanelKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !panelRef.current) return;
    const list = getFocusableElements(panelRef.current);
    if (list.length === 0) return;
    const first = list[0];
    const last = list[list.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey) {
      if (active === first || !panelRef.current.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (open) {
      exitDoneRef.current = false;
    } else {
      didCaptureFocusRef.current = false;
      clearExitFallback();
      queueMicrotask(() => setIsExiting(false));
    }
  }, [open, clearExitFallback]);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setIsExiting(false);
        setIsEntered(false);
      });
      const t = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsEntered(true));
      });
      return () => cancelAnimationFrame(t);
    }
    queueMicrotask(() => setIsEntered(false));
  }, [open]);

  const isMounted = open || isExiting;

  useEffect(() => {
    if (!isMounted) {
      queueMicrotask(() => setPortalContainer(null));
      return;
    }
    if (typeof document === "undefined") return;
    const div = document.createElement("div");
    div.setAttribute("data-anheyu-dialog-portal", "");
    document.body.appendChild(div);
    queueMicrotask(() => setPortalContainer(div));
    return () => {
      div.parentNode?.removeChild(div);
    };
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMounted]);

  useEffect(() => {
    if (!closeOnEscape || !isMounted) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMounted, closeOnEscape, requestClose]);

  useEffect(() => {
    if (!open || !isEntered || isExiting) return;
    if (typeof document === "undefined") return;
    if (didCaptureFocusRef.current) return;
    didCaptureFocusRef.current = true;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const t = requestAnimationFrame(() => {
      const root = panelRef.current;
      if (!root) return;
      const closeBtn = showCloseButton ? root.querySelector<HTMLElement>('button[aria-label="关闭"]') : null;
      const list = getFocusableElements(root);
      const pick = closeBtn && list.includes(closeBtn) ? closeBtn : list[0];
      pick?.focus();
    });
    return () => cancelAnimationFrame(t);
  }, [open, isEntered, isExiting, showCloseButton]);

  useEffect(() => {
    return () => {
      clearExitFallback();
    };
  }, [clearExitFallback]);

  if (!isMounted || !portalContainer) {
    return null;
  }

  const dialog = (
    <div
      className={cn(
        styles.wrapper,
        className,
        isEntered && !isExiting ? styles.wrapperEntered : "",
        isExiting ? styles.wrapperExiting : ""
      )}
      style={zIndex != null ? { zIndex } : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className={styles.overlay}
        role="presentation"
        onClick={closeOnOverlayClick ? requestClose : undefined}
        onTransitionEnd={handleTransitionEnd}
      >
        <div
          ref={panelRef}
          className={cn(styles.container, containerClassName)}
          style={containerStyle}
          onClick={e => e.stopPropagation()}
          onKeyDown={handlePanelKeyDown}
        >
          <div className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {showCloseButton ? (
              <button type="button" className={styles.closeBtn} onClick={requestClose} aria-label="关闭">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            ) : null}
          </div>
          <div className={cn(styles.content, contentClassName)}>{children}</div>
          {footer != null ? (
            <div className={styles.footer}>
              {
                // eslint-disable-next-line react-hooks/refs -- `close` 仅在 footer 内 onClick 等回调中调用，不会在 render 中同步触发
                typeof footer === "function" ? footer({ close: requestClose }) : footer
              }
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, portalContainer);
}
