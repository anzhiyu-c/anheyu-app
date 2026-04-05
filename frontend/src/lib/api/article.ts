/**
 * 文章相关 API 服务
 */

import { apiClient } from "./client";
import type {
  FeedItem,
  FeedListResponse,
  GetFeedListParams,
  PostCategory,
  PostTag,
  Archive,
  ArticleListResponse,
  GetArticleListParams,
} from "@/types/article";

// ===================================
//          文章内容流 API
// ===================================

export const articleApi = {
  /**
   * 获取混合内容流（文章列表）
   * @param params 查询参数
   */
  async getFeedList(params: GetFeedListParams = {}): Promise<FeedListResponse> {
    const { page = 1, pageSize = 10, category, tag, year, month } = params;
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(page));
    queryParams.append("pageSize", String(pageSize));
    if (category) queryParams.append("category", category);
    if (tag) queryParams.append("tag", tag);
    if (year) queryParams.append("year", String(year));
    if (month) queryParams.append("month", String(month));

    const response = await apiClient.get<FeedListResponse>(`/api/public/articles?${queryParams.toString()}`);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "获取文章列表失败");
  },

  /**
   * 获取文章列表（仅文章）
   * @param params 查询参数
   */
  async getPublicArticles(params: GetArticleListParams = {}): Promise<ArticleListResponse> {
    const { page = 1, pageSize = 10, category, tag, year, month } = params;
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(page));
    queryParams.append("pageSize", String(pageSize));
    if (category) queryParams.append("category", category);
    if (tag) queryParams.append("tag", tag);
    if (year) queryParams.append("year", String(year));
    if (month) queryParams.append("month", String(month));

    const response = await apiClient.get<ArticleListResponse>(`/api/public/articles?${queryParams.toString()}`);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "获取文章列表失败");
  },

  /**
   * 获取分类列表
   */
  async getCategoryList(): Promise<PostCategory[]> {
    const response = await apiClient.get<PostCategory[]>(`/api/post-categories`);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "获取分类列表失败");
  },

  /**
   * 获取标签列表
   */
  async getTagList(sort: "count" | "name" = "count"): Promise<PostTag[]> {
    const response = await apiClient.get<PostTag[]>(`/api/post-tags`, {
      params: { sort },
    });

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "获取标签列表失败");
  },

  /**
   * 创建分类
   */
  async createCategory(data: {
    name: string;
    slug?: string;
    description?: string;
    is_series?: boolean;
    sort_order?: number;
  }): Promise<PostCategory> {
    const response = await apiClient.post<PostCategory>(`/api/post-categories`, data);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "创建分类失败");
  },

  /**
   * 创建标签
   */
  async createTag(data: { name: string; slug?: string }): Promise<PostTag> {
    const response = await apiClient.post<PostTag>(`/api/post-tags`, data);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "创建标签失败");
  },

  async updateCategory(
    id: string,
    data: { name?: string; slug?: string; description?: string; is_series?: boolean; sort_order?: number }
  ): Promise<PostCategory> {
    const response = await apiClient.put<PostCategory>(`/api/post-categories/${id}`, data);
    if (response.code === 200 && response.data) return response.data;
    throw new Error(response.message || "更新分类失败");
  },

  async updateTag(id: string, data: { name?: string; slug?: string }): Promise<PostTag> {
    const response = await apiClient.put<PostTag>(`/api/post-tags/${id}`, data);
    if (response.code === 200 && response.data) return response.data;
    throw new Error(response.message || "更新标签失败");
  },

  async deleteCategory(id: string): Promise<void> {
    const response = await apiClient.delete(`/api/post-categories/${id}`);
    if (response.code !== 200) throw new Error(response.message || "删除分类失败");
  },

  async deleteTag(id: string): Promise<void> {
    const response = await apiClient.delete(`/api/post-tags/${id}`);
    if (response.code !== 200) throw new Error(response.message || "删除标签失败");
  },

  /**
   * 获取文章统计数据
   */
  async getStatistics(): Promise<{ total_posts: number; total_words: number }> {
    const response = await apiClient.get<{ total_posts: number; total_words: number }>(
      `/api/public/articles/statistics`
    );

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "获取文章统计失败");
  },

  /**
   * 获取归档列表
   */
  async getRandomArticle(): Promise<{ id: number; is_doc?: boolean; doc_series_id?: number }> {
    const response = await apiClient.get<{ id: number; is_doc?: boolean; doc_series_id?: number }>(
      `/api/public/articles/random`
    );

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "获取随机文章失败");
  },

  async getArchiveList(): Promise<Archive[]> {
    // 后端返回 { list: Archive[] } 格式
    const response = await apiClient.get<{ list: Archive[] }>(`/api/public/articles/archives`);

    if (response.code === 200 && response.data) {
      return response.data.list || [];
    }

    throw new Error(response.message || "获取归档列表失败");
  },
};

export type {
  FeedItem,
  FeedListResponse,
  PostCategory,
  PostTag,
  Archive,
  GetFeedListParams,
  ArticleListResponse,
  GetArticleListParams,
};
