"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface FormCodeEditorProps {
  /** 标签 */
  label?: string;
  /** 受控值 */
  value?: string;
  /** 值变化回调 */
  onValueChange?: (value: string) => void;
  /** 描述文本 */
  description?: string;
  /** 错误提示 */
  error?: string;
  /** 语言提示 */
  language?: "html" | "css" | "javascript" | "json" | "text";
  /** 最小行数 */
  minRows?: number;
  /** 禁用状态 */
  disabled?: boolean;
  /** 容器额外 className */
  className?: string;
}

const FormCodeEditor = React.forwardRef<HTMLTextAreaElement, FormCodeEditorProps>(
  ({ label, value, onValueChange, description, error, language = "text", minRows = 8, disabled, className }, ref) => {
    const id = React.useId();
    const descId = `${id}-desc`;

    const langLabel: Record<string, string> = {
      html: "HTML",
      css: "CSS",
      javascript: "JavaScript",
      json: "JSON",
      text: "文本",
    };

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        {label && (
          <div className="flex items-center justify-between">
            <label htmlFor={id} className="text-sm font-medium text-foreground/80">
              {label}
            </label>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
              {langLabel[language] || language}
            </span>
          </div>
        )}

        <textarea
          ref={ref}
          id={id}
          value={value || ""}
          rows={minRows}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={description || error ? descId : undefined}
          onChange={e => onValueChange?.(e.target.value)}
          spellCheck={false}
          className={cn(
            "w-full rounded-xl border px-3.5 py-2.5 text-sm text-foreground font-mono resize-y leading-relaxed",
            "outline-none transition-all duration-200",
            "placeholder:text-muted-foreground/60",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error
              ? "border-danger bg-danger-50/50 focus:border-danger focus:ring-1 focus:ring-danger/20"
              : "border-border/80 bg-card hover:border-border-hover/40 focus:border-primary/65 focus:ring-2 focus:ring-primary/15"
          )}
        />

        {(description || error) && (
          <p
            id={descId}
            role={error ? "alert" : undefined}
            className={cn("text-xs leading-relaxed", error ? "text-danger" : "text-muted-foreground")}
          >
            {error || description}
          </p>
        )}
      </div>
    );
  }
);
FormCodeEditor.displayName = "FormCodeEditor";

export { FormCodeEditor };
