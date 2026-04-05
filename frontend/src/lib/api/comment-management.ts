/**
 * 管理端评论 API 服务
 * 对接后端 /api/comments 管理员接口
 */

import { apiClient, axiosInstance } from "./client";
import type {
  AdminCommentListParams,
  AdminCommentListResponse,
  UpdateCommentInfoRequest,
  ImportCommentsParams,
  ImportCommentsResult,
} from "@/types/comment-management";

export const commentManagementApi = {
  // ============================================
  //  评论列表
  // ============================================

  /**
   * 获取管理端评论列表（服务端分页 + 筛选）
   * GET /api/comments
   */
  async getComments(params: AdminCommentListParams = {}): Promise<AdminCommentListResponse> {
    const { page = 1, pageSize = 10, nickname, email, target_path, ip_address, content, status } = params;
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(page));
    queryParams.append("pageSize", String(pageSize));
    if (nickname) queryParams.append("nickname", nickname);
    if (email) queryParams.append("email", email);
    if (target_path) queryParams.append("target_path", target_path);
    if (ip_address) queryParams.append("ip_address", ip_address);
    if (content) queryParams.append("content", content);
    if (status !== undefined) queryParams.append("status", String(status));

    const response = await apiClient.get<AdminCommentListResponse>(`/api/comments?${queryParams.toString()}`);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "获取评论列表失败");
  },

  // ============================================
  //  删除
  // ============================================

  /**
   * 批量删除评论
   * DELETE /api/comments
   */
  async deleteComments(ids: string[]): Promise<void> {
    const response = await apiClient.delete<unknown>("/api/comments", {
      data: { ids },
    });
    if (response.code !== 200) {
      throw new Error(response.message || "删除评论失败");
    }
  },

  // ============================================
  //  状态更新
  // ============================================

  /**
   * 更新评论状态
   * PUT /api/comments/:id/status
   * @param status 1=已发布, 2=待审核
   */
  async updateCommentStatus(id: string, status: number): Promise<void> {
    const response = await apiClient.put(`/api/comments/${id}/status`, { status });
    if (response.code !== 200) {
      throw new Error(response.message || "更新评论状态失败");
    }
  },

  // ============================================
  //  内容更新
  // ============================================

  /**
   * 更新评论内容（Markdown）
   * PUT /api/comments/:id
   */
  async updateCommentContent(id: string, content: string): Promise<void> {
    const response = await apiClient.put(`/api/comments/${id}`, { content });
    if (response.code !== 200) {
      throw new Error(response.message || "更新评论内容失败");
    }
  },

  /**
   * 更新评论信息（内容、昵称、邮箱、网站）
   * PUT /api/comments/:id/info
   */
  async updateCommentInfo(id: string, data: UpdateCommentInfoRequest): Promise<void> {
    const response = await apiClient.put(`/api/comments/${id}/info`, data);
    if (response.code !== 200) {
      throw new Error(response.message || "更新评论信息失败");
    }
  },

  // ============================================
  //  置顶
  // ============================================

  /**
   * 切换评论置顶状态
   * PUT /api/comments/:id/pin
   */
  async togglePin(id: string, pinned: boolean): Promise<void> {
    const response = await apiClient.put(`/api/comments/${id}/pin`, { pinned });
    if (response.code !== 200) {
      throw new Error(response.message || "置顶操作失败");
    }
  },

  // ============================================
  //  导入 & 导出
  // ============================================

  /**
   * 导出评论（返回 ZIP Blob）
   * POST /api/comments/export
   */
  async exportComments(ids?: string[]): Promise<Blob> {
    const response = await axiosInstance.post("/api/comments/export", { ids: ids ?? [] }, { responseType: "blob" });
    return response.data;
  },

  /**
   * 导入评论
   * POST /api/comments/import
   */
  async importComments(params: ImportCommentsParams): Promise<ImportCommentsResult> {
    const formData = new FormData();
    formData.append("file", params.file);
    if (params.skip_existing !== undefined) {
      formData.append("skip_existing", String(params.skip_existing));
    }
    if (params.default_status !== undefined) {
      formData.append("default_status", String(params.default_status));
    }
    if (params.keep_create_time !== undefined) {
      formData.append("keep_create_time", String(params.keep_create_time));
    }

    const response = await apiClient.post<ImportCommentsResult>("/api/comments/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "导入评论失败");
  },
};
