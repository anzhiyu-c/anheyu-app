/**
 * 将解析后的外观令牌写入 document（覆盖 globals.css 默认值）
 */
import type { SiteConfigData } from "@/types/site-config";
import type { AppearanceModeTokens } from "@/lib/theme/appearance-types";
import { resolveAppearanceModeTokens } from "@/lib/theme/appearance-resolve";

const HEX6 = /^#([A-Fa-f0-9]{6})$/;
const HEX3 = /^#([A-Fa-f0-9]{3})$/;

export function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const t = hex.trim();
  let m = t.match(HEX6);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  m = t.match(HEX3);
  if (m) {
    const [a, b, c] = m[1].split("").map(ch => ch + ch);
    const n = parseInt(a + b + c, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  return null;
}

function expandToHex6(hex: string): string | null {
  const rgb = parseHexRgb(hex);
  if (!rgb) return null;
  const to = (n: number) => n.toString(16).padStart(2, "0");
  return `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`;
}

function applyPrimaryWithOps(root: HTMLElement, hex: string): boolean {
  const normalized = expandToHex6(hex);
  if (!normalized) return false;
  const rgb = parseHexRgb(normalized);
  if (!rgb) return false;
  root.style.setProperty("--primary", normalized);
  root.style.setProperty("--primary-op", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`);
  root.style.setProperty("--primary-op-deep", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.87)`);
  root.style.setProperty("--primary-op-light", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.05)`);
  return true;
}

function setSolidOrRemove(root: HTMLElement, cssVar: string, hex: string) {
  const n = expandToHex6(hex);
  if (n) root.style.setProperty(cssVar, n);
  else root.style.removeProperty(cssVar);
}

/** 由 JS 写入、需在清除时移除的变量名 */
const MANAGED_CSS_VARS = [
  "--primary",
  "--primary-op",
  "--primary-op-deep",
  "--primary-op-light",
  "--primary-foreground",
  "--green",
  "--yellow",
  "--red",
  "--blue",
  "--purple",
] as const;

/** 主色解析失败时仅移除主色相关内联变量，保留语义色等已写入项 */
const PRIMARY_RELATED_CSS_VARS = [
  "--primary",
  "--primary-op",
  "--primary-op-deep",
  "--primary-op-light",
  "--primary-foreground",
] as const;

export function clearSitePrimaryAppearanceOverrides() {
  const root = document.documentElement;
  for (const k of PRIMARY_RELATED_CSS_VARS) {
    root.style.removeProperty(k);
  }
}

export function clearSiteAppearanceOverrides() {
  const root = document.documentElement;
  for (const k of MANAGED_CSS_VARS) {
    root.style.removeProperty(k);
  }
}

/**
 * 将单模式令牌应用到 :root（当前亮/暗由调用方传入的已解析令牌决定）
 */
export function applyAppearanceModeTokensToDocument(tokens: AppearanceModeTokens) {
  const root = document.documentElement;
  if (!applyPrimaryWithOps(root, tokens.primary)) {
    clearSitePrimaryAppearanceOverrides();
  } else {
    const fg = expandToHex6(tokens.primaryForeground);
    if (fg) {
      root.style.setProperty("--primary-foreground", fg);
    } else {
      root.style.removeProperty("--primary-foreground");
    }
  }
  setSolidOrRemove(root, "--green", tokens.success);
  setSolidOrRemove(root, "--yellow", tokens.warning);
  setSolidOrRemove(root, "--red", tokens.danger);
  setSolidOrRemove(root, "--blue", tokens.info);
  setSolidOrRemove(root, "--purple", tokens.accent);
}

/**
 * 从站点配置解析并应用当前主题模式下的外观
 */
export function applySiteAppearanceFromConfig(config: SiteConfigData | undefined | null, isDark: boolean) {
  const skin = config?.APPEARANCE_SKIN;
  const tokens = config?.APPEARANCE_TOKENS;
  const resolved = resolveAppearanceModeTokens(skin, tokens, isDark);
  applyAppearanceModeTokensToDocument(resolved);
}
