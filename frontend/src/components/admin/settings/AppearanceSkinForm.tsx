"use client";

import { useCallback, useMemo } from "react";
import { Tabs, Tab, Button, RadioGroup, Radio } from "@heroui/react";
import { FormMonacoEditor } from "@/components/ui/form-monaco-editor";
import { SettingsSection } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import { KEY_APPEARANCE_SKIN, KEY_APPEARANCE_TOKENS } from "@/lib/settings/setting-keys";
import {
  BUILT_IN_APPEARANCE_SKINS,
  BUILT_IN_SKIN_BY_ID,
  DEFAULT_APPEARANCE_SKIN_ID,
} from "@/lib/theme/appearance-presets";
import { AppearanceTokenColorField } from "./AppearanceTokenColorField";
import { tryParseAppearanceTokensJson } from "@/lib/theme/appearance-resolve";
import type { AppearanceModeTokens, AppearanceTokenKey } from "@/lib/theme/appearance-types";
import { APPEARANCE_TOKEN_KEYS } from "@/lib/theme/appearance-types";
import { cn } from "@/lib/utils";

const TOKEN_LABELS: Record<AppearanceTokenKey, string> = {
  primary: "主色",
  primaryForeground: "主色上的文字",
  success: "成功",
  warning: "警告",
  danger: "危险",
  info: "信息",
  accent: "辅助强调",
};

function compactTokensJson(o: {
  light?: Partial<AppearanceModeTokens>;
  dark?: Partial<AppearanceModeTokens>;
}): string {
  const pick = (p?: Partial<AppearanceModeTokens>) => {
    if (!p) return undefined;
    const e = Object.fromEntries(
      Object.entries(p).filter(([, v]) => typeof v === "string" && v.trim() !== "")
    ) as Partial<AppearanceModeTokens>;
    return Object.keys(e).length ? e : undefined;
  };
  const light = pick(o.light);
  const dark = pick(o.dark);
  const body: { light?: Partial<AppearanceModeTokens>; dark?: Partial<AppearanceModeTokens> } = {};
  if (light) body.light = light;
  if (dark) body.dark = dark;
  return Object.keys(body).length ? JSON.stringify(body) : "{}";
}

function updateTokenField(
  rawJson: string,
  mode: "light" | "dark",
  key: AppearanceTokenKey,
  value: string
): string {
  const parsedResult = tryParseAppearanceTokensJson(rawJson);
  if (!parsedResult.ok) {
    return rawJson;
  }
  const o = parsedResult.data;
  const branch: Partial<AppearanceModeTokens> = { ...(mode === "light" ? o.light : o.dark) };
  if (value.trim() === "") {
    delete branch[key];
  } else {
    branch[key] = value.trim();
  }
  const next = { ...o, [mode]: Object.keys(branch).length ? branch : undefined };
  if (!next.light || Object.keys(next.light).length === 0) delete next.light;
  if (!next.dark || Object.keys(next.dark).length === 0) delete next.dark;
  return compactTokensJson(next);
}

function presetTokensForSkin(skinId: string, mode: "light" | "dark"): AppearanceModeTokens {
  const id = skinId?.trim() || DEFAULT_APPEARANCE_SKIN_ID;
  const def = BUILT_IN_SKIN_BY_ID[id] ?? BUILT_IN_SKIN_BY_ID[DEFAULT_APPEARANCE_SKIN_ID];
  return mode === "light" ? def.light : def.dark;
}

interface AppearanceSkinFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

export function AppearanceSkinForm({ values, onChange, loading }: AppearanceSkinFormProps) {
  const skin = values[KEY_APPEARANCE_SKIN] || "brand_blue";
  const tokensJson = values[KEY_APPEARANCE_TOKENS] || "{}";
  const tokensParse = useMemo(() => tryParseAppearanceTokensJson(tokensJson), [tokensJson]);
  const parsed = tokensParse.ok ? tokensParse.data : {};

  const setSkin = useCallback((id: string) => onChange(KEY_APPEARANCE_SKIN, id), [onChange]);
  const setTokensJson = useCallback((s: string) => onChange(KEY_APPEARANCE_TOKENS, s), [onChange]);

  const onTokenChange = useCallback(
    (mode: "light" | "dark", key: AppearanceTokenKey, v: string) => {
      setTokensJson(updateTokenField(tokensJson, mode, key, v));
    },
    [tokensJson, setTokensJson]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  const renderModeVisualFields = (mode: "light" | "dark") => {
    const branch = mode === "light" ? parsed.light : parsed.dark;
    const disabled = !tokensParse.ok;
    const preset = presetTokensForSkin(skin, mode);
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {APPEARANCE_TOKEN_KEYS.map(key => (
          <AppearanceTokenColorField
            key={`${mode}-${key}`}
            label={`${TOKEN_LABELS[key]}（${mode === "light" ? "浅色" : "深色"}）`}
            overrideHex={branch?.[key] ?? ""}
            presetHex={preset[key]}
            disabled={disabled}
            onChange={v => onTokenChange(mode, key, v)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <SettingsSection title="配色方案">
        <p className="text-sm text-muted-foreground -mt-2 mb-4 max-w-3xl leading-relaxed">
          选择内置换肤方案后，前台会按当前亮/暗模式应用对应颜色；下方「令牌覆盖」可逐项覆盖预设（留空则沿用预设）。
          令牌与前台 CSS 变量对应：主色、语义色（成功/警告/危险/信息）及辅助强调色。
        </p>
        <RadioGroup
          value={skin}
          onValueChange={v => {
            if (v) setSkin(v);
          }}
          aria-label="配色方案"
          classNames={{
            base: "w-full",
            wrapper: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3",
          }}
        >
          {BUILT_IN_APPEARANCE_SKINS.map(def => (
            <Radio
              key={def.id}
              value={def.id}
              classNames={{
                base: cn(
                  "max-w-full m-0 w-full items-start border-2 rounded-xl p-4 transition-all min-h-0",
                  "data-[selected=true]:border-primary data-[selected=true]:bg-primary/5 data-[selected=true]:shadow-sm",
                  "border-border/80 bg-card data-[selected=false]:hover:border-primary/50 data-[selected=false]:hover:bg-muted/40"
                ),
                labelWrapper: "flex-1 min-w-0 ms-3 gap-0",
                label: "w-full",
              }}
            >
              <div className="flex flex-col text-left w-full">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="h-8 w-8 rounded-lg border border-border/60 shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${def.light.primary} 50%, ${def.dark.primary} 50%)`,
                    }}
                    aria-hidden
                  />
                  <span className="font-medium text-sm truncate">{def.label}</span>
                </div>
                <span className="text-xs text-muted-foreground leading-snug line-clamp-2">{def.description}</span>
              </div>
            </Radio>
          ))}
        </RadioGroup>
      </SettingsSection>

      <SettingsSection title="令牌覆盖（可选）">
        <p className="text-sm text-muted-foreground -mt-2 mb-4 max-w-3xl leading-relaxed">
          可视化取色与下方 JSON 写入同一字段 <code className="text-xs bg-muted px-1 rounded">APPEARANCE_TOKENS</code>
          。取色器与友链标签等处共用组件 <code className="text-xs bg-muted px-1 rounded">FormColorPicker</code>
          （HeroUI Popover + React Aria 色盘）；旁侧可手输 HEX，留空表示沿用当前配色方案的预设。
        </p>
        {!tokensParse.ok && (
          <p className="text-sm text-destructive mb-3" role="alert">
            令牌 JSON 无效，已禁用下方字段；请先在「高级：JSON 源码」中修正。原因：{tokensParse.error}
            <a
              href="#appearance-tokens-json-editor"
              className="ml-2 underline underline-offset-2 font-medium text-destructive"
            >
              跳转 JSON 编辑器
            </a>
          </p>
        )}
        <Tabs aria-label="亮暗模式颜色覆盖" variant="underlined" classNames={{ panel: "pt-4" }}>
          <Tab key="light" title="浅色模式">
            {renderModeVisualFields("light")}
          </Tab>
          <Tab key="dark" title="深色模式">
            {renderModeVisualFields("dark")}
          </Tab>
        </Tabs>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button size="sm" variant="flat" onPress={() => setTokensJson("{}")}>
            清空全部覆盖
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="高级：JSON 源码">
        <div id="appearance-tokens-json-editor" className="scroll-mt-24 space-y-3">
        <p className="text-sm text-muted-foreground -mt-2 mb-3">
          与上述字段同一数据；可直接编辑 <code className="text-xs bg-muted px-1 rounded">light</code> /{" "}
          <code className="text-xs bg-muted px-1 rounded">dark</code> 下的部分键。
        </p>
        <FormMonacoEditor
          label="APPEARANCE_TOKENS"
          language="json"
          height={220}
          wordWrap
          value={tokensJson}
          onValueChange={setTokensJson}
        />
        </div>
      </SettingsSection>
    </div>
  );
}
