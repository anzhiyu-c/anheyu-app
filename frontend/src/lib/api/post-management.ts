/**
 * 管理端文章 API 服务
 * 对接 anheyu-app 后端 /api/articles 接口
 */

import { apiClient } from "./client";
import type {
  AdminArticle,
  AdminArticleListParams,
  AdminArticleListResponse,
  CreateArticleRequest,
  UpdateArticleRequest,
  ImportArticlesParams,
  ImportArticlesResult,
  ArticleDetailForEdit,
  ArticleHistoryListResponse,
  ArticleHistoryDetail,
} from "@/types/post-management";
import { toSameOriginMediaUrl } from "@/utils/same-origin-media-url";

export const postManagementApi = {
  /**
   * 获取管理端文章列表（服务端分页 + 筛选 + 搜索）
   * GET /api/articles
   */
  async getArticles(params: AdminArticleListParams = {}): Promise<AdminArticleListResponse> {
    const { page = 1, pageSize = 10, query, status, author_id, category } = params;
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(page));
    queryParams.append("pageSize", String(pageSize));
    if (query) queryParams.append("query", query);
    if (status) queryParams.append("status", status);
    if (author_id) queryParams.append("author_id", author_id);
    if (category) queryParams.append("category", category);

    const response = await apiClient.get<AdminArticleListResponse>(`/api/articles?${queryParams.toString()}`);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "获取文章列表失败");
  },

  /**
   * 获取单篇文章详情（管理端）
   * GET /api/articles/:id
   */
  async getArticle(id: string): Promise<AdminArticle> {
    const response = await apiClient.get<AdminArticle>(`/api/articles/${id}`);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "获取文章详情失败");
  },

  /**
   * 获取文章详情（编辑用，包含 content_md 和 content_html）
   * GET /api/articles/:id
   */
  async getArticleForEdit(id: string): Promise<ArticleDetailForEdit> {
    const response = await apiClient.get<ArticleDetailForEdit>(`/api/articles/${id}`);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "获取文章详情失败");
  },

  /**
   * 删除单篇文章
   * DELETE /api/articles/:id
   */
  async deleteArticle(id: string): Promise<void> {
    const response = await apiClient.delete(`/api/articles/${id}`);
    if (response.code !== 200) {
      throw new Error(response.message || "删除文章失败");
    }
  },

  /**
   * 创建文章
   * POST /api/articles
   */
  async createArticle(data: CreateArticleRequest): Promise<AdminArticle> {
    const response = await apiClient.post<AdminArticle>("/api/articles", data);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "创建文章失败");
  },

  /**
   * 更新文章
   * PUT /api/articles/:id
   */
  async updateArticle(id: string, data: UpdateArticleRequest): Promise<AdminArticle> {
    const response = await apiClient.put<AdminArticle>(`/api/articles/${id}`, data);

    if (response.code === 200) {
      return response.data;
    }

    throw new Error(response.message || "更新文章失败");
  },

  /**
   * 上传文章图片
   * POST /api/articles/upload
   */
  async uploadArticleImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.post<{ url: string; file_id: string }>("/api/articles/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (response.code === 200 && response.data) {
      const { url } = response.data;

      if (url) {
        return toSameOriginMediaUrl(url);
      }
    }

    throw new Error(response.message || "上传图片失败");
  },

  /**
   * 导入文章
   * POST /api/articles/import
   */
  async importArticles(params: ImportArticlesParams): Promise<ImportArticlesResult> {
    const formData = new FormData();
    formData.append("file", params.file);
    if (params.create_categories !== undefined) {
      formData.append("create_categories", String(params.create_categories));
    }
    if (params.create_tags !== undefined) {
      formData.append("create_tags", String(params.create_tags));
    }
    if (params.skip_existing !== undefined) {
      formData.append("skip_existing", String(params.skip_existing));
    }
    if (params.default_status) {
      formData.append("default_status", params.default_status);
    }
    if (params.import_paid_content !== undefined) {
      formData.append("import_paid_content", String(params.import_paid_content));
    }
    if (params.import_password_content !== undefined) {
      formData.append("import_password_content", String(params.import_password_content));
    }
    if (params.import_full_text_hidden !== undefined) {
      formData.append("import_full_text_hidden", String(params.import_full_text_hidden));
    }

    const response = await apiClient.post<ImportArticlesResult>("/api/articles/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "导入文章失败");
  },

  /**
   * 获取文章历史版本列表
   * GET /api/articles/:id/history
   */
  async getArticleHistory(
    articleId: string,
    params: { page?: number; pageSize?: number } = {}
  ): Promise<ArticleHistoryListResponse> {
    const { page = 1, pageSize = 50 } = params;
    const response = await apiClient.get<ArticleHistoryListResponse>(
      `/api/articles/${articleId}/history?page=${page}&pageSize=${pageSize}`
    );

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "获取历史版本失败");
  },

  /**
   * 获取历史版本详情
   * GET /api/articles/:id/history/:version
   */
  async getArticleHistoryVersion(articleId: string, version: number): Promise<ArticleHistoryDetail> {
    const response = await apiClient.get<ArticleHistoryDetail>(`/api/articles/${articleId}/history/${version}`);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "获取历史版本详情失败");
  },

  /**
   * 恢复到指定版本
   * POST /api/articles/:id/history/:version/restore
   */
  async restoreArticleHistory(articleId: string, version: number): Promise<ArticleHistoryDetail> {
    const response = await apiClient.post<ArticleHistoryDetail>(
      `/api/articles/${articleId}/history/${version}/restore`
    );

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "恢复历史版本失败");
  },

  /**
   * 获取历史版本数量
   * GET /api/articles/:id/history/count
   */
  async getArticleHistoryCount(articleId: string): Promise<number> {
    const response = await apiClient.get<{ count: number }>(`/api/articles/${articleId}/history/count`);

    if (response.code === 200 && response.data) {
      return response.data.count;
    }

    throw new Error(response.message || "获取历史版本数量失败");
  },
};
