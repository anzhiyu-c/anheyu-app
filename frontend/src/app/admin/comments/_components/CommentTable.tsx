"use client";

import { useCallback } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  User,
  Chip,
  Spinner,
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Pagination,
  Tooltip,
} from "@heroui/react";
import {
  MessageSquare,
  Trash2,
  ShieldX,
  ChevronDown,
  Pin,
  PinOff,
  Pencil,
  ExternalLink,
  Heart,
  MessageCircle,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PAGE_SIZES, ADMIN_EMPTY_TEXTS } from "@/lib/constants/admin";
import { TableEmptyState } from "@/components/admin/TableEmptyState";
import { COMMENT_STATUS } from "@/types/comment-management";
import type { AdminComment } from "@/types/comment-management";
import { formatDateTimeParts } from "@/utils/date";
import type { CommentPageState } from "../_hooks/use-comment-page";

/** 表格列定义 */
const TABLE_COLUMNS = [
  { key: "commenter", label: "评论者" },
  { key: "content", label: "内容" },
  { key: "status", label: "状态" },
  { key: "interaction", label: "互动" },
  { key: "time", label: "时间" },
  { key: "actions", label: "操作" },
];

interface CommentTableProps {
  cm: CommentPageState;
}

export function CommentTable({ cm }: CommentTableProps) {
  const renderCell = useCallback(
    (comment: AdminComment, columnKey: React.Key) => {
      switch (columnKey) {
        case "commenter": {
          const avatarSrc = comment.avatar_url
            ? comment.avatar_url.startsWith("http")
              ? comment.avatar_url
              : `${cm.gravatarBaseUrl}/${comment.avatar_url}`
            : comment.email_md5
              ? `${cm.gravatarBaseUrl}/avatar/${comment.email_md5}?d=mp&s=80`
              : undefined;
          return (
            <User
              name={
                <div className="flex items-center gap-1.5">
                  <span>{comment.nickname || "匿名"}</span>
                  {comment.is_admin_comment && (
                    <Chip size="sm" color="primary" variant="flat" className="text-[10px] h-4 px-1">
                      管理员
                    </Chip>
                  )}
                  {comment.pinned_at && <Pin className="w-3 h-3 text-warning fill-warning" />}
                </div>
              }
              description={comment.email || (comment.is_anonymous ? "匿名用户" : "")}
              avatarProps={{
                src: avatarSrc,
                size: "sm",
                name: (comment.nickname || "U").charAt(0).toUpperCase(),
                showFallback: true,
              }}
              classNames={{ name: "text-sm font-medium", description: "text-[11px]" }}
            />
          );
        }
        case "content": {
          const plainText = comment.content_html
            ? comment.content_html.replace(/<[^>]*>/g, "").slice(0, 80)
            : comment.content?.slice(0, 80) || "";
          return (
            <div className="max-w-md min-w-0">
              <p className="text-sm truncate" title={plainText}>
                {plainText}
              </p>
              {comment.target_path && (
                <a
                  href={comment.target_path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 mt-0.5 group/link hover:opacity-80 transition-opacity w-fit"
                  onClick={e => e.stopPropagation()}
                >
                  <ExternalLink className="w-3 h-3 text-muted-foreground/50 shrink-0 group-hover/link:text-primary transition-colors" />
                  <p className="text-[11px] text-muted-foreground/60 truncate group-hover/link:text-primary transition-colors">
                    {comment.target_title || comment.target_path}
                  </p>
                </a>
              )}
              {!comment.target_path && comment.target_title && (
                <div className="flex items-center gap-1 mt-0.5">
                  <ExternalLink className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                  <p className="text-[11px] text-muted-foreground/60 truncate">{comment.target_title}</p>
                </div>
              )}
              {comment.reply_to_nick && (
                <p className="text-[11px] text-primary/60 mt-0.5">回复 @{comment.reply_to_nick}</p>
              )}
            </div>
          );
        }
        case "status": {
          const isPublished = comment.status === COMMENT_STATUS.PUBLISHED;
          return (
            <Chip size="sm" color={isPublished ? "success" : "warning"} variant="flat">
              {isPublished ? "已发布" : "待审核"}
            </Chip>
          );
        }
        case "interaction":
          return (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1">
                <Heart className="w-3 h-3 text-muted-foreground/40" />
                <span className="text-xs text-muted-foreground tabular-nums">{comment.like_count}</span>
              </div>
              {comment.total_children > 0 && (
                <div className="flex items-center gap-1">
                  <MessageCircle className="w-3 h-3 text-muted-foreground/40" />
                  <span className="text-xs text-muted-foreground tabular-nums">{comment.total_children}</span>
                </div>
              )}
            </div>
          );
        case "time": {
          const created = formatDateTimeParts(comment.created_at);
          return (
            <div className="flex flex-col gap-0.5 text-xs">
              <div className="text-muted-foreground tabular-nums">
                <div>{created.date}</div>
                <div className="text-muted-foreground/60">{created.time}</div>
              </div>
            </div>
          );
        }
        case "actions":
          return (
            <div className="flex items-center justify-center gap-1">
              {comment.status === COMMENT_STATUS.PENDING ? (
                <Tooltip content="通过" placement="top" size="sm">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    radius="full"
                    className="w-7 h-7 min-w-0 text-success bg-success/10 hover:bg-success/20"
                    onPress={() => cm.handleAction(comment, "approve")}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                </Tooltip>
              ) : (
                <Tooltip content="设为待审核" placement="top" size="sm">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    radius="full"
                    className="w-7 h-7 min-w-0 text-warning-600 bg-warning/10 hover:bg-warning/20"
                    onPress={() => cm.handleAction(comment, "reject")}
                  >
                    <ShieldX className="w-3.5 h-3.5" />
                  </Button>
                </Tooltip>
              )}
              <Tooltip content={comment.pinned_at ? "取消置顶" : "置顶"} placement="top" size="sm">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  radius="full"
                  className={cn(
                    "w-7 h-7 min-w-0",
                    comment.pinned_at
                      ? "text-warning bg-warning/10 hover:bg-warning/20"
                      : "text-muted-foreground bg-default/10 hover:bg-default/20"
                  )}
                  onPress={() => cm.handleAction(comment, "pin")}
                >
                  {comment.pinned_at ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                </Button>
              </Tooltip>
              <Tooltip content="编辑" placement="top" size="sm">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  radius="full"
                  className="w-7 h-7 min-w-0 text-primary bg-primary/10 hover:bg-primary/20"
                  onPress={() => cm.handleAction(comment, "edit")}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </Tooltip>
              <Tooltip content="删除" placement="top" size="sm" color="danger">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  radius="full"
                  className="w-7 h-7 min-w-0 text-danger bg-danger/10 hover:bg-danger/20"
                  onPress={() => cm.handleAction(comment, "delete")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </Tooltip>
            </div>
          );
        default:
          return null;
      }
    },
    [cm]
  );

  const bottomContent = (
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
            <span className="text-small text-primary font-medium whitespace-nowrap">已选 {cm.selectedIds.size} 项</span>
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
            onPress={() => cm.setPage(p => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <Button
            isDisabled={cm.page >= cm.totalPages}
            size="sm"
            variant="flat"
            onPress={() => cm.setPage(p => Math.min(cm.totalPages, p + 1))}
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <Table
        isHeaderSticky
        aria-label="评论管理表格"
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
          items={cm.comments}
          emptyContent={
            <TableEmptyState
              icon={MessageSquare}
              hasFilter={!!(cm.debouncedSearch || cm.statusFilter)}
              filterEmptyText={ADMIN_EMPTY_TEXTS.comments.filterEmptyText}
              emptyText={ADMIN_EMPTY_TEXTS.comments.emptyText}
              emptyHint={ADMIN_EMPTY_TEXTS.comments.emptyHint}
            />
          }
          isLoading={cm.isFetching && !cm.isLoading}
          loadingContent={<Spinner size="sm" label="加载中..." />}
        >
          {comment => (
            <TableRow key={comment.id}>{columnKey => <TableCell>{renderCell(comment, columnKey)}</TableCell>}</TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
