/**
 * 文档系列 API 服务
 * 对接后端 /api/doc-series 接口
 */

import { apiClient } from "./client";
import type {
  DocSeries,
  DocSeriesForm,
  DocSeriesListResponse,
  DocSeriesListParams,
  DocSeriesWithArticles,
} from "@/types/doc-series";

export const docSeriesApi = {
  /**
   * 获取文档系列列表（管理员，分页）
   * GET /api/doc-series
   */
  async getList(params: DocSeriesListParams = {}): Promise<DocSeriesListResponse> {
    const { page = 1, pageSize = 20, keyword } = params;
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(page));
    queryParams.append("pageSize", String(pageSize));
    if (keyword) {
      queryParams.append("keyword", keyword);
    }

    const response = await apiClient.get<DocSeriesListResponse>(`/api/doc-series?${queryParams.toString()}`);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "获取文档系列列表失败");
  },

  /**
   * 创建文档系列
   * POST /api/doc-series
   */
  async create(data: DocSeriesForm): Promise<DocSeries> {
    const response = await apiClient.post<DocSeries>("/api/doc-series", data);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "创建文档系列失败");
  },

  /**
   * 更新文档系列
   * PUT /api/doc-series/:id
   */
  async update(id: string, data: Partial<DocSeriesForm>): Promise<DocSeries> {
    const response = await apiClient.put<DocSeries>(`/api/doc-series/${id}`, data);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "更新文档系列失败");
  },

  /**
   * 删除文档系列
   * DELETE /api/doc-series/:id
   */
  async delete(id: string): Promise<void> {
    const response = await apiClient.delete(`/api/doc-series/${id}`);
    if (response.code !== 200) {
      throw new Error(response.message || "删除文档系列失败");
    }
  },

  /**
   * 获取文档系列及其文章列表（公共接口）
   * GET /api/public/doc-series/:id/articles
   */
  async getPublicSeriesWithArticles(id: string): Promise<DocSeriesWithArticles> {
    const response = await apiClient.get<DocSeriesWithArticles>(`/api/public/doc-series/${id}/articles`);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "获取文档系列详情失败");
  },
};
