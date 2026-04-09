"use client";

import {
  Button,
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Spinner,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Pagination,
} from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, lazy, Suspense } from "react";
import { Plus, Upload, Trash2, ShieldAlert, ChevronDown, FileText, Tags } from "lucide-react";
import { useRouter } from "next/navigation";

const PostCategoryTagManager = lazy(() => import("@/components/admin/post-management/PostCategoryTagManager"));
import { adminContainerVariants, adminItemVariants } from "@/lib/motion";
import { PAGE_SIZES, ADMIN_EMPTY_TEXTS } from "@/lib/constants/admin";
import { usePostManagementPage } from "./_hooks/use-post-page";
import { TABLE_COLUMNS, usePostRenderCell } from "@/components/admin/post-management/PostTableColumns";
import { PostManagementSkeleton } from "@/components/admin/post-management/PostManagementSkeleton";
import { PostFilterBar } from "@/components/admin/post-management/PostFilterBar";
import { ImportModal } from "@/components/admin/post-management/ImportModal";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { FloatingSelectionBar } from "@/components/admin/FloatingSelectionBar";
import { TableEmptyState } from "@/components/admin/TableEmptyState";

export default function PostManagementPage() {
  const router = useRouter();
  const pm = usePostManagementPage();
  const [showCategoryTagManager, setShowCategoryTagManager] = useState(false);

  const renderCell = usePostRenderCell({
    defaultCover: pm.defaultCover,
    gravatarBaseUrl: pm.gravatarBaseUrl,
    onAction: pm.handleAction,
  });
  const getColumnClassName = (columnKey: string) => {
    if (columnKey === "article") return "w-[26%] max-w-[260px]";
    if (columnKey === "time") return "w-[120px] min-w-[100px]";
    return undefined;
  };

  // ---- bottomContent ----
  const bottomContent = (
    <div className="py-2 px-2 flex flex-wrap justify-between items-center gap-2">
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-small text-muted-foreground whitespace-nowrap">共 {pm.totalItems} 篇</span>
        <span className="text-small text-muted-foreground/40">|</span>
        <Dropdown>
          <DropdownTrigger>
            <Button variant="light" size="sm" className="text-muted-foreground text-small h-7 min-w-0 gap-1 px-2">
              {pm.pageSize}条/页
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="每页显示条数"
            selectedKeys={new Set([String(pm.pageSize)])}
            selectionMode="single"
            onSelectionChange={keys => {
              const v = Array.from(keys)[0];
              if (v) {
                pm.setPageSize(Number(v));
                pm.setPage(1);
              }
            }}
          >
            {PAGE_SIZES.map(n => (
              <DropdownItem key={String(n)}>{n}条/页</DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>
        {pm.selectedIds.size > 0 && (
          <>
            <span className="text-small text-muted-foreground/40">|</span>
            <span className="text-small text-primary font-medium whitespace-nowrap">已选 {pm.selectedIds.size} 项</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Pagination
          isCompact
          showControls
          showShadow
          color="primary"
          page={pm.page}
          total={pm.totalPages}
          onChange={pm.setPage}
        />
        <div className="hidden sm:flex gap-1.5">
          <Button
            isDisabled={pm.page <= 1}
            size="sm"
            variant="flat"
            onPress={() => pm.setPage(p => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <Button
            isDisabled={pm.page >= pm.totalPages}
            size="sm"
            variant="flat"
            onPress={() => pm.setPage(p => Math.min(pm.totalPages, p + 1))}
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  );

  if (pm.isLoading) {
    return <PostManagementSkeleton />;
  }

  return (
    <motion.div
      className="relative h-full flex flex-col overflow-hidden -m-4 lg:-m-8"
      variants={adminContainerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div
        variants={adminItemVariants}
        className="flex-1 min-h-0 flex flex-col mx-6 mt-5 mb-2 bg-card border border-border/60 rounded-xl overflow-hidden"
      >
        {/* 标题区 + 操作按钮 */}
        <div className="shrink-0 px-5 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">文章管理</h1>
              <p className="text-xs text-muted-foreground mt-1">管理博客文章，支持多作者审核发布</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="flat"
                startContent={<Tags className="w-3.5 h-3.5" />}
                onPress={() => setShowCategoryTagManager(true)}
              >
                分类标签
              </Button>
              <Button
                size="sm"
                color="primary"
                startContent={<Plus className="w-3.5 h-3.5" />}
                onPress={() => router.push("/admin/post-management/new")}
                className="font-medium shadow-sm"
              >
                新增文章
              </Button>
              <Button
                size="sm"
                variant="flat"
                onPress={pm.importModal.onOpen}
                startContent={<Upload className="w-3.5 h-3.5" />}
                className="text-foreground/70"
              >
                导入
              </Button>
            </div>
          </div>
        </div>

        {/* 筛选栏 */}
        <PostFilterBar
          searchInput={pm.searchInput}
          onSearchInputChange={pm.setSearchInput}
          statusFilter={pm.statusFilter}
          onStatusFilterChange={pm.setStatusFilter}
          reviewStatusFilter={pm.reviewStatusFilter}
          onReviewStatusFilterChange={pm.setReviewStatusFilter}
          onReset={pm.handleReset}
          onPageReset={() => pm.setPage(1)}
        />

        {/* 表格 */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <Table
            isHeaderSticky
            aria-label="文章管理表格"
            selectionMode="multiple"
            color="default"
            checkboxesProps={{ color: "primary" }}
            selectedKeys={pm.selectedIds}
            onSelectionChange={pm.handleSelectionChange}
            bottomContent={bottomContent}
            bottomContentPlacement="outside"
            classNames={{
              base: "flex-1 min-h-0 flex flex-col",
              wrapper: "flex-1 min-h-0 px-3! py-0! shadow-none! rounded-none! border-none!",
              table: "border-separate border-spacing-y-1.5 -mt-1.5",
              thead: "[&>tr]:first:shadow-none! after:hidden!",
              th: "bg-[#F6F7FA] dark:bg-muted first:rounded-tl-lg! last:rounded-tr-lg!",
              tr: "rounded-xl!",
              td: "first:before:rounded-s-xl! last:before:rounded-e-xl!",
            }}
          >
            <TableHeader columns={TABLE_COLUMNS}>
              {column => (
                <TableColumn
                  key={column.key}
                  align={column.key === "actions" ? "center" : "start"}
                  className={getColumnClassName(String(column.key))}
                >
                  {column.label}
                </TableColumn>
              )}
            </TableHeader>
            <TableBody
              items={pm.articles}
              emptyContent={
                <TableEmptyState
                  icon={FileText}
                  hasFilter={!!(pm.debouncedSearch || pm.statusFilter || pm.categoryFilter)}
                  filterEmptyText={ADMIN_EMPTY_TEXTS.posts.filterEmptyText}
                  emptyText={ADMIN_EMPTY_TEXTS.posts.emptyText}
                  emptyHint={ADMIN_EMPTY_TEXTS.posts.emptyHint}
                  action={{
                    label: "新建文章",
                    onPress: () => router.push("/admin/post-management/new"),
                  }}
                />
              }
              isLoading={pm.isFetching && !pm.isLoading}
              loadingContent={<Spinner size="sm" label="加载中..." />}
            >
              {article => (
                <TableRow key={article.id} className={article.is_takedown ? "opacity-50" : ""}>
                  {columnKey => (
                    <TableCell className={getColumnClassName(String(columnKey))}>
                      {renderCell(article, columnKey)}
                    </TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </motion.div>

      {/* 浮动选择操作栏 */}
      <AnimatePresence>
        {pm.isSomeSelected && (
          <FloatingSelectionBar
            count={pm.selectedIds.size}
            actions={[
              {
                key: "delete",
                label: "删除",
                icon: <Trash2 className="w-3.5 h-3.5" />,
                onClick: pm.batchDeleteModal.onOpen,
                variant: "danger",
              },
            ]}
            onClear={() => pm.setSelectedIds(new Set())}
          />
        )}
      </AnimatePresence>

      {/* 弹窗 */}
      <ConfirmDialog
        isOpen={pm.deleteModal.isOpen}
        onOpenChange={pm.deleteModal.onOpenChange}
        title="删除文章"
        description={`确定要删除「${pm.deleteTarget?.title}」吗？此操作不可撤销。`}
        confirmText="删除"
        confirmColor="danger"
        icon={<ShieldAlert className="w-5 h-5 text-danger" />}
        iconBg="bg-danger-50"
        loading={pm.deleteArticle.isPending}
        onConfirm={pm.handleDeleteConfirm}
      />

      <ConfirmDialog
        isOpen={pm.batchDeleteModal.isOpen}
        onOpenChange={pm.batchDeleteModal.onOpenChange}
        title="批量删除"
        description={`确定要删除选中的 ${pm.selectedIds.size} 篇文章吗？此操作不可撤销。`}
        confirmText={`删除 ${pm.selectedIds.size} 篇`}
        confirmColor="danger"
        icon={<ShieldAlert className="w-5 h-5 text-danger" />}
        iconBg="bg-danger-50"
        loading={pm.batchDeleting}
        onConfirm={pm.handleBatchDeleteConfirm}
      />

      <ImportModal
        isOpen={pm.importModal.isOpen}
        onOpenChange={pm.importModal.onOpenChange}
        onImport={pm.importArticlesHook}
      />

      <Suspense fallback={null}>
        {showCategoryTagManager && (
          <PostCategoryTagManager isOpen={showCategoryTagManager} onClose={() => setShowCategoryTagManager(false)} />
        )}
      </Suspense>
    </motion.div>
  );
}
