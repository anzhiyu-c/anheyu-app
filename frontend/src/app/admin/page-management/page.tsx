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
  Input,
} from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ShieldAlert, ChevronDown, FileText, Search, RotateCcw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { adminContainerVariants, adminItemVariants } from "@/lib/motion";
import { PAGE_SIZES, ADMIN_EMPTY_TEXTS } from "@/lib/constants/admin";
import { usePageManagementPage } from "./_hooks/use-page-page";
import { TABLE_COLUMNS, usePageRenderCell } from "@/components/admin/page-management/PageTableColumns";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { FloatingSelectionBar } from "@/components/admin/FloatingSelectionBar";
import { TableEmptyState } from "@/components/admin/TableEmptyState";

const PUBLISH_OPTIONS = [
  { key: "true", label: "已发布" },
  { key: "false", label: "草稿" },
];

export default function PageManagementPage() {
  const router = useRouter();
  const pm = usePageManagementPage();

  const renderCell = usePageRenderCell({
    onAction: pm.handleAction,
  });

  const getColumnClassName = (columnKey: string) => {
    if (columnKey === "title") return "w-[28%] max-w-[360px]";
    if (columnKey === "path") return "w-[20%] max-w-[240px]";
    if (columnKey === "time") return "w-[180px] min-w-[180px]";
    return undefined;
  };

  const bottomContent = (
    <div className="py-2 px-2 flex flex-wrap justify-between items-center gap-2">
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-small text-muted-foreground whitespace-nowrap">共 {pm.totalItems} 个页面</span>
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
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" label="加载中..." />
      </div>
    );
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
              <h1 className="text-lg font-semibold tracking-tight text-foreground">页面管理</h1>
              <p className="text-xs text-muted-foreground mt-1">管理自定义页面，支持创建隐私政策、关于等静态页面</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="flat"
                startContent={<Sparkles className="w-3.5 h-3.5" />}
                onPress={pm.handleInitializeDefaults}
                isLoading={pm.initializeDefaultPages.isPending}
                className="text-foreground/70"
              >
                初始化默认
              </Button>
              <Button
                size="sm"
                color="primary"
                startContent={<Plus className="w-3.5 h-3.5" />}
                onPress={() => router.push("/admin/page-management/new")}
                className="font-medium shadow-sm"
              >
                新建页面
              </Button>
            </div>
          </div>
        </div>

        {/* 筛选栏 */}
        <div className="shrink-0 px-5 pb-3">
          <div className="flex items-center gap-3">
            <Input
              size="sm"
              isClearable
              className="w-full sm:max-w-[300px]"
              placeholder="搜索页面标题..."
              startContent={<Search className="w-3.5 h-3.5 text-muted-foreground" />}
              value={pm.searchInput}
              onValueChange={pm.setSearchInput}
              onClear={() => pm.setSearchInput("")}
              classNames={{
                inputWrapper:
                  "h-8 min-h-8 bg-card shadow-none! [border:var(--style-border)] data-[hover=true]:bg-card dark:data-[hover=true]:bg-muted/30! group-data-[focus=true]:bg-card dark:group-data-[focus=true]:bg-muted/30! group-data-[focus=true]:[border:var(--style-border-hover)] transition-all duration-200",
              }}
            />
            <Dropdown>
              <DropdownTrigger className="hidden sm:flex">
                <Button size="sm" variant="flat" endContent={<ChevronDown className="w-3.5 h-3.5" />} className="h-8">
                  {pm.publishFilter
                    ? (PUBLISH_OPTIONS.find(o => o.key === pm.publishFilter)?.label ?? "发布状态")
                    : "发布状态"}
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="发布状态筛选"
                selectedKeys={pm.publishFilter ? new Set([pm.publishFilter]) : new Set()}
                selectionMode="single"
                onSelectionChange={keys => {
                  const v = Array.from(keys)[0];
                  pm.setPublishFilter(v ? (v as string) : "");
                  pm.setPage(1);
                }}
              >
                {PUBLISH_OPTIONS.map(opt => (
                  <DropdownItem key={opt.key}>{opt.label}</DropdownItem>
                ))}
              </DropdownMenu>
            </Dropdown>
            <div className="ml-auto">
              <Button
                size="sm"
                variant="flat"
                startContent={<RotateCcw className="w-3.5 h-3.5" />}
                onPress={pm.handleReset}
                isDisabled={!pm.searchInput && !pm.publishFilter}
                className="text-foreground/70"
              >
                重置
              </Button>
            </div>
          </div>
        </div>

        {/* 表格 */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <Table
            isHeaderSticky
            aria-label="页面管理表格"
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
              items={pm.pages}
              emptyContent={
                <TableEmptyState
                  icon={FileText}
                  hasFilter={!!(pm.debouncedSearch || pm.publishFilter)}
                  filterEmptyText={ADMIN_EMPTY_TEXTS.pages.filterEmptyText}
                  emptyText={ADMIN_EMPTY_TEXTS.pages.emptyText}
                  emptyHint={ADMIN_EMPTY_TEXTS.pages.emptyHint}
                  action={{
                    label: "新建页面",
                    onPress: () => router.push("/admin/page-management/new"),
                  }}
                />
              }
              isLoading={pm.isFetching && !pm.isLoading}
              loadingContent={<Spinner size="sm" label="加载中..." />}
            >
              {pageItem => (
                <TableRow key={String(pageItem.id)}>
                  {columnKey => (
                    <TableCell className={getColumnClassName(String(columnKey))}>
                      {renderCell(pageItem, columnKey)}
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
        title="删除页面"
        description={`确定要删除「${pm.deleteTarget?.title}」吗？此操作不可撤销。`}
        confirmText="删除"
        confirmColor="danger"
        icon={<ShieldAlert className="w-5 h-5 text-danger" />}
        iconBg="bg-danger-50"
        loading={pm.deletePage.isPending}
        onConfirm={pm.handleDeleteConfirm}
      />

      <ConfirmDialog
        isOpen={pm.batchDeleteModal.isOpen}
        onOpenChange={pm.batchDeleteModal.onOpenChange}
        title="批量删除"
        description={`确定要删除选中的 ${pm.selectedIds.size} 个页面吗？此操作不可撤销。`}
        confirmText={`删除 ${pm.selectedIds.size} 个`}
        confirmColor="danger"
        icon={<ShieldAlert className="w-5 h-5 text-danger" />}
        iconBg="bg-danger-50"
        loading={pm.deletePage.isPending}
        onConfirm={pm.handleBatchDeleteConfirm}
      />
    </motion.div>
  );
}
