/**
 * 友链管理 Query Hooks
 * 对接友链管理 API，提供服务端分页查询和各类 mutation
 */

import { useQuery, useMutation, useQueryClient, queryOptions, keepPreviousData } from "@tanstack/react-query";
import { friendsApi } from "@/lib/api/friends";
import type {
  AdminLinksParams,
  CreateLinkRequest,
  UpdateLinkRequest,
  ReviewLinkRequest,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  CreateTagRequest,
  UpdateTagRequest,
  ImportLinksRequest,
  ExportLinksParams,
  BatchUpdateLinkSortRequest,
  PublicLinksParams,
  ApplyLinkRequest,
  LinkApplicationsParams,
} from "@/types/friends";

// ===================================
//          Query Keys
// ===================================

export const friendsKeys = {
  all: ["friends"] as const,
  lists: () => [...friendsKeys.all, "list"] as const,
  list: (params: AdminLinksParams) => [...friendsKeys.lists(), params] as const,
  categories: () => [...friendsKeys.all, "categories"] as const,
  tags: () => [...friendsKeys.all, "tags"] as const,
  healthCheck: () => [...friendsKeys.all, "health-check"] as const,
  // 公开接口 keys
  publicCategories: () => [...friendsKeys.all, "public-categories"] as const,
  publicLinks: (params: PublicLinksParams) => [...friendsKeys.all, "public-links", params] as const,
  applications: (params: LinkApplicationsParams) => [...friendsKeys.all, "applications", params] as const,
};

// ===================================
//          Query Options
// ===================================

export const adminLinksQueryOptions = (params: AdminLinksParams = {}) =>
  queryOptions({
    queryKey: friendsKeys.list(params),
    queryFn: () => friendsApi.getLinks(params),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2,
  });

export const linkCategoriesQueryOptions = () =>
  queryOptions({
    queryKey: friendsKeys.categories(),
    queryFn: () => friendsApi.getCategories(),
    staleTime: 1000 * 60 * 5,
  });

export const linkTagsQueryOptions = () =>
  queryOptions({
    queryKey: friendsKeys.tags(),
    queryFn: () => friendsApi.getTags(),
    staleTime: 1000 * 60 * 5,
  });

// ===================================
//          Query Hooks
// ===================================

/** 管理端友链列表（服务端分页） */
export function useAdminLinks(params: AdminLinksParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    ...adminLinksQueryOptions(params),
    enabled: options?.enabled ?? true,
  });
}

/** 友链分类列表 */
export function useLinkCategories() {
  return useQuery(linkCategoriesQueryOptions());
}

/** 友链标签列表 */
export function useLinkTags() {
  return useQuery(linkTagsQueryOptions());
}

/** 健康检查状态（轮询） */
export function useHealthCheckStatus(options?: { enabled?: boolean; refetchInterval?: number }) {
  return useQuery({
    queryKey: friendsKeys.healthCheck(),
    queryFn: () => friendsApi.getHealthCheckStatus(),
    enabled: options?.enabled ?? false,
    refetchInterval: options?.refetchInterval,
  });
}

// ===================================
//       友链 Mutation Hooks
// ===================================

/** 创建友链 */
export function useCreateLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateLinkRequest) => friendsApi.createLink(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKeys.lists() });
    },
  });
}

/** 更新友链 */
export function useUpdateLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateLinkRequest }) => friendsApi.updateLink(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKeys.lists() });
    },
  });
}

/** 删除友链 */
export function useDeleteLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => friendsApi.deleteLink(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKeys.lists() });
    },
  });
}

/** 审核友链 */
export function useReviewLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ReviewLinkRequest }) => friendsApi.reviewLink(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKeys.lists() });
    },
  });
}

// ===================================
//     分类 Mutation Hooks
// ===================================

/** 创建分类 */
export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCategoryRequest) => friendsApi.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKeys.categories() });
    },
  });
}

/** 更新分类 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCategoryRequest }) => friendsApi.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKeys.categories() });
    },
  });
}

/** 删除分类 */
export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => friendsApi.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKeys.categories() });
      queryClient.invalidateQueries({ queryKey: friendsKeys.lists() });
    },
  });
}

// ===================================
//     标签 Mutation Hooks
// ===================================

/** 创建标签 */
export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTagRequest) => friendsApi.createTag(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKeys.tags() });
    },
  });
}

/** 更新标签 */
export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTagRequest }) => friendsApi.updateTag(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKeys.tags() });
    },
  });
}

/** 删除标签 */
export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => friendsApi.deleteTag(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKeys.tags() });
      queryClient.invalidateQueries({ queryKey: friendsKeys.lists() });
    },
  });
}

// ===================================
//   导入 / 导出 / 健康检查 / 排序
// ===================================

/** 批量导入友链 */
export function useImportLinks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ImportLinksRequest) => friendsApi.importLinks(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: friendsKeys.categories() });
      queryClient.invalidateQueries({ queryKey: friendsKeys.tags() });
    },
  });
}

/** 导出友链 */
export function useExportLinks() {
  return useMutation({
    mutationFn: (params?: ExportLinksParams) => friendsApi.exportLinks(params),
    onSuccess: data => {
      // 触发浏览器下载 JSON 文件
      const jsonStr = JSON.stringify(data.links, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `friends-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
  });
}

/** 触发健康检查 */
export function useTriggerHealthCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => friendsApi.triggerHealthCheck(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKeys.healthCheck() });
    },
  });
}

/** 批量更新排序 */
export function useBatchUpdateSort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BatchUpdateLinkSortRequest) => friendsApi.batchUpdateSort(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKeys.lists() });
    },
  });
}

// ===================================
//     公开接口 Query / Mutation Hooks
// ===================================

/** 公开友链分类列表 */
export function usePublicCategories() {
  return useQuery({
    queryKey: friendsKeys.publicCategories(),
    queryFn: () => friendsApi.getPublicCategories(),
    staleTime: 1000 * 60 * 5,
  });
}

/** 公开友链列表（按分类） */
export function usePublicLinks(params: PublicLinksParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: friendsKeys.publicLinks(params),
    queryFn: () => friendsApi.getPublicLinks(params),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 2,
    placeholderData: keepPreviousData,
  });
}

/** 友链申请列表（公开） */
export function useApplications(params: LinkApplicationsParams = {}) {
  return useQuery({
    queryKey: friendsKeys.applications(params),
    queryFn: () => friendsApi.getApplications(params),
    staleTime: 1000 * 60 * 2,
    placeholderData: keepPreviousData,
  });
}

/** 申请友链 */
export function useApplyLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ApplyLinkRequest) => friendsApi.applyLink(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKeys.all });
    },
  });
}
