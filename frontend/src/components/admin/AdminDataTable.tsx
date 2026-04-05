"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Button, Input } from "@/components/ui";
import {
  Search,
  Inbox,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TableEmptyState } from "./TableEmptyState";

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: "left" | "center" | "right";
}

interface AdminDataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowKey?: keyof T | ((item: T, index: number) => string | number);
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: string[];
  pageSize?: number;
  emptyMessage?: string;
  emptyContent?: React.ReactNode;
  loading?: boolean;
  onRowClick?: (item: T) => void;
  rowActions?: (item: T) => React.ReactNode;
  search?: string;
  onSearchChange?: (value: string) => void;
  sortKey?: string | null;
  sortDir?: "asc" | "desc";
  onSortChange?: (key: string, dir: "asc" | "desc") => void;
  page?: number;
  onPageChange?: (page: number) => void;
}

export function AdminDataTable<T extends Record<string, unknown>>({
  data,
  columns,
  rowKey,
  searchable = true,
  searchPlaceholder = "搜索...",
  searchKeys = [],
  pageSize = 10,
  emptyMessage = "暂无数据",
  emptyContent,
  loading = false,
  onRowClick,
  rowActions,
  search: controlledSearch,
  onSearchChange,
  sortKey: controlledSortKey,
  sortDir: controlledSortDir,
  onSortChange,
  page: controlledPage,
  onPageChange,
}: AdminDataTableProps<T>) {
  const [internalSearch, setInternalSearch] = useState("");
  const [internalPage, setInternalPage] = useState(1);
  const [internalSortKey, setInternalSortKey] = useState<string | null>(null);
  const [internalSortDir, setInternalSortDir] = useState<"asc" | "desc">("asc");

  const search = controlledSearch ?? internalSearch;
  const setSearch = onSearchChange ?? setInternalSearch;
  const page = controlledPage ?? internalPage;
  const setPage = onPageChange ?? setInternalPage;
  const sortKey = controlledSortKey ?? internalSortKey;
  const sortDir = controlledSortDir ?? internalSortDir;

  const getRowKey = (item: T, index: number): string | number => {
    if (!rowKey)
      return (item as Record<string, unknown>).id != null ? String((item as Record<string, unknown>).id) : index;
    if (typeof rowKey === "function") return rowKey(item, index);
    return String(item[rowKey] ?? index);
  };

  // 过滤数据
  const filteredData = useMemo(() => {
    if (!search || searchKeys.length === 0) return data;
    const searchLower = search.toLowerCase();
    return data.filter(item =>
      searchKeys.some(key => {
        const value = item[key];
        return String(value).toLowerCase().includes(searchLower);
      })
    );
  }, [data, search, searchKeys]);

  // 排序数据
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey] as string | number | null | undefined;
      const bVal = b[sortKey] as string | number | null | undefined;
      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const comparison = aVal > bVal ? 1 : -1;
      return sortDir === "asc" ? comparison : -comparison;
    });
  }, [filteredData, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));

  const safePage = page > totalPages ? totalPages : page;
  if (safePage !== page) {
    Promise.resolve().then(() => setPage(safePage));
  }

  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, safePage, pageSize]);

  const handleSort = (key: string) => {
    if (onSortChange) {
      const newDir = sortKey === key && sortDir === "asc" ? "desc" : "asc";
      onSortChange(key, newDir);
    } else {
      if (sortKey === key) {
        setInternalSortDir(prev => (prev === "asc" ? "desc" : "asc"));
      } else {
        setInternalSortKey(key);
        setInternalSortDir("asc");
      }
    }
  };

  const renderSortIcon = (key: string) => {
    if (sortKey !== key) return <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-primary" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-primary" />
    );
  };

  const hasSearchFilter = searchable && search.trim().length > 0;
  const resolvedEmptyContent = emptyContent ?? (
    <TableEmptyState
      icon={Inbox}
      hasFilter={hasSearchFilter}
      filterEmptyText="没有匹配的数据"
      emptyText={emptyMessage}
      filterHint="试试调整搜索关键词"
      emptyHint={searchable ? "你可以通过上方搜索框快速筛选数据" : undefined}
    />
  );

  return (
    <div className="space-y-4">
      {/* 搜索框 */}
      {searchable && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
            className="pl-9!"
          />
        </div>
      )}

      {/* 表格 */}
      <div className="overflow-x-auto rounded-lg border border-border/50">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/30">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider",
                    col.align === "center" && "text-center",
                    col.align === "right" && "text-right",
                    col.sortable && "cursor-pointer hover:text-foreground transition-colors"
                  )}
                  style={{ width: col.width }}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div
                    className={cn(
                      "flex items-center gap-1.5",
                      col.align === "center" && "justify-center",
                      col.align === "right" && "justify-end"
                    )}
                  >
                    {col.header}
                    {col.sortable && renderSortIcon(col.key)}
                  </div>
                </th>
              ))}
              {rowActions && (
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right w-20">
                  操作
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading ? (
              <tr>
                <td colSpan={columns.length + (rowActions ? 1 : 0)} className="px-4 py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    加载中...
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (rowActions ? 1 : 0)} className="px-4 py-12 text-center">
                  {resolvedEmptyContent}
                </td>
              </tr>
            ) : (
              paginatedData.map((item, index) => (
                <motion.tr
                  key={getRowKey(item, index)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className={cn("bg-card hover:bg-muted/30 transition-colors", onRowClick && "cursor-pointer")}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-3 text-sm",
                        col.align === "center" && "text-center",
                        col.align === "right" && "text-right"
                      )}
                    >
                      {col.render ? col.render(item, index) : String(item[col.key] ?? "")}
                    </td>
                  ))}
                  {rowActions && <td className="px-4 py-3 text-right">{rowActions(item)}</td>}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            共 {sortedData.length} 条，第 {safePage} / {totalPages} 页
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(1)}
              disabled={safePage === 1}
              className="h-8 w-8 p-0"
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, safePage - 1))}
              disabled={safePage === 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-1 px-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (safePage <= 3) {
                  pageNum = i + 1;
                } else if (safePage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = safePage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={safePage === pageNum ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setPage(pageNum)}
                    className="h-8 w-8 p-0"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
              disabled={safePage === totalPages}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(totalPages)}
              disabled={safePage === totalPages}
              className="h-8 w-8 p-0"
            >
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
