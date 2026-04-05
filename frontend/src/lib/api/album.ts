/**
 * 相册管理 API 服务
 * 对接后端 /api/albums 接口
 */

import { apiClient, axiosInstance } from "./client";
import type {
  AlbumCategory,
  AlbumForm,
  AlbumListResponse,
  AlbumListParams,
  BatchImportAlbumsRequest,
  BatchImportAlbumsResult,
  CreateAlbumCategoryRequest,
  ExportAlbumsRequest,
  ImportAlbumsResult,
  UpdateAlbumCategoryRequest,
} from "@/types/album";

export const albumApi = {
  /**
   * 获取相册图片列表（管理员，分页）
   * GET /api/albums/get
   */
  async getList(params: AlbumListParams = {}): Promise<AlbumListResponse> {
    const { page = 1, pageSize = 10, categoryId, tag, sort } = params;
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(page));
    queryParams.append("pageSize", String(pageSize));
    if (categoryId !== undefined) {
      queryParams.append("categoryId", String(categoryId));
    }
    if (tag) {
      queryParams.append("tag", tag);
    }
    if (sort) {
      queryParams.append("sort", sort);
    }

    const response = await apiClient.get<AlbumListResponse>(`/api/albums/get?${queryParams.toString()}`);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "获取相册列表失败");
  },

  /**
   * 新增相册图片
   * POST /api/albums/add
   */
  async create(data: AlbumForm): Promise<void> {
    const response = await apiClient.post("/api/albums/add", data);

    if (response.code !== 200) {
      throw new Error(response.message || "添加图片失败");
    }
  },

  /**
   * 更新相册图片
   * PUT /api/albums/update/:id
   */
  async update(id: number, data: AlbumForm): Promise<void> {
    const response = await apiClient.put(`/api/albums/update/${id}`, data);

    if (response.code !== 200) {
      throw new Error(response.message || "更新图片失败");
    }
  },

  /**
   * 删除相册图片
   * DELETE /api/albums/delete/:id
   */
  async delete(id: number): Promise<void> {
    const response = await apiClient.delete(`/api/albums/delete/${id}`);
    if (response.code !== 200) {
      throw new Error(response.message || "删除图片失败");
    }
  },

  /**
   * 批量删除相册图片
   * DELETE /api/albums/batch-delete
   */
  async batchDelete(ids: number[]): Promise<number> {
    const response = await apiClient.delete<{ deleted: number }>("/api/albums/batch-delete", {
      data: { ids },
    });
    if (response.code === 200 && response.data) {
      return response.data.deleted;
    }
    throw new Error(response.message || "批量删除失败");
  },

  // ============================================
  //  分类管理
  // ============================================

  /**
   * 获取相册分类列表
   * GET /api/album-categories
   */
  async getCategories(): Promise<AlbumCategory[]> {
    const response = await apiClient.get<AlbumCategory[]>("/api/album-categories");
    if (response.code === 200 && response.data) {
      return response.data;
    }
    throw new Error(response.message || "获取相册分类失败");
  },

  /**
   * 创建相册分类
   * POST /api/album-categories
   */
  async createCategory(data: CreateAlbumCategoryRequest): Promise<AlbumCategory> {
    const response = await apiClient.post<AlbumCategory>("/api/album-categories", data);
    if (response.code === 200 && response.data) {
      return response.data;
    }
    throw new Error(response.message || "创建相册分类失败");
  },

  /**
   * 更新相册分类
   * PUT /api/album-categories/:id
   */
  async updateCategory(id: number, data: UpdateAlbumCategoryRequest): Promise<AlbumCategory> {
    const response = await apiClient.put<AlbumCategory>(`/api/album-categories/${id}`, data);
    if (response.code === 200 && response.data) {
      return response.data;
    }
    throw new Error(response.message || "更新相册分类失败");
  },

  /**
   * 删除相册分类
   * DELETE /api/album-categories/:id
   */
  async deleteCategory(id: number): Promise<void> {
    const response = await apiClient.delete<null>(`/api/album-categories/${id}`);
    if (response.code !== 200) {
      throw new Error(response.message || "删除相册分类失败");
    }
  },

  // ============================================
  //  导入导出
  // ============================================

  /**
   * URL 批量导入相册
   * POST /api/albums/batch-import
   */
  async batchImportAlbums(data: BatchImportAlbumsRequest): Promise<BatchImportAlbumsResult> {
    const response = await apiClient.post<BatchImportAlbumsResult>("/api/albums/batch-import", data);
    if (response.code === 200 && response.data) {
      return response.data;
    }
    throw new Error(response.message || "URL 批量导入失败");
  },

  /**
   * 文件/JSON 导入相册
   * POST /api/albums/import
   */
  async importAlbums(formData: FormData): Promise<ImportAlbumsResult> {
    const response = await apiClient.post<ImportAlbumsResult>("/api/albums/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    if (response.code === 200 && response.data) {
      return response.data;
    }
    throw new Error(response.message || "导入相册失败");
  },

  /**
   * 导出相册（返回 blob）
   * POST /api/albums/export
   */
  async exportAlbums(data: ExportAlbumsRequest): Promise<Blob> {
    const response = await axiosInstance.post("/api/albums/export", data, {
      responseType: "blob",
    });
    return response.data;
  },
};
