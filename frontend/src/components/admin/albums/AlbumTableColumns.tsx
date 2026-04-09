"use client";

import { useCallback, useMemo } from "react";
import { Chip, Button, Tooltip } from "@heroui/react";
import { Edit, Trash2, Eye, Download } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { formatDateTimeParts } from "@/utils/date";
import type { Album, AlbumCategory } from "@/types/album";

/** 格式化文件大小 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/** 表格列定义 */
export const TABLE_COLUMNS = [
  { key: "image", label: "图片" },
  { key: "info", label: "信息" },
  { key: "stats", label: "统计" },
  { key: "time", label: "时间" },
  { key: "actions", label: "操作" },
];

interface UseAlbumRenderCellOptions {
  onAction: (item: Album, key: string) => void;
  categories?: AlbumCategory[];
}

/**
 * 返回相册表格的 renderCell 函数
 */
export function useAlbumRenderCell({ onAction, categories = [] }: UseAlbumRenderCellOptions) {
  const categoryMap = useMemo(() => {
    return new Map(categories.map(category => [category.id, category.name]));
  }, [categories]);

  return useCallback(
    (item: Album, columnKey: React.Key) => {
      switch (columnKey) {
        case "image": {
          return (
            <div className="flex gap-3 items-center min-w-0">
              <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-muted ring-1 ring-border/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl + (item.thumbParam || "")}
                  alt={item.title || "相册图片"}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={e => {
                    const target = e.currentTarget;
                    target.style.display = "none";
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{item.title || "未命名"}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <Chip size="sm" variant="flat" className="text-[11px] h-5">
                    {item.format || "未知"}
                  </Chip>
                  <span className="text-[11px] text-muted-foreground">
                    {item.widthAndHeight || `${item.width}x${item.height}`}
                  </span>
                  {item.fileSize > 0 && (
                    <span className="text-[11px] text-muted-foreground">{formatFileSize(item.fileSize)}</span>
                  )}
                </div>
              </div>
            </div>
          );
        }
        case "info": {
          const tags = item.tags ? item.tags.split(",").filter(Boolean) : [];
          const categoryName =
            item.categoryId === null || item.categoryId === undefined
              ? "未分类"
              : categoryMap.get(item.categoryId) || "未知分类";
          return (
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Chip size="sm" variant="flat" className="text-[11px] h-5">
                  {categoryName}
                </Chip>
              </div>
              {item.description ? (
                <p className="text-sm text-muted-foreground truncate max-w-[200px]" title={item.description}>
                  {item.description}
                </p>
              ) : (
                <span className="text-xs text-muted-foreground/50">无描述</span>
              )}
              {tags.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {tags.slice(0, 3).map(tag => (
                    <span key={tag} className="text-[11px] text-primary/70">
                      #{tag.trim()}
                    </span>
                  ))}
                  {tags.length > 3 && <span className="text-[11px] text-muted-foreground">+{tags.length - 3}</span>}
                </div>
              )}
              {item.location && <span className="text-[11px] text-muted-foreground/60 truncate">{item.location}</span>}
            </div>
          );
        }
        case "stats":
          return (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1">
                <Eye className="w-3 h-3 text-muted-foreground/40" />
                <span className="text-xs text-muted-foreground tabular-nums">{formatNumber(item.viewCount)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Download className="w-3 h-3 text-muted-foreground/40" />
                <span className="text-xs text-muted-foreground tabular-nums">{formatNumber(item.downloadCount)}</span>
              </div>
            </div>
          );
        case "time": {
          const published = item.published_at ? formatDateTimeParts(item.published_at) : null;
          const created = formatDateTimeParts(item.created_at);
          const updated = formatDateTimeParts(item.updated_at);
          return (
            <div className="flex flex-col gap-1 text-xs">
              {published ? (
                <>
                  <div className="tabular-nums">
                    <div className="text-[10px] text-primary/70 font-medium mb-0.5">发布</div>
                    <div className="text-muted-foreground">{published.date}</div>
                    <div className="text-muted-foreground/60">{published.time}</div>
                  </div>
                  <div className="text-muted-foreground/50 tabular-nums">
                    <div className="text-[10px] text-muted-foreground/40 mb-0.5">创建</div>
                    <div>{created.date}</div>
                    <div className="text-muted-foreground/40">{created.time}</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-muted-foreground tabular-nums">
                    <div>{created.date}</div>
                    <div className="text-muted-foreground/60">{created.time}</div>
                  </div>
                  <div className="text-muted-foreground/50 tabular-nums">
                    <div>{updated.date}</div>
                    <div className="text-muted-foreground/40">{updated.time}</div>
                  </div>
                </>
              )}
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
    [categoryMap, onAction]
  );
}
