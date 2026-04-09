"use client";

import { useMemo } from "react";
import { useDashboardData, useApproveComment, useRejectComment } from "@/hooks/queries/use-dashboard";

// ==================== 工具函数 ====================
function calculateTrend(current: number, previous: number) {
  if (previous === 0) return { value: 0, isUp: true };
  const diff = ((current - previous) / previous) * 100;
  return { value: Math.abs(Math.round(diff)), isUp: diff >= 0 };
}

// ==================== 仪表盘页面 Hook ====================
export function useDashboardPage() {
  // 获取仪表盘数据
  const { summary, content, topArticles, recentComments, isLoading, queries } = useDashboardData({
    topArticlesLimit: 5,
    recentCommentsLimit: 5,
  });

  // 评论审核 mutations
  const approveComment = useApproveComment();
  const rejectComment = useRejectComment();

  // 计算趋势数据
  const viewsTrend = useMemo(() => {
    const todayViews = summary?.basic_stats?.today_views ?? 0;
    const yesterdayViews = summary?.basic_stats?.yesterday_views ?? 0;
    return calculateTrend(todayViews, yesterdayViews);
  }, [summary?.basic_stats?.today_views, summary?.basic_stats?.yesterday_views]);

  const visitorsTrend = useMemo(() => {
    const todayVisitors = summary?.basic_stats?.today_visitors ?? 0;
    const yesterdayVisitors = summary?.basic_stats?.yesterday_visitors ?? 0;
    return calculateTrend(todayVisitors, yesterdayVisitors);
  }, [summary?.basic_stats?.today_visitors, summary?.basic_stats?.yesterday_visitors]);

  // 转换趋势数据格式用于图表
  const trendChartData = useMemo(() => {
    const daily = summary?.trend_data?.daily;
    if (!daily || daily.length === 0) return [];
    return daily.map(item => {
      // 处理多种日期格式
      let dateStr = item.date;
      if (dateStr.includes("T")) {
        // ISO 格式: 2025-01-22T00:00:00Z -> 01-22
        dateStr = dateStr.split("T")[0];
      }
      if (dateStr.includes("-") && dateStr.length >= 10) {
        // YYYY-MM-DD -> MM-DD
        dateStr = dateStr.slice(5);
      }
      return {
        date: dateStr,
        views: item.views || 0,
        visitors: item.visitors || 0,
      };
    });
  }, [summary?.trend_data?.daily]);

  // 转换来源数据格式
  const sourceChartData = useMemo(() => {
    const topReferers = summary?.analytics?.top_referers;
    if (!topReferers) return [];
    const total = topReferers.reduce((sum, item) => sum + item.count, 0);
    return topReferers.slice(0, 5).map(item => ({
      name: item.referer || "直接访问",
      value: item.count,
      percentage: total > 0 ? Math.round((item.count / total) * 100) : 0,
    }));
  }, [summary?.analytics?.top_referers]);

  // 转换设备数据格式（后端 UA 解析为中文：桌面 / 手机 / 平板）
  const deviceChartData = useMemo(() => {
    const topDevices = summary?.analytics?.top_devices;
    if (!topDevices) return [];
    const total = topDevices.reduce((sum, item) => sum + item.count, 0);
    const iconMap: Record<string, string> = {
      desktop: "ri:computer-line",
      mobile: "ri:smartphone-line",
      tablet: "ri:tablet-line",
      other: "ri:device-line",
    };
    const resolveDevice = (raw: string) => {
      const t = raw.trim();
      const lower = t.toLowerCase();
      if (t === "桌面" || lower === "desktop") return { label: "桌面端", key: "desktop" as const };
      if (t === "手机" || lower === "mobile") return { label: "移动端", key: "mobile" as const };
      if (t === "平板" || lower === "tablet") return { label: "平板", key: "tablet" as const };
      return { label: "其他", key: "other" as const };
    };
    return topDevices.slice(0, 3).map(item => {
      const { label, key } = resolveDevice(item.device);
      return {
        name: label,
        value: item.count,
        percentage: total > 0 ? Math.round((item.count / total) * 100) : 0,
        icon: iconMap[key] || "ri:device-line",
      };
    });
  }, [summary?.analytics?.top_devices]);

  // 转换热门文章数据格式
  const topArticlesData = useMemo(() => {
    if (!topArticles) return [];
    return topArticles.map(article => ({
      id: article.id,
      title: article.title,
      total_views: article.total_views,
      unique_views: article.unique_views,
      avg_duration: article.avg_duration,
    }));
  }, [topArticles]);

  // 转换评论数据格式
  const recentCommentsData = useMemo((): Array<{
    id: string | number;
    author: string;
    content: string;
    article_title: string;
    article_id: string | number;
    created_at: string;
    status: "pending" | "approved" | "spam";
  }> => {
    if (!recentComments) return [];
    return recentComments.map(comment => ({
      id: comment.id,
      author: comment.author,
      content: comment.content,
      article_title: comment.article_title,
      article_id: comment.article_id,
      created_at: comment.created_at,
      status: comment.status as "pending" | "approved" | "spam",
    }));
  }, [recentComments]);

  // 处理评论审核
  const handleApprove = (id: string | number) => {
    approveComment.mutate(String(id));
  };

  const handleReject = (id: string | number) => {
    rejectComment.mutate(String(id));
  };

  // 使用真实数据或回退到默认值
  const basicStats = summary?.basic_stats || {
    today_visitors: 0,
    today_views: 0,
    yesterday_visitors: 0,
    yesterday_views: 0,
    month_views: 0,
    year_views: 0,
  };

  const contentStats = content || {
    total_articles: 0,
    published_articles: 0,
    draft_articles: 0,
    total_comments: 0,
    pending_comments: 0,
    total_categories: 0,
    total_tags: 0,
  };

  return {
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
  };
}
