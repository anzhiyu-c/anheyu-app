/**
 * 解析 APPEARANCE_SKIN + APPEARANCE_TOKENS 为当前模式下的完整令牌
 */
import type { AppearanceModeTokens, AppearanceTokensOverride } from "./appearance-types";
import { APPEARANCE_TOKEN_KEYS } from "./appearance-types";
import {
  BUILT_IN_SKIN_BY_ID,
  DEFAULT_APPEARANCE_SKIN_ID,
} from "./appearance-presets";

/** 仅保留白名单键且值为非空字符串的字段，忽略未知键与非字符串 */
function sanitizeTokensBranch(obj: Record<string, unknown>): Partial<AppearanceModeTokens> {
  const out: Partial<AppearanceModeTokens> = {};
  for (const k of APPEARANCE_TOKEN_KEYS) {
    const v = obj[k];
    if (typeof v === "string" && v.trim() !== "") {
      out[k] = v.trim();
    }
  }
  return out;
}

export type ParseAppearanceTokensResult =
  | { ok: true; data: AppearanceTokensOverride }
  | { ok: false; error: string };

/**
 * 解析 APPEARANCE_TOKENS JSON；失败时返回错误信息（不吞掉非法 JSON）。
 */
export function tryParseAppearanceTokensJson(raw: unknown): ParseAppearanceTokensResult {
  if (raw == null || raw === "") {
    return { ok: true, data: {} };
  }
  let text: string;
  if (typeof raw === "string") {
    text = raw.trim();
    if (!text || text === "{}") {
      return { ok: true, data: {} };
    }
  } else if (typeof raw === "object") {
    try {
      text = JSON.stringify(raw);
    } catch {
      return { ok: false, error: "无法序列化为 JSON" };
    }
  } else {
    return { ok: false, error: "类型无效" };
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "根节点须为对象" };
    }
    const o = parsed as Record<string, unknown>;

    if (o.light !== undefined && o.light !== null) {
      if (typeof o.light !== "object" || Array.isArray(o.light)) {
        return { ok: false, error: "light 须为对象" };
      }
    }
    if (o.dark !== undefined && o.dark !== null) {
      if (typeof o.dark !== "object" || Array.isArray(o.dark)) {
        return { ok: false, error: "dark 须为对象" };
      }
    }

    const light =
      o.light !== undefined && o.light !== null
        ? sanitizeTokensBranch(o.light as Record<string, unknown>)
        : undefined;
    const dark =
      o.dark !== undefined && o.dark !== null
        ? sanitizeTokensBranch(o.dark as Record<string, unknown>)
        : undefined;

    const data: AppearanceTokensOverride = {};
    if (light && Object.keys(light).length > 0) data.light = light;
    if (dark && Object.keys(dark).length > 0) data.dark = dark;
    return { ok: true, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

function deepMergeMode(
  base: AppearanceModeTokens,
  patch: Partial<AppearanceModeTokens> | undefined
): AppearanceModeTokens {
  if (!patch) return { ...base };
  const next = { ...base };
  for (const k of APPEARANCE_TOKEN_KEYS) {
    const v = patch[k];
    if (typeof v === "string" && v.trim() !== "") {
      next[k] = v.trim();
    }
  }
  return next;
}

export function parseAppearanceTokensJson(raw: unknown): AppearanceTokensOverride {
  const r = tryParseAppearanceTokensJson(raw);
  return r.ok ? r.data : {};
}

export function resolveAppearanceModeTokens(
  skinId: string | undefined,
  tokensOverride: unknown,
  isDark: boolean
): AppearanceModeTokens {
  const id = skinId?.trim() || DEFAULT_APPEARANCE_SKIN_ID;
  const baseSkin = BUILT_IN_SKIN_BY_ID[id] ?? BUILT_IN_SKIN_BY_ID[DEFAULT_APPEARANCE_SKIN_ID];
  const baseMode = isDark ? baseSkin.dark : baseSkin.light;
  const ov = parseAppearanceTokensJson(tokensOverride);
  const patch = isDark ? ov.dark : ov.light;
  return deepMergeMode(baseMode, patch);
}
