"use client";

import { useCallback } from "react";
import Image from "next/image";
import { Chip, Button, Tooltip } from "@heroui/react";
import { Edit, Trash2 } from "lucide-react";
import { formatDateTimeParts } from "@/utils/date";
import type { DocSeries } from "@/types/doc-series";

/** 表格列定义 */
export const TABLE_COLUMNS = [
  { key: "series", label: "系列信息" },
  { key: "description", label: "描述" },
  { key: "docCount", label: "文档数量" },
  { key: "sort", label: "排序" },
  { key: "time", label: "时间" },
  { key: "actions", label: "操作" },
];

interface UseDocSeriesRenderCellOptions {
  onAction: (item: DocSeries, key: string) => void;
}

/**
 * 返回文档系列表格的 renderCell 函数
 */
export function useDocSeriesRenderCell({ onAction }: UseDocSeriesRenderCellOptions) {
  return useCallback(
    (item: DocSeries, columnKey: React.Key) => {
      switch (columnKey) {
        case "series": {
          return (
            <div className="flex gap-3 items-center min-w-0">
              {item.cover_url ? (
                <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-muted ring-1 ring-border/20">
                  <Image src={item.cover_url} alt={item.name} fill className="object-cover" sizes="56px" unoptimized />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-lg shrink-0 bg-primary/10 flex items-center justify-center ring-1 ring-border/20">
                  <span className="text-lg font-bold text-primary/60">{item.name.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{item.name}</p>
              </div>
            </div>
          );
        }
        case "description":
          return (
            <p className="text-sm text-muted-foreground truncate max-w-[240px]" title={item.description || undefined}>
              {item.description || "-"}
            </p>
          );
        case "docCount":
          return (
            <Chip size="sm" variant="flat" color={item.doc_count > 0 ? "primary" : "default"}>
              {item.doc_count} 篇
            </Chip>
          );
        case "sort":
          return <span className="text-sm text-muted-foreground tabular-nums">{item.sort}</span>;
        case "time": {
          const created = formatDateTimeParts(item.created_at);
          const updated = formatDateTimeParts(item.updated_at);
          return (
            <div className="flex flex-col gap-1 text-xs">
              <div className="text-muted-foreground tabular-nums">
                <div>{created.date}</div>
                <div className="text-muted-foreground/60">{created.time}</div>
              </div>
              <div className="text-muted-foreground/50 tabular-nums">
                <div>{updated.date}</div>
                <div className="text-muted-foreground/40">{updated.time}</div>
              </div>
            </div>
          );
        }
        case "actions":
          return (
            <div className="flex items-center justify-center gap-1">
              <Tooltip content="编辑" placement="top" size="sm">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  radius="full"
                  className="w-7 h-7 min-w-0 text-warning-600 bg-warning/10 hover:bg-warning/20"
                  onPress={() => onAction(item, "edit")}
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
                  onPress={() => onAction(item, "delete")}
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
    [onAction]
  );
}
