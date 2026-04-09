"use client";

import { useCallback, useMemo } from "react";
import Image from "next/image";
import {
  Button,
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Chip,
  Spinner,
  Tooltip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Pagination,
} from "@heroui/react";
import { Link2, ExternalLink, CheckCircle, XCircle, Edit, Trash2, ChevronDown } from "lucide-react";
import { PAGE_SIZES, ADMIN_EMPTY_TEXTS } from "@/lib/constants/admin";
import { TableEmptyState } from "@/components/admin/TableEmptyState";
import type { LinkItem, LinkStatus } from "@/types/friends";
import type { FriendsPageState } from "../_hooks/use-friends-page";

// ===================================
// 常量 & 配置
// ===================================

const STATUS_CHIP: Record<LinkStatus, { label: string; color: "success" | "warning" | "danger" | "default" }> = {
  APPROVED: { label: "已通过", color: "success" },
  PENDING: { label: "待审核", color: "warning" },
  REJECTED: { label: "已拒绝", color: "danger" },
  INVALID: { label: "已失效", color: "default" },
};

const TABLE_COLUMNS = [
  { key: "site", label: "网站信息" },
  { key: "description", label: "描述" },
  { key: "category", label: "分类/标签" },
  { key: "status", label: "状态" },
  { key: "actions", label: "操作" },
];

// ===================================
// 友链列表
// ===================================

interface FriendsContentProps {
  cm: FriendsPageState;
}

export function FriendsContent({ cm }: FriendsContentProps) {
  const hasFilter = !!(cm.searchInput || cm.statusFilter || cm.categoryFilter || cm.tagFilter);

  // ---- 单元格渲染 ----
  const renderCell = useCallback(
    (link: LinkItem, columnKey: React.Key) => {
      switch (columnKey) {
        case "site": {
          return (
            <div className="flex items-center gap-3 min-w-0">
              {link.logo ? (
                <Image
                  src={link.logo}
                  alt={link.name}
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full object-cover border border-border/60 shrink-0"
                  unoptimized
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                  {link.name[0]}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{link.name}</p>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-0.5 truncate"
                >
                  {link.url}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            </div>
          );
        }
        case "description": {
          return <p className="text-xs text-muted-foreground line-clamp-2 max-w-[160px]">{link.description || "-"}</p>;
        }
        case "category": {
          return (
            <div className="flex flex-col gap-1">
              {link.category && (
                <Chip size="sm" variant="flat" color="primary" className="text-[11px] h-5">
                  {link.category.name}
                </Chip>
              )}
              {link.tag && (
                <Chip
                  size="sm"
                  variant="flat"
                  className="text-[11px] h-5"
                  startContent={
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: link.tag.color || "#999" }} />
                  }
                >
                  {link.tag.name}
                </Chip>
              )}
              {!link.category && !link.tag && <span className="text-xs text-muted-foreground/30">-</span>}
            </div>
          );
        }
        case "status": {
          const chip = STATUS_CHIP[link.status] ?? { label: "未知", color: "default" as const };
          return (
            <Chip size="sm" color={chip.color} variant="flat">
              {chip.label}
            </Chip>
          );
        }
        case "actions": {
          return (
            <div className="flex items-center justify-center gap-1">
              {link.status === "PENDING" && (
                <>
                  <Tooltip content="通过" placement="top" size="sm">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      radius="full"
                      className="w-7 h-7 min-w-0 text-success-600 bg-success/10 hover:bg-success/20"
                      onPress={() => cm.handleReviewClick(link, "APPROVED")}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                    </Button>
                  </Tooltip>
                  <Tooltip content="拒绝" placement="top" size="sm">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      radius="full"
                      className="w-7 h-7 min-w-0 text-danger bg-danger/10 hover:bg-danger/20"
                      onPress={() => cm.handleReviewClick(link, "REJECTED")}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </Button>
                  </Tooltip>
                </>
              )}
              <Tooltip content="编辑" placement="top" size="sm">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  radius="full"
                  className="w-7 h-7 min-w-0 text-primary bg-primary/10 hover:bg-primary/20"
                  onPress={() => cm.handleOpenEdit(link)}
                >
                  <Edit className="w-3.5 h-3.5" />
                </Button>
              </Tooltip>
              <Tooltip content="删除" placement="top" size="sm" color="danger">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  radius="full"
                  className="w-7 h-7 min-w-0 text-danger bg-danger/10 hover:bg-danger/20"
                  onPress={() => cm.handleDeleteClick(link)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </Tooltip>
            </div>
          );
        }
        default:
          return null;
      }
    },
    [cm]
  );

  // ---- bottomContent（总数 + 每页 + 选择计数 + 分页 + 上一页/下一页） ----
  const bottomContent = useMemo(() => {
    return (
      <div className="py-2 px-2 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-small text-muted-foreground whitespace-nowrap">共 {cm.totalItems} 条</span>
          <span className="text-small text-muted-foreground/40">|</span>
          <Dropdown>
            <DropdownTrigger>
              <Button variant="light" size="sm" className="text-muted-foreground text-small h-7 min-w-0 gap-1 px-2">
                {cm.pageSize}条/页
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="每页显示条数"
              selectedKeys={new Set([String(cm.pageSize)])}
              selectionMode="single"
              onSelectionChange={keys => {
                const v = Array.from(keys)[0];
                if (v) {
                  cm.setPageSize(Number(v));
                  cm.setPage(1);
                }
              }}
            >
              {PAGE_SIZES.map(n => (
                <DropdownItem key={String(n)}>{n}条/页</DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
          {cm.selectedIds.size > 0 && (
            <>
              <span className="text-small text-muted-foreground/40">|</span>
              <span className="text-small text-primary font-medium whitespace-nowrap">
                已选 {cm.selectedIds.size} 项
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Pagination
            isCompact
            showControls
            showShadow
            color="primary"
            page={cm.page}
            total={cm.totalPages}
            onChange={cm.setPage}
          />
          <div className="hidden sm:flex gap-1.5">
            <Button
              isDisabled={cm.page <= 1}
              size="sm"
              variant="flat"
              onPress={() => cm.setPage(Math.max(1, cm.page - 1))}
            >
              上一页
            </Button>
            <Button
              isDisabled={cm.page >= cm.totalPages}
              size="sm"
              variant="flat"
              onPress={() => cm.setPage(Math.min(cm.totalPages, cm.page + 1))}
            >
              下一页
            </Button>
          </div>
        </div>
      </div>
    );
  }, [cm]);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <Table
        isHeaderSticky
        aria-label="友链管理表格"
        selectionMode="multiple"
        color="default"
        checkboxesProps={{ color: "primary" }}
        selectedKeys={cm.selectedIds}
        onSelectionChange={cm.handleSelectionChange}
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
          items={cm.links}
          emptyContent={
            <TableEmptyState
              icon={Link2}
              hasFilter={hasFilter}
              filterEmptyText={ADMIN_EMPTY_TEXTS.friends.filterEmptyText}
              emptyText={ADMIN_EMPTY_TEXTS.friends.emptyText}
              filterHint={ADMIN_EMPTY_TEXTS.friends.filterHint}
              emptyHint={ADMIN_EMPTY_TEXTS.friends.emptyHint}
              action={{
                label: "添加友链",
                onPress: cm.handleOpenCreate,
              }}
            />
          }
          isLoading={cm.isFetching && !cm.isLoading}
          loadingContent={<Spinner size="sm" label="加载中..." />}
        >
          {link => (
            <TableRow key={String(link.id)}>
              {columnKey => <TableCell>{renderCell(link, columnKey)}</TableCell>}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
