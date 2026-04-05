import { useState, useMemo, useCallback } from "react";
import { addToast, useDisclosure } from "@heroui/react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDocSeriesList, useDeleteDocSeries } from "@/hooks/queries/use-doc-series";
import type { DocSeries, DocSeriesListParams } from "@/types/doc-series";

export function useDocSeriesPage() {
  // ---- 筛选 & 分页 ----
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ---- 选择 ----
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ---- 弹窗状态 ----
  const [editItem, setEditItem] = useState<DocSeries | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocSeries | null>(null);

  const formModal = useDisclosure();
  const deleteModal = useDisclosure();
  const batchDeleteModal = useDisclosure();

  // ---- 查询 ----
  const queryParams: DocSeriesListParams = useMemo(
    () => ({
      page,
      pageSize,
      keyword: debouncedSearch || undefined,
    }),
    [page, pageSize, debouncedSearch]
  );

  const { data, isLoading, isFetching } = useDocSeriesList(queryParams);
  const seriesList = useMemo(() => data?.list ?? [], [data?.list]);
  const totalItems = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // ---- Mutations ----
  const deleteDocSeries = useDeleteDocSeries();

  // ---- 选择逻辑 ----
  const isSomeSelected = selectedIds.size > 0;

  const handleSelectionChange = useCallback(
    (keys: "all" | Set<React.Key>) => {
      if (keys === "all") {
        setSelectedIds(new Set(seriesList.map(s => s.id)));
      } else {
        setSelectedIds(keys as Set<string>);
      }
    },
    [seriesList]
  );

  // ---- 新增 ----
  const handleNew = useCallback(() => {
    setEditItem(null);
    formModal.onOpen();
  }, [formModal]);

  // ---- 编辑 ----
  const handleEdit = useCallback(
    (item: DocSeries) => {
      setEditItem(item);
      formModal.onOpen();
    },
    [formModal]
  );

  const handleFormClose = useCallback(() => {
    formModal.onClose();
    setEditItem(null);
  }, [formModal]);

  // ---- 删除 ----
  const handleDeleteClick = useCallback(
    (item: DocSeries) => {
      if (item.doc_count > 0) {
        addToast({
          title: `该系列下还有 ${item.doc_count} 篇文档，请先移除文档后再删除`,
          color: "warning",
          timeout: 4000,
        });
        return;
      }
      setDeleteTarget(item);
      deleteModal.onOpen();
    },
    [deleteModal]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteDocSeries.mutateAsync(deleteTarget.id);
      addToast({ title: "删除成功", color: "success", timeout: 2000 });
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
    } catch (error) {
      addToast({
        title: error instanceof Error ? error.message : "删除失败",
        color: "danger",
        timeout: 3000,
      });
    }
    deleteModal.onClose();
    setDeleteTarget(null);
  }, [deleteTarget, deleteDocSeries, deleteModal]);

  const handleBatchDeleteConfirm = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      // 逐个删除（后端暂无批量接口）
      for (const id of ids) {
        await deleteDocSeries.mutateAsync(id);
      }
      addToast({ title: `已删除 ${ids.length} 个系列`, color: "success", timeout: 3000 });
      setSelectedIds(new Set());
    } catch (error) {
      addToast({
        title: error instanceof Error ? error.message : "批量删除失败",
        color: "danger",
        timeout: 3000,
      });
    }
    batchDeleteModal.onClose();
  }, [selectedIds, deleteDocSeries, batchDeleteModal]);

  // ---- 行操作分发 ----
  const handleAction = useCallback(
    (item: DocSeries, key: string) => {
      switch (key) {
        case "edit":
          handleEdit(item);
          break;
        case "delete":
          handleDeleteClick(item);
          break;
      }
    },
    [handleEdit, handleDeleteClick]
  );

  // ---- 重置筛选 ----
  const handleReset = useCallback(() => {
    setSearchInput("");
    setPage(1);
  }, []);

  return {
    // 筛选
    searchInput,
    setSearchInput,
    debouncedSearch,
    page,
    setPage,
    pageSize,
    setPageSize,
    handleReset,

    // 查询数据
    seriesList,
    totalItems,
    totalPages,
    isLoading,
    isFetching,

    // 选择
    selectedIds,
    setSelectedIds,
    isSomeSelected,
    handleSelectionChange,

    // 新增 / 编辑
    editItem,
    handleNew,
    handleEdit,
    handleFormClose,
    formModal,

    // 删除
    deleteTarget,
    deleteModal,
    batchDeleteModal,
    deleteDocSeries,
    handleDeleteConfirm,
    handleBatchDeleteConfirm,

    // 行操作
    handleAction,
  };
}

/** 页面状态类型，供子组件使用 */
export type DocSeriesPageState = ReturnType<typeof useDocSeriesPage>;
