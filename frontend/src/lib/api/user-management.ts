/**
 * 管理端用户管理 API 服务
 * 对接 anheyu-app 后端 /api/admin/users 和 /api/admin/user-groups 接口
 */

import { apiClient } from "./client";
import type {
  AdminUser,
  AdminUserListParams,
  AdminUserListResponse,
  AdminCreateUserRequest,
  AdminUpdateUserRequest,
  AdminResetPasswordRequest,
  AdminUpdateUserStatusRequest,
  UserGroupDTO,
} from "@/types/user-management";

export const userManagementApi = {
  // ============================================
  //  用户列表
  // ============================================

  /**
   * 获取管理端用户列表（服务端分页 + 筛选 + 搜索）
   * GET /api/admin/users
   */
  async getUsers(params: AdminUserListParams = {}): Promise<AdminUserListResponse> {
    const { page = 1, pageSize = 10, keyword, groupID, status } = params;
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(page));
    queryParams.append("pageSize", String(pageSize));
    if (keyword) queryParams.append("keyword", keyword);
    if (groupID) queryParams.append("groupID", groupID);
    if (status !== undefined) queryParams.append("status", String(status));

    const response = await apiClient.get<AdminUserListResponse>(`/api/admin/users?${queryParams.toString()}`);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "获取用户列表失败");
  },

  // ============================================
  //  创建用户
  // ============================================

  /**
   * 管理员创建新用户
   * POST /api/admin/users
   */
  async createUser(data: AdminCreateUserRequest): Promise<AdminUser> {
    const response = await apiClient.post<AdminUser>("/api/admin/users", data);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "创建用户失败");
  },

  // ============================================
  //  更新用户
  // ============================================

  /**
   * 管理员更新用户信息
   * PUT /api/admin/users/:id
   */
  async updateUser(id: string, data: AdminUpdateUserRequest): Promise<void> {
    const response = await apiClient.put(`/api/admin/users/${id}`, data);
    if (response.code !== 200) {
      throw new Error(response.message || "更新用户失败");
    }
  },

  // ============================================
  //  删除用户
  // ============================================

  /**
   * 管理员删除用户（软删除）
   * DELETE /api/admin/users/:id
   */
  async deleteUser(id: string): Promise<void> {
    const response = await apiClient.delete(`/api/admin/users/${id}`);
    if (response.code !== 200) {
      throw new Error(response.message || "删除用户失败");
    }
  },

  // ============================================
  //  重置密码
  // ============================================

  /**
   * 管理员重置用户密码
   * POST /api/admin/users/:id/reset-password
   */
  async resetPassword(id: string, data: AdminResetPasswordRequest): Promise<void> {
    const response = await apiClient.post(`/api/admin/users/${id}/reset-password`, data);
    if (response.code !== 200) {
      throw new Error(response.message || "重置密码失败");
    }
  },

  // ============================================
  //  更新用户状态
  // ============================================

  /**
   * 管理员更新用户状态（封禁/解封）
   * PUT /api/admin/users/:id/status
   */
  async updateUserStatus(id: string, data: AdminUpdateUserStatusRequest): Promise<void> {
    const response = await apiClient.put(`/api/admin/users/${id}/status`, data);
    if (response.code !== 200) {
      throw new Error(response.message || "更新用户状态失败");
    }
  },

  // ============================================
  //  用户组
  // ============================================

  /**
   * 获取所有用户组列表
   * GET /api/admin/user-groups
   */
  async getUserGroups(): Promise<UserGroupDTO[]> {
    const response = await apiClient.get<UserGroupDTO[]>("/api/admin/user-groups");

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "获取用户组列表失败");
  },
};
