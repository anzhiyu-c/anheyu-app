"use client";

import { useRef, useCallback } from "react";
import { useSnackbar } from "@/hooks/use-snackbar";

const TRAVELLING_URL = "https://www.travellings.cn/go.html";
const TRAVELLING_DELAY = 5000;

/**
 * 开往跳转 hook（对齐 anheyu-app handleTravelClick / handleTreasureLinkClick）
 *
 * 行为（与 anheyu-app 完全一致）：
 * 1. 点击 → 显示 snackbar 警告 + 5 秒倒计时 + "取消"按钮
 * 2. 5 秒后自动打开 travellings.cn/go.html
 * 3. 点击"取消"按钮 → 清除定时器，显示"跳转已取消"
 */
export function useTravellingLink() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { showSnackbar } = useSnackbar();

  const handleTravelClick = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      // 如果已有定时器，清除旧的（再次点击重新开始倒计时，对齐 anheyu-app）
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      const cancelAction = () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
          showSnackbar("跳转已取消");
        }
      };

      showSnackbar(
        "即将跳转到「开往」项目的成员博客，不保证跳转网站的安全性和可用性",
        cancelAction,
        TRAVELLING_DELAY,
        "取消"
      );

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        window.open(TRAVELLING_URL, "_blank");
      }, TRAVELLING_DELAY);
    },
    [showSnackbar]
  );

  return { handleTravelClick };
}
