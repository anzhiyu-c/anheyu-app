/**
 * 自定义页面管理 Query Hooks
 * 对接管理端页面 API，提供服务端分页查询和各类 mutation
 */

import { useQuery, useMutation, useQueryClient, queryOptions, keepPreviousData } from "@tanstack/react-query";
import { pageManagementApi } from "@/lib/api/page-management";
import type { PageListParams, CreatePageRequest, UpdatePageRequest } from "@/types/page-management";

// ===================================
//          Query Keys
// ===================================

export const pageManagementKeys = {
  all: ["page-management"] as const,
  lists: () => [...pageManagementKeys.all, "list"] as const,
  list: (params: PageListParams) => [...pageManagementKeys.lists(), params] as const,
  detail: (id: number) => [...pageManagementKeys.all, "detail", id] as const,
  publicPage: (path: string) => [...pageManagementKeys.all, "public", path] as const,
};

// ===================================
//          Query Options
// ===================================

export const adminPagesQueryOptions = (params: PageListParams = {}) =>
  queryOptions({
    queryKey: pageManagementKeys.list(params),
    queryFn: () => pageManagementApi.getPages(params),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2,
  });

export const adminPageDetailQueryOptions = (id: number) =>
  queryOptions({
    queryKey: pageManagementKeys.detail(id),
    queryFn: () => pageManagementApi.getPageById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });

export const publicPageQueryOptions = (path: string) =>
  queryOptions({
    queryKey: pageManagementKeys.publicPage(path),
    queryFn: () => pageManagementApi.getPageByPath(path),
    enabled: !!path,
    staleTime: 1000 * 60 * 5,
  });

// ===================================
//          Query Hooks
// ===================================

/**
 * 管理端页面列表（服务端分页）
 */
export function useAdminPages(params: PageListParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    ...adminPagesQueryOptions(params),
    enabled: options?.enabled ?? true,
  });
}

/**
 * 管理端页面详情
 */
export function useAdminPageDetail(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    ...adminPageDetailQueryOptions(id),
    enabled: (options?.enabled ?? true) && !!id,
  });
}

/**
 * 公开页面（前台渲染用）
 */
export function usePublicPage(path: string, options?: { enabled?: boolean }) {
  return useQuery({
    ...publicPageQueryOptions(path),
    enabled: (options?.enabled ?? true) && !!path,
  });
}

// ===================================
//          Mutation Hooks
// ===================================

/**
 * 创建页面
 */
export function useCreatePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePageRequest) => pageManagementApi.createPage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageManagementKeys.lists() });
    },
  });
}

/**
 * 更新页面
 */
export function useUpdatePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdatePageRequest }) => pageManagementApi.updatePage(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: pageManagementKeys.lists() });
      queryClient.invalidateQueries({ queryKey: pageManagementKeys.detail(variables.id) });
    },
  });
}

/**
 * 删除页面
 */
export function useDeletePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => pageManagementApi.deletePage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageManagementKeys.lists() });
    },
  });
}

/**
 * 初始化默认页面
 */
export function useInitializeDefaultPages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => pageManagementApi.initializeDefaultPages(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageManagementKeys.lists() });
    },
  });
}
