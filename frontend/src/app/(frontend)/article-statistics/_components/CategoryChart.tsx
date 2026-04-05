"use client";

import { useMemo } from "react";
import { PieChart } from "lucide-react";
import type { CategoryStatItem } from "@/types/article-statistics";
import styles from "../article-statistics.module.css";

interface CategoryChartProps {
  data: CategoryStatItem[];
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

export function CategoryChart({ data }: CategoryChartProps) {
  const safeData = useMemo(() => (Array.isArray(data) ? data.slice(0, 8) : []), [data]);
  const total = useMemo(() => safeData.reduce((sum, item) => sum + item.count, 0), [safeData]);

  // 计算饼图的 conic-gradient
  const gradient = useMemo(() => {
    if (safeData.length === 0) return "conic-gradient(#e5e7eb 0deg 360deg)";
    let current = 0;
    const stops = safeData.map((item, i) => {
      const start = current;
      const angle = total > 0 ? (item.count / total) * 360 : 0;
      current += angle;
      return `${COLORS[i % COLORS.length]} ${start}deg ${start + angle}deg`;
    });
    return `conic-gradient(${stops.join(", ")})`;
  }, [safeData, total]);

  return (
    <div className={styles.chartCard} style={{ animationDelay: "0.1s" }}>
      <h3 className={styles.chartTitle}>
        <PieChart />
        分类分布
      </h3>
      <div className={styles.categoryChart}>
        <div className={styles.pieContainer}>
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: gradient,
              mask: "radial-gradient(circle at center, transparent 55%, black 56%)",
              WebkitMask: "radial-gradient(circle at center, transparent 55%, black 56%)",
            }}
          />
          <div className={styles.pieCenter}>
            <div className={styles.pieCenterValue}>{total}</div>
            <div className={styles.pieCenterLabel}>总计</div>
          </div>
        </div>
        <div className={styles.legendList}>
          {safeData.length > 0 ? (
            safeData.map((item, i) => (
              <div key={item.name} className={styles.legendItem}>
                <div className={styles.legendDot} style={{ background: COLORS[i % COLORS.length] }} />
                <span>{item.name || "未分类"}</span>
                <span className={styles.legendCount}>{item.count}</span>
              </div>
            ))
          ) : (
            <span style={{ color: "var(--muted-foreground)" }}>暂无分类数据</span>
          )}
        </div>
      </div>
    </div>
  );
}
