/**
 * 评论管理 Query Hooks
 * 对接管理端评论 API，提供服务端分页查询和各类 mutation
 */

import { useQuery, useMutation, useQueryClient, queryOptions, keepPreviousData } from "@tanstack/react-query";
import { commentManagementApi } from "@/lib/api/comment-management";
import type {
  AdminCommentListParams,
  UpdateCommentInfoRequest,
  ImportCommentsParams,
} from "@/types/comment-management";

// ===================================
//          Query Keys
// ===================================

export const commentManagementKeys = {
  all: ["comment-management"] as const,
  lists: () => [...commentManagementKeys.all, "list"] as const,
  list: (params: AdminCommentListParams) => [...commentManagementKeys.lists(), params] as const,
};

// ===================================
//          Query Options
// ===================================

export const adminCommentsQueryOptions = (params: AdminCommentListParams = {}) =>
  queryOptions({
    queryKey: commentManagementKeys.list(params),
    queryFn: () => commentManagementApi.getComments(params),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2, // 2 分钟
  });

// ===================================
//          Query Hooks
// ===================================

/**
 * 管理端评论列表（服务端分页）
 */
export function useAdminComments(params: AdminCommentListParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    ...adminCommentsQueryOptions(params),
    enabled: options?.enabled ?? true,
  });
}

// ===================================
//          Mutation Hooks
// ===================================

/**
 * 批量删除评论
 */
export function useDeleteComments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => commentManagementApi.deleteComments(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentManagementKeys.lists() });
    },
  });
}

/**
 * 更新评论状态（通过/待审核）
 */
export function useUpdateCommentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: number }) =>
      commentManagementApi.updateCommentStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentManagementKeys.lists() });
    },
  });
}

/**
 * 更新评论信息（内容、昵称、邮箱、网站）
 */
export function useUpdateCommentInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCommentInfoRequest }) =>
      commentManagementApi.updateCommentInfo(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentManagementKeys.lists() });
    },
  });
}

/**
 * 切换评论置顶状态
 */
export function useToggleCommentPin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => commentManagementApi.togglePin(id, pinned),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentManagementKeys.lists() });
    },
  });
}

/**
 * 导出评论
 */
export function useExportComments() {
  return useMutation({
    mutationFn: (ids?: string[]) => commentManagementApi.exportComments(ids),
    onSuccess: blob => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `comments-export-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
  });
}

/**
 * 导入评论
 */
export function useImportComments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: ImportCommentsParams) => commentManagementApi.importComments(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentManagementKeys.lists() });
    },
  });
}
