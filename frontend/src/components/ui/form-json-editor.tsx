"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface FormJsonEditorProps {
  /** 标签 */
  label?: string;
  /** 受控值（JSON 字符串） */
  value?: string;
  /** 值变化回调 */
  onValueChange?: (value: string) => void;
  /** 描述文本 */
  description?: string;
  /** 错误提示 */
  error?: string;
  /** 最小行数 */
  minRows?: number;
  /** 禁用状态 */
  disabled?: boolean;
  /** 占位文本 */
  placeholder?: string;
  /** 容器额外 className */
  className?: string;
}

const FormJsonEditor = React.forwardRef<HTMLTextAreaElement, FormJsonEditorProps>(
  ({ label, value, onValueChange, description, error, minRows = 6, disabled, placeholder, className }, ref) => {
    const id = React.useId();
    const descId = `${id}-desc`;
    const [jsonError, setJsonError] = React.useState<string>("");

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newVal = e.target.value;
      onValueChange?.(newVal);

      // 校验 JSON
      if (newVal.trim()) {
        try {
          JSON.parse(newVal);
          setJsonError("");
        } catch (err) {
          setJsonError(`JSON 格式错误: ${(err as Error).message}`);
        }
      } else {
        setJsonError("");
      }
    };

    const handleFormat = () => {
      if (!value?.trim()) return;
      try {
        const parsed = JSON.parse(value);
        const formatted = JSON.stringify(parsed, null, 2);
        onValueChange?.(formatted);
        setJsonError("");
      } catch {
        // 保持当前错误状态
      }
    };

    const displayError = error || jsonError;

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        {label && (
          <div className="flex items-center justify-between">
            <label htmlFor={id} className="text-sm font-medium text-foreground/80">
              {label}
            </label>
            <button
              type="button"
              onClick={handleFormat}
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              格式化 JSON
            </button>
          </div>
        )}

        <textarea
          ref={ref}
          id={id}
          value={value || ""}
          rows={minRows}
          disabled={disabled}
          aria-invalid={!!displayError}
          aria-describedby={description || displayError ? descId : undefined}
          onChange={handleChange}
          className={cn(
            "w-full rounded-xl border px-3.5 py-2.5 text-sm text-foreground font-mono resize-y",
            "outline-none transition-all duration-200",
            "placeholder:text-muted-foreground/60",
            "disabled:cursor-not-allowed disabled:opacity-50",
            displayError
              ? "border-danger bg-danger-50/50 focus:border-danger focus:ring-1 focus:ring-danger/20"
              : "border-border/80 bg-card hover:border-border-hover/40 focus:border-primary/65 focus:ring-2 focus:ring-primary/15"
          )}
          placeholder={placeholder || '{"key": "value"}'}
        />

        {(description || displayError) && (
          <p
            id={descId}
            role={displayError ? "alert" : undefined}
            className={cn("text-xs leading-relaxed", displayError ? "text-danger" : "text-muted-foreground")}
          >
            {displayError || description}
          </p>
        )}
      </div>
    );
  }
);
FormJsonEditor.displayName = "FormJsonEditor";

export { FormJsonEditor };
