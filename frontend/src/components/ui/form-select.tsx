"use client";

import * as React from "react";
import { Select, SelectItem, type SelectProps } from "@heroui/react";
import { cn } from "@/lib/utils";

export interface FormSelectProps {
  /** 输入框上方的标签 */
  label?: string;
  /** 占位符文本 */
  placeholder?: string;
  /** 受控选中值（单选） */
  value?: string;
  /** 值变化回调 */
  onValueChange?: (value: string) => void;
  /** 是否必填 */
  isRequired?: boolean;
  /** 下方描述文本 */
  description?: React.ReactNode;
  /** 错误提示 */
  error?: string;
  /** 尺寸 */
  size?: "sm" | "md";
  /** 禁用状态 */
  disabled?: boolean;
  /** 容器额外 className */
  className?: string;
  /** SelectItem 子元素 */
  children: SelectProps["children"];
}

/**
 * 统一风格的下拉选择框
 * 默认灰底填充，展开/聚焦后白底 + 主题色边框
 * 内部使用 HeroUI Select，复用其下拉定位、键盘导航、无障碍能力
 */
function FormSelect({
  label,
  placeholder,
  value,
  onValueChange,
  isRequired,
  description,
  error,
  size = "md",
  disabled,
  className,
  children,
}: FormSelectProps) {
  const id = React.useId();
  const descId = `${id}-desc`;

  const handleSelectionChange = React.useCallback(
    (keys: "all" | Set<React.Key>) => {
      if (keys === "all") return;
      const selected = Array.from(keys)[0];
      if (selected !== undefined) {
        onValueChange?.(String(selected));
      }
    },
    [onValueChange]
  );

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/* 外部 Label */}
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground/80">
          {label}
          {isRequired && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}

      <Select
        aria-label={label || placeholder || "选择"}
        placeholder={placeholder}
        selectedKeys={value ? [value] : []}
        onSelectionChange={handleSelectionChange}
        isDisabled={disabled}
        size={size === "sm" ? "sm" : "md"}
        variant="bordered"
        aria-describedby={description || error ? descId : undefined}
        classNames={{
          trigger: cn(
            size === "sm" ? "h-9 min-h-9" : "h-10 min-h-10",
            "data-[focus=true]:ring-2 data-[focus=true]:ring-primary/15 data-[focus=true]:border-primary",
            "data-[open=true]:ring-2 data-[open=true]:ring-primary/15 data-[open=true]:border-primary",
            error && "data-[focus=true]:border-danger data-[focus=true]:ring-danger/20 data-[open=true]:border-danger data-[open=true]:ring-danger/20"
          ),
          value: "text-sm",
        }}
      >
        {children}
      </Select>

      {/* Description / Error */}
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

FormSelect.displayName = "FormSelect";

// 重新导出 SelectItem 方便使用方不需要额外导入 HeroUI
const FormSelectItem = SelectItem;

export { FormSelect, FormSelectItem };
