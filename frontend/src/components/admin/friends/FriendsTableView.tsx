"use client";

import Image from "next/image";
import { Chip, Checkbox, Tooltip, Button } from "@heroui/react";
import { ExternalLink, CheckCircle, XCircle, Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LinkItem, LinkStatus } from "@/types/friends";

const STATUS_CONFIG: Record<
  LinkStatus,
  { label: string; color: "success" | "warning" | "danger" | "default"; dotClass: string }
> = {
  APPROVED: { label: "已通过", color: "success", dotClass: "bg-emerald-500" },
  PENDING: { label: "待审核", color: "warning", dotClass: "bg-amber-500" },
  REJECTED: { label: "已拒绝", color: "danger", dotClass: "bg-red-500" },
  INVALID: { label: "已失效", color: "default", dotClass: "bg-zinc-400" },
};

interface FriendsTableViewProps {
  links: LinkItem[];
  selectedIds: Set<number>;
  onSelectAll: (checked: boolean) => void;
  onSelectItem: (id: number, checked: boolean) => void;
  onEdit: (item: LinkItem) => void;
  onDelete: (item: LinkItem) => void;
  onReview: (item: LinkItem, action: "APPROVED" | "REJECTED") => void;
}

export function FriendsTableView({
  links,
  selectedIds,
  onSelectAll,
  onSelectItem,
  onEdit,
  onDelete,
  onReview,
}: FriendsTableViewProps) {
  const allSelected = links.length > 0 && links.every(l => selectedIds.has(l.id));
  const someSelected = links.some(l => selectedIds.has(l.id)) && !allSelected;

  return (
    <div className="overflow-x-auto rounded-xl border border-border/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/30 border-b border-border/50">
            <th className="w-10 px-3 py-3 text-left">
              <Checkbox isSelected={allSelected} isIndeterminate={someSelected} onValueChange={onSelectAll} size="sm" />
            </th>
            <th className="px-3 py-3 text-left font-medium text-muted-foreground min-w-[240px]">网站信息</th>
            <th className="px-3 py-3 text-left font-medium text-muted-foreground min-w-[120px]">描述</th>
            <th className="px-3 py-3 text-left font-medium text-muted-foreground">分类/标签</th>
            <th className="px-3 py-3 text-left font-medium text-muted-foreground w-24">状态</th>
            <th className="px-3 py-3 text-center font-medium text-muted-foreground w-16">排序</th>
            <th className="px-3 py-3 text-right font-medium text-muted-foreground w-48">操作</th>
          </tr>
        </thead>
        <tbody>
          {links.map(link => {
            const statusCfg = STATUS_CONFIG[link.status];
            return (
              <tr
                key={link.id}
                className={cn(
                  "border-b border-border/30 hover:bg-muted/30 transition-colors",
                  selectedIds.has(link.id) && "bg-primary-50/30"
                )}
              >
                <td className="px-3 py-3">
                  <Checkbox
                    isSelected={selectedIds.has(link.id)}
                    onValueChange={checked => onSelectItem(link.id, checked)}
                    size="sm"
                  />
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
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
                    <div className="min-w-0">
                      <p className="font-medium truncate">{link.name}</p>
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
                </td>
                <td className="px-3 py-3">
                  <p className="text-muted-foreground line-clamp-2 text-xs">{link.description || "-"}</p>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-col gap-1">
                    {link.category && (
                      <Chip size="sm" variant="flat" color="primary" className="text-xs">
                        {link.category.name}
                      </Chip>
                    )}
                    {link.tag && (
                      <Chip
                        size="sm"
                        variant="flat"
                        className="text-xs"
                        startContent={
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: link.tag.color || "#999" }}
                          />
                        }
                      >
                        {link.tag.name}
                      </Chip>
                    )}
                    {!link.category && !link.tag && <span className="text-muted-foreground/40 text-xs">-</span>}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <Chip
                    size="sm"
                    variant="flat"
                    color={statusCfg.color}
                    startContent={<span className={cn("w-1.5 h-1.5 rounded-full", statusCfg.dotClass)} />}
                  >
                    {statusCfg.label}
                  </Chip>
                </td>
                <td className="px-3 py-3 text-center">
                  <span className="text-xs text-muted-foreground">{link.sort_order}</span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {link.status === "PENDING" && (
                      <>
                        <Tooltip content="通过">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            color="success"
                            onPress={() => onReview(link, "APPROVED")}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="拒绝">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            color="danger"
                            onPress={() => onReview(link, "REJECTED")}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        </Tooltip>
                      </>
                    )}
                    <Tooltip content="编辑">
                      <Button isIconOnly size="sm" variant="flat" color="primary" onPress={() => onEdit(link)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                    </Tooltip>
                    <Tooltip content="删除">
                      <Button isIconOnly size="sm" variant="flat" color="danger" onPress={() => onDelete(link)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </Tooltip>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
