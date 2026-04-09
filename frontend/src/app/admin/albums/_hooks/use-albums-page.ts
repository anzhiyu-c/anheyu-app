import { useState, useMemo, useCallback } from "react";
import { addToast, useDisclosure } from "@heroui/react";
import { useAlbumList, useAlbumCategories, useDeleteAlbum, useBatchDeleteAlbums } from "@/hooks/queries/use-album";
import type { Album, AlbumListParams } from "@/types/album";

export function useAlbumsPage() {
  // ---- 筛选 & 分页 ----
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortFilter, setSortFilter] = useState("display_order_asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ---- 选择 ----
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ---- 弹窗状态 ----
  const [editItem, setEditItem] = useState<Album | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Album | null>(null);

  const formModal = useDisclosure();
  const importModal = useDisclosure();
  const exportModal = useDisclosure();
  const categoryModal = useDisclosure();
  const deleteModal = useDisclosure();
  const batchDeleteModal = useDisclosure();

  // ---- 查询 ----
  const queryParams: AlbumListParams = useMemo(
    () => ({
      page,
      pageSize,
      categoryId: categoryFilter ? Number(categoryFilter) : undefined,
      sort: sortFilter || undefined,
    }),
    [page, pageSize, categoryFilter, sortFilter]
  );

  const { data, isLoading, isFetching } = useAlbumList(queryParams);
  const { data: categories = [] } = useAlbumCategories();
  const albumList = useMemo(() => data?.list ?? [], [data?.list]);
  const totalItems = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // ---- Mutations ----
  const deleteAlbum = useDeleteAlbum();
  const batchDeleteAlbums = useBatchDeleteAlbums();

  // ---- 选择逻辑 ----
  const isSomeSelected = selectedIds.size > 0;

  const handleSelectionChange = useCallback(
    (keys: "all" | Set<React.Key>) => {
      if (keys === "all") {
        setSelectedIds(new Set(albumList.map(a => String(a.id))));
      } else {
        setSelectedIds(keys as Set<string>);
      }
    },
    [albumList]
  );

  // ---- 新增 ----
  const handleNew = useCallback(() => {
    setEditItem(null);
    formModal.onOpen();
  }, [formModal]);

  // ---- 编辑 ----
  const handleEdit = useCallback(
    (item: Album) => {
      setEditItem(item);
      formModal.onOpen();
    },
    [formModal]
  );

  const handleFormClose = useCallback(() => {
    formModal.onClose();
    setEditItem(null);
  }, [formModal]);

  const handleOpenImport = useCallback(() => {
    importModal.onOpen();
  }, [importModal]);

  const handleOpenExport = useCallback(() => {
    exportModal.onOpen();
  }, [exportModal]);

  const handleOpenCategoryManage = useCallback(() => {
    categoryModal.onOpen();
  }, [categoryModal]);

  // ---- 删除 ----
  const handleDeleteClick = useCallback(
    (item: Album) => {
      setDeleteTarget(item);
      deleteModal.onOpen();
    },
    [deleteModal]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteAlbum.mutateAsync(deleteTarget.id);
      addToast({ title: "删除成功", color: "success", timeout: 2000 });
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(String(deleteTarget.id));
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
  }, [deleteTarget, deleteAlbum, deleteModal]);

  const handleBatchDeleteConfirm = useCallback(async () => {
    const ids = Array.from(selectedIds).map(Number);
    if (ids.length === 0) return;
    try {
      const deleted = await batchDeleteAlbums.mutateAsync(ids);
      addToast({ title: `已删除 ${deleted} 张图片`, color: "success", timeout: 3000 });
      setSelectedIds(new Set());
    } catch (error) {
      addToast({
        title: error instanceof Error ? error.message : "批量删除失败",
        color: "danger",
        timeout: 3000,
      });
    }
    batchDeleteModal.onClose();
  }, [selectedIds, batchDeleteAlbums, batchDeleteModal]);

  // ---- 行操作分发 ----
  const handleAction = useCallback(
    (item: Album, key: string) => {
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
    setCategoryFilter("");
    setSortFilter("display_order_asc");
    setPage(1);
  }, []);

  return {
    // 筛选
    categoryFilter,
    setCategoryFilter,
    sortFilter,
    setSortFilter,
    page,
    setPage,
    pageSize,
    setPageSize,
    handleReset,

    // 查询数据
    albumList,
    totalItems,
    totalPages,
    isLoading,
    isFetching,
    categories,

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
    importModal,
    exportModal,
    categoryModal,
    handleOpenImport,
    handleOpenExport,
    handleOpenCategoryManage,

    // 删除
    deleteTarget,
    deleteModal,
    batchDeleteModal,
    deleteAlbum,
    batchDeleteAlbums,
    handleDeleteConfirm,
    handleBatchDeleteConfirm,

    // 行操作
    handleAction,
  };
}

/** 页面状态类型，供子组件使用 */
export type AlbumsPageState = ReturnType<typeof useAlbumsPage>;
