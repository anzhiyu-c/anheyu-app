"use client";

import { useCallback, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { Snackbar, type SnackbarProps } from "@/components/ui/snackbar/Snackbar";

/**
 * Snackbar hook（对齐 anheyu-app useSnackbar composable）
 *
 * 用法：
 *   const { showSnackbar } = useSnackbar();
 *   showSnackbar("消息内容", cancelCallback, 5000, "取消");
 */
export function useSnackbar() {
  const rootRef = useRef<{ root: Root; container: HTMLDivElement } | null>(null);

  const cleanup = useCallback(() => {
    if (rootRef.current) {
      rootRef.current.root.unmount();
      rootRef.current.container.remove();
      rootRef.current = null;
    }
  }, []);

  const showSnackbar = useCallback(
    (text: string, onActionClick?: (() => void) | false, duration = 2000, actionText?: string | false) => {
      // 清除上一个
      cleanup();

      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      rootRef.current = { root, container };

      const props: SnackbarProps = {
        text,
        duration,
        onClose: cleanup,
      };

      if (typeof onActionClick === "function" && typeof actionText === "string" && actionText.length > 0) {
        props.actionText = actionText;
        props.onActionClick = onActionClick;
      }

      root.render(createElement(Snackbar, props));
    },
    [cleanup]
  );

  return { showSnackbar };
}
