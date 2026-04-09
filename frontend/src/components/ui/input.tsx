"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: boolean;
  helperText?: string;
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
  /** 用于可访问性的唯一 ID，如果未提供则自动生成 */
  inputId?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      label,
      error,
      helperText,
      startAdornment,
      endAdornment,
      value,
      defaultValue,
      inputId,
      placeholder,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(Boolean(value !== undefined && value !== "" ? value : defaultValue));

    // 生成唯一 ID 用于可访问性
    const generatedId = React.useId();
    const id = inputId || props.id || generatedId;
    const helperId = `${id}-helper`;

    // 监听 value 变化（受控组件）
    React.useEffect(() => {
      if (value !== undefined) {
        setHasValue(value !== "");
      }
    }, [value]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      setHasValue(e.target.value !== "");
      props.onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(e.target.value !== "");
      props.onChange?.(e);
    };

    // 标签浮动条件：聚焦 或 有内容
    const isFloating = isFocused || hasValue;

    // 当有浮动 label 时，只在 label 浮起后才显示 placeholder，避免重叠
    const effectivePlaceholder = label && !isFloating ? "" : placeholder;

    return (
      <div className="relative w-full">
        <div className="relative flex items-center w-full group">
          {/* 图标 - 垂直居中与输入框对齐 */}
          {startAdornment && (
            <div
              className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-10",
                "transition-colors duration-200 ease-out",
                error ? "text-red" : "text-muted-foreground"
              )}
            >
              {startAdornment}
            </div>
          )}

          <input
            id={id}
            type={type}
            value={value}
            defaultValue={defaultValue}
            aria-invalid={error}
            aria-describedby={helperText ? helperId : undefined}
            placeholder={effectivePlaceholder}
            className={cn(
              "peer flex h-11 w-full rounded-lg border px-3 py-2.5 text-sm",
              "transition-all duration-200 ease-out",
              "placeholder:text-muted-foreground",
              "focus:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error
                ? "border-red/40 bg-red/5 focus:border-red/60"
                : "border-border bg-muted/50 focus:border-primary focus:bg-card",
              startAdornment && "pl-10",
              endAdornment && "pr-10",
              className
            )}
            ref={ref}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            {...props}
          />

          {/* 浮动标签 */}
          {label && (
            <label
              htmlFor={id}
              className={cn(
                "absolute left-3 pointer-events-none",
                "px-1",
                "transition-all duration-200 ease-out",
                startAdornment && "left-10",
                isFloating
                  ? cn(
                      "-top-2 text-xs scale-100 bg-card",
                      error ? "text-red" : isFocused ? "text-primary" : "text-muted-foreground"
                    )
                  : "top-1/2 -translate-y-1/2 text-sm text-muted-foreground bg-transparent"
              )}
            >
              {label}
            </label>
          )}

          {/* 结尾装饰 - 垂直居中与输入框对齐 */}
          {endAdornment && (
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center transition-opacity duration-200">
              {endAdornment}
            </div>
          )}

          {/* 帮助文本或错误信息 - 带淡入动画 */}
          <p
            id={helperId}
            role={error ? "alert" : undefined}
            className={cn(
              "absolute -bottom-5 left-0 text-xs",
              "transition-all duration-200 ease-out",
              helperText ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1",
              error ? "text-red" : "text-muted-foreground"
            )}
          >
            {helperText || "\u00A0"}
          </p>
        </div>
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
