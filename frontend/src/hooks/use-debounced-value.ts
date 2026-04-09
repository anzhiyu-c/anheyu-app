/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-02-06 23:08:38
 * @LastEditTime: 2026-02-06 23:08:48
 * @LastEditors: 安知鱼
 */
import { useState, useEffect } from "react";

/**
 * 防抖 Hook：延迟更新值，适用于搜索输入等场景
 * @param value 原始值
 * @param delay 延迟毫秒数
 * @returns 防抖后的值
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
