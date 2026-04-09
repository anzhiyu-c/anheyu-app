"use client";

import { Button } from "@heroui/react";
import { Search, Plus, type LucideIcon } from "lucide-react";

interface TableEmptyStateProps {
  icon: LucideIcon;
  filterEmptyText: string;
  emptyText: string;
  filterHint?: string;
  emptyHint?: string;
  hasFilter: boolean;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function TableEmptyState({
  icon: Icon,
  filterEmptyText,
  emptyText,
  filterHint = "试试调整筛选条件或搜索关键词",
  emptyHint,
  hasFilter,
  action,
}: TableEmptyStateProps) {
  const title = hasFilter ? filterEmptyText : emptyText;
  const hint = hasFilter ? filterHint : emptyHint;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-muted/40 flex items-center justify-center">
          <Icon className="w-9 h-9 text-muted-foreground/25" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
          {hasFilter ? (
            <Search className="w-3.5 h-3.5 text-primary/50" />
          ) : (
            <Plus className="w-3.5 h-3.5 text-primary/50" />
          )}
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {hint ? <p className="text-xs text-muted-foreground/60 mt-1">{hint}</p> : null}
      </div>

      {!hasFilter && action ? (
        <Button
          size="sm"
          color="primary"
          variant="flat"
          onPress={action.onPress}
          startContent={<Plus className="w-3.5 h-3.5" />}
          className="mt-1"
        >
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
