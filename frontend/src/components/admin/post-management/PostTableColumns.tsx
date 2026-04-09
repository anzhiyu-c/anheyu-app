"use client";

import { useCallback } from "react";
import Image from "next/image";
import { User, Chip, Button } from "@heroui/react";
import { FileText, Eye, Trash2 } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { formatDateTimeParts } from "@/utils/date";
import { FALLBACK_COVER } from "@/lib/constants/admin";
import type { AdminArticle } from "@/types/post-management";

/** 状态 Chip 配置 */
const STATUS_CHIP: Record<string, { label: string; color: "success" | "warning" | "default" | "primary" }> = {
  PUBLISHED: { label: "已发布", color: "success" },
  DRAFT: { label: "草稿", color: "warning" },
  ARCHIVED: { label: "已归档", color: "default" },
  SCHEDULED: { label: "定时发布", color: "primary" },
};

/** 表格列定义 */
export const TABLE_COLUMNS = [
  { key: "author", label: "作者" },
  { key: "article", label: "文章" },
  { key: "status", label: "状态" },
  { key: "stats", label: "统计" },
  { key: "time", label: "时间" },
  { key: "actions", label: "操作" },
];

interface UsePostRenderCellOptions {
  defaultCover: string;
  gravatarBaseUrl: string;
  onAction: (article: AdminArticle, key: string) => void;
}

/**
 * 返回文章表格的 renderCell 函数
 */
export function usePostRenderCell({ defaultCover, gravatarBaseUrl, onAction }: UsePostRenderCellOptions) {
  return useCallback(
    (article: AdminArticle, columnKey: React.Key) => {
      switch (columnKey) {
        case "author": {
          const avatarSrc = article.owner_avatar
            ? article.owner_avatar.startsWith("http")
              ? article.owner_avatar
              : `${gravatarBaseUrl}/${article.owner_avatar}`
            : undefined;
          return (
            <User
              name={article.owner_nickname || "未知"}
              description={article.owner_email || ""}
              avatarProps={{
                src: avatarSrc,
                size: "sm",
                name: (article.owner_nickname || "U").charAt(0).toUpperCase(),
                showFallback: true,
              }}
              classNames={{ name: "text-sm font-medium", description: "text-[11px]" }}
            />
          );
        }
        case "article": {
          const coverSrc = article.cover_url || defaultCover;
          const previewUrl = `/posts/${article.abbrlink || article.id}`;
          const cat = article.post_categories?.[0];
          const tag = article.post_tags?.[0];
          return (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-2 items-center min-w-0 max-w-full group/article cursor-pointer rounded-lg -m-1 p-1 transition-colors hover:bg-muted/50"
              onClick={e => {
                if (!e.ctrlKey && !e.metaKey && e.button === 0) {
                  e.preventDefault();
                  onAction(article, "preview");
                }
              }}
            >
              <div className="relative w-10 h-10 rounded-md overflow-hidden shrink-0 bg-muted ring-1 ring-border/20 transition-shadow group-hover/article:ring-primary/40">
                <Image
                  src={coverSrc}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="40px"
                  unoptimized
                  onError={e => {
                    (e.target as HTMLImageElement).src = FALLBACK_COVER;
                  }}
                />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate group-hover/article:text-primary transition-colors" title={article.title}>
                  {article.title}
                </p>
                <div className="flex items-center gap-1 mt-0.5 min-w-0 overflow-hidden">
                  {cat && (
                    <span className="text-[11px] text-primary truncate shrink-0 max-w-16">{cat.name}</span>
                  )}
                  {tag && (
                    <span className="text-[11px] text-muted-foreground truncate shrink min-w-0">#{tag.name}</span>
                  )}
                </div>
              </div>
            </a>
          );
        }
        case "status": {
          const chip = STATUS_CHIP[article.status] ?? { label: article.status, color: "default" as const };
          return (
            <Chip size="sm" color={chip.color} variant="flat">
              {chip.label}
            </Chip>
          );
        }
        case "stats":
          return (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1">
                <Eye className="w-3 h-3 text-muted-foreground/40" />
                <span className="text-xs text-muted-foreground tabular-nums">{formatNumber(article.view_count)}</span>
              </div>
              {article.word_count > 0 && (
                <div className="flex items-center gap-1">
                  <FileText className="w-3 h-3 text-muted-foreground/40" />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatNumber(article.word_count)}字
                  </span>
                </div>
              )}
            </div>
          );
        case "time": {
          const created = formatDateTimeParts(article.created_at);
          const updated = formatDateTimeParts(article.updated_at);
          const createdShort = created.date.length >= 10 ? `${created.date.slice(5)} ${created.time}` : "-";
          const updatedShort = updated.date.length >= 10 ? `${updated.date.slice(5)} ${updated.time}` : "-";
          return (
            <div className="text-xs text-muted-foreground tabular-nums whitespace-nowrap" title={`创建 ${created.date} ${created.time} · 更新 ${updated.date} ${updated.time}`}>
              {createdShort} / {updatedShort}
            </div>
          );
        }
        case "actions":
          return (
            <div className="flex items-center justify-center gap-1.5">
              <Button
                size="sm"
                variant="flat"
                color="primary"
                startContent={<Eye className="w-3.5 h-3.5" />}
                className="h-7 min-w-0 px-2.5 text-xs font-medium"
                onPress={() => onAction(article, "preview")}
              >
                预览
              </Button>
              <Button
                size="sm"
                variant="flat"
                color="warning"
                startContent={<FileText className="w-3.5 h-3.5" />}
                className="h-7 min-w-0 px-2.5 text-xs font-medium"
                onPress={() => onAction(article, "edit")}
              >
                编辑
              </Button>
              <Button
                size="sm"
                variant="flat"
                color="danger"
                startContent={<Trash2 className="w-3.5 h-3.5" />}
                className="h-7 min-w-0 px-2.5 text-xs font-medium"
                onPress={() => onAction(article, "delete")}
              >
                删除
              </Button>
            </div>
          );
        default:
          return null;
      }
    },
    [onAction, defaultCover, gravatarBaseUrl]
  );
}
