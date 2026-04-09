import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { addToast, useDisclosure } from "@heroui/react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useAdminPages,
  useDeletePage,
  useInitializeDefaultPages,
} from "@/hooks/queries/use-page-management";
import type { CustomPage, PageListParams } from "@/types/page-management";

export function usePageManagementPage() {
  const router = useRouter();

  // ---- 筛选 & 分页 ----
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [publishFilter, setPublishFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ---- 选择 ----
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ---- 弹窗状态 ----
  const [deleteTarget, setDeleteTarget] = useState<CustomPage | null>(null);
  const deleteModal = useDisclosure();
  const batchDeleteModal = useDisclosure();

  // ---- 查询 ----
  const queryParams: PageListParams = useMemo(
    () => ({
      page,
      page_size: pageSize,
      search: debouncedSearch || undefined,
      is_published: publishFilter === "" ? undefined : publishFilter === "true",
    }),
    [page, pageSize, debouncedSearch, publishFilter]
  );

  const { data, isLoading, isFetching } = useAdminPages(queryParams);
  const pages = useMemo(() => data?.pages ?? [], [data?.pages]);
  const totalItems = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // ---- Mutations ----
  const deletePage = useDeletePage();
  const initializeDefaultPages = useInitializeDefaultPages();

  // ---- 选择逻辑 ----
  const isSomeSelected = selectedIds.size > 0;

  const handleSelectionChange = useCallback(
    (keys: "all" | Set<React.Key>) => {
      if (keys === "all") {
        setSelectedIds(new Set(pages.map(p => String(p.id))));
      } else {
        setSelectedIds(keys as Set<string>);
      }
    },
    [pages]
  );

  // ---- 删除 ----
  const handleDeleteClick = useCallback(
    (pageItem: CustomPage) => {
      setDeleteTarget(pageItem);
      deleteModal.onOpen();
    },
    [deleteModal]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deletePage.mutateAsync(deleteTarget.id);
      addToast({ title: "页面已删除", color: "success", timeout: 3000 });
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(String(deleteTarget.id));
        return next;
      });
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "删除失败", color: "danger", timeout: 3000 });
    }
    deleteModal.onClose();
    setDeleteTarget(null);
  }, [deleteTarget, deletePage, deleteModal]);

  const handleBatchDeleteConfirm = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      const results = await Promise.allSettled(ids.map(id => deletePage.mutateAsync(Number(id))));
      const failed = results.filter(r => r.status === "rejected").length;
      const succeeded = results.filter(r => r.status === "fulfilled").length;
      if (failed === 0) {
        addToast({ title: `已删除 ${succeeded} 个页面`, color: "success", timeout: 3000 });
      } else {
        addToast({ title: `${succeeded} 个删除成功，${failed} 个删除失败`, color: "warning", timeout: 5000 });
      }
      setSelectedIds(new Set());
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "批量删除失败", color: "danger", timeout: 3000 });
    }
    batchDeleteModal.onClose();
  }, [selectedIds, deletePage, batchDeleteModal]);

  // ---- 初始化默认页面 ----
  const handleInitializeDefaults = useCallback(async () => {
    try {
      await initializeDefaultPages.mutateAsync();
      addToast({ title: "默认页面初始化完成", color: "success", timeout: 3000 });
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "初始化失败", color: "danger", timeout: 3000 });
    }
  }, [initializeDefaultPages]);

  // ---- 行操作分发 ----
  const handleAction = useCallback(
    (pageItem: CustomPage, key: string) => {
      switch (key) {
        case "edit":
          router.push(`/admin/page-management/${pageItem.id}/edit`);
          break;
        case "delete":
          handleDeleteClick(pageItem);
          break;
      }
    },
    [router, handleDeleteClick]
  );

  // ---- 重置筛选 ----
  const handleReset = useCallback(() => {
    setSearchInput("");
    setPublishFilter("");
    setPage(1);
  }, []);

  return {
    searchInput,
    setSearchInput,
    debouncedSearch,
    publishFilter,
    setPublishFilter,
    page,
    setPage,
    pageSize,
    setPageSize,
    handleReset,
    pages,
    totalItems,
    totalPages,
    isLoading,
    isFetching,
    selectedIds,
    setSelectedIds,
    isSomeSelected,
    handleSelectionChange,
    deleteTarget,
    deleteModal,
    batchDeleteModal,
    deletePage,
    handleDeleteClick,
    handleDeleteConfirm,
    handleBatchDeleteConfirm,
    initializeDefaultPages,
    handleInitializeDefaults,
    handleAction,
  };
}

export type PagePageState = ReturnType<typeof usePageManagementPage>;
