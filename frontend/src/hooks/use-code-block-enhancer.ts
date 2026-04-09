"use client";

import { useEffect, useRef, type RefObject } from "react";

const COPY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 512 512"><path fill="currentColor" d="M408 480H184a72 72 0 0 1-72-72V184a72 72 0 0 1 72-72h224a72 72 0 0 1 72 72v224a72 72 0 0 1-72 72"/><path fill="currentColor" d="M160 80h235.88A72.12 72.12 0 0 0 328 32H104a72 72 0 0 0-72 72v224a72.12 72.12 0 0 0 48 67.88V160a80 80 0 0 1 80-80"/></svg>`;
const CHECK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 448 512"><path fill="currentColor" d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>`;

/**
 * 为容器内的 <pre> 代码块添加复制按钮。
 * 适用于通过 dangerouslySetInnerHTML 渲染的静态 HTML 内容。
 */
export function useCodeBlockEnhancer(containerRef: RefObject<HTMLElement | null>, html: string) {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !html) return;

    const cleanups: (() => void)[] = [];

    const preBlocks = container.querySelectorAll("pre");
    preBlocks.forEach(pre => {
      if (pre.querySelector(".code-copy-btn")) return;

      const btn = document.createElement("button");
      btn.className = "code-copy-btn";
      btn.innerHTML = COPY_ICON;
      btn.title = "复制代码";
      Object.assign(btn.style, {
        position: "absolute",
        top: "8px",
        right: "8px",
        cursor: "pointer",
        background: "transparent",
        border: "none",
        color: "inherit",
        opacity: "0.5",
        padding: "4px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "opacity 0.2s",
        zIndex: "1",
      });

      pre.style.position = "relative";
      pre.appendChild(btn);

      const handleClick = async () => {
        const codeText = pre.querySelector("code")?.textContent || pre.textContent || "";
        try {
          await navigator.clipboard.writeText(codeText);
          btn.innerHTML = CHECK_ICON;
          btn.style.color = "#28ca42";
          btn.style.opacity = "1";
          setTimeout(() => {
            btn.innerHTML = COPY_ICON;
            btn.style.color = "inherit";
            btn.style.opacity = "0.5";
          }, 2000);
        } catch {
          /* clipboard API may fail in insecure context */
        }
      };

      btn.addEventListener("click", handleClick);
      cleanups.push(() => btn.removeEventListener("click", handleClick));
    });

    cleanupRef.current = () => cleanups.forEach(fn => fn());

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [containerRef, html]);
}
