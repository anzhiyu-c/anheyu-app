/**
 * 站点外观换肤：设计令牌（与 globals.css 中语义变量对齐）
 */

/** 单模式（亮或暗）下一组可映射到 CSS 变量的颜色 */
export interface AppearanceModeTokens {
  /** 主品牌色 -> --primary */
  primary: string;
  /** 主色上的前景（按钮文字等）-> --primary-foreground */
  primaryForeground: string;
  /** 成功 -> --green */
  success: string;
  /** 警告 -> --yellow */
  warning: string;
  /** 危险 -> --red */
  danger: string;
  /** 信息 -> --blue */
  info: string;
  /** 辅助强调 -> --purple */
  accent: string;
}

/** 用户/API 部分覆盖（空字段表示不覆盖预设） */
export interface AppearanceTokensOverride {
  light?: Partial<AppearanceModeTokens>;
  dark?: Partial<AppearanceModeTokens>;
}

export const APPEARANCE_TOKEN_KEYS = [
  "primary",
  "primaryForeground",
  "success",
  "warning",
  "danger",
  "info",
  "accent",
] as const satisfies readonly (keyof AppearanceModeTokens)[];

export type AppearanceTokenKey = (typeof APPEARANCE_TOKEN_KEYS)[number];
