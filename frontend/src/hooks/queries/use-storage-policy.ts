/**
 * 存储策略 Query Hooks
 * 对接 /api/policies 端点，提供全量查询和 CRUD mutation
 */

import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { storagePolicyApi } from "@/lib/api/storage-policy";
import type { StoragePolicyCreateRequest, StoragePolicyUpdateRequest } from "@/types/storage-policy";

// ===================================
//          Query Keys
// ===================================

export const storagePolicyKeys = {
  all: ["storage-policy"] as const,
  lists: () => [...storagePolicyKeys.all, "list"] as const,
  detail: (id: string) => [...storagePolicyKeys.all, "detail", id] as const,
};

// ===================================
//          Query Options
// ===================================

export const storagePoliciesQueryOptions = () =>
  queryOptions({
    queryKey: storagePolicyKeys.lists(),
    queryFn: () => storagePolicyApi.listAll(),
    staleTime: 1000 * 60 * 2,
  });

export const storagePolicyDetailOptions = (id: string) =>
  queryOptions({
    queryKey: storagePolicyKeys.detail(id),
    queryFn: () => storagePolicyApi.getById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  });

// ===================================
//          Query Hooks
// ===================================

/** 存储策略列表（全量，前端分页） */
export function useStoragePolicies() {
  return useQuery(storagePoliciesQueryOptions());
}

/** 单条存储策略详情 */
export function useStoragePolicy(id: string) {
  return useQuery(storagePolicyDetailOptions(id));
}

// ===================================
//          Mutation Hooks
// ===================================

/** 创建存储策略 */
export function useCreateStoragePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<StoragePolicyCreateRequest>) => storagePolicyApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storagePolicyKeys.lists() });
    },
  });
}

/** 更新存储策略 */
export function useUpdateStoragePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: StoragePolicyUpdateRequest }) => storagePolicyApi.update(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: storagePolicyKeys.lists() });
      queryClient.invalidateQueries({ queryKey: storagePolicyKeys.detail(variables.id) });
    },
  });
}

/** 删除存储策略 */
export function useDeleteStoragePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storagePolicyApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storagePolicyKeys.lists() });
    },
  });
}
