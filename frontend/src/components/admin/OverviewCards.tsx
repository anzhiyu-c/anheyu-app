"use client";

import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface OverviewItem {
  label: string;
  value: number | string;
  color?: string;
}

interface OverviewCardsProps {
  items: OverviewItem[];
  className?: string;
}

const defaultColors = [
  "text-primary",
  "text-green-500",
  "text-orange-500",
  "text-purple-500",
  "text-cyan-500",
  "text-red-500",
];

export function OverviewCards({ items, className }: OverviewCardsProps) {
  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-4 gap-4", className)}>
      {items.map((item, index) => (
        <div
          key={item.label}
          className="bg-card border border-border rounded-2xl p-5 text-center transition-all hover:shadow-md hover:border-border/80"
        >
          <p
            className={cn("text-2xl sm:text-3xl font-bold", item.color || defaultColors[index % defaultColors.length])}
          >
            {typeof item.value === "number" ? formatNumber(item.value) : item.value}
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
