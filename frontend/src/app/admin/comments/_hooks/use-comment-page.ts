import { useState, useMemo, useCallback } from "react";
import { addToast, useDisclosure } from "@heroui/react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useAdminComments,
  useDeleteComments,
  useUpdateCommentStatus,
  useUpdateCommentInfo,
  useToggleCommentPin,
  useExportComments,
  useImportComments,
} from "@/hooks/queries/use-comment-management";
import type {
  AdminComment,
  AdminCommentListParams,
  CommentStatus,
  UpdateCommentInfoRequest,
} from "@/types/comment-management";
import { COMMENT_STATUS } from "@/types/comment-management";
import { useSiteConfigStore } from "@/store/site-config-store";

export function useCommentManagementPage() {
  // ---- 站点配置 ----
  const siteConfig = useSiteConfigStore(state => state.siteConfig);
  const gravatarBaseUrl = useMemo(
    () => (siteConfig?.GRAVATAR_URL || "https://cravatar.cn").replace(/\/$/, ""),
    [siteConfig]
  );

  // ---- 筛选 & 分页 ----
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ---- 选择 ----
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ---- 弹窗状态 ----
  const [deleteTarget, setDeleteTarget] = useState<AdminComment | null>(null);
  const [editTarget, setEditTarget] = useState<AdminComment | null>(null);
  const [editForm, setEditForm] = useState<UpdateCommentInfoRequest>({});

  const deleteModal = useDisclosure();
  const batchDeleteModal = useDisclosure();
  const editModal = useDisclosure();
  const importModal = useDisclosure();

  // ---- 查询 ----
  const queryParams: AdminCommentListParams = useMemo(
    () => ({
      page,
      pageSize,
      content: debouncedSearch || undefined,
      status: statusFilter ? (Number(statusFilter) as CommentStatus) : undefined,
    }),
    [page, pageSize, debouncedSearch, statusFilter]
  );

  const { data, isLoading, isFetching } = useAdminComments(queryParams);
  const comments = useMemo(() => data?.list ?? [], [data?.list]);
  const totalItems = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // ---- Mutations ----
  const deleteComments = useDeleteComments();
  const updateCommentStatus = useUpdateCommentStatus();
  const updateCommentInfo = useUpdateCommentInfo();
  const toggleCommentPin = useToggleCommentPin();
  const exportComments = useExportComments();
  const importCommentsHook = useImportComments();

  // ---- 选择逻辑 ----
  const isSomeSelected = selectedIds.size > 0;

  /** 选中的评论中是否包含待审核的 */
  const hasPendingSelected = useMemo(
    () => comments.some(c => selectedIds.has(c.id) && c.status === COMMENT_STATUS.PENDING),
    [comments, selectedIds]
  );
  /** 选中的评论中是否包含已发布的 */
  const hasPublishedSelected = useMemo(
    () => comments.some(c => selectedIds.has(c.id) && c.status === COMMENT_STATUS.PUBLISHED),
    [comments, selectedIds]
  );

  const handleSelectionChange = useCallback(
    (keys: "all" | Set<React.Key>) => {
      if (keys === "all") {
        setSelectedIds(new Set(comments.map(c => c.id)));
      } else {
        setSelectedIds(keys as Set<string>);
      }
    },
    [comments]
  );

  // ---- 删除 ----
  const handleDeleteClick = useCallback(
    (comment: AdminComment) => {
      setDeleteTarget(comment);
      deleteModal.onOpen();
    },
    [deleteModal]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteComments.mutateAsync([deleteTarget.id]);
      addToast({ title: "评论已删除", color: "success", timeout: 3000 });
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "删除失败", color: "danger", timeout: 3000 });
    }
    deleteModal.onClose();
    setDeleteTarget(null);
  }, [deleteTarget, deleteComments, deleteModal]);

  const handleBatchDeleteConfirm = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await deleteComments.mutateAsync(ids);
      addToast({ title: `已删除 ${ids.length} 条评论`, color: "success", timeout: 3000 });
      setSelectedIds(new Set());
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "批量删除失败", color: "danger", timeout: 3000 });
    }
    batchDeleteModal.onClose();
  }, [selectedIds, deleteComments, batchDeleteModal]);

  // ---- 审核 ----
  const handleApprove = useCallback(
    async (comment: AdminComment) => {
      try {
        await updateCommentStatus.mutateAsync({ id: comment.id, status: COMMENT_STATUS.PUBLISHED });
        addToast({ title: "评论已通过", color: "success", timeout: 3000 });
      } catch (error) {
        addToast({ title: error instanceof Error ? error.message : "审核失败", color: "danger", timeout: 3000 });
      }
    },
    [updateCommentStatus]
  );

  const handleReject = useCallback(
    async (comment: AdminComment) => {
      try {
        await updateCommentStatus.mutateAsync({ id: comment.id, status: COMMENT_STATUS.PENDING });
        addToast({ title: "评论已设为待审核", color: "success", timeout: 3000 });
      } catch (error) {
        addToast({ title: error instanceof Error ? error.message : "操作失败", color: "danger", timeout: 3000 });
      }
    },
    [updateCommentStatus]
  );

  // ---- 批量审核 ----
  const handleBatchApprove = useCallback(async () => {
    // 只对待审核的评论执行通过操作
    const ids = Array.from(selectedIds).filter(id => {
      const comment = comments.find(c => c.id === id);
      return comment && comment.status === COMMENT_STATUS.PENDING;
    });
    if (ids.length === 0) return;
    try {
      await Promise.all(ids.map(id => updateCommentStatus.mutateAsync({ id, status: COMMENT_STATUS.PUBLISHED })));
      addToast({ title: `已通过 ${ids.length} 条评论`, color: "success", timeout: 3000 });
      setSelectedIds(new Set());
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "批量审核失败", color: "danger", timeout: 3000 });
    }
  }, [selectedIds, comments, updateCommentStatus]);

  const handleBatchReject = useCallback(async () => {
    // 只对已发布的评论执行设为待审核操作
    const ids = Array.from(selectedIds).filter(id => {
      const comment = comments.find(c => c.id === id);
      return comment && comment.status !== COMMENT_STATUS.PENDING;
    });
    if (ids.length === 0) return;
    try {
      await Promise.all(ids.map(id => updateCommentStatus.mutateAsync({ id, status: COMMENT_STATUS.PENDING })));
      addToast({ title: `已将 ${ids.length} 条评论设为待审核`, color: "success", timeout: 3000 });
      setSelectedIds(new Set());
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "批量操作失败", color: "danger", timeout: 3000 });
    }
  }, [selectedIds, comments, updateCommentStatus]);

  // ---- 置顶 ----
  const handleTogglePin = useCallback(
    async (comment: AdminComment) => {
      const isPinned = !!comment.pinned_at;
      try {
        await toggleCommentPin.mutateAsync({ id: comment.id, pinned: !isPinned });
        addToast({ title: isPinned ? "已取消置顶" : "已置顶", color: "success", timeout: 3000 });
      } catch (error) {
        addToast({ title: error instanceof Error ? error.message : "置顶操作失败", color: "danger", timeout: 3000 });
      }
    },
    [toggleCommentPin]
  );

  // ---- 编辑 ----
  const handleEditClick = useCallback(
    (comment: AdminComment) => {
      setEditTarget(comment);
      setEditForm({
        content: comment.content,
        nickname: comment.nickname,
        email: comment.email,
        website: comment.website ?? "",
      });
      editModal.onOpen();
    },
    [editModal]
  );

  const handleEditConfirm = useCallback(async () => {
    if (!editTarget) return;
    try {
      await updateCommentInfo.mutateAsync({ id: editTarget.id, data: editForm });
      addToast({ title: "评论已更新", color: "success", timeout: 3000 });
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "更新失败", color: "danger", timeout: 3000 });
    }
    editModal.onClose();
    setEditTarget(null);
    setEditForm({});
  }, [editTarget, editForm, updateCommentInfo, editModal]);

  // ---- 导出 ----
  const handleExport = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      addToast({ title: "请先选择要导出的评论", color: "warning", timeout: 3000 });
      return;
    }
    try {
      await exportComments.mutateAsync(ids);
      addToast({ title: `已导出 ${ids.length} 条评论`, color: "success", timeout: 3000 });
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "导出失败", color: "danger", timeout: 3000 });
    }
  }, [selectedIds, exportComments]);

  // ---- 行操作分发 ----
  const handleAction = useCallback(
    (comment: AdminComment, key: string) => {
      switch (key) {
        case "approve":
          handleApprove(comment);
          break;
        case "reject":
          handleReject(comment);
          break;
        case "pin":
          handleTogglePin(comment);
          break;
        case "edit":
          handleEditClick(comment);
          break;
        case "delete":
          handleDeleteClick(comment);
          break;
        case "view":
          window.open(comment.target_path, "_blank");
          break;
      }
    },
    [handleApprove, handleReject, handleTogglePin, handleEditClick, handleDeleteClick]
  );

  // ---- 重置筛选 ----
  const handleReset = useCallback(() => {
    setSearchInput("");
    setStatusFilter("");
    setPage(1);
  }, []);

  return {
    // 站点配置
    gravatarBaseUrl,

    // 筛选
    searchInput,
    setSearchInput,
    debouncedSearch,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    pageSize,
    setPageSize,
    handleReset,

    // 查询数据
    comments,
    totalItems,
    totalPages,
    isLoading,
    isFetching,

    // 选择
    selectedIds,
    setSelectedIds,
    isSomeSelected,
    hasPendingSelected,
    hasPublishedSelected,
    handleSelectionChange,

    // 删除
    deleteTarget,
    deleteModal,
    batchDeleteModal,
    deleteComments,
    handleDeleteClick,
    handleDeleteConfirm,
    handleBatchDeleteConfirm,

    // 审核
    updateCommentStatus,
    handleApprove,
    handleReject,
    handleBatchApprove,
    handleBatchReject,

    // 置顶
    toggleCommentPin,
    handleTogglePin,

    // 编辑
    editTarget,
    editForm,
    setEditForm,
    editModal,
    updateCommentInfo,
    handleEditClick,
    handleEditConfirm,

    // 导出 & 导入
    exportComments,
    handleExport,
    importModal,
    importCommentsHook,

    // 行操作
    handleAction,
  };
}

/** 页面状态类型，供子组件使用 */
export type CommentPageState = ReturnType<typeof useCommentManagementPage>;
