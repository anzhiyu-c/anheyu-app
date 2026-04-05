/**
 * 内置配色方案（企业站点常用：品牌主色 + 语义色 + 深浅模式独立调色）
 */
import type { AppearanceModeTokens } from "./appearance-types";

export interface AppearanceSkinDefinition {
  id: string;
  label: string;
  description: string;
  light: AppearanceModeTokens;
  dark: AppearanceModeTokens;
}

const L_SEM: Pick<AppearanceModeTokens, "success" | "warning" | "danger" | "info"> = {
  success: "#57bd6a",
  warning: "#c28b00",
  danger: "#d80020",
  info: "#3e86f6",
};

const D_SEM: Pick<AppearanceModeTokens, "success" | "warning" | "danger" | "info"> = {
  success: "#3e9f50",
  warning: "#ffc93e",
  danger: "#ff3842",
  info: "#0084ff",
};

function mode(
  primary: string,
  fg: string,
  accent: string,
  sem: Pick<AppearanceModeTokens, "success" | "warning" | "danger" | "info">
): AppearanceModeTokens {
  return { primary, primaryForeground: fg, accent, ...sem };
}

/** 内置皮肤（id 写入 APPEARANCE_SKIN） */
export const BUILT_IN_APPEARANCE_SKINS: AppearanceSkinDefinition[] = [
  {
    id: "brand_blue",
    label: "品牌蓝",
    description: "默认蓝 + 深色模式琥珀强调",
    light: mode("#163bf2", "#ffffff", "#7a60d2", L_SEM),
    dark: mode("#f5b82a", "#1a1508", "#a78bfa", D_SEM),
  },
  {
    id: "emerald",
    label: "翡翠绿",
    description: "清新绿色系",
    light: mode("#059669", "#ffffff", "#0d9488", L_SEM),
    dark: mode("#34d399", "#052e26", "#5eead4", D_SEM),
  },
  {
    id: "violet",
    label: "紫罗兰",
    description: "创意与科技感",
    light: mode("#6d28d9", "#ffffff", "#7c3aed", L_SEM),
    dark: mode("#c4b5fd", "#1e1b2e", "#a78bfa", D_SEM),
  },
  {
    id: "rose",
    label: "玫红",
    description: "偏暖的品牌色",
    light: mode("#e11d48", "#ffffff", "#db2777", L_SEM),
    dark: mode("#fb7185", "#2a121c", "#f472b6", D_SEM),
  },
  {
    id: "amber",
    label: "琥珀",
    description: "金色强调、阅读友好",
    light: mode("#d97706", "#ffffff", "#b45309", L_SEM),
    dark: mode("#fbbf24", "#29220a", "#fcd34d", D_SEM),
  },
  {
    id: "cyan",
    label: "青蓝",
    description: "冷静、专业",
    light: mode("#0891b2", "#ffffff", "#0e7490", L_SEM),
    dark: mode("#22d3ee", "#0c1e24", "#67e8f9", D_SEM),
  },
  {
    id: "slate",
    label: "板岩灰",
    description: "中性企业风",
    light: mode("#334155", "#ffffff", "#475569", L_SEM),
    dark: mode("#94a3b8", "#0f172a", "#cbd5e1", D_SEM),
  },
  {
    id: "crimson",
    label: "深红",
    description: "稳重、高对比",
    light: mode("#b91c1c", "#ffffff", "#991b1b", L_SEM),
    dark: mode("#f87171", "#2a0c0c", "#fca5a5", D_SEM),
  },
];

function assertUniqueAppearanceSkinIds(skins: AppearanceSkinDefinition[]) {
  const seen = new Set<string>();
  for (const s of skins) {
    if (seen.has(s.id)) {
      throw new Error(`[appearance-presets] duplicate built-in skin id: ${s.id}`);
    }
    seen.add(s.id);
  }
}

assertUniqueAppearanceSkinIds(BUILT_IN_APPEARANCE_SKINS);

export const BUILT_IN_SKIN_BY_ID: Record<string, AppearanceSkinDefinition> = Object.fromEntries(
  BUILT_IN_APPEARANCE_SKINS.map(s => [s.id, s])
);

export const DEFAULT_APPEARANCE_SKIN_ID = "brand_blue";
