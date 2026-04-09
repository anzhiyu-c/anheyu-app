"use client";

import * as React from "react";
import { addToast } from "@heroui/react";
import { cn } from "@/lib/utils";

export interface PlaceholderItem {
  /** 占位符文本，如 {{.SiteName}} */
  variable: string;
  /** 说明 */
  description: string;
}

export interface PlaceholderHelpPanelProps {
  /** 面板标题 */
  title?: string;
  /** 副标题/格式说明，如 "Go 模板格式，点击可复制" */
  subtitle?: string;
  /** 占位符列表 */
  items: PlaceholderItem[];
  /** 额外 class */
  className?: string;
}

/**
 * 可用占位符描述面板：展示模板变量列表，点击变量可复制到剪贴板
 */
export function PlaceholderHelpPanel({ title = "可用占位符", subtitle, items, className }: PlaceholderHelpPanelProps) {
  const handleCopy = React.useCallback((text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        addToast({ title: "已复制", color: "success", timeout: 1500 });
      })
      .catch(() => {
        addToast({ title: "复制失败", color: "danger", timeout: 2000 });
      });
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      className={cn("rounded-xl border border-border/50 bg-muted/40 p-3", className)}
      role="region"
      aria-label={title}
    >
      <p className="text-xs font-medium text-foreground/80 mb-2">{title}</p>
      {subtitle && <p className="text-[11px] text-muted-foreground mb-2">{subtitle}</p>}
      <ul className="space-y-1.5 text-xs">
        {items.map(({ variable, description }) => (
          <li key={variable} className="flex items-baseline gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleCopy(variable)}
              className={cn(
                "font-mono text-primary hover:bg-primary/10 rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 transition-colors",
                "focus:outline-none focus:ring-1 focus:ring-primary/30 focus:ring-offset-1"
              )}
              title="点击复制"
            >
              {variable}
            </button>
            <span className="text-muted-foreground shrink-0">：</span>
            <span className="text-foreground/70">{description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
