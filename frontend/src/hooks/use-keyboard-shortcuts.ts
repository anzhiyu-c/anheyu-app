"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { addToast } from "@heroui/react";
import { useUiStore } from "@/store/ui-store";

export interface Shortcut {
  keys: string[];
  description: string;
  action: () => void;
}

export function useKeyboardShortcuts() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const isShortcutsEnabled = useUiStore(state => state.isShortcutsEnabled);
  const useCustomContextMenu = useUiStore(state => state.useCustomContextMenu);
  const toggleShortcuts = useUiStore(state => state.toggleShortcuts);
  const toggleContextMenuMode = useUiStore(state => state.toggleContextMenuMode);

  const [showShortcutsPanel, setShowShortcutsPanel] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const pressedKeysRef = useRef<Set<string>>(new Set());

  // 快捷键定义
  const shortcuts: Shortcut[] = useMemo(
    () => [
      {
        keys: ["Shift", "K"],
        description: "开启/关闭快捷键功能",
        action: () => {
          const wasEnabled = isShortcutsEnabled;
          toggleShortcuts();
          addToast({
            title: `快捷键功能已${wasEnabled ? "关闭" : "开启"}`,
            color: wasEnabled ? "default" : "success",
            timeout: 2000,
          });
          setShowShortcutsPanel(false);
          setIsShiftPressed(false);
          pressedKeysRef.current.clear();
        },
      },
      {
        keys: ["Shift", "A"],
        description: "打开/关闭中控台",
        action: () => {
          window.dispatchEvent(new CustomEvent("toggle-console"));
          setShowShortcutsPanel(false);
          setIsShiftPressed(false);
          pressedKeysRef.current.clear();
        },
      },
      {
        keys: ["Shift", "D"],
        description: "深色/浅色显示模式",
        action: () => {
          const newTheme = theme === "dark" ? "light" : "dark";
          setTheme(newTheme);
          setShowShortcutsPanel(false);
          setIsShiftPressed(false);
          pressedKeysRef.current.clear();
        },
      },
      {
        keys: ["Shift", "S"],
        description: "站内搜索",
        action: () => {
          window.dispatchEvent(new CustomEvent("frontend-open-search"));
          setShowShortcutsPanel(false);
          setIsShiftPressed(false);
          pressedKeysRef.current.clear();
        },
      },
      {
        keys: ["Shift", "R"],
        description: "随机访问",
        action: () => {
          router.push("/random-post");
          setShowShortcutsPanel(false);
          setIsShiftPressed(false);
          pressedKeysRef.current.clear();
        },
      },
      {
        keys: ["Shift", "H"],
        description: "返回首页",
        action: () => {
          router.push("/");
          setShowShortcutsPanel(false);
          setIsShiftPressed(false);
          pressedKeysRef.current.clear();
        },
      },
      {
        keys: ["Shift", "L"],
        description: "友链页面",
        action: () => {
          router.push("/links");
          setShowShortcutsPanel(false);
          setIsShiftPressed(false);
          pressedKeysRef.current.clear();
        },
      },
      {
        keys: ["Shift", "P"],
        description: "关于本站",
        action: () => {
          router.push("/about");
          setShowShortcutsPanel(false);
          setIsShiftPressed(false);
          pressedKeysRef.current.clear();
        },
      },
      {
        keys: ["Shift", "I"],
        description: "原版/本站右键菜单",
        action: () => {
          toggleContextMenuMode();
          addToast({
            title: `已切换为${useCustomContextMenu ? "浏览器原生" : "本站"}右键菜单`,
            color: "default",
            timeout: 2000,
          });
          setShowShortcutsPanel(false);
          setIsShiftPressed(false);
          pressedKeysRef.current.clear();
        },
      },
    ],
    [isShortcutsEnabled, useCustomContextMenu, theme, router, setTheme, toggleShortcuts, toggleContextMenuMode]
  );

  // 检查是否为输入元素
  const isInputElement = useCallback((element: HTMLElement | null): boolean => {
    if (!element) return false;

    const inputTags = ["INPUT", "TEXTAREA", "SELECT"];
    const contentEditable = element.getAttribute("contenteditable") === "true";

    return (
      inputTags.includes(element.tagName) ||
      contentEditable ||
      !!element.closest("input, textarea, select, [contenteditable='true']")
    );
  }, []);

  // 处理键盘按下事件
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // 忽略在输入框中的按键
      if (isInputElement(event.target as HTMLElement)) {
        return;
      }

      const key = event.key;

      // 检查是否按下 Shift 键
      if (key === "Shift") {
        setIsShiftPressed(true);
        pressedKeysRef.current.add("Shift");
        // 只有在快捷键功能启用时才显示面板
        if (isShortcutsEnabled) {
          setShowShortcutsPanel(true);
        }
        return;
      }

      // 如果 Shift 键已按下，检查其他按键组合
      if (pressedKeysRef.current.has("Shift") && key) {
        const pressedKey = key.toUpperCase();
        pressedKeysRef.current.add(pressedKey);

        // 特殊处理总开关快捷键 Shift+K
        if (pressedKey === "K") {
          event.preventDefault();
          const shortcut = shortcuts.find(s => s.keys.includes("Shift") && s.keys.includes("K"));
          if (shortcut) {
            shortcut.action();
          }
          return;
        }

        // 其他快捷键需要功能开启
        if (!isShortcutsEnabled) {
          return;
        }

        // 查找匹配的快捷键
        const shortcut = shortcuts.find(s => s.keys.includes("Shift") && s.keys.includes(pressedKey));

        if (shortcut) {
          event.preventDefault();
          shortcut.action();
        }
      }
    },
    [isShortcutsEnabled, isInputElement, shortcuts]
  );

  // 处理键盘释放事件
  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    const key = event.key;

    // 防止 key 为 undefined 的情况
    if (!key) return;

    if (key === "Shift") {
      setIsShiftPressed(false);
      pressedKeysRef.current.delete("Shift");

      // 延迟隐藏面板，给用户时间看到快捷键提示
      setTimeout(() => {
        if (!pressedKeysRef.current.has("Shift") && pressedKeysRef.current.size === 0) {
          setShowShortcutsPanel(false);
        }
      }, 300);
    } else {
      pressedKeysRef.current.delete(key.toUpperCase());

      // 如果没有按键被按下，隐藏面板
      if (pressedKeysRef.current.size === 0) {
        setTimeout(() => {
          if (pressedKeysRef.current.size === 0) {
            setShowShortcutsPanel(false);
          }
        }, 100);
      }
    }
  }, []);

  // 处理点击外部关闭面板
  const handleClickOutside = useCallback((event: Event) => {
    const target = event.target as HTMLElement;
    if (!target.closest(".shortcut-guide-wrapper") && !target.closest(".keyboard-shortcuts-trigger")) {
      setShowShortcutsPanel(false);
      setIsShiftPressed(false);
      pressedKeysRef.current.clear();
    }
  }, []);

  // 强制关闭快捷键面板
  const closeShortcutsPanel = useCallback(() => {
    setShowShortcutsPanel(false);
    setIsShiftPressed(false);
    pressedKeysRef.current.clear();
  }, []);

  // 手动显示/隐藏快捷键面板
  const toggleShortcutsPanel = useCallback(() => {
    setShowShortcutsPanel(prev => {
      if (prev) {
        setIsShiftPressed(false);
        pressedKeysRef.current.clear();
      }
      return !prev;
    });
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    document.addEventListener("click", handleClickOutside);
    window.addEventListener("blur", closeShortcutsPanel);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("click", handleClickOutside);
      window.removeEventListener("blur", closeShortcutsPanel);
    };
  }, [handleKeyDown, handleKeyUp, handleClickOutside, closeShortcutsPanel]);

  return {
    showShortcutsPanel,
    isShiftPressed,
    shortcuts,
    toggleShortcutsPanel,
    closeShortcutsPanel,
  };
}
