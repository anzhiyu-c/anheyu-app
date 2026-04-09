import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { addToast, useDisclosure } from "@heroui/react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAdminArticles, useDeleteArticle, useImportArticles } from "@/hooks/queries/use-post-management";
import type { AdminArticle, AdminArticleListParams, ArticleStatus, ReviewStatus } from "@/types/post-management";
import { useSiteConfigStore } from "@/store/site-config-store";
import { FALLBACK_COVER } from "@/lib/constants/admin";

export function usePostManagementPage() {
  const router = useRouter();

  // ---- 站点配置 ----
  const siteConfig = useSiteConfigStore(state => state.siteConfig);
  const defaultCover = useMemo(() => siteConfig?.post?.default?.default_cover || FALLBACK_COVER, [siteConfig]);
  const gravatarBaseUrl = useMemo(
    () => (siteConfig?.GRAVATAR_URL || "https://cravatar.cn").replace(/\/$/, ""),
    [siteConfig]
  );

  // ---- 筛选 & 分页 ----
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState("");
  const [reviewStatusFilter, setReviewStatusFilter] = useState("");
  const [categoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ---- 选择 ----
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ---- 弹窗状态 ----
  const [deleteTarget, setDeleteTarget] = useState<AdminArticle | null>(null);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const deleteModal = useDisclosure();
  const batchDeleteModal = useDisclosure();
  const importModal = useDisclosure();

  // ---- 查询 ----
  const queryParams: AdminArticleListParams = useMemo(
    () => ({
      page,
      pageSize,
      query: debouncedSearch || undefined,
      status: (statusFilter as ArticleStatus) || undefined,
      review_status: (reviewStatusFilter as ReviewStatus) || undefined,
      category: categoryFilter || undefined,
    }),
    [page, pageSize, debouncedSearch, statusFilter, reviewStatusFilter, categoryFilter]
  );

  const { data, isLoading, isFetching } = useAdminArticles(queryParams);
  const articles = useMemo(() => data?.list ?? [], [data?.list]);
  const totalItems = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // ---- Mutations ----
  const deleteArticle = useDeleteArticle();
  const importArticlesHook = useImportArticles();

  // ---- 选择逻辑 ----
  const isSomeSelected = selectedIds.size > 0;

  const handleSelectionChange = useCallback(
    (keys: "all" | Set<React.Key>) => {
      if (keys === "all") {
        setSelectedIds(new Set(articles.map(a => a.id)));
      } else {
        setSelectedIds(keys as Set<string>);
      }
    },
    [articles]
  );

  // ---- 删除 ----
  const handleDeleteClick = useCallback(
    (article: AdminArticle) => {
      setDeleteTarget(article);
      deleteModal.onOpen();
    },
    [deleteModal]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteArticle.mutateAsync(deleteTarget.id);
      addToast({ title: "文章已删除", color: "success", timeout: 3000 });
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
  }, [deleteTarget, deleteArticle, deleteModal]);

  const handleBatchDeleteConfirm = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBatchDeleting(true);
    try {
      const results = await Promise.allSettled(ids.map(id => deleteArticle.mutateAsync(id)));
      const failed = results.filter(r => r.status === "rejected").length;
      const succeeded = results.filter(r => r.status === "fulfilled").length;
      if (failed === 0) {
        addToast({ title: `已删除 ${succeeded} 篇文章`, color: "success", timeout: 3000 });
      } else {
        addToast({ title: `${succeeded} 篇删除成功，${failed} 篇删除失败`, color: "warning", timeout: 5000 });
      }
      setSelectedIds(new Set());
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "批量删除失败", color: "danger", timeout: 3000 });
    } finally {
      setBatchDeleting(false);
      batchDeleteModal.onClose();
    }
  }, [selectedIds, deleteArticle, batchDeleteModal]);

  // ---- 行操作分发 ----
  const handleAction = useCallback(
    (article: AdminArticle, key: string) => {
      switch (key) {
        case "preview":
          window.open(`/posts/${article.abbrlink || article.id}`, "_blank");
          break;
        case "edit":
          router.push(`/admin/post-management/${article.id}/edit`);
          break;
        case "delete":
          handleDeleteClick(article);
          break;
      }
    },
    [router, handleDeleteClick]
  );

  // ---- 重置筛选 ----
  const handleReset = useCallback(() => {
    setSearchInput("");
    setStatusFilter("");
    setReviewStatusFilter("");
    setPage(1);
  }, []);

  return {
    // 站点配置
    defaultCover,
    gravatarBaseUrl,

    // 筛选
    searchInput,
    setSearchInput,
    debouncedSearch,
    statusFilter,
    setStatusFilter,
    reviewStatusFilter,
    setReviewStatusFilter,
    categoryFilter,
    page,
    setPage,
    pageSize,
    setPageSize,
    handleReset,

    // 查询数据
    articles,
    totalItems,
    totalPages,
    isLoading,
    isFetching,

    // 选择
    selectedIds,
    setSelectedIds,
    isSomeSelected,
    handleSelectionChange,

    // 删除
    deleteTarget,
    deleteModal,
    batchDeleteModal,
    batchDeleting,
    deleteArticle,
    handleDeleteClick,
    handleDeleteConfirm,
    handleBatchDeleteConfirm,

    // 导入
    importModal,
    importArticlesHook,

    // 行操作
    handleAction,
  };
}

/** 页面状态类型，供子组件使用 */
export type PostPageState = ReturnType<typeof usePostManagementPage>;
