"use client";

import { Input, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { Search, ChevronDown, RotateCcw } from "lucide-react";

/** 审核状态选项 */
const REVIEW_STATUS_OPTIONS = [
  { key: "PENDING", label: "待审核" },
  { key: "APPROVED", label: "已通过" },
  { key: "REJECTED", label: "已拒绝" },
];

/** 文章状态选项 */
const ARTICLE_STATUS_OPTIONS = [
  { key: "PUBLISHED", label: "已发布" },
  { key: "DRAFT", label: "草稿" },
  { key: "ARCHIVED", label: "已归档" },
  { key: "SCHEDULED", label: "定时发布" },
];

interface PostFilterBarProps {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  reviewStatusFilter: string;
  onReviewStatusFilterChange: (value: string) => void;
  onReset: () => void;
  onPageReset: () => void;
}

export function PostFilterBar({
  searchInput,
  onSearchInputChange,
  statusFilter,
  onStatusFilterChange,
  reviewStatusFilter,
  onReviewStatusFilterChange,
  onReset,
  onPageReset,
}: PostFilterBarProps) {
  return (
    <div className="shrink-0 px-5 pb-3">
      <div className="flex items-center gap-3">
        <Input
          size="sm"
          isClearable
          className="w-full sm:max-w-[300px]"
          placeholder="搜索文章标题、内容..."
          startContent={<Search className="w-3.5 h-3.5 text-muted-foreground" />}
          value={searchInput}
          onValueChange={onSearchInputChange}
          onClear={() => onSearchInputChange("")}
          classNames={{
            inputWrapper:
              "h-8 min-h-8 bg-card shadow-none! [border:var(--style-border)] data-[hover=true]:bg-card dark:data-[hover=true]:bg-muted/30! group-data-[focus=true]:bg-card dark:group-data-[focus=true]:bg-muted/30! group-data-[focus=true]:[border:var(--style-border-hover)] transition-all duration-200",
          }}
        />
        <Dropdown>
          <DropdownTrigger className="hidden sm:flex">
            <Button size="sm" variant="flat" endContent={<ChevronDown className="w-3.5 h-3.5" />} className="h-8">
              {statusFilter
                ? (ARTICLE_STATUS_OPTIONS.find(o => o.key === statusFilter)?.label ?? "文章状态")
                : "文章状态"}
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="文章状态筛选"
            selectedKeys={statusFilter ? new Set([statusFilter]) : new Set()}
            selectionMode="single"
            onSelectionChange={keys => {
              const v = Array.from(keys)[0];
              onStatusFilterChange(v ? (v as string) : "");
              onPageReset();
            }}
          >
            {ARTICLE_STATUS_OPTIONS.map(opt => (
              <DropdownItem key={opt.key}>{opt.label}</DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>
        <Dropdown>
          <DropdownTrigger className="hidden sm:flex">
            <Button size="sm" variant="flat" endContent={<ChevronDown className="w-3.5 h-3.5" />} className="h-8">
              {reviewStatusFilter
                ? (REVIEW_STATUS_OPTIONS.find(o => o.key === reviewStatusFilter)?.label ?? "审核状态")
                : "审核状态"}
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="审核状态筛选"
            selectedKeys={reviewStatusFilter ? new Set([reviewStatusFilter]) : new Set()}
            selectionMode="single"
            onSelectionChange={keys => {
              const v = Array.from(keys)[0];
              onReviewStatusFilterChange(v ? (v as string) : "");
              onPageReset();
            }}
          >
            {REVIEW_STATUS_OPTIONS.map(opt => (
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
            isDisabled={!searchInput && !statusFilter && !reviewStatusFilter}
            className="text-foreground/70"
          >
            重置
          </Button>
        </div>
      </div>
    </div>
  );
}
