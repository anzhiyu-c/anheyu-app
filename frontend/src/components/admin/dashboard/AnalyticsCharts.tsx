"use client";

import { cn } from "@/lib/utils";
import { Icon } from "@iconify/react";

// 访问来源数据
interface SourceData {
  name: string;
  value: number;
  percentage: number;
}

// 设备数据
interface DeviceData {
  name: string;
  value: number;
  percentage: number;
  icon: string;
}

// 浏览器数据
interface BrowserData {
  name: string;
  value: number;
  percentage: number;
  icon: string;
}

interface SourceChartProps {
  data: SourceData[];
  className?: string;
  isLoading?: boolean;
}

interface DeviceChartProps {
  data: DeviceData[];
  className?: string;
  isLoading?: boolean;
}

interface BrowserChartProps {
  data: BrowserData[];
  className?: string;
  isLoading?: boolean;
}

// 来源颜色
const sourceColors = ["bg-primary", "bg-green-500", "bg-orange-500", "bg-purple-500", "bg-cyan-500", "bg-pink-500"];

const sourceTextColors = [
  "text-primary",
  "text-green-500",
  "text-orange-500",
  "text-purple-500",
  "text-cyan-500",
  "text-pink-500",
];

// 格式化来源名称
function formatSourceName(name: string): string {
  if (!name || name === "/") return "首页";
  try {
    // 尝试解码 URL
    const decoded = decodeURIComponent(name);
    // 如果是 URL 路径，简化显示
    if (decoded.startsWith("/posts/") || decoded.startsWith("/article/")) {
      const parts = decoded.split("#");
      const slug = parts[0].replace(/^\/(posts|article)\//, "");
      const anchor = parts[1] ? `#${parts[1]}` : "";
      // 如果有锚点，显示锚点内容
      if (anchor) {
        return decodeURIComponent(anchor.slice(1)).slice(0, 15) + "...";
      }
      return slug.slice(0, 15) + (slug.length > 15 ? "..." : "");
    }
    // 如果是完整 URL，提取域名
    if (decoded.startsWith("http")) {
      try {
        const url = new URL(decoded);
        return url.hostname;
      } catch {
        return decoded.slice(0, 20) + "...";
      }
    }
    return decoded.slice(0, 20) + (decoded.length > 20 ? "..." : "");
  } catch {
    return name.slice(0, 20) + (name.length > 20 ? "..." : "");
  }
}

/**
 * 访问来源饼图
 */
export function SourceChart({ data, className, isLoading }: SourceChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (isLoading) {
    return (
      <div className={cn("bg-card border border-border rounded-xl p-5 flex flex-col min-h-0 animate-pulse", className)}>
        <div className="h-5 w-24 bg-muted rounded mb-4" />
        <div className="flex items-center gap-6 flex-1 min-h-0">
          <div className="w-28 h-28 bg-muted rounded-full shrink-0" />
          <div className="flex-1 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-muted rounded-full" />
                  <div className="h-4 w-16 bg-muted rounded" />
                </div>
                <div className="h-4 w-8 bg-muted rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  const radius = 16;
  const innerRadius = 10;
  const cx = 16;
  const cy = 16;

  // 预先计算所有扇形的路径数据
  const arcData = (() => {
    const result: Array<{ name: string; path: string; colorIndex: number }> = [];
    let currentAngle = -Math.PI / 2; // 从顶部开始

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const percent = total > 0 ? item.value / total : 0;
      const angle = percent * Math.PI * 2;
      const startAngle = currentAngle;
      // 处理接近 100% 的情况，避免完整圆形路径问题
      const endAngle = percent > 0.99 ? startAngle + Math.PI * 1.9999 : currentAngle + angle;

      // 计算扇形路径
      const startOuter = { x: cx + radius * Math.cos(startAngle), y: cy + radius * Math.sin(startAngle) };
      const endOuter = { x: cx + radius * Math.cos(endAngle), y: cy + radius * Math.sin(endAngle) };
      const startInner = { x: cx + innerRadius * Math.cos(endAngle), y: cy + innerRadius * Math.sin(endAngle) };
      const endInner = { x: cx + innerRadius * Math.cos(startAngle), y: cy + innerRadius * Math.sin(startAngle) };
      const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

      const path = `M ${startOuter.x} ${startOuter.y} A ${radius} ${radius} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y} L ${startInner.x} ${startInner.y} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${endInner.x} ${endInner.y} Z`;

      result.push({ name: item.name, path, colorIndex: i });
      currentAngle += angle;
    }
    return result;
  })();

  return (
    <div className={cn("bg-card border border-border rounded-xl p-5 flex flex-col min-h-0", className)}>
      <h3 className="text-base font-semibold mb-4 shrink-0">访问来源</h3>

      <div className="flex items-center gap-6 flex-1 min-h-0">
        {/* 饼图 */}
        <div className="relative w-28 h-28 shrink-0">
          <svg viewBox="0 0 32 32" className="w-full h-full">
            {arcData.map((arc, arcIdx) => (
              <path
                key={`source-arc-${arcIdx}`}
                d={arc.path}
                className={sourceTextColors[arc.colorIndex % sourceTextColors.length]}
                fill="currentColor"
              />
            ))}
          </svg>
          {/* 中心显示总数 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-semibold">{total.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">总访问</p>
            </div>
          </div>
        </div>

        {/* 图例 */}
        <div className="flex-1 min-w-0 space-y-2 overflow-hidden">
          {data.slice(0, 5).map((item, index) => (
            <div key={`source-legend-${index}-${item.name}`} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className={cn("w-2 h-2 rounded-full shrink-0", sourceColors[index % sourceColors.length])} />
                <span className="text-muted-foreground truncate" title={item.name}>
                  {formatSourceName(item.name)}
                </span>
              </div>
              <span className="font-medium shrink-0">{item.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 设备分布图
 */
export function DeviceChart({ data, className, isLoading }: DeviceChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (isLoading) {
    return (
      <div className={cn("bg-card border border-border rounded-xl p-5 animate-pulse", className)}>
        <div className="h-5 w-24 bg-muted rounded mb-4" />
        <div className="space-y-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex items-center gap-2 shrink-0 w-24">
                <div className="w-4 h-4 bg-muted rounded" />
                <div className="h-4 w-12 bg-muted rounded" />
              </div>
              <div className="flex-1 h-2 bg-muted rounded-full" />
              <div className="h-4 w-10 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 为不同设备设置不同颜色
  const deviceColors = ["bg-primary", "bg-blue-500", "bg-cyan-500"];

  return (
    <div className={cn("bg-card border border-border rounded-xl p-5", className)}>
      <h3 className="text-base font-semibold mb-4">设备分布</h3>

      <div className="space-y-5">
        {data.map((item, index) => (
          <div key={item.name} className="flex items-center gap-3">
            {/* 图标 + 名称：固定宽度 */}
            <div className="flex items-center gap-2 shrink-0 w-24">
              <Icon icon={item.icon} className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm">{item.name}</span>
            </div>
            {/* 进度条：占满中间，与右侧百分比对齐 */}
            <div className="flex-1 min-w-0 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  deviceColors[index % deviceColors.length]
                )}
                style={{ width: `${item.percentage}%` }}
              />
            </div>
            {/* 百分比：固定宽度右对齐 */}
            <span className="text-sm font-medium w-12 text-right shrink-0 tabular-nums">{item.percentage}%</span>
          </div>
        ))}

        {/* 总计 - 与上方百分比列对齐 */}
        <div className="flex items-center gap-3 pt-3 border-t border-border/50 text-sm">
          <span className="text-muted-foreground shrink-0 w-24">总访问</span>
          <div className="flex-1 min-w-0" />
          <span className="font-semibold w-12 text-right shrink-0 tabular-nums">{total.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 浏览器分布图
 */
export function BrowserChart({ data, className }: BrowserChartProps) {
  return (
    <div className={cn("bg-card border border-border rounded-xl p-5", className)}>
      <h3 className="text-base font-semibold mb-4">浏览器分布</h3>

      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={item.name} className="flex items-center gap-3">
            <Icon icon={item.icon} className="w-5 h-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm truncate">{item.name}</span>
                <span className="text-sm text-muted-foreground ml-2">{item.percentage}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    sourceColors[index % sourceColors.length]
                  )}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
