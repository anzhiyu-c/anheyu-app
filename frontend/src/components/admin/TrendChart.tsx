"use client";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils";
import { useState } from "react";

interface TrendData {
  date: string;
  views: number;
  visitors: number;
}

interface TrendChartProps {
  data: TrendData[];
  title?: string;
  description?: string;
  className?: string;
}

export function TrendChart({
  data,
  title = "访问趋势",
  description = "最近 7 天的访问数据",
  className,
}: TrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const maxViews = Math.max(...data.map(d => d.views), 1);

  // 计算总数
  const totalViews = data.reduce((sum, d) => sum + d.views, 0);
  const totalVisitors = data.reduce((sum, d) => sum + d.visitors, 0);

  return (
    <div className={cn("bg-card border border-border rounded-2xl overflow-hidden", className)}>
      <div className="p-5 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-right">
              <p className="font-semibold">{formatNumber(totalViews)}</p>
              <p className="text-xs text-muted-foreground">浏览量</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-primary">{formatNumber(totalVisitors)}</p>
              <p className="text-xs text-muted-foreground">访客</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5">
        {/* 悬停提示 */}
        <div className="h-5 mb-2 text-center">
          {hoveredIndex !== null && data[hoveredIndex] && (
            <span className="text-xs text-muted-foreground">
              {data[hoveredIndex].date}：
              <span className="text-foreground font-medium ml-1">{formatNumber(data[hoveredIndex].views)}</span> 浏览 /
              <span className="text-primary font-medium ml-1">{formatNumber(data[hoveredIndex].visitors)}</span> 访客
            </span>
          )}
        </div>

        {/* 图表 */}
        <div className="h-40 flex items-end justify-between gap-1.5">
          {data.map((item, index) => (
            <div
              key={index}
              className="flex-1 flex flex-col items-center gap-1.5 group cursor-pointer"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div className="w-full relative" style={{ height: `${Math.max((item.views / maxViews) * 100, 4)}%` }}>
                {/* 浏览量柱 */}
                <div
                  className={cn(
                    "absolute inset-0 bg-primary/15 rounded-t-md transition-all",
                    hoveredIndex === index && "bg-primary/25"
                  )}
                />
                {/* 访客柱 */}
                <div
                  className={cn(
                    "absolute bottom-0 left-0 right-0 bg-primary rounded-t-md transition-all",
                    hoveredIndex === index && "bg-primary/90"
                  )}
                  style={{ height: `${item.views > 0 ? (item.visitors / item.views) * 100 : 0}%` }}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] text-muted-foreground transition-colors",
                  hoveredIndex === index && "text-foreground font-medium"
                )}
              >
                {item.date}
              </span>
            </div>
          ))}
        </div>

        {/* 图例 */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm bg-primary/20" />
            <span className="text-xs text-muted-foreground">浏览量</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm bg-primary" />
            <span className="text-xs text-muted-foreground">访客</span>
          </div>
        </div>
      </div>
    </div>
  );
}
