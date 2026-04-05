"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { PieChart } from "lucide-react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { statisticsApi } from "@/lib/api/admin";
import styles from "../about.module.css";

interface StatisticCardProps {
  cover: string;
}

interface StatItem {
  label: string;
  id: string;
  value: number;
}

export function StatisticCard({ cover }: StatisticCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animatedRef = useRef(false);
  const [stats, setStats] = useState<StatItem[]>([
    { label: "今日人数", id: "today-visitors", value: 0 },
    { label: "今日访问", id: "today-views", value: 0 },
    { label: "昨日人数", id: "yesterday-visitors", value: 0 },
    { label: "昨日访问", id: "yesterday-views", value: 0 },
    { label: "本月访问", id: "month-views", value: 0 },
    { label: "年访问量", id: "year-views", value: 0 },
  ]);
  const [isLoading, setIsLoading] = useState(true);

  // 获取统计数据
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await statisticsApi.getBasicStats();
        if (!cancelled && data) {
          setStats([
            { label: "今日人数", id: "today-visitors", value: data.today_visitors || 0 },
            { label: "今日访问", id: "today-views", value: data.today_views || 0 },
            { label: "昨日人数", id: "yesterday-visitors", value: data.yesterday_visitors || 0 },
            { label: "昨日访问", id: "yesterday-views", value: data.yesterday_views || 0 },
            { label: "本月访问", id: "month-views", value: data.month_views || 0 },
            { label: "年访问量", id: "year-views", value: data.year_views || 0 },
          ]);
        }
      } catch {
        // 静默处理，保持默认 0
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const animateNumber = useCallback((element: HTMLElement, target: number) => {
    let current = 0;
    const duration = 1500 + Math.random() * 1000;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      element.textContent = Math.floor(current).toLocaleString();
    }, 16);
  }, []);

  // 数据加载完成后启动动画
  useEffect(() => {
    if (isLoading || animatedRef.current || !containerRef.current) return;

    const startAnimation = () => {
      if (animatedRef.current) return;
      animatedRef.current = true;
      setTimeout(() => {
        const elements = containerRef.current?.querySelectorAll("[data-stat-value]");
        elements?.forEach(el => {
          const value = parseInt(el.getAttribute("data-stat-value") || "0");
          if (value > 0) animateNumber(el as HTMLElement, value);
        });
      }, 300);
    };

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            startAnimation();
            observer.disconnect();
          }
        });
      },
      { threshold: 0.3 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isLoading, stats, animateNumber]);

  return (
    <div
      ref={containerRef}
      className={`${styles.item} ${styles.aboutStatistic}`}
      style={{ backgroundImage: `url(${cover})`, backgroundPosition: "top" }}
    >
      <div className={styles.cardContent}>
        <div className={styles.itemTips}>数据</div>
        <span className={styles.itemTitle}>访问统计</span>

        {!isLoading ? (
          <div className={styles.statisticGrid}>
            {stats.map(stat => (
              <div key={stat.id} className={styles.statisticGridItem}>
                <span>{stat.label}</span>
                <span data-stat-value={stat.value}>0</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 16, opacity: 0.8 }}>加载中...</div>
        )}

        <div className={styles.statisticFooter}>
          <div className={styles.statisticFooterLeft}>
            <PieChart style={{ width: 14, height: 14 }} />
            <span>数据由本站自主统计</span>
          </div>
          <Link href="/article-statistics" className={styles.articleStatsBtn}>
            <Icon icon="tabler:circle-arrow-up-right-filled" width={22} height={22} />
            <span>文章统计</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
