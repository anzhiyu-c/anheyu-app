"use client";

import { Button, Input } from "@heroui/react";
import { FormColorPicker } from "@/components/ui/form-color-picker";
import { cn } from "@/lib/utils";

export interface AppearanceTokenColorFieldProps {
  label: string;
  /** 用户覆盖值，空字符串表示使用预设 */
  overrideHex: string;
  /** 当前皮肤在该模式下的预设 HEX */
  presetHex: string;
  disabled?: boolean;
  onChange: (hex: string) => void;
}

/**
 * 站点换肤令牌：复用全局 {@link FormColorPicker}（与友链标签等一致），旁侧保留 HEX 输入与恢复预设。
 */
export function AppearanceTokenColorField({
  label,
  overrideHex,
  presetHex,
  disabled,
  onChange,
}: AppearanceTokenColorFieldProps) {
  const trimmed = overrideHex.trim();
  const hasOverride = trimmed.length > 0;
  const effectiveHex = hasOverride ? trimmed : presetHex;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-lg border border-border/60 bg-card/30 p-3",
        disabled && "opacity-50"
      )}
    >
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <FormColorPicker
            value={effectiveHex}
            onChange={onChange}
            disabled={disabled}
            triggerAriaLabel={`${label}：打开取色器`}
            className="h-8 w-8"
          />
          <span className="text-sm text-muted-foreground">取色器</span>
        </div>

        <Input
          size="sm"
          classNames={{
            base: "w-[9rem]",
            input: "font-mono text-xs",
            inputWrapper: "h-9",
          }}
          aria-label={`${label} HEX`}
          placeholder={presetHex}
          value={trimmed}
          onValueChange={v => onChange(v.trim())}
          isDisabled={disabled}
        />
        {hasOverride ? (
          <Button size="sm" variant="light" isDisabled={disabled} onPress={() => onChange("")}>
            恢复预设
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        预设{" "}
        <code className="rounded bg-muted px-1 font-mono text-[11px]">{presetHex}</code>
        {!hasOverride ? "（当前未覆盖）" : null}
      </p>
    </div>
  );
}
