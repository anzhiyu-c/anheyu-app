"use client";

import * as React from "react";
import { Switch } from "@heroui/react";
import { cn } from "@/lib/utils";

export interface FormSwitchProps {
  /** 开关上方的标签 */
  label?: string;
  /** 开关下方描述文本 */
  description?: React.ReactNode;
  /** 受控值 */
  checked?: boolean;
  /** 值变化回调 */
  onCheckedChange?: (checked: boolean) => void;
  /** 禁用状态 */
  disabled?: boolean;
  /** 容器额外 className */
  className?: string;
  /** PRO 标签 */
  isPro?: boolean;
}

const FormSwitch = React.forwardRef<HTMLInputElement, FormSwitchProps>(
  ({ label, description, checked = false, onCheckedChange, disabled, className, isPro }, ref) => {
    return (
      <div className={cn("flex items-center justify-between gap-4 py-2", className)}>
        <div className="flex-1 min-w-0">
          {label && (
            <span className="text-sm font-medium text-foreground/80 flex items-center gap-2">
              {label}
              {isPro && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-linear-to-r from-amber-500 to-orange-500 text-white leading-none">
                  PRO
                </span>
              )}
            </span>
          )}
          {description && <p className="text-xs leading-relaxed text-muted-foreground mt-0.5">{description}</p>}
        </div>

        <Switch
          ref={ref}
          isSelected={checked}
          onValueChange={onCheckedChange}
          isDisabled={disabled}
          aria-label={label || "开关"}
          size="sm"
          classNames={{
            wrapper: cn("group-data-[selected=true]:bg-primary"),
          }}
        />
      </div>
    );
  }
);
FormSwitch.displayName = "FormSwitch";

export { FormSwitch };
