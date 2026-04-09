"use client";

import { Icon } from "@iconify/react";
import { cn, formatNumber } from "@/lib/utils";

interface DashboardStatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: string;
  trend?: {
    value: number;
    isUp: boolean;
    label?: string;
  };
  className?: string;
  isLoading?: boolean;
}

export function DashboardStatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
  isLoading,
}: DashboardStatCardProps) {
  const displayValue = typeof value === "number" ? formatNumber(value) : value;

  if (isLoading) {
    return (
      <div className={cn("bg-card rounded-xl border border-border p-5 animate-pulse", className)}>
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 w-16 bg-muted rounded" />
          <div className="w-8 h-8 bg-muted rounded-lg" />
        </div>
        <div className="h-8 w-20 bg-muted rounded mb-1" />
        <div className="h-3 w-24 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-card rounded-xl border border-border p-5",
        "transition-all duration-200 hover:border-border/60 hover:shadow-sm",
        className
      )}
    >
      {/* 头部：图标和标题 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <div className="p-2 rounded-lg bg-muted/50 text-muted-foreground">
          <Icon icon={icon} className="w-4 h-4" />
        </div>
      </div>

      {/* 数值 */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight">{displayValue}</span>
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium",
              trend.isUp ? "text-green-600" : "text-red-500"
            )}
          >
            <Icon icon={trend.isUp ? "ri:arrow-up-s-fill" : "ri:arrow-down-s-fill"} className="w-3.5 h-3.5" />
            {trend.value}%
          </span>
        )}
      </div>

      {/* 副标题 */}
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}
