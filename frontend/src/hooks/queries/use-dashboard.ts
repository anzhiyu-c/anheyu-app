/**
 * Dashboard 相关 Query Hooks
 * 用于管理后台仪表盘数据获取
 */

import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import type {
  StatisticsSummary,
  ContentStats,
  TopArticle,
  RecentComment,
  VisitorTrendData,
  VisitorAnalytics,
} from "@/types/dashboard";

// ===================================
//          Query Keys
// ===================================

export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: () => [...dashboardKeys.all, "summary"] as const,
  content: () => [...dashboardKeys.all, "content"] as const,
  topArticles: (limit?: number) => [...dashboardKeys.all, "topArticles", limit] as const,
  recentComments: (limit?: number) => [...dashboardKeys.all, "recentComments", limit] as const,
  trend: (period?: string, days?: number) => [...dashboardKeys.all, "trend", period, days] as const,
  analytics: (startDate?: string, endDate?: string) => [...dashboardKeys.all, "analytics", startDate, endDate] as const,
};

// ===================================
//          Query Options
// ===================================

/** 统计概览 */
export const statisticsSummaryQueryOptions = () =>
  queryOptions({
    queryKey: dashboardKeys.summary(),
    queryFn: () => adminApi.statistics.getSummary(),
    staleTime: 1000 * 60 * 2, // 2 分钟（统计数据需要较新）
    retry: 2,
  });

/** 内容统计 */
export const contentStatsQueryOptions = () =>
  queryOptions({
    queryKey: dashboardKeys.content(),
    queryFn: () => adminApi.contentStats.getContentStats(),
    staleTime: 1000 * 60 * 5, // 5 分钟
    retry: 2,
  });

/** 热门文章 */
export const topArticlesQueryOptions = (limit: number = 5) =>
  queryOptions({
    queryKey: dashboardKeys.topArticles(limit),
    queryFn: () => adminApi.topArticles.getTopArticles(limit),
    staleTime: 1000 * 60 * 5, // 5 分钟
    retry: 2,
  });

/** 最近评论 */
export const recentCommentsQueryOptions = (limit: number = 5) =>
  queryOptions({
    queryKey: dashboardKeys.recentComments(limit),
    queryFn: () => adminApi.recentComments.getRecentComments(limit),
    staleTime: 1000 * 60 * 2, // 2 分钟
    retry: 2,
  });

/** 访客趋势 */
export const trendQueryOptions = (period: "daily" | "weekly" | "monthly" = "daily", days: number = 30) =>
  queryOptions({
    queryKey: dashboardKeys.trend(period, days),
    queryFn: () => adminApi.statistics.getTrend(period, days),
    staleTime: 1000 * 60 * 5, // 5 分钟
    retry: 2,
  });

/** 访客分析 */
export const analyticsQueryOptions = (startDate?: string, endDate?: string) =>
  queryOptions({
    queryKey: dashboardKeys.analytics(startDate, endDate),
    queryFn: () => adminApi.statistics.getAnalytics(startDate, endDate),
    staleTime: 1000 * 60 * 5, // 5 分钟
    retry: 2,
  });

// ===================================
//          Query Hooks
// ===================================

/**
 * 获取统计概览
 */
export function useStatisticsSummary(options?: { enabled?: boolean }) {
  return useQuery({
    ...statisticsSummaryQueryOptions(),
    enabled: options?.enabled ?? true,
  });
}

/**
 * 获取内容统计
 */
export function useContentStats(options?: { enabled?: boolean }) {
  return useQuery({
    ...contentStatsQueryOptions(),
    enabled: options?.enabled ?? true,
  });
}

/**
 * 获取热门文章
 */
export function useTopArticles(limit: number = 5, options?: { enabled?: boolean }) {
  return useQuery({
    ...topArticlesQueryOptions(limit),
    enabled: options?.enabled ?? true,
  });
}

/**
 * 获取最近评论
 */
export function useRecentComments(limit: number = 5, options?: { enabled?: boolean }) {
  return useQuery({
    ...recentCommentsQueryOptions(limit),
    enabled: options?.enabled ?? true,
  });
}

/**
 * 获取访客趋势
 */
export function useTrend(
  period: "daily" | "weekly" | "monthly" = "daily",
  days: number = 30,
  options?: { enabled?: boolean }
) {
  return useQuery({
    ...trendQueryOptions(period, days),
    enabled: options?.enabled ?? true,
  });
}

/**
 * 获取访客分析
 */
export function useAnalytics(startDate?: string, endDate?: string, options?: { enabled?: boolean }) {
  return useQuery({
    ...analyticsQueryOptions(startDate, endDate),
    enabled: options?.enabled ?? true,
  });
}

// ===================================
//          Mutation Hooks
// ===================================

/**
 * 审核评论
 */
export function useApproveComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => adminApi.recentComments.approveComment(id),
    onSuccess: () => {
      // 刷新评论列表
      queryClient.invalidateQueries({ queryKey: dashboardKeys.recentComments() });
      // 刷新内容统计
      queryClient.invalidateQueries({ queryKey: dashboardKeys.content() });
    },
  });
}

/**
 * 拒绝评论
 */
export function useRejectComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => adminApi.recentComments.rejectComment(id),
    onSuccess: () => {
      // 刷新评论列表
      queryClient.invalidateQueries({ queryKey: dashboardKeys.recentComments() });
      // 刷新内容统计
      queryClient.invalidateQueries({ queryKey: dashboardKeys.content() });
    },
  });
}

// ===================================
//          Combined Hook
// ===================================

export interface DashboardDataOptions {
  enabled?: boolean;
  topArticlesLimit?: number;
  recentCommentsLimit?: number;
  trendDays?: number;
}

/**
 * 获取完整的仪表盘数据（组合 hook）
 */
export function useDashboardData(options: DashboardDataOptions = {}) {
  const { enabled = true, topArticlesLimit = 5, recentCommentsLimit = 5 } = options;

  const summaryQuery = useStatisticsSummary({ enabled });
  const contentQuery = useContentStats({ enabled });
  const topArticlesQuery = useTopArticles(topArticlesLimit, { enabled });
  const recentCommentsQuery = useRecentComments(recentCommentsLimit, { enabled });

  const isLoading =
    summaryQuery.isLoading || contentQuery.isLoading || topArticlesQuery.isLoading || recentCommentsQuery.isLoading;

  const isError = summaryQuery.isError && contentQuery.isError;

  const error = summaryQuery.error || contentQuery.error;

  return {
    // 状态
    isLoading,
    isError,
    error,

    // 数据
    summary: summaryQuery.data as StatisticsSummary | undefined,
    content: contentQuery.data as ContentStats | undefined,
    topArticles: topArticlesQuery.data as TopArticle[] | undefined,
    recentComments: recentCommentsQuery.data as RecentComment[] | undefined,

    // 单独的 Query 状态（用于细粒度控制）
    queries: {
      summary: summaryQuery,
      content: contentQuery,
      topArticles: topArticlesQuery,
      recentComments: recentCommentsQuery,
    },

    // 刷新函数
    refetch: () => {
      summaryQuery.refetch();
      contentQuery.refetch();
      topArticlesQuery.refetch();
      recentCommentsQuery.refetch();
    },
  };
}

// ===================================
//          Export Types
// ===================================

export type { StatisticsSummary, ContentStats, TopArticle, RecentComment, VisitorTrendData, VisitorAnalytics };
