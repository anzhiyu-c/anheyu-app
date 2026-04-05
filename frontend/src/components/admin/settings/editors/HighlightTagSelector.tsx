"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Input, Checkbox, Button, Spinner } from "@heroui/react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { articleApi } from "@/lib/api/article";
import type { PostTag } from "@/types/article";

interface HighlightTagSelectorProps {
  /** JSON 字符串格式的已选标签 ID 数组 */
  value: string;
  /** 值变化回调（JSON 字符串） */
  onValueChange: (value: string) => void;
}

/**
 * 高亮标签穿梭框选择器
 * 从后端获取所有标签，用穿梭框（Transfer）组件让用户选择要高亮的标签
 */
export function HighlightTagSelector({ value, onValueChange }: HighlightTagSelectorProps) {
  const [allTags, setAllTags] = useState<PostTag[]>([]);
  const [loading, setLoading] = useState(true);

  // 左侧搜索
  const [leftSearch, setLeftSearch] = useState("");
  // 右侧搜索
  const [rightSearch, setRightSearch] = useState("");

  // 左侧勾选的项
  const [leftChecked, setLeftChecked] = useState<Set<string>>(new Set());
  // 右侧勾选的项
  const [rightChecked, setRightChecked] = useState<Set<string>>(new Set());

  // 解析已选标签 ID
  const selectedIds = useMemo<string[]>(() => {
    if (!value || value === "[]") return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }, [value]);

  // 加载标签
  useEffect(() => {
    let cancelled = false;
    const loadTags = async () => {
      setLoading(true);
      try {
        const tags = await articleApi.getTagList("name");
        if (!cancelled) setAllTags(tags);
      } catch (err) {
        console.error("获取标签列表失败:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadTags();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // 左侧：未选中的标签
  const leftItems = useMemo(() => {
    const items = allTags.filter(t => !selectedSet.has(t.id));
    if (!leftSearch.trim()) return items;
    const keyword = leftSearch.toLowerCase();
    return items.filter(t => t.name.toLowerCase().includes(keyword));
  }, [allTags, selectedSet, leftSearch]);

  // 右侧：已选中的标签
  const rightItems = useMemo(() => {
    const items = allTags.filter(t => selectedSet.has(t.id));
    if (!rightSearch.trim()) return items;
    const keyword = rightSearch.toLowerCase();
    return items.filter(t => t.name.toLowerCase().includes(keyword));
  }, [allTags, selectedSet, rightSearch]);

  // 移到右侧（选择）
  const handleSelect = useCallback(() => {
    if (leftChecked.size === 0) return;
    const newIds = [...selectedIds, ...leftChecked];
    onValueChange(JSON.stringify(newIds));
    setLeftChecked(new Set());
  }, [leftChecked, selectedIds, onValueChange]);

  // 移到左侧（移除）
  const handleRemove = useCallback(() => {
    if (rightChecked.size === 0) return;
    const newIds = selectedIds.filter(id => !rightChecked.has(id));
    onValueChange(JSON.stringify(newIds));
    setRightChecked(new Set());
  }, [rightChecked, selectedIds, onValueChange]);

  // 左侧全选/取消
  const toggleLeftAll = useCallback(() => {
    if (leftChecked.size === leftItems.length && leftItems.length > 0) {
      setLeftChecked(new Set());
    } else {
      setLeftChecked(new Set(leftItems.map(t => t.id)));
    }
  }, [leftChecked, leftItems]);

  // 右侧全选/取消
  const toggleRightAll = useCallback(() => {
    if (rightChecked.size === rightItems.length && rightItems.length > 0) {
      setRightChecked(new Set());
    } else {
      setRightChecked(new Set(rightItems.map(t => t.id)));
    }
  }, [rightChecked, rightItems]);

  const leftAllChecked = leftItems.length > 0 && leftChecked.size === leftItems.length;
  const rightAllChecked = rightItems.length > 0 && rightChecked.size === rightItems.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner size="sm" />
        <span className="ml-2 text-sm text-muted-foreground">加载标签...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground/70">选择高亮的标签</label>

      <div className="flex items-stretch gap-3 max-sm:flex-col">
        {/* 左侧面板：所有标签 */}
        <TransferPanel
          title="所有标签"
          count={`${leftChecked.size}/${leftItems.length}`}
          search={leftSearch}
          onSearchChange={setLeftSearch}
          allChecked={leftAllChecked}
          onToggleAll={toggleLeftAll}
          items={leftItems}
          checkedSet={leftChecked}
          onToggleItem={id => {
            setLeftChecked(prev => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          }}
        />

        {/* 中间操作按钮 */}
        <div className="flex flex-col items-center justify-center gap-2 py-4 max-sm:flex-row max-sm:py-2">
          <Button
            size="sm"
            color="primary"
            variant="flat"
            isDisabled={rightChecked.size === 0}
            onPress={handleRemove}
            startContent={<ChevronLeft className="w-3.5 h-3.5" />}
            className="min-w-[80px] text-xs font-medium"
          >
            移除
          </Button>
          <Button
            size="sm"
            color="primary"
            isDisabled={leftChecked.size === 0}
            onPress={handleSelect}
            endContent={<ChevronRight className="w-3.5 h-3.5" />}
            className="min-w-[80px] text-xs font-medium"
          >
            选择
          </Button>
        </div>

        {/* 右侧面板：高亮标签 */}
        <TransferPanel
          title="高亮标签"
          count={`${rightChecked.size}/${rightItems.length}`}
          search={rightSearch}
          onSearchChange={setRightSearch}
          allChecked={rightAllChecked}
          onToggleAll={toggleRightAll}
          items={rightItems}
          checkedSet={rightChecked}
          onToggleItem={id => {
            setRightChecked(prev => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          }}
        />
      </div>
    </div>
  );
}

// ==================== 穿梭框面板子组件 ====================

interface TransferPanelProps {
  title: string;
  count: string;
  search: string;
  onSearchChange: (v: string) => void;
  allChecked: boolean;
  onToggleAll: () => void;
  items: PostTag[];
  checkedSet: Set<string>;
  onToggleItem: (id: string) => void;
}

function TransferPanel({
  title,
  count,
  search,
  onSearchChange,
  allChecked,
  onToggleAll,
  items,
  checkedSet,
  onToggleItem,
}: TransferPanelProps) {
  return (
    <div className="flex-1 border border-border/60 rounded-xl overflow-hidden bg-background min-w-[200px]">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30 bg-muted/30">
        <div className="flex items-center gap-2">
          <Checkbox size="sm" isSelected={allChecked} onValueChange={onToggleAll} aria-label={`全选${title}`} />
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      </div>

      {/* 搜索框 */}
      <div className="px-3 py-2 border-b border-border/30">
        <Input
          size="sm"
          placeholder="搜索标签"
          value={search}
          onValueChange={onSearchChange}
          startContent={<Search className="w-3 h-3 text-muted-foreground" />}
          classNames={{
            inputWrapper: cn(
              "bg-muted border border-border/60 rounded-lg shadow-none! h-8 min-h-8",
              "data-[hover=true]:bg-muted! data-[hover=true]:border-border/80",
              "group-data-[focus=true]:border-primary/50 group-data-[focus=true]:ring-1 group-data-[focus=true]:ring-primary/20"
            ),
            input: "text-xs placeholder:text-muted-foreground",
          }}
        />
      </div>

      {/* 列表 */}
      <div className="h-[220px] overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground/40">暂无标签</div>
        ) : (
          <div className="py-1">
            {items.map(tag => (
              <label
                key={tag.id}
                className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/30 transition-colors"
              >
                <Checkbox
                  size="sm"
                  isSelected={checkedSet.has(tag.id)}
                  onValueChange={() => onToggleItem(tag.id)}
                  aria-label={tag.name}
                />
                <span className="text-sm text-foreground truncate">{tag.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
