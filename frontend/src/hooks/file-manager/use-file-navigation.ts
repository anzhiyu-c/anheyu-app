"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColumnConfig, FileItem, ParentInfo, StoragePolicy } from "@/types/file-manager";
import { FileType } from "@/types/file-manager";
import { fetchFilesByPathApi, updateFolderViewApi } from "@/lib/api/file-manager";
import { extractLogicalPathFromUri } from "@/utils/file-manager";
import type { SortKey } from "./types";
import { DEFAULT_COLUMNS, DEFAULT_PAGE_SIZE, parseSortKey, toast } from "./types";

export function useFileNavigation(onFileItemLoadedRef: React.RefObject<((fileItem: FileItem) => void) | null>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileToolbarRef = useRef<{ openDialog: () => void } | null>(null);

  const [path, setPath] = useState("/");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortKey, setSortKey] = useState<SortKey>("updated_at_desc");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [loading, setLoading] = useState(false);
  const [isMoreLoading, setIsMoreLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [parentInfo, setParentInfo] = useState<ParentInfo | null>(null);
  const [storagePolicy, setStoragePolicy] = useState<StoragePolicy | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  const pathRef = useRef(path);
  const nextTokenRef = useRef(nextToken);
  const hasMoreRef = useRef(hasMore);
  const isMoreLoadingRef = useRef(isMoreLoading);
  const viewModeRef = useRef(viewMode);
  const sortKeyRef = useRef(sortKey);
  const pageSizeRef = useRef(pageSize);
  const columnsRef = useRef(columns);
  const currentFolderIdRef = useRef(currentFolderId);

  useEffect(() => {
    pathRef.current = path;
    nextTokenRef.current = nextToken;
    hasMoreRef.current = hasMore;
    isMoreLoadingRef.current = isMoreLoading;
    viewModeRef.current = viewMode;
    sortKeyRef.current = sortKey;
    pageSizeRef.current = pageSize;
    columnsRef.current = columns;
    currentFolderIdRef.current = currentFolderId;
  }, [path, nextToken, hasMore, isMoreLoading, viewMode, sortKey, pageSize, columns, currentFolderId]);

  const sortedFiles = useMemo(() => {
    const filesToSort = [...files];
    const [orderKey, direction] = parseSortKey(sortKey);
    filesToSort.sort((a, b) => {
      if (a.type === FileType.Dir && b.type !== FileType.Dir) return -1;
      if (a.type !== FileType.Dir && b.type === FileType.Dir) return 1;
      let comparison = 0;
      switch (orderKey) {
        case "name":
          comparison = a.name.localeCompare(b.name, "zh-Hans-CN");
          break;
        case "size":
          comparison = (a.size ?? 0) - (b.size ?? 0);
          break;
        case "updated_at":
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
        case "created_at":
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return direction === "asc" ? comparison : -comparison;
    });
    return filesToSort;
  }, [files, sortKey]);

  const syncViewConfig = useCallback(async () => {
    const folderId = currentFolderIdRef.current;
    if (!folderId) return;
    try {
      const [order, order_direction] = parseSortKey(sortKeyRef.current);
      const viewConfig = {
        view: viewModeRef.current,
        order,
        page_size: pageSizeRef.current,
        order_direction,
        columns: columnsRef.current,
      };
      await updateFolderViewApi(folderId, viewConfig);
    } catch (error) {
      console.error("保存视图设置失败:", error);
      toast("保存视图设置失败", "danger");
    }
  }, []);

  const loadingRequestIdRef = useRef(0);

  const loadFiles = useCallback(
    async (pathToLoad: string, isRefresh: boolean = false) => {
      if (isRefresh) {
        const requestId = ++loadingRequestIdRef.current;
        setLoading(true);
        const normalizedPath = extractLogicalPathFromUri(pathToLoad || "/");
        setPath(normalizedPath);
        pathRef.current = normalizedPath;
        setNextToken(null);

        try {
          const res = await fetchFilesByPathApi(normalizedPath, null);
          if (loadingRequestIdRef.current !== requestId) return;

          if (res.code === 200 && res.data) {
            const { files: newFiles, parent, pagination, storage_policy, view } = res.data;
            setFiles(newFiles);
            newFiles.forEach(fileItem => {
              onFileItemLoadedRef.current?.(fileItem);
            });

            if (pagination?.next_token) {
              setNextToken(pagination.next_token);
              setHasMore(true);
            } else {
              setNextToken(null);
              setHasMore(false);
            }

            if (view) {
              setViewMode(view.view);
              setPageSize(view.page_size);
              setSortKey(`${view.order}_${view.order_direction}` as SortKey);
              setColumns(view.columns?.length ? view.columns : DEFAULT_COLUMNS);
            }

            setParentInfo(parent ? { ...parent, path: extractLogicalPathFromUri(parent.path) } : null);
            setStoragePolicy(storage_policy || null);
            setCurrentFolderId(parent?.id || null);
          } else {
            toast(res.message || "文件列表加载失败", "danger");
          }
        } catch (error) {
          if (loadingRequestIdRef.current !== requestId) return;
          console.error("文件加载失败:", error);
          toast("文件加载失败，请检查网络连接。", "danger");
        } finally {
          if (loadingRequestIdRef.current === requestId) {
            setLoading(false);
          }
        }
      } else {
        if (isMoreLoadingRef.current || !hasMoreRef.current) return;
        setIsMoreLoading(true);

        try {
          const res = await fetchFilesByPathApi(pathRef.current, nextTokenRef.current);
          if (res.code === 200 && res.data) {
            const { files: newFiles, pagination } = res.data;
            setFiles(prev => {
              const existingIds = new Set(prev.map(f => f.id));
              const unique = newFiles.filter(f => !existingIds.has(f.id));
              return [...prev, ...unique];
            });

            if (pagination?.next_token) {
              setNextToken(pagination.next_token);
              setHasMore(true);
            } else {
              setNextToken(null);
              setHasMore(false);
            }
          } else {
            toast(res.message || "文件列表加载失败", "danger");
          }
        } catch (error) {
          console.error("文件加载失败:", error);
          toast("文件加载失败，请检查网络连接。", "danger");
        } finally {
          setIsMoreLoading(false);
        }
      }
    },
    [onFileItemLoadedRef]
  );

  const handleRefresh = () => loadFiles(path, true);

  const handleLoadMore = () => {
    if (isMoreLoadingRef.current) return;
    if (hasMoreRef.current && !loading) {
      loadFiles(path);
    }
  };

  const handleSetViewMode = async (mode: "list" | "grid") => {
    if (viewModeRef.current === mode) return;
    setViewMode(mode);
    await syncViewConfig();
  };

  const handleSetPageSize = async (size: number) => {
    if (pageSizeRef.current === size) return;
    setPageSize(size);
    await syncViewConfig();
    handleRefresh();
  };

  const handleSetSortKey = async (key: SortKey) => {
    if (sortKeyRef.current === key) return;
    setSortKey(key);
    await syncViewConfig();
    handleRefresh();
  };

  const handleSetColumns = async (cols: ColumnConfig[]) => {
    if (JSON.stringify(columnsRef.current) === JSON.stringify(cols)) return;
    setColumns(cols);
    await syncViewConfig();
  };

  const handleOpenColumnSettings = () => {
    fileToolbarRef.current?.openDialog();
  };

  const updateFileInState = (fileId: string, updates: Partial<FileItem>) => {
    setFiles(prev => prev.map(file => (file.id === fileId ? { ...file, ...updates } : file)));
  };

  const removeFilesFromState = (fileIds: string[]) => {
    const ids = new Set(fileIds);
    setFiles(prev => prev.filter(file => !ids.has(file.id)));
  };

  return {
    containerRef,
    fileToolbarRef,
    path,
    files,
    sortedFiles,
    loading,
    isMoreLoading,
    hasMore,
    viewMode,
    sortKey,
    pageSize,
    columns,
    parentInfo,
    storagePolicy,
    currentFolderId,
    loadFiles,
    handleRefresh,
    handleLoadMore,
    handleSetViewMode,
    handleSetPageSize,
    handleSetSortKey,
    handleSetColumns,
    handleOpenColumnSettings,
    updateFileInState,
    removeFilesFromState,
  };
}
