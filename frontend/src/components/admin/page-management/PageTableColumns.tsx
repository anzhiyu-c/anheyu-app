"use client";

import { useCallback } from "react";
import { Chip, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Button } from "@heroui/react";
import { MoreHorizontal, Pencil, Trash2, ExternalLink, MessageSquare } from "lucide-react";
import type { CustomPage } from "@/types/page-management";

export const TABLE_COLUMNS = [
  { key: "title", label: "标题" },
  { key: "path", label: "路径" },
  { key: "status", label: "状态" },
  { key: "options", label: "选项" },
  { key: "time", label: "时间" },
  { key: "actions", label: "操作" },
];

interface UsePageRenderCellOptions {
  onAction: (page: CustomPage, key: string) => void;
}

export function usePageRenderCell({ onAction }: UsePageRenderCellOptions) {
  return useCallback(
    (pageItem: CustomPage, columnKey: React.Key) => {
      switch (columnKey) {
        case "title":
          return (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground line-clamp-1">{pageItem.title}</span>
              {pageItem.description && (
                <span className="text-xs text-muted-foreground line-clamp-1">{pageItem.description}</span>
              )}
            </div>
          );

        case "path":
          return (
            <span className="text-xs text-muted-foreground font-mono bg-muted/40 px-1.5 py-0.5 rounded">
              {pageItem.path}
            </span>
          );

        case "status":
          return (
            <Chip
              size="sm"
              variant="flat"
              color={pageItem.is_published ? "success" : "default"}
              className="text-xs"
            >
              {pageItem.is_published ? "已发布" : "草稿"}
            </Chip>
          );

        case "options":
          return (
            <div className="flex items-center gap-1.5">
              <Chip
                size="sm"
                variant="flat"
                color={pageItem.show_comment ? "primary" : "default"}
                startContent={<MessageSquare className="w-3 h-3" />}
                className="text-xs"
              >
                {pageItem.show_comment ? "评论开" : "评论关"}
              </Chip>
              <Chip size="sm" variant="flat" className="text-xs">
                排序: {pageItem.sort}
              </Chip>
            </div>
          );

        case "time":
          return (
            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              <span>创建: {new Date(pageItem.created_at).toLocaleDateString("zh-CN")}</span>
              <span>更新: {new Date(pageItem.updated_at).toLocaleDateString("zh-CN")}</span>
            </div>
          );

        case "actions":
          return (
            <div className="flex justify-center">
              <Dropdown>
                <DropdownTrigger>
                  <Button isIconOnly size="sm" variant="light" className="text-muted-foreground">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="页面操作"
                  onAction={key => onAction(pageItem, key as string)}
                >
                  <DropdownItem key="visit" startContent={<ExternalLink className="w-3.5 h-3.5" />} href={pageItem.path} target="_blank">
                    访问
                  </DropdownItem>
                  <DropdownItem key="edit" startContent={<Pencil className="w-3.5 h-3.5" />}>
                    编辑
                  </DropdownItem>
                  <DropdownItem key="delete" startContent={<Trash2 className="w-3.5 h-3.5" />} color="danger" className="text-danger">
                    删除
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </div>
          );

        default:
          return null;
      }
    },
    [onAction]
  );
}
