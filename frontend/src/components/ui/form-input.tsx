"use client";

import * as React from "react";
import { Input } from "@heroui/react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FormInputProps {
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
  description?: React.ReactNode;
  /** 错误提示（非空时显示错误状态） */
  error?: string;
  /** 输入类型 */
  type?: React.HTMLInputTypeAttribute;
  /** 最大字符数 */
  maxLength?: number;
  /** 尺寸 */
  size?: "sm" | "md";
  /** 前缀内容（图标等） */
  startContent?: React.ReactNode;
  /** 后缀内容 */
  endContent?: React.ReactNode;
  /** 禁用状态 */
  disabled?: boolean;
  /** 只读状态（展示用，不提交修改） */
  readOnly?: boolean;
  /** 容器额外 className */
  className?: string;
  /** 输入框额外 className */
  inputClassName?: string;
  /** 键盘事件 */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** 自动完成属性，用于控制浏览器自动填充行为 */
  autoComplete?: string;
  /** 自动聚焦 */
  autoFocus?: boolean;
}

/** 密码可见性切换按钮 */
function PasswordToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex items-center justify-center w-7 h-7 -mr-1 rounded-lg shrink-0",
        "text-muted-foreground hover:text-foreground/70 dark:hover:text-muted-foreground/40",
        "hover:bg-muted dark:hover:bg-secondary",
        "transition-all duration-150 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
      )}
      aria-label={visible ? "隐藏密码" : "显示密码"}
      tabIndex={-1}
    >
      {visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
    </button>
  );
}

const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  (
    {
      label,
      placeholder,
      value,
      onValueChange,
      isRequired,
      description,
      error,
      type = "text",
      maxLength,
      size = "md",
      startContent,
      endContent,
      disabled,
      readOnly,
      className,
      inputClassName,
      onKeyDown,
      autoComplete,
      autoFocus,
    },
    ref
  ) => {
    const id = React.useId();
    const descId = `${id}-desc`;
    const isPassword = type === "password";
    const [passwordVisible, setPasswordVisible] = React.useState(false);

    // 密码类型：实际使用的 type 取决于可见性切换状态
    const actualType = isPassword && passwordVisible ? "text" : type;

    // 密码类型自动追加眼睛按钮，与用户传入的 endContent 共存
    const resolvedEndContent = isPassword ? (
      <div className="flex items-center gap-0.5">
        {endContent}
        <PasswordToggle visible={passwordVisible} onToggle={() => setPasswordVisible(v => !v)} />
      </div>
    ) : (
      endContent
    );

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        {/* 手动放置 Label，不依赖 HeroUI 的 labelPlacement */}
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-foreground/80">
            {label}
            {isRequired && <span className="text-danger ml-0.5">*</span>}
          </label>
        )}

        <Input
          ref={ref}
          id={id}
          placeholder={placeholder}
          value={value}
          onValueChange={onValueChange}
          isInvalid={!!error}
          type={actualType}
          maxLength={maxLength}
          size={size === "sm" ? "sm" : "md"}
          variant="bordered"
          startContent={startContent}
          endContent={resolvedEndContent}
          isDisabled={disabled}
          isReadOnly={readOnly}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
          autoComplete={autoComplete ?? (isPassword ? "new-password" : undefined)}
          aria-describedby={description || error ? descId : undefined}
          classNames={{
            inputWrapper: cn(
              size === "sm" ? "h-9 min-h-9" : "h-10 min-h-10",
              "group-data-[focus=true]:ring-2 group-data-[focus=true]:ring-primary/15 group-data-[focus=true]:border-primary",
              error && "group-data-[focus=true]:border-danger group-data-[focus=true]:ring-danger/20",
              inputClassName
            ),
            input: "text-sm",
          }}
        />

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
);
FormInput.displayName = "FormInput";

export { FormInput };
