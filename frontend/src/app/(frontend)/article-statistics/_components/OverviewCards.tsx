"use client";

import { FileText, Type, Eye, Calculator } from "lucide-react";
import type { ArticleStatistics } from "@/types/article-statistics";
import styles from "../article-statistics.module.css";

interface OverviewCardsProps {
  statistics: ArticleStatistics;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
};

export function OverviewCards({ statistics }: OverviewCardsProps) {
  const items = [
    { title: "文章总数", value: formatNumber(statistics.total_posts), icon: FileText, color: "#3b82f6" },
    { title: "总字数", value: formatNumber(statistics.total_words), icon: Type, color: "#10b981" },
    { title: "总浏览量", value: formatNumber(statistics.total_views), icon: Eye, color: "#f59e0b" },
    { title: "平均字数", value: formatNumber(statistics.avg_words), icon: Calculator, color: "#8b5cf6" },
  ];

  return (
    <div className={styles.overviewCards}>
      {items.map((item, index) => (
        <div key={index} className={styles.overviewCard} style={{ animationDelay: `${index * 0.1}s` }}>
          <div className={styles.cardIcon} style={{ background: item.color + "20" }}>
            <item.icon style={{ color: item.color }} />
          </div>
          <div className={styles.cardInfo}>
            <span className={styles.cardValue}>{item.value}</span>
            <span className={styles.cardLabel}>{item.title}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
