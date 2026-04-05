/**
 * 评论相关 Query Hooks
 */

import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  queryOptions,
  infiniteQueryOptions,
} from "@tanstack/react-query";
import {
  commentApi,
  type GetLatestCommentsParams,
  type GetCommentsParams,
  type CreateCommentPayload,
} from "@/lib/api/comment";

// ===================================
//          Query Keys
// ===================================

export const commentKeys = {
  all: ["comments"] as const,
  latestBase: () => [...commentKeys.all, "latest"] as const,
  latest: (params: GetLatestCommentsParams) => [...commentKeys.latestBase(), params] as const,
  byPath: (targetPath: string, pageSize: number) => [...commentKeys.all, "by-path", targetPath, pageSize] as const,
  children: (parentId: string, page: number, pageSize: number) =>
    [...commentKeys.all, "children", parentId, page, pageSize] as const,
};

// ===================================
//          Query Options
// ===================================

export const latestCommentsQueryOptions = (params: GetLatestCommentsParams = {}) =>
  queryOptions({
    queryKey: commentKeys.latest(params),
    queryFn: () => commentApi.getLatestComments(params),
    staleTime: 1000 * 60 * 2, // 2 分钟
  });

export const commentsByPathQueryOptions = (params: GetCommentsParams) =>
  infiniteQueryOptions({
    queryKey: commentKeys.byPath(params.target_path, params.pageSize ?? 10),
    queryFn: ({ pageParam }) =>
      commentApi.getCommentsByPath({
        target_path: params.target_path,
        page: pageParam,
        pageSize: params.pageSize ?? 10,
      }),
    initialPageParam: 1,
    getNextPageParam: lastPage => {
      const loaded = lastPage.page * lastPage.pageSize;
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
    staleTime: 1000 * 60 * 2, // 2 分钟
  });

// ===================================
//          Query Hooks
// ===================================

/**
 * 获取最新评论列表
 */
export function useLatestComments(params: GetLatestCommentsParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    ...latestCommentsQueryOptions(params),
    enabled: options?.enabled ?? true,
  });
}

/**
 * 获取指定路径评论列表（无限滚动）
 */
export function useCommentsByPath(params: GetCommentsParams, options?: { enabled?: boolean }) {
  return useInfiniteQuery({
    ...commentsByPathQueryOptions(params),
    enabled: options?.enabled ?? true,
  });
}

/**
 * 获取子评论列表
 */
export function useCommentChildren(
  parentId: string,
  params: { page?: number; pageSize?: number } = {},
  options?: { enabled?: boolean }
) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 10;
  return useQuery({
    queryKey: commentKeys.children(parentId, page, pageSize),
    queryFn: () => commentApi.getCommentChildren(parentId, { page, pageSize }),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 30,
  });
}

/**
 * 发表评论
 */
export function useCreateComment(targetPath: string, pageSize = 10) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...commentKeys.byPath(targetPath, pageSize), "create"],
    mutationFn: (payload: CreateCommentPayload) => commentApi.createComment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.byPath(targetPath, pageSize), refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: commentKeys.latestBase(), refetchType: "all" });
    },
  });
}

/**
 * 点赞评论
 */
export function useLikeComment(targetPath: string, pageSize = 10) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...commentKeys.byPath(targetPath, pageSize), "like"],
    mutationFn: (commentId: string) => commentApi.likeComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.byPath(targetPath, pageSize), refetchType: "all" });
    },
  });
}

/**
 * 取消点赞
 */
export function useUnlikeComment(targetPath: string, pageSize = 10) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...commentKeys.byPath(targetPath, pageSize), "unlike"],
    mutationFn: (commentId: string) => commentApi.unlikeComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.byPath(targetPath, pageSize), refetchType: "all" });
    },
  });
}
