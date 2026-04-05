"use client";

import { motion, type Variants } from "framer-motion";
import { TopArticles, RecentComments } from "@/components/admin/dashboard";

interface DashboardRecentProps {
  topArticlesData: Array<{
    id: string | number;
    title: string;
    total_views: number;
    unique_views: number;
    avg_duration: number;
  }>;
  recentCommentsData: Array<{
    id: string | number;
    author: string;
    content: string;
    article_title: string;
    article_id: string | number;
    created_at: string;
    status: "pending" | "approved" | "spam";
  }>;
  onApprove: (id: string | number) => void;
  onReject: (id: string | number) => void;
  queries: {
    topArticles: { isLoading: boolean };
    recentComments: { isLoading: boolean };
  };
  itemVariants: Variants;
}

export function DashboardRecent({
  topArticlesData,
  recentCommentsData,
  onApprove,
  onReject,
  queries,
  itemVariants,
}: DashboardRecentProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 热门文章 */}
      <motion.div variants={itemVariants}>
        <TopArticles articles={topArticlesData} isLoading={queries.topArticles.isLoading} />
      </motion.div>

      {/* 最近评论 */}
      <motion.div variants={itemVariants}>
        <RecentComments
          comments={recentCommentsData}
          onApprove={onApprove}
          onReject={onReject}
          isLoading={queries.recentComments.isLoading}
        />
      </motion.div>
    </div>
  );
}
