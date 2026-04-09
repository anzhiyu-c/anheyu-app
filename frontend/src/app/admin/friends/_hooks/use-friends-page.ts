import { useState, useMemo, useCallback } from "react";
import { addToast, useDisclosure } from "@heroui/react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useAdminLinks,
  useLinkCategories,
  useLinkTags,
  useDeleteLink,
  useReviewLink,
  useExportLinks,
} from "@/hooks/queries/use-friends";
import type { LinkItem, LinkStatus, AdminLinksParams } from "@/types/friends";

export function useFriendsPage() {
  // ---- 筛选 & 分页状态 ----
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState<LinkStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");

  // ---- 选择 ----
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ---- 弹窗状态 ----
  const [editItem, setEditItem] = useState<LinkItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LinkItem | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{
    item: LinkItem;
    action: "APPROVED" | "REJECTED";
  } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const formModal = useDisclosure();
  const categoryTagModal = useDisclosure();
  const importModal = useDisclosure();
  const healthCheckModal = useDisclosure();
  const deleteModal = useDisclosure();
  const reviewModal = useDisclosure();

  // ---- API ----
  const queryParams = useMemo<AdminLinksParams>(
    () => ({
      page,
      pageSize,
      name: debouncedSearch || undefined,
      status: statusFilter || undefined,
      category_id: categoryFilter ? Number(categoryFilter) : undefined,
      tag_id: tagFilter ? Number(tagFilter) : undefined,
    }),
    [page, pageSize, debouncedSearch, statusFilter, categoryFilter, tagFilter]
  );

  const { data, isLoading, isFetching } = useAdminLinks(queryParams);
  const { data: categories = [] } = useLinkCategories();
  const { data: tags = [] } = useLinkTags();
  const deleteLink = useDeleteLink();
  const reviewLink = useReviewLink();
  const exportLinks = useExportLinks();

  const links = useMemo(() => data?.list ?? [], [data?.list]);
  const totalItems = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // ---- 选择逻辑 ----
  const isSomeSelected = selectedIds.size > 0;

  const handleSelectionChange = useCallback(
    (keys: "all" | Set<React.Key>) => {
      if (keys === "all") {
        setSelectedIds(new Set(links.map(l => String(l.id))));
      } else {
        setSelectedIds(keys as Set<string>);
      }
    },
    [links]
  );

  // ---- Handlers ----
  const handleReset = useCallback(() => {
    setSearchInput("");
    setStatusFilter("");
    setCategoryFilter("");
    setTagFilter("");
    setPage(1);
    setSelectedIds(new Set());
  }, []);

  const handleOpenCreate = useCallback(() => {
    setEditItem(null);
    formModal.onOpen();
  }, [formModal]);

  const handleOpenEdit = useCallback(
    (item: LinkItem) => {
      setEditItem(item);
      formModal.onOpen();
    },
    [formModal]
  );

  const handleDeleteClick = useCallback(
    (item: LinkItem) => {
      setDeleteTarget(item);
      deleteModal.onOpen();
    },
    [deleteModal]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteLink.mutateAsync(deleteTarget.id);
      addToast({ title: "友链已删除", color: "success", timeout: 3000 });
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
  }, [deleteTarget, deleteLink, deleteModal]);

  const handleReviewClick = useCallback(
    (item: LinkItem, action: "APPROVED" | "REJECTED") => {
      setReviewTarget({ item, action });
      setRejectReason("");
      reviewModal.onOpen();
    },
    [reviewModal]
  );

  const handleReviewConfirm = useCallback(async () => {
    if (!reviewTarget) return;
    try {
      if (reviewTarget.action === "REJECTED" && !rejectReason.trim()) {
        addToast({ title: "请填写拒绝原因", color: "warning", timeout: 3000 });
        return;
      }
      await reviewLink.mutateAsync({
        id: reviewTarget.item.id,
        data: {
          status: reviewTarget.action,
          reject_reason: reviewTarget.action === "REJECTED" ? rejectReason.trim() : undefined,
        },
      });
      addToast({
        title: reviewTarget.action === "APPROVED" ? "友链已通过审核" : "友链已拒绝",
        color: "success",
        timeout: 3000,
      });
    } catch (error) {
      addToast({
        title: error instanceof Error ? error.message : "审核操作失败",
        color: "danger",
        timeout: 3000,
      });
    }
    reviewModal.onClose();
    setReviewTarget(null);
  }, [reviewTarget, rejectReason, reviewLink, reviewModal]);

  const handleExport = useCallback(async () => {
    try {
      await exportLinks.mutateAsync({
        name: debouncedSearch || undefined,
        status: statusFilter || undefined,
        category_id: categoryFilter ? Number(categoryFilter) : undefined,
        tag_id: tagFilter ? Number(tagFilter) : undefined,
      });
      addToast({ title: "友链导出成功", color: "success", timeout: 3000 });
    } catch (error) {
      addToast({
        title: error instanceof Error ? error.message : "导出失败",
        color: "danger",
        timeout: 3000,
      });
    }
  }, [debouncedSearch, statusFilter, categoryFilter, tagFilter, exportLinks]);

  return {
    // 筛选 & 分页
    page,
    setPage,
    pageSize,
    setPageSize,
    searchInput,
    setSearchInput,
    debouncedSearch,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    tagFilter,
    setTagFilter,
    viewMode,
    setViewMode,

    // 选择
    selectedIds,
    setSelectedIds,
    isSomeSelected,
    handleSelectionChange,

    // 弹窗状态
    editItem,
    deleteTarget,
    reviewTarget,
    rejectReason,
    setRejectReason,
    formModal,
    categoryTagModal,
    importModal,
    healthCheckModal,
    deleteModal,
    reviewModal,

    // 查询数据
    links,
    totalItems,
    totalPages,
    isLoading,
    isFetching,
    categories,
    tags,

    // mutations
    deleteLink,
    reviewLink,
    exportLinks,

    // handlers
    handleReset,
    handleOpenCreate,
    handleOpenEdit,
    handleDeleteClick,
    handleDeleteConfirm,
    handleReviewClick,
    handleReviewConfirm,
    handleExport,
  };
}

/** 页面状态类型，供子组件使用 */
export type FriendsPageState = ReturnType<typeof useFriendsPage>;
