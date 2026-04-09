"use client";

import { Input, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { Plus, Search, RotateCcw, Tags, Upload, Download, HeartPulse, ChevronDown } from "lucide-react";
import type { FriendsPageState } from "../_hooks/use-friends-page";

/** 状态筛选选项 */
const STATUS_OPTIONS = [
  { key: "APPROVED", label: "已通过" },
  { key: "PENDING", label: "待审核" },
  { key: "REJECTED", label: "已拒绝" },
  { key: "INVALID", label: "已失效" },
];

interface FriendsToolbarProps {
  cm: FriendsPageState;
}

export function FriendsToolbar({ cm }: FriendsToolbarProps) {
  const hasFilter = !!(cm.searchInput || cm.statusFilter || cm.categoryFilter || cm.tagFilter);

  return (
    <>
      {/* ===== 标题区 + 操作按钮 ===== */}
      <div className="shrink-0 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">友链管理</h1>
            <p className="text-xs text-muted-foreground mt-1">管理友情链接，支持分类、标签和健康检查</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              color="primary"
              onPress={cm.handleOpenCreate}
              startContent={<Plus className="w-3.5 h-3.5" />}
              className="font-medium shadow-sm"
            >
              新建友链
            </Button>
            <Button
              size="sm"
              variant="flat"
              onPress={cm.categoryTagModal.onOpen}
              startContent={<Tags className="w-3.5 h-3.5" />}
              className="text-foreground/70"
            >
              分类标签
            </Button>
            <Button
              size="sm"
              variant="flat"
              onPress={cm.importModal.onOpen}
              startContent={<Upload className="w-3.5 h-3.5" />}
              className="text-foreground/70"
            >
              导入
            </Button>
            <Button
              size="sm"
              variant="flat"
              onPress={cm.handleExport}
              isLoading={cm.exportLinks.isPending}
              startContent={<Download className="w-3.5 h-3.5" />}
              className="text-foreground/70"
            >
              导出
            </Button>
            <Button
              size="sm"
              variant="flat"
              onPress={cm.healthCheckModal.onOpen}
              startContent={<HeartPulse className="w-3.5 h-3.5" />}
              className="text-foreground/70"
            >
              健康检查
            </Button>
          </div>
        </div>
      </div>

      {/* ===== 筛选栏 ===== */}
      <div className="shrink-0 px-5 pb-3">
        <div className="flex items-center gap-3">
          <Input
            size="sm"
            isClearable
            className="w-full sm:max-w-[300px]"
            placeholder="搜索网站名称、网址..."
            startContent={<Search className="w-3.5 h-3.5 text-muted-foreground" />}
            value={cm.searchInput}
            onValueChange={cm.setSearchInput}
            onClear={() => cm.setSearchInput("")}
            classNames={{
              inputWrapper:
                "h-8 min-h-8 bg-card shadow-none! [border:var(--style-border)] data-[hover=true]:bg-card dark:data-[hover=true]:bg-muted/30! group-data-[focus=true]:bg-card dark:group-data-[focus=true]:bg-muted/30! group-data-[focus=true]:[border:var(--style-border-hover)] transition-all duration-200",
            }}
          />

          {/* 状态筛选 */}
          <Dropdown>
            <DropdownTrigger className="hidden sm:flex">
              <Button size="sm" variant="flat" endContent={<ChevronDown className="w-3.5 h-3.5" />} className="h-8">
                {cm.statusFilter
                  ? (STATUS_OPTIONS.find(o => o.key === cm.statusFilter)?.label ?? "友链状态")
                  : "友链状态"}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="友链状态筛选"
              selectedKeys={cm.statusFilter ? new Set([cm.statusFilter]) : new Set()}
              selectionMode="single"
              onSelectionChange={keys => {
                const v = Array.from(keys)[0];
                cm.setStatusFilter(v ? (v as typeof cm.statusFilter) : "");
                cm.setPage(1);
              }}
            >
              {STATUS_OPTIONS.map(opt => (
                <DropdownItem key={opt.key}>{opt.label}</DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>

          {/* 分类筛选 */}
          {cm.categories.length > 0 && (
            <Dropdown>
              <DropdownTrigger className="hidden sm:flex">
                <Button size="sm" variant="flat" endContent={<ChevronDown className="w-3.5 h-3.5" />} className="h-8">
                  {cm.categoryFilter
                    ? (cm.categories.find(c => String(c.id) === cm.categoryFilter)?.name ?? "分类")
                    : "分类"}
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="分类筛选"
                selectedKeys={cm.categoryFilter ? new Set([cm.categoryFilter]) : new Set()}
                selectionMode="single"
                onSelectionChange={keys => {
                  const v = Array.from(keys)[0];
                  cm.setCategoryFilter(v ? String(v) : "");
                  cm.setPage(1);
                }}
              >
                {cm.categories.map(cat => (
                  <DropdownItem key={String(cat.id)}>{cat.name}</DropdownItem>
                ))}
              </DropdownMenu>
            </Dropdown>
          )}

          {/* 标签筛选 */}
          {cm.tags.length > 0 && (
            <Dropdown>
              <DropdownTrigger className="hidden sm:flex">
                <Button size="sm" variant="flat" endContent={<ChevronDown className="w-3.5 h-3.5" />} className="h-8">
                  {cm.tagFilter ? (cm.tags.find(t => String(t.id) === cm.tagFilter)?.name ?? "标签") : "标签"}
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="标签筛选"
                selectedKeys={cm.tagFilter ? new Set([cm.tagFilter]) : new Set()}
                selectionMode="single"
                onSelectionChange={keys => {
                  const v = Array.from(keys)[0];
                  cm.setTagFilter(v ? String(v) : "");
                  cm.setPage(1);
                }}
              >
                {cm.tags.map(tag => (
                  <DropdownItem
                    key={String(tag.id)}
                    startContent={
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: tag.color || "#999" }}
                      />
                    }
                  >
                    {tag.name}
                  </DropdownItem>
                ))}
              </DropdownMenu>
            </Dropdown>
          )}

          {/* 重置 */}
          <div className="ml-auto">
            <Button
              size="sm"
              variant="flat"
              startContent={<RotateCcw className="w-3.5 h-3.5" />}
              onPress={cm.handleReset}
              isDisabled={!hasFilter}
              className="text-foreground/70"
            >
              重置
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
