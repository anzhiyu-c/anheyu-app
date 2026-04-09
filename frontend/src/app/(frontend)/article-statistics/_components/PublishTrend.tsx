"use client";

import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import type { PublishTrendItem } from "@/types/article-statistics";
import styles from "../article-statistics.module.css";

interface PublishTrendProps {
  data: PublishTrendItem[];
}

export function PublishTrend({ data }: PublishTrendProps) {
  const safeData = useMemo(() => {
    const arr = Array.isArray(data) ? data : [];
    return [...arr].reverse();
  }, [data]);

  const maxCount = useMemo(() => Math.max(...safeData.map(d => d.count), 1), [safeData]);

  const formatMonth = (month: string) => {
    const parts = month.split("-");
    return parts.length >= 2 ? `${parseInt(parts[1])}月` : month;
  };

  return (
    <div className={styles.chartCard} style={{ animationDelay: "0.2s" }}>
      <h3 className={styles.chartTitle}>
        <TrendingUp />
        发布趋势
      </h3>
      <div className={styles.trendChart}>
        {safeData.length > 0 ? (
          <div className={styles.trendBars}>
            {safeData.map((item, i) => (
              <div key={i} className={styles.trendBarWrapper}>
                <div
                  className={styles.trendBar}
                  style={{
                    height:
                      item.count <= 0
                        ? "0"
                        : `${Math.max((item.count / maxCount) * 100, 6)}%`,
                  }}
                >
                  <span className={styles.trendBarValue}>{item.count}</span>
                </div>
                <span className={styles.trendBarLabel}>{formatMonth(item.month)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>暂无发布趋势数据</div>
        )}
      </div>
    </div>
  );
}
