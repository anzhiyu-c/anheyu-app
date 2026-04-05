"use client";

import * as React from "react";
import { Input, Textarea } from "@heroui/react";
import { Reorder, useDragControls } from "framer-motion";
import { GripVertical, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface EquipmentListEditorProps {
  value?: string;
  onValueChange?: (value: string) => void;
}

interface InternalItem {
  _id: string;
  data: Record<string, unknown>;
}

interface InternalCategory {
  _id: string;
  data: Record<string, unknown>;
  items: InternalItem[];
}

interface ParseResult {
  categories: InternalCategory[];
  parseError: boolean;
}

let nextIdSeed = 0;
const nextId = () => `equip_${++nextIdSeed}`;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseValue(raw: string | undefined): ParseResult {
  if (!raw || raw.trim() === "") return { categories: [], parseError: false };
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { categories: [], parseError: true };
    const categories = parsed.map(category => {
      const categoryObj = asRecord(category);
      const categoryName = String(categoryObj.title ?? categoryObj.name ?? "");
      const rawItems = Array.isArray(categoryObj.equipment_list)
        ? categoryObj.equipment_list
        : Array.isArray(categoryObj.items)
          ? categoryObj.items
          : [];
      return {
        _id: nextId(),
        data: { ...categoryObj, name: categoryName },
        items: rawItems.map(item => {
          const itemObj = asRecord(item);
          return {
            _id: nextId(),
            data: {
              ...itemObj,
              name: String(itemObj.name ?? ""),
              image: String(itemObj.image ?? ""),
              link: String(itemObj.link ?? ""),
              description: String(itemObj.description ?? ""),
              specification: String(itemObj.specification ?? ""),
            },
          };
        }),
      };
    });
    return { categories, parseError: false };
  } catch {
    return { categories: [], parseError: true };
  }
}

function serializeValue(categories: InternalCategory[]): string {
  const normalized = categories.map(category => ({
    title: String(category.data.name ?? ""),
    description: String(category.data.description ?? ""),
    equipment_list: category.items.map(item => ({
      name: String(item.data.name ?? ""),
      image: String(item.data.image ?? ""),
      link: String(item.data.link ?? ""),
      description: String(item.data.description ?? ""),
      specification: String(item.data.specification ?? ""),
    })),
  }));
  return JSON.stringify(normalized, null, 2);
}

const inputWrapperClass =
  "bg-transparent! border border-border/60 rounded-lg shadow-none! min-h-9 h-9 data-[hover=true]:border-border-hover/40 group-data-[focus=true]:bg-card! group-data-[focus=true]:border-primary/40";

export function EquipmentListEditor({ value, onValueChange }: EquipmentListEditorProps) {
  const [categories, setCategories] = React.useState<InternalCategory[]>(() => parseValue(value).categories);
  const [hasParseError, setHasParseError] = React.useState<boolean>(() => parseValue(value).parseError);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(() => new Set());
  const lastExternal = React.useRef(value);

  React.useEffect(() => {
    if (value !== lastExternal.current) {
      lastExternal.current = value;
      const parsed = parseValue(value);
      setCategories(parsed.categories);
      setHasParseError(parsed.parseError);
      // 加载数据时展开第一个分类
      if (parsed.categories.length > 0) {
        setExpandedIds(new Set([parsed.categories[0]._id]));
      }
    }
  }, [value]);

  const emit = React.useCallback(
    (next: InternalCategory[]) => {
      const json = serializeValue(next);
      lastExternal.current = json;
      onValueChange?.(json);
    },
    [onValueChange]
  );

  const updateCategories = React.useCallback(
    (next: InternalCategory[]) => {
      setCategories(next);
      emit(next);
    },
    [emit]
  );

  const toggleExpanded = React.useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addCategory = React.useCallback(() => {
    const newCat = { _id: nextId(), data: { name: "" }, items: [] };
    updateCategories([...categories, newCat]);
    setExpandedIds(prev => new Set([...prev, newCat._id]));
  }, [categories, updateCategories]);

  const removeCategory = React.useCallback(
    (id: string) => updateCategories(categories.filter(c => c._id !== id)),
    [categories, updateCategories]
  );

  const updateCategoryName = React.useCallback(
    (id: string, name: string) => {
      updateCategories(categories.map(c => (c._id === id ? { ...c, data: { ...c.data, name } } : c)));
    },
    [categories, updateCategories]
  );

  const addItem = React.useCallback(
    (categoryId: string) => {
      updateCategories(
        categories.map(c =>
          c._id === categoryId
            ? {
                ...c,
                items: [
                  ...c.items,
                  {
                    _id: nextId(),
                    data: { name: "", image: "", link: "", description: "", specification: "" },
                  },
                ],
              }
            : c
        )
      );
    },
    [categories, updateCategories]
  );

  const removeItem = React.useCallback(
    (categoryId: string, itemId: string) => {
      updateCategories(
        categories.map(c => (c._id === categoryId ? { ...c, items: c.items.filter(i => i._id !== itemId) } : c))
      );
    },
    [categories, updateCategories]
  );

  const updateItemField = React.useCallback(
    (categoryId: string, itemId: string, field: string, val: string) => {
      updateCategories(
        categories.map(c => {
          if (c._id !== categoryId) return c;
          return {
            ...c,
            items: c.items.map(i => (i._id === itemId ? { ...i, data: { ...i.data, [field]: val } } : i)),
          };
        })
      );
    },
    [categories, updateCategories]
  );

  const reorderItems = React.useCallback(
    (categoryId: string, nextItems: InternalItem[]) => {
      updateCategories(categories.map(c => (c._id === categoryId ? { ...c, items: nextItems } : c)));
    },
    [categories, updateCategories]
  );

  if (hasParseError) {
    return (
      <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning-700 dark:text-warning-400">
        配置格式无效，请确认为数组结构（支持 title/name、equipment_list/items 等字段）。
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Reorder.Group axis="y" values={categories} onReorder={updateCategories} className="space-y-2">
        {categories.map((cat, idx) => (
          <CategoryCard
            key={cat._id}
            category={cat}
            index={idx}
            isExpanded={expandedIds.has(cat._id)}
            onToggle={() => toggleExpanded(cat._id)}
            onNameChange={v => updateCategoryName(cat._id, v)}
            onRemove={() => removeCategory(cat._id)}
            onAddItem={() => addItem(cat._id)}
            onReorderItems={items => reorderItems(cat._id, items)}
            onRemoveItem={itemId => removeItem(cat._id, itemId)}
            onItemFieldChange={(itemId, field, val) => updateItemField(cat._id, itemId, field, val)}
          />
        ))}
      </Reorder.Group>

      {categories.length === 0 && (
        <div
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-12 text-center"
          style={{ minHeight: 140 }}
        >
          <p className="text-sm text-muted-foreground">暂无分类</p>
          <p className="mt-1 text-xs text-muted-foreground/50">点击下方按钮添加</p>
        </div>
      )}

      <button
        type="button"
        onClick={addCategory}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 py-3 text-sm",
          "text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        )}
      >
        <Plus className="h-4 w-4" />
        添加分类
      </button>
    </div>
  );
}

function CategoryCard({
  category,
  index,
  isExpanded,
  onToggle,
  onNameChange,
  onRemove,
  onAddItem,
  onReorderItems,
  onRemoveItem,
  onItemFieldChange,
}: {
  category: InternalCategory;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onNameChange: (v: string) => void;
  onRemove: () => void;
  onAddItem: () => void;
  onReorderItems: (items: InternalItem[]) => void;
  onRemoveItem: (id: string) => void;
  onItemFieldChange: (itemId: string, field: string, value: string) => void;
}) {
  const dragControls = useDragControls();
  const categoryName = String(category.data.name ?? "");

  return (
    <Reorder.Item
      value={category}
      dragListener={false}
      dragControls={dragControls}
      className="rounded-xl border border-border/60 bg-muted/20 shadow-[0_0_0_0.5px_rgba(0,0,0,0.03)] dark:shadow-none"
    >
      {/* 分类标题栏 */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onPointerDown={e => dragControls.start(e)}
          className="shrink-0 rounded p-0.5 text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="flex shrink-0 items-center justify-center rounded p-0.5 text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground"
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <Input
            size="sm"
            value={categoryName}
            onValueChange={onNameChange}
            placeholder={`分类 ${index + 1}`}
            classNames={{
              inputWrapper: cn(inputWrapperClass, "min-h-8 h-8"),
              input: "text-sm font-medium",
            }}
          />
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{category.items.length} 项</span>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded p-1.5 text-muted-foreground/50 hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 可展开内容 - 使用 CSS 过渡避免 Framer layout 动画冲突 */}
      <div
        className={cn(
          "overflow-hidden transition-[max-height] duration-200 ease-out",
          isExpanded ? "max-h-[5000px]" : "max-h-0"
        )}
      >
        <div className="border-t border-border/40 px-3 py-3">
          <Reorder.Group axis="y" values={category.items} onReorder={onReorderItems} className="space-y-2">
            {category.items.map(item => (
              <ItemCard
                key={item._id}
                item={item}
                onRemove={() => onRemoveItem(item._id)}
                onFieldChange={(f, v) => onItemFieldChange(item._id, f, v)}
              />
            ))}
          </Reorder.Group>
          <button
            type="button"
            onClick={onAddItem}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/60 py-2 text-xs text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            添加装备
          </button>
        </div>
      </div>
    </Reorder.Item>
  );
}

function ItemCard({
  item,
  onRemove,
  onFieldChange,
}: {
  item: InternalItem;
  onRemove: () => void;
  onFieldChange: (field: string, value: string) => void;
}) {
  const dragControls = useDragControls();
  const imgUrl = String(item.data.image ?? "");

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={dragControls}
      className="flex gap-3 rounded-lg border border-border/40 bg-card p-2.5"
    >
      {/* 拖拽手柄 + 图片预览 */}
      <div className="flex shrink-0 flex-col items-center gap-1">
        <button
          type="button"
          onPointerDown={e => dragControls.start(e)}
          className="rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className="h-12 w-12 overflow-hidden rounded-lg border border-border/60 bg-muted">
          {imgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- 用户 URL 预览，需支持任意域名
            <img
              src={imgUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={e => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground/40">
              图
            </div>
          )}
        </div>
      </div>

      {/* 表单字段 */}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start gap-2">
          <Input
            size="sm"
            placeholder="名称"
            value={String(item.data.name ?? "")}
            onValueChange={v => onFieldChange("name", v)}
            classNames={{ inputWrapper: cn(inputWrapperClass, "min-w-0 flex-1"), input: "text-sm" }}
          />
          <Input
            size="sm"
            placeholder="规格"
            value={String(item.data.specification ?? "")}
            onValueChange={v => onFieldChange("specification", v)}
            classNames={{ inputWrapper: cn(inputWrapperClass, "w-20 shrink-0"), input: "text-sm" }}
          />
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded p-1.5 text-muted-foreground/50 hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input
            size="sm"
            placeholder="链接"
            value={String(item.data.link ?? "")}
            onValueChange={v => onFieldChange("link", v)}
            classNames={{ inputWrapper: inputWrapperClass, input: "text-xs" }}
          />
          <Input
            size="sm"
            placeholder="图片 URL"
            value={String(item.data.image ?? "")}
            onValueChange={v => onFieldChange("image", v)}
            classNames={{ inputWrapper: inputWrapperClass, input: "text-xs" }}
          />
        </div>
        <Textarea
          size="sm"
          placeholder="描述"
          value={String(item.data.description ?? "")}
          onValueChange={v => onFieldChange("description", v)}
          minRows={1}
          classNames={{
            inputWrapper: cn(
              "bg-transparent! border border-border/60 rounded-lg shadow-none! min-h-[60px]",
              "data-[hover=true]:border-border-hover/40 group-data-[focus=true]:bg-card! group-data-[focus=true]:border-primary/40"
            ),
            input: "text-xs",
          }}
        />
      </div>
    </Reorder.Item>
  );
}
