/**
 * 管理员 API 服务
 * 对接后端 /api/statistics/* 和 /api/admin/* 接口
 */

import { apiClient } from "./client";
import type {
  StatisticsSummary,
  VisitorStatistics,
  VisitorTrendData,
  VisitorAnalytics,
  URLStatistics,
  ContentStats,
  ArticleStatsResponse,
  CommentStatsResponse,
  TopArticle,
  RecentComment,
} from "@/types/dashboard";

// ============================================
// 访问统计 API
// ============================================

export const statisticsApi = {
  /**
   * 获取统计概览（包含基础统计、热门页面、访客分析、趋势数据）
   * GET /api/statistics/summary
   */
  async getSummary(): Promise<StatisticsSummary> {
    const response = await apiClient.get<StatisticsSummary>("/api/statistics/summary");
    if (response.code === 200 && response.data) {
      return response.data;
    }
    throw new Error(response.message || "获取统计概览失败");
  },

  /**
   * 获取基础统计数据
   * GET /api/public/statistics/basic
   */
  async getBasicStats(): Promise<VisitorStatistics> {
    const response = await apiClient.get<VisitorStatistics>("/api/public/statistics/basic");
    if (response.code === 200 && response.data) {
      return response.data;
    }
    throw new Error(response.message || "获取基础统计失败");
  },

  /**
   * 上报一次页面访问（SPA 路由需由前端主动调用；对应 POST /api/public/statistics/visit）
   */
  async recordVisit(payload: {
    url_path: string;
    page_title?: string;
    referer?: string;
    duration?: number;
  }): Promise<void> {
    try {
      await apiClient.post("/api/public/statistics/visit", {
        url_path: payload.url_path,
        page_title: payload.page_title ?? "",
        referer: payload.referer ?? "",
        duration: payload.duration ?? 0,
      });
    } catch {
      // 统计失败不影响页面使用
    }
  },

  /**
   * 获取访客趋势数据
   * GET /api/statistics/trend
   * @param period 时间周期 (daily/weekly/monthly)
   * @param days 查询天数
   */
  async getTrend(period: "daily" | "weekly" | "monthly" = "daily", days: number = 30): Promise<VisitorTrendData> {
    const response = await apiClient.get<VisitorTrendData>("/api/statistics/trend", {
      params: { period, days },
    });
    if (response.code === 200 && response.data) {
      return response.data;
    }
    throw new Error(response.message || "获取趋势数据失败");
  },

  /**
   * 获取访客分析数据
   * GET /api/statistics/analytics
   * @param startDate 开始日期 (YYYY-MM-DD)
   * @param endDate 结束日期 (YYYY-MM-DD)
   */
  async getAnalytics(startDate?: string, endDate?: string): Promise<VisitorAnalytics> {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const response = await apiClient.get<VisitorAnalytics>("/api/statistics/analytics", { params });
    if (response.code === 200 && response.data) {
      return response.data;
    }
    throw new Error(response.message || "获取访客分析失败");
  },

  /**
   * 获取热门页面
   * GET /api/statistics/top-pages
   * @param limit 返回数量
   */
  async getTopPages(limit: number = 10): Promise<URLStatistics[]> {
    const response = await apiClient.get<URLStatistics[]>("/api/statistics/top-pages", {
      params: { limit },
    });
    if (response.code === 200 && response.data) {
      return response.data;
    }
    throw new Error(response.message || "获取热门页面失败");
  },
};

// ============================================
// 内容统计 API
// ============================================

export const contentStatsApi = {
  /**
   * 获取文章统计
   * GET /api/public/articles/statistics
   */
  async getArticleStats(): Promise<ArticleStatsResponse> {
    const response = await apiClient.get<ArticleStatsResponse>("/api/public/articles/statistics");
    if (response.code === 200 && response.data) {
      return response.data;
    }
    throw new Error(response.message || "获取文章统计失败");
  },

  /**
   * 获取评论统计
   * 通过 /api/comments 获取评论列表并统计
   */
  async getCommentStats(): Promise<CommentStatsResponse> {
    try {
      // 后端没有专门的统计接口，通过获取评论列表来计算
      // 获取所有状态的评论总数
      const response = await apiClient.get<{ total: number }>("/api/comments", {
        params: { page: 1, pageSize: 1 },
      });

      if (response.code === 200 && response.data) {
        return {
          total: response.data.total || 0,
          approved: 0, // 后端没有按状态统计的接口
          pending: 0,
          spam: 0,
        };
      }
    } catch {
      // 忽略错误，返回默认值
    }
    return { total: 0, approved: 0, pending: 0, spam: 0 };
  },

  /**
   * 获取分类数量
   */
  async getCategoryCount(): Promise<number> {
    const response = await apiClient.get<{ id: string }[]>("/api/post-categories");
    if (response.code === 200 && response.data) {
      return response.data.length;
    }
    return 0;
  },

  /**
   * 获取标签数量
   */
  async getTagCount(): Promise<number> {
    const response = await apiClient.get<{ id: string }[]>("/api/post-tags");
    if (response.code === 200 && response.data) {
      return response.data.length;
    }
    return 0;
  },

  /**
   * 获取完整的内容统计
   */
  async getContentStats(): Promise<ContentStats> {
    try {
      const [articleStats, categoryCount, tagCount] = await Promise.all([
        this.getArticleStats().catch(() => ({ total: 0, published: 0, draft: 0, pending: 0 })),
        this.getCategoryCount().catch(() => 0),
        this.getTagCount().catch(() => 0),
      ]);

      // 尝试获取评论统计，失败时返回默认值
      let commentStats = { total: 0, approved: 0, pending: 0, spam: 0 };
      try {
        commentStats = await this.getCommentStats();
      } catch {
        // 评论统计接口可能不存在，忽略错误
      }

      return {
        total_articles: articleStats.total ?? 0,
        published_articles: articleStats.published ?? 0,
        draft_articles: articleStats.draft ?? 0,
        total_comments: commentStats.total ?? 0,
        pending_comments: commentStats.pending ?? 0,
        total_categories: categoryCount,
        total_tags: tagCount,
      };
    } catch (error) {
      console.error("获取内容统计失败:", error);
      throw error;
    }
  },
};

// ============================================
// 热门文章 API
// ============================================

export const topArticlesApi = {
  /**
   * 获取热门文章列表
   * 基于热门页面数据，过滤出文章页面
   */
  async getTopArticles(limit: number = 5): Promise<TopArticle[]> {
    try {
      const topPages = await statisticsApi.getTopPages(limit * 2); // 获取更多以过滤

      // 过滤出文章页面（URL 格式: /posts/xxx 或 /article/xxx）
      const articlePages = topPages.filter(
        page => page.url_path.startsWith("/posts/") || page.url_path.startsWith("/article/")
      );

      // 转换为 TopArticle 格式
      return articlePages.slice(0, limit).map((page, index) => ({
        id: String(index + 1),
        title: page.page_title || page.url_path,
        slug: page.url_path.replace(/^\/(posts|article)\//, ""),
        total_views: page.total_views,
        unique_views: page.unique_views,
        avg_duration: page.avg_duration,
      }));
    } catch (error) {
      console.error("获取热门文章失败:", error);
      return [];
    }
  },
};

// ============================================
// 最近评论 API
// ============================================

export const recentCommentsApi = {
  /**
   * 获取最近评论列表
   * GET /api/comments (管理员接口)
   */
  async getRecentComments(limit: number = 5): Promise<RecentComment[]> {
    interface AdminComment {
      id: string;
      nickname: string;
      avatar_url?: string;
      email_md5?: string;
      content_html: string;
      content?: string;
      target_title?: string;
      target_path: string;
      created_at: string;
      status?: number;
    }

    interface CommentsResponse {
      list: AdminComment[];
      total: number;
    }

    try {
      // 后端路径是 /api/comments，不是 /api/admin/comments
      // 后端不支持 sort/order 参数，默认按创建时间降序
      const response = await apiClient.get<CommentsResponse>("/api/comments", {
        params: { page: 1, pageSize: limit },
      });

      if (response.code === 200 && response.data?.list) {
        return response.data.list.map(comment => ({
          id: comment.id,
          author: comment.nickname,
          avatar: comment.avatar_url,
          content: comment.content_html || comment.content || "",
          article_title: comment.target_title || comment.target_path,
          article_id: comment.target_path.replace(/^\/(posts|article)\//, ""),
          created_at: comment.created_at,
          status: comment.status === 1 ? "approved" : comment.status === 2 ? "pending" : "approved",
        }));
      }

      return [];
    } catch (error) {
      console.error("获取最近评论失败:", error);
      return [];
    }
  },

  /**
   * 审核评论（通过）
   * PUT /api/comments/:id/status
   */
  async approveComment(id: string): Promise<void> {
    const response = await apiClient.put(`/api/comments/${id}/status`, { status: 1 });
    if (response.code !== 200) {
      throw new Error(response.message || "审核评论失败");
    }
  },

  /**
   * 拒绝评论（待审核）
   * PUT /api/comments/:id/status
   */
  async rejectComment(id: string): Promise<void> {
    const response = await apiClient.put(`/api/comments/${id}/status`, { status: 2 });
    if (response.code !== 200) {
      throw new Error(response.message || "拒绝评论失败");
    }
  },
};

// ============================================
// 导出统一的管理员 API
// ============================================

export const adminApi = {
  statistics: statisticsApi,
  contentStats: contentStatsApi,
  topArticles: topArticlesApi,
  recentComments: recentCommentsApi,
};
