/**
 * 相册管理 Query Hooks
 * 对接相册 API，提供列表查询和 CRUD mutation
 */

import { useQuery, useMutation, useQueryClient, queryOptions, keepPreviousData } from "@tanstack/react-query";
import { albumApi } from "@/lib/api/album";
import type {
  AlbumExportFormat,
  AlbumForm,
  AlbumListParams,
  BatchImportAlbumsRequest,
  CreateAlbumCategoryRequest,
  UpdateAlbumCategoryRequest,
} from "@/types/album";

// ===================================
//          Query Keys
// ===================================

export const albumKeys = {
  all: ["albums"] as const,
  lists: () => [...albumKeys.all, "list"] as const,
  list: (params: AlbumListParams) => [...albumKeys.lists(), params] as const,
  categories: () => [...albumKeys.all, "categories"] as const,
};

// ===================================
//          Query Options
// ===================================

export const albumListQueryOptions = (params: AlbumListParams = {}) =>
  queryOptions({
    queryKey: albumKeys.list(params),
    queryFn: () => albumApi.getList(params),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2,
  });

export const albumCategoriesQueryOptions = () =>
  queryOptions({
    queryKey: albumKeys.categories(),
    queryFn: () => albumApi.getCategories(),
    staleTime: 1000 * 60 * 5,
  });

// ===================================
//          Query Hooks
// ===================================

/** 相册图片列表（分页） */
export function useAlbumList(params: AlbumListParams = {}) {
  return useQuery(albumListQueryOptions(params));
}

/** 相册分类列表 */
export function useAlbumCategories() {
  return useQuery(albumCategoriesQueryOptions());
}

// ===================================
//       Mutation Hooks
// ===================================

/** 新增图片 */
export function useCreateAlbum() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AlbumForm) => albumApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: albumKeys.lists() });
    },
  });
}

/** 更新图片 */
export function useUpdateAlbum() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AlbumForm }) => albumApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: albumKeys.lists() });
    },
  });
}

/** 删除图片 */
export function useDeleteAlbum() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => albumApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: albumKeys.lists() });
    },
  });
}

/** 批量删除图片 */
export function useBatchDeleteAlbums() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: number[]) => albumApi.batchDelete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: albumKeys.lists() });
    },
  });
}

/** 创建相册分类 */
export function useCreateAlbumCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAlbumCategoryRequest) => albumApi.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: albumKeys.categories() });
      queryClient.invalidateQueries({ queryKey: albumKeys.lists() });
    },
  });
}

/** 更新相册分类 */
export function useUpdateAlbumCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateAlbumCategoryRequest }) => albumApi.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: albumKeys.categories() });
      queryClient.invalidateQueries({ queryKey: albumKeys.lists() });
    },
  });
}

/** 删除相册分类 */
export function useDeleteAlbumCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => albumApi.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: albumKeys.categories() });
      queryClient.invalidateQueries({ queryKey: albumKeys.lists() });
    },
  });
}

/** URL 批量导入相册 */
export function useBatchImportAlbums() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BatchImportAlbumsRequest) => albumApi.batchImportAlbums(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: albumKeys.lists() });
      queryClient.invalidateQueries({ queryKey: albumKeys.categories() });
    },
  });
}

/** 文件/JSON 导入相册 */
export function useImportAlbums() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: FormData) => albumApi.importAlbums(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: albumKeys.lists() });
      queryClient.invalidateQueries({ queryKey: albumKeys.categories() });
    },
  });
}

/** 导出相册 */
export function useExportAlbums() {
  return useMutation({
    mutationFn: ({ albumIds, format }: { albumIds: number[]; format: AlbumExportFormat }) =>
      albumApi.exportAlbums({ album_ids: albumIds, format }),
    onSuccess: (blob, variables) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `albums-export-${new Date().toISOString().slice(0, 10)}.${variables.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
  });
}
