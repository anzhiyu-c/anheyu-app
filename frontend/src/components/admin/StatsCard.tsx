"use client";

import { Icon } from "@iconify/react";
import { formatNumber, cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: string;
  trend?: { value: number; isUp: boolean };
  color?: "primary" | "success" | "warning" | "danger" | "purple" | "cyan";
  className?: string;
}

const iconColorClasses: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-green-500/10 text-green-500",
  warning: "bg-orange-500/10 text-orange-500",
  danger: "bg-red-500/10 text-red-500",
  purple: "bg-purple-500/10 text-purple-500",
  cyan: "bg-cyan-500/10 text-cyan-500",
};

export function StatsCard({ title, value, subtitle, icon, trend, color = "primary", className }: StatsCardProps) {
  const displayValue = typeof value === "number" ? formatNumber(value) : value;

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-2xl p-5 transition-all hover:shadow-md hover:border-border/80",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-semibold tracking-tight">{displayValue}</p>
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full",
                  trend.isUp ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                )}
              >
                <Icon icon={trend.isUp ? "ri:arrow-up-line" : "ri:arrow-down-line"} className="w-3 h-3" />
                {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={cn("p-2.5 rounded-xl text-xl", iconColorClasses[color])}>
          <Icon icon={icon} />
        </div>
      </div>
    </div>
  );
}
