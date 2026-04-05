"use client";

import { motion, type Variants } from "framer-motion";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { VisitTrendChart, SourceChart, DeviceChart } from "@/components/admin/dashboard";

interface DashboardChartsProps {
  trendChartData: Array<{ date: string; views: number; visitors: number }>;
  sourceChartData: Array<{ name: string; value: number; percentage: number }>;
  deviceChartData: Array<{ name: string; value: number; percentage: number; icon: string }>;
  contentStats: {
    total_categories: number;
    total_tags: number;
    pending_comments: number;
    draft_articles: number;
  };
  queries: {
    summary: { isLoading: boolean };
  };
  itemVariants: Variants;
}

export function DashboardCharts({
  trendChartData,
  sourceChartData,
  deviceChartData,
  contentStats,
  queries,
  itemVariants,
}: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
      {/* 左侧：访问趋势 + 快捷统计 */}
      <motion.div variants={itemVariants} className="xl:col-span-2 space-y-6 flex flex-col">
        <VisitTrendChart data={trendChartData} isLoading={queries.summary.isLoading} />

        {/* 快捷统计卡片 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link
            href="/admin/categories"
            className="group flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-primary/30 transition-all"
          >
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
              <Icon icon="ri:folder-line" className="w-5 h-5" />
            </div>
            <div>
              <p className="text-lg font-semibold">{contentStats.total_categories}</p>
              <p className="text-xs text-muted-foreground">分类</p>
            </div>
          </Link>

          <Link
            href="/admin/tags"
            className="group flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-primary/30 transition-all"
          >
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
              <Icon icon="ri:price-tag-3-line" className="w-5 h-5" />
            </div>
            <div>
              <p className="text-lg font-semibold">{contentStats.total_tags}</p>
              <p className="text-xs text-muted-foreground">标签</p>
            </div>
          </Link>

          <Link
            href="/admin/comments?status=pending"
            className="group flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-primary/30 transition-all"
          >
            <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-600">
              <Icon icon="ri:time-line" className="w-5 h-5" />
            </div>
            <div>
              <p className="text-lg font-semibold">{contentStats.pending_comments}</p>
              <p className="text-xs text-muted-foreground">待审核评论</p>
            </div>
          </Link>

          <Link
            href="/admin/post-management?status=draft"
            className="group flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-primary/30 transition-all"
          >
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-500">
              <Icon icon="ri:draft-line" className="w-5 h-5" />
            </div>
            <div>
              <p className="text-lg font-semibold">{contentStats.draft_articles}</p>
              <p className="text-xs text-muted-foreground">草稿</p>
            </div>
          </Link>
        </div>
      </motion.div>

      {/* 右侧：访问来源 + 设备分布 */}
      <motion.div variants={itemVariants} className="flex flex-col h-full min-h-0 space-y-6">
        <div className="flex-1 min-h-0">
          <SourceChart data={sourceChartData} className="h-full" isLoading={queries.summary.isLoading} />
        </div>
        <DeviceChart data={deviceChartData} className="shrink-0" isLoading={queries.summary.isLoading} />
      </motion.div>
    </div>
  );
}
