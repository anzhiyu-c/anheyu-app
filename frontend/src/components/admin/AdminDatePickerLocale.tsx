"use client";

import type { ReactNode } from "react";
import { I18nProvider } from "@react-aria/i18n";

/**
 * 管理后台 HeroUI DatePicker：使用 zh-CN，日期分段顺序为 **年 → 月 → 日**，
 * 避免默认 en-US 的月/日/年；时间与日历文案亦为中文。
 */
export function AdminDatePickerLocale({ children }: { children: ReactNode }) {
  return <I18nProvider locale="zh-CN">{children}</I18nProvider>;
}
