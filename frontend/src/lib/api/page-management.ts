/**
 * 自定义页面管理 API 服务
 * 对接 anheyu-app 后端 /api/pages 和 /api/public/pages 接口
 */

import { apiClient } from "./client";
import type {
  CustomPage,
  PageListParams,
  PageListResponse,
  CreatePageRequest,
  UpdatePageRequest,
} from "@/types/page-management";

export const pageManagementApi = {
  // ============================================
  //  管理端接口
  // ============================================

  /**
   * 获取页面列表
   * GET /api/pages
   */
  async getPages(params: PageListParams = {}): Promise<PageListResponse> {
    const { page = 1, page_size = 10, search, is_published } = params;
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(page));
    queryParams.append("page_size", String(page_size));
    if (search) queryParams.append("search", search);
    if (is_published !== undefined) queryParams.append("is_published", String(is_published));

    const response = await apiClient.get<PageListResponse>(`/api/pages?${queryParams.toString()}`);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "获取页面列表失败");
  },

  /**
   * 获取单个页面详情（管理端，通过 ID）
   * GET /api/pages/:id
   */
  async getPageById(id: number): Promise<CustomPage> {
    const response = await apiClient.get<CustomPage>(`/api/pages/${id}`);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "获取页面详情失败");
  },

  /**
   * 创建页面
   * POST /api/pages
   */
  async createPage(data: CreatePageRequest): Promise<CustomPage> {
    const response = await apiClient.post<CustomPage>("/api/pages", data);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "创建页面失败");
  },

  /**
   * 更新页面
   * PUT /api/pages/:id
   */
  async updatePage(id: number, data: UpdatePageRequest): Promise<CustomPage> {
    const response = await apiClient.put<CustomPage>(`/api/pages/${id}`, data);

    if (response.code === 200) {
      return response.data;
    }

    throw new Error(response.message || "更新页面失败");
  },

  /**
   * 删除页面
   * DELETE /api/pages/:id
   */
  async deletePage(id: number): Promise<void> {
    const response = await apiClient.delete(`/api/pages/${id}`);
    if (response.code !== 200) {
      throw new Error(response.message || "删除页面失败");
    }
  },

  /**
   * 初始化默认页面
   * POST /api/pages/initialize
   */
  async initializeDefaultPages(): Promise<void> {
    const response = await apiClient.post("/api/pages/initialize");
    if (response.code !== 200) {
      throw new Error(response.message || "初始化默认页面失败");
    }
  },

  // ============================================
  //  公开接口
  // ============================================

  /**
   * 根据路径获取公开页面
   * GET /api/public/pages/:path
   */
  async getPageByPath(path: string): Promise<CustomPage> {
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    const response = await apiClient.get<CustomPage>(`/api/public/pages/${cleanPath}`);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "获取页面失败");
  },
};
