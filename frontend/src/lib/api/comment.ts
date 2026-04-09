/**
 * 评论相关 API
 */

import { apiClient } from "./client";

// 评论类型
export interface Comment {
  id: string;
  created_at: string;
  pinned_at?: string | null;
  nickname: string;
  email_md5: string;
  qq_number?: string | null;
  avatar_url?: string | null;
  website?: string | null;
  content_html: string;
  is_admin_comment: boolean;
  is_anonymous: boolean;
  ip_location?: string;
  user_agent?: string;
  target_path: string;
  target_title?: string | null;
  parent_id?: string | null;
  reply_to_id?: string | null;
  reply_to_nick?: string | null;
  like_count: number;
  total_children: number;
  children?: Comment[];
  // 管理员字段（前台可忽略）
  email?: string | null;
  content?: string | null;
  status?: number;
}

// 评论列表响应
export interface CommentListResponse {
  list: Comment[];
  total: number;
  total_with_children?: number;
  page: number;
  pageSize: number;
}

// 获取最新评论参数
export interface GetLatestCommentsParams {
  page?: number;
  pageSize?: number;
}

// 获取路径评论参数
export interface GetCommentsParams {
  target_path: string;
  page?: number;
  pageSize?: number;
}

// 创建评论参数
export interface CreateCommentPayload {
  target_path: string;
  target_title?: string;
  parent_id?: string | null;
  reply_to_id?: string | null;
  nickname: string;
  email?: string;
  website?: string;
  content: string;
  is_anonymous: boolean;
}

// QQ 信息响应
export interface QQInfoResponse {
  nickname: string;
  avatar?: string;
}

// 上传图片响应
export interface UploadCommentResponse {
  id: string;
}

/**
 * 评论 API
 */
export const commentApi = {
  /**
   * 获取全站最新评论列表
   */
  async getLatestComments(params: GetLatestCommentsParams = {}): Promise<CommentListResponse> {
    const { page = 1, pageSize = 6 } = params;
    const response = await apiClient.get<CommentListResponse>(`/api/public/comments/latest`, {
      params: { page, pageSize },
    });
    if (response.code === 200 && response.data) {
      return response.data;
    }
    throw new Error(response.message || "获取最新评论失败");
  },

  /**
   * 获取指定路径的评论列表
   */
  async getCommentsByPath(params: GetCommentsParams): Promise<CommentListResponse> {
    const { target_path, page = 1, pageSize = 10 } = params;
    const response = await apiClient.get<CommentListResponse>(`/api/public/comments`, {
      params: { target_path, page, pageSize },
    });
    if (response.code === 200 && response.data) {
      return response.data;
    }
    throw new Error(response.message || "获取评论列表失败");
  },

  /**
   * 获取子评论列表
   */
  async getCommentChildren(
    parentId: string,
    params: { page?: number; pageSize?: number } = {}
  ): Promise<CommentListResponse> {
    const { page = 1, pageSize = 10 } = params;
    const response = await apiClient.get<CommentListResponse>(`/api/public/comments/${parentId}/children`, {
      params: { page, pageSize },
    });
    if (response.code === 200 && response.data) {
      return response.data;
    }
    throw new Error(response.message || "获取子评论失败");
  },

  /**
   * 创建评论
   */
  async createComment(payload: CreateCommentPayload): Promise<Comment> {
    const response = await apiClient.post<Comment>(`/api/public/comments`, payload);
    if (response.code === 200 && response.data) {
      return response.data;
    }
    throw new Error(response.message || "发表评论失败");
  },

  /**
   * 点赞评论
   */
  async likeComment(commentId: string): Promise<number> {
    const response = await apiClient.post<number>(`/api/public/comments/${commentId}/like`);
    if (response.code === 200 && response.data !== undefined) {
      return response.data;
    }
    throw new Error(response.message || "点赞失败");
  },

  /**
   * 取消点赞
   */
  async unlikeComment(commentId: string): Promise<number> {
    const response = await apiClient.post<number>(`/api/public/comments/${commentId}/unlike`);
    if (response.code === 200 && response.data !== undefined) {
      return response.data;
    }
    throw new Error(response.message || "取消点赞失败");
  },

  /**
   * 上传评论图片
   */
  async uploadCommentImage(file: File): Promise<UploadCommentResponse> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post<UploadCommentResponse>(`/api/public/comments/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    if (response.code === 200 && response.data) {
      return response.data;
    }
    throw new Error(response.message || "图片上传失败");
  },

  /**
   * 获取 QQ 信息
   */
  async getQQInfo(qq: string): Promise<QQInfoResponse> {
    const response = await apiClient.get<QQInfoResponse>(`/api/public/comments/qq-info`, {
      params: { qq },
    });
    if (response.code === 200 && response.data) {
      return response.data;
    }
    throw new Error(response.message || "获取 QQ 信息失败");
  },
};
