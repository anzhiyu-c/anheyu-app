/**
 * 文档系列管理 Query Hooks
 * 对接文档系列 API，提供列表查询和 CRUD mutation
 */

import { useQuery, useMutation, useQueryClient, queryOptions, keepPreviousData } from "@tanstack/react-query";
import { docSeriesApi } from "@/lib/api/doc-series";
import type { DocSeriesForm, DocSeriesListParams } from "@/types/doc-series";

// ===================================
//          Query Keys
// ===================================

export const docSeriesKeys = {
  all: ["doc-series"] as const,
  lists: () => [...docSeriesKeys.all, "list"] as const,
  list: (params: DocSeriesListParams) => [...docSeriesKeys.lists(), params] as const,
};

// ===================================
//          Query Options
// ===================================

export const docSeriesListQueryOptions = (params: DocSeriesListParams = {}) =>
  queryOptions({
    queryKey: docSeriesKeys.list(params),
    queryFn: () => docSeriesApi.getList(params),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2,
  });

// ===================================
//          Query Hooks
// ===================================

/** 文档系列列表（分页） */
export function useDocSeriesList(params: DocSeriesListParams = {}) {
  return useQuery(docSeriesListQueryOptions(params));
}

// ===================================
//       Mutation Hooks
// ===================================

/** 创建文档系列 */
export function useCreateDocSeries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: DocSeriesForm) => docSeriesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: docSeriesKeys.lists() });
    },
  });
}

/** 更新文档系列 */
export function useUpdateDocSeries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DocSeriesForm> }) => docSeriesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: docSeriesKeys.lists() });
    },
  });
}

/** 删除文档系列 */
export function useDeleteDocSeries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => docSeriesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: docSeriesKeys.lists() });
    },
  });
}
