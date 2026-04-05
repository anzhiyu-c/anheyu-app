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
import { Plus, Trash2, ShieldAlert, ChevronDown, BookOpen } from "lucide-react";
import { adminContainerVariants, adminItemVariants } from "@/lib/motion";
import { PAGE_SIZES, ADMIN_EMPTY_TEXTS } from "@/lib/constants/admin";
import { useDocSeriesPage } from "./_hooks/use-doc-series-page";
import { TABLE_COLUMNS, useDocSeriesRenderCell } from "@/components/admin/doc-series/DocSeriesTableColumns";
import { DocSeriesSkeleton } from "@/components/admin/doc-series/DocSeriesSkeleton";
import { DocSeriesFilterBar } from "@/components/admin/doc-series/DocSeriesFilterBar";
import DocSeriesFormModal from "@/components/admin/doc-series/DocSeriesFormModal";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { FloatingSelectionBar } from "@/components/admin/FloatingSelectionBar";
import { TableEmptyState } from "@/components/admin/TableEmptyState";

export default function DocSeriesPage() {
  const ds = useDocSeriesPage();

  const renderCell = useDocSeriesRenderCell({
    onAction: ds.handleAction,
  });

  // ---- bottomContent ----
  const bottomContent = (
    <div className="py-2 px-2 flex flex-wrap justify-between items-center gap-2">
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-small text-muted-foreground whitespace-nowrap">共 {ds.totalItems} 个系列</span>
        <span className="text-small text-muted-foreground/40">|</span>
        <Dropdown>
          <DropdownTrigger>
            <Button variant="light" size="sm" className="text-muted-foreground text-small h-7 min-w-0 gap-1 px-2">
              {ds.pageSize}条/页
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="每页显示条数"
            selectedKeys={new Set([String(ds.pageSize)])}
            selectionMode="single"
            onSelectionChange={keys => {
              const v = Array.from(keys)[0];
              if (v) {
                ds.setPageSize(Number(v));
                ds.setPage(1);
              }
            }}
          >
            {PAGE_SIZES.map(n => (
              <DropdownItem key={String(n)}>{n}条/页</DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>
        {ds.selectedIds.size > 0 && (
          <>
            <span className="text-small text-muted-foreground/40">|</span>
            <span className="text-small text-primary font-medium whitespace-nowrap">已选 {ds.selectedIds.size} 项</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Pagination
          isCompact
          showControls
          showShadow
          color="primary"
          page={ds.page}
          total={ds.totalPages}
          onChange={ds.setPage}
        />
        <div className="hidden sm:flex gap-1.5">
          <Button
            isDisabled={ds.page <= 1}
            size="sm"
            variant="flat"
            onPress={() => ds.setPage(p => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <Button
            isDisabled={ds.page >= ds.totalPages}
            size="sm"
            variant="flat"
            onPress={() => ds.setPage(p => Math.min(ds.totalPages, p + 1))}
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  );

  if (ds.isLoading) {
    return <DocSeriesSkeleton />;
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
              <h1 className="text-lg font-semibold tracking-tight text-foreground">文档系列管理</h1>
              <p className="text-xs text-muted-foreground mt-1">管理文档系列，组织系列化文档内容</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                color="primary"
                startContent={<Plus className="w-3.5 h-3.5" />}
                onPress={ds.handleNew}
                className="font-medium shadow-sm"
              >
                新增系列
              </Button>
            </div>
          </div>
        </div>

        {/* 筛选栏 */}
        <DocSeriesFilterBar
          searchInput={ds.searchInput}
          onSearchInputChange={ds.setSearchInput}
          onReset={ds.handleReset}
          onPageReset={() => ds.setPage(1)}
        />

        {/* 表格 */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <Table
            isHeaderSticky
            aria-label="文档系列管理表格"
            selectionMode="multiple"
            color="default"
            checkboxesProps={{ color: "primary" }}
            selectedKeys={ds.selectedIds}
            onSelectionChange={ds.handleSelectionChange}
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
                <TableColumn key={column.key} align={column.key === "actions" ? "center" : "start"}>
                  {column.label}
                </TableColumn>
              )}
            </TableHeader>
            <TableBody
              items={ds.seriesList}
              emptyContent={
                <TableEmptyState
                  icon={BookOpen}
                  hasFilter={!!ds.debouncedSearch}
                  filterEmptyText={ADMIN_EMPTY_TEXTS.docSeries.filterEmptyText}
                  emptyText={ADMIN_EMPTY_TEXTS.docSeries.emptyText}
                  emptyHint={ADMIN_EMPTY_TEXTS.docSeries.emptyHint}
                  action={{
                    label: "新增系列",
                    onPress: ds.handleNew,
                  }}
                />
              }
              isLoading={ds.isFetching && !ds.isLoading}
              loadingContent={<Spinner size="sm" label="加载中..." />}
            >
              {item => (
                <TableRow key={item.id}>{columnKey => <TableCell>{renderCell(item, columnKey)}</TableCell>}</TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </motion.div>

      {/* 浮动选择操作栏 */}
      <AnimatePresence>
        {ds.isSomeSelected && (
          <FloatingSelectionBar
            count={ds.selectedIds.size}
            actions={[
              {
                key: "delete",
                label: "删除",
                icon: <Trash2 className="w-3.5 h-3.5" />,
                onClick: ds.batchDeleteModal.onOpen,
                variant: "danger",
              },
            ]}
            onClear={() => ds.setSelectedIds(new Set())}
          />
        )}
      </AnimatePresence>

      {/* 弹窗 */}
      <ConfirmDialog
        isOpen={ds.deleteModal.isOpen}
        onOpenChange={ds.deleteModal.onOpenChange}
        title="删除文档系列"
        description={`确定要删除「${ds.deleteTarget?.name}」吗？此操作不可撤销。`}
        confirmText="删除"
        confirmColor="danger"
        icon={<ShieldAlert className="w-5 h-5 text-danger" />}
        iconBg="bg-danger-50"
        loading={ds.deleteDocSeries.isPending}
        onConfirm={ds.handleDeleteConfirm}
      />

      <ConfirmDialog
        isOpen={ds.batchDeleteModal.isOpen}
        onOpenChange={ds.batchDeleteModal.onOpenChange}
        title="批量删除"
        description={`确定要删除选中的 ${ds.selectedIds.size} 个文档系列吗？此操作不可撤销。`}
        confirmText={`删除 ${ds.selectedIds.size} 个`}
        confirmColor="danger"
        icon={<ShieldAlert className="w-5 h-5 text-danger" />}
        iconBg="bg-danger-50"
        loading={ds.deleteDocSeries.isPending}
        onConfirm={ds.handleBatchDeleteConfirm}
      />

      <DocSeriesFormModal isOpen={ds.formModal.isOpen} onClose={ds.handleFormClose} editItem={ds.editItem} />
    </motion.div>
  );
}
