"use client";

import * as React from "react";
import { Textarea } from "@heroui/react";
import { cn } from "@/lib/utils";

export interface FormTextareaProps {
  /** 输入框上方的标签 */
  label?: string;
  /** 占位符文本 */
  placeholder?: string;
  /** 受控值 */
  value?: string;
  /** 值变化回调（兼容 HeroUI onValueChange） */
  onValueChange?: (value: string) => void;
  /** 是否必填（label 后显示红色星号） */
  isRequired?: boolean;
  /** 输入框下方描述文本 */
  description?: string;
  /** 错误提示（非空时显示错误状态） */
  error?: string;
  /** 最小行数 */
  minRows?: number;
  /** 最大行数 */
  maxRows?: number;
  /** 最大字符数 */
  maxLength?: number;
  /** 禁用状态 */
  disabled?: boolean;
  /** 容器额外 className */
  className?: string;
  /** textarea 额外 className */
  textareaClassName?: string;
}

const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  (
    {
      label,
      placeholder,
      value,
      onValueChange,
      isRequired,
      description,
      error,
      minRows = 3,
      maxRows,
      maxLength,
      disabled,
      className,
      textareaClassName,
    },
    ref
  ) => {
    const id = React.useId();
    const descId = `${id}-desc`;

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        {/* Label（与 FormInput 一致，不依赖 HeroUI 的 labelPlacement） */}
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-foreground/80">
            {label}
            {isRequired && <span className="text-danger ml-0.5">*</span>}
          </label>
        )}

        <Textarea
          ref={ref}
          id={id}
          placeholder={placeholder}
          value={value}
          onValueChange={onValueChange}
          isInvalid={!!error}
          variant="bordered"
          minRows={minRows}
          maxRows={maxRows}
          maxLength={maxLength}
          isDisabled={disabled}
          aria-describedby={description || error ? descId : undefined}
          classNames={{
            inputWrapper: cn(
              "min-h-[5.5rem] py-2.5",
              "group-data-[focus=true]:ring-2 group-data-[focus=true]:ring-primary/15 group-data-[focus=true]:border-primary",
              error && "group-data-[focus=true]:border-danger group-data-[focus=true]:ring-danger/20",
              textareaClassName
            ),
            input: "text-sm",
          }}
        />

        {/* Description / Error（与 FormInput 一致） */}
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
FormTextarea.displayName = "FormTextarea";

export { FormTextarea };
