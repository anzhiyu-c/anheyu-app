"use client";

import { motion } from "framer-motion";
import { QuickActions } from "@/components/admin";
import { useDashboardPage } from "./_hooks/use-dashboard-page";
import { DashboardSkeleton } from "./_components/DashboardSkeleton";
import { DashboardHeader } from "./_components/DashboardHeader";
import { DashboardStats } from "./_components/DashboardStats";
import { DashboardCharts } from "./_components/DashboardCharts";
import { DashboardRecent } from "./_components/DashboardRecent";

// ==================== 动画配置 ====================
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

// ==================== 主组件 ====================
export default function AdminDashboard() {
  const {
    isLoading,
    basicStats,
    contentStats,
    viewsTrend,
    visitorsTrend,
    trendChartData,
    sourceChartData,
    deviceChartData,
    topArticlesData,
    recentCommentsData,
    handleApprove,
    handleReject,
    queries,
  } = useDashboardPage();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="visible">
      <motion.div variants={itemVariants}>
        <DashboardHeader />
      </motion.div>

      <motion.div variants={itemVariants}>
        <DashboardStats
          basicStats={basicStats}
          contentStats={contentStats}
          viewsTrend={viewsTrend}
          visitorsTrend={visitorsTrend}
          queries={queries}
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <QuickActions />
      </motion.div>

      <DashboardCharts
        trendChartData={trendChartData}
        sourceChartData={sourceChartData}
        deviceChartData={deviceChartData}
        contentStats={contentStats}
        queries={queries}
        itemVariants={itemVariants}
      />

      <DashboardRecent
        topArticlesData={topArticlesData}
        recentCommentsData={recentCommentsData}
        onApprove={handleApprove}
        onReject={handleReject}
        queries={queries}
        itemVariants={itemVariants}
      />
    </motion.div>
  );
}
