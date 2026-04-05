/**
 * 用户管理 Query Hooks
 * 对接管理端用户 API，提供服务端分页查询和各类 mutation
 */

import { useQuery, useMutation, useQueryClient, queryOptions, keepPreviousData } from "@tanstack/react-query";
import { userManagementApi } from "@/lib/api/user-management";
import type {
  AdminUserListParams,
  AdminCreateUserRequest,
  AdminUpdateUserRequest,
  AdminResetPasswordRequest,
  AdminUpdateUserStatusRequest,
} from "@/types/user-management";

// ===================================
//          Query Keys
// ===================================

export const userManagementKeys = {
  all: ["user-management"] as const,
  lists: () => [...userManagementKeys.all, "list"] as const,
  list: (params: AdminUserListParams) => [...userManagementKeys.lists(), params] as const,
  groups: () => [...userManagementKeys.all, "groups"] as const,
};

// ===================================
//          Query Options
// ===================================

export const adminUsersQueryOptions = (params: AdminUserListParams = {}) =>
  queryOptions({
    queryKey: userManagementKeys.list(params),
    queryFn: () => userManagementApi.getUsers(params),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2, // 2 分钟
  });

export const userGroupsQueryOptions = () =>
  queryOptions({
    queryKey: userManagementKeys.groups(),
    queryFn: () => userManagementApi.getUserGroups(),
    staleTime: 1000 * 60 * 10, // 10 分钟，用户组变化不频繁
  });

// ===================================
//          Query Hooks
// ===================================

/**
 * 管理端用户列表（服务端分页）
 */
export function useAdminUsers(params: AdminUserListParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    ...adminUsersQueryOptions(params),
    enabled: options?.enabled ?? true,
  });
}

/**
 * 用户组列表
 */
export function useUserGroups(options?: { enabled?: boolean }) {
  return useQuery({
    ...userGroupsQueryOptions(),
    enabled: options?.enabled ?? true,
  });
}

// ===================================
//          Mutation Hooks
// ===================================

/**
 * 创建用户
 */
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AdminCreateUserRequest) => userManagementApi.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userManagementKeys.lists() });
    },
  });
}

/**
 * 更新用户
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdminUpdateUserRequest }) => userManagementApi.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userManagementKeys.lists() });
    },
  });
}

/**
 * 删除用户
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => userManagementApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userManagementKeys.lists() });
    },
  });
}

/**
 * 批量删除用户（逐个调用删除接口）
 */
export function useBatchDeleteUsers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => userManagementApi.deleteUser(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userManagementKeys.lists() });
    },
  });
}

/**
 * 重置用户密码
 */
export function useResetPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdminResetPasswordRequest }) =>
      userManagementApi.resetPassword(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userManagementKeys.lists() });
    },
  });
}

/**
 * 更新用户状态（封禁/解封）
 */
export function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdminUpdateUserStatusRequest }) =>
      userManagementApi.updateUserStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userManagementKeys.lists() });
    },
  });
}
