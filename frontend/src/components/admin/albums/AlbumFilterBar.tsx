"use client";

import { Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { ALBUM_SORT_OPTIONS } from "@/types/album";
import type { AlbumCategory } from "@/types/album";

interface AlbumFilterBarProps {
  categories: AlbumCategory[];
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  sortFilter: string;
  onSortFilterChange: (value: string) => void;
  onReset: () => void;
  onPageReset: () => void;
}

export function AlbumFilterBar({
  categories,
  categoryFilter,
  onCategoryFilterChange,
  sortFilter,
  onSortFilterChange,
  onReset,
  onPageReset,
}: AlbumFilterBarProps) {
  const hasFilter = categoryFilter !== "" || sortFilter !== "display_order_asc";
  const categoryOptions = [
    { key: "__all__", label: "全部分类" },
    ...categories.map(cat => ({
      key: String(cat.id),
      label: cat.name,
    })),
  ];

  return (
    <div className="shrink-0 px-5 pb-3">
      <div className="flex items-center gap-3">
        {categories.length > 0 && (
          <Dropdown>
            <DropdownTrigger>
              <Button size="sm" variant="flat" endContent={<ChevronDown className="w-3.5 h-3.5" />} className="h-8">
                {categoryFilter ? (categories.find(c => String(c.id) === categoryFilter)?.name ?? "分类") : "分类"}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="分类筛选"
              selectedKeys={categoryFilter ? new Set([categoryFilter]) : new Set()}
              selectionMode="single"
              onSelectionChange={keys => {
                const v = Array.from(keys)[0];
                const next = v ? String(v) : "";
                onCategoryFilterChange(next === "__all__" ? "" : next);
                onPageReset();
              }}
            >
              {categoryOptions.map(option => (
                <DropdownItem key={option.key}>{option.label}</DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        )}

        <Dropdown>
          <DropdownTrigger>
            <Button size="sm" variant="flat" endContent={<ChevronDown className="w-3.5 h-3.5" />} className="h-8">
              {sortFilter ? (ALBUM_SORT_OPTIONS.find(o => o.key === sortFilter)?.label ?? "排序方式") : "排序方式"}
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="排序方式"
            selectedKeys={sortFilter ? new Set([sortFilter]) : new Set()}
            selectionMode="single"
            onSelectionChange={keys => {
              const v = Array.from(keys)[0];
              onSortFilterChange(v ? (v as string) : "display_order_asc");
              onPageReset();
            }}
          >
            {ALBUM_SORT_OPTIONS.map(opt => (
              <DropdownItem key={opt.key}>{opt.label}</DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>
        <div className="ml-auto">
          <Button
            size="sm"
            variant="flat"
            startContent={<RotateCcw className="w-3.5 h-3.5" />}
            onPress={onReset}
            isDisabled={!hasFilter}
            className="text-foreground/70"
          >
            重置
          </Button>
        </div>
      </div>
    </div>
  );
}
