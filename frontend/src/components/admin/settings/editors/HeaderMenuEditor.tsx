"use client";

import * as React from "react";
import { Input, Select, SelectItem, Switch, Tooltip } from "@heroui/react";
import { AnimatePresence, motion, Reorder, useDragControls } from "framer-motion";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormIconSelector } from "@/components/ui/form-icon-selector";

// ─── 类型 ──────────────────────────────────────────────────────────

interface MenuSubItem {
  title: string;
  path: string;
  icon?: string;
  isExternal?: boolean;
  _id?: string;
}

interface MenuItem {
  title: string;
  type?: "direct" | "dropdown";
  path?: string;
  icon?: string;
  isExternal?: boolean;
  items?: MenuSubItem[];
  _id?: string;
}

interface HeaderMenuEditorProps {
  label?: string;
  description?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

// ─── 工具函数 ──────────────────────────────────────────────────────

function parseMenuArray(value: string | undefined): MenuItem[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value as unknown as MenuItem[];
  if (typeof value === "object") return [];
  if (!value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((it: MenuItem) => ({ ...it }));
  } catch {
    return [];
  }
}

function ensureStableMenuItemIds(nextItems: MenuItem[], prevItems: MenuItem[] = []): MenuItem[] {
  return nextItems.map((item, index) => ({
    ...item,
    _id: item._id || prevItems[index]?._id || `mi-${index}-${Math.random().toString(36).slice(2)}`,
    items: item.items ? ensureStableSubItemIds(item.items, prevItems[index]?.items) : item.items,
  }));
}

function ensureStableSubItemIds(nextSubs: MenuSubItem[], prevSubs: MenuSubItem[] = []): MenuSubItem[] {
  return nextSubs.map((sub, index) => ({
    ...sub,
    _id: sub._id || prevSubs[index]?._id || `si-${index}-${Math.random().toString(36).slice(2)}`,
  }));
}

function serializeMenuItems(items: MenuItem[]): string {
  /* eslint-disable @typescript-eslint/no-unused-vars -- omit _id from items and sub-items */
  const strip = items.map(({ _id: _, ...rest }) => ({
    ...rest,
    items: rest.items?.map(({ _id: __, ...subRest }) => subRest),
  }));
  /* eslint-enable @typescript-eslint/no-unused-vars */
  return JSON.stringify(strip, null, 2);
}

const defaultMenuItem: MenuItem = {
  title: "",
  type: "direct",
  path: "",
  icon: "",
  isExternal: false,
  items: [],
};

const defaultSubItem: MenuSubItem = {
  title: "",
  path: "",
  icon: "",
  isExternal: false,
};

const ICON_BUTTON_CLASS = cn(
  "inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent",
  "text-muted-foreground transition-all duration-200",
  "hover:border-border/60 hover:bg-background hover:text-foreground",
  "disabled:cursor-not-allowed disabled:opacity-35"
);

const DANGER_ICON_BUTTON_CLASS = cn(
  "inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent",
  "text-muted-foreground transition-all duration-200",
  "hover:border-danger/20 hover:bg-danger-50 hover:text-danger"
);

const DASHED_ADD_BUTTON_CLASS = cn(
  "flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/80 bg-background/80",
  "py-2 text-xs font-medium text-foreground/70 transition-all duration-200",
  "hover:border-primary/45 hover:bg-primary/5 hover:text-primary"
);

// ─── 内联输入框 ─────────────────────────────────────────────────

function SmallInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <Input
      label={label}
      labelPlacement="outside"
      size="sm"
      value={value}
      placeholder={placeholder}
      onValueChange={onChange}
      classNames={{
        label: "text-[11px] font-medium tracking-wide text-foreground/60",
        inputWrapper: cn(
          "h-9 min-h-9 rounded-xl border border-border/60 bg-card shadow-none!",
          "data-[hover=true]:bg-card dark:data-[hover=true]:bg-muted data-[hover=true]:border-border/80",
          "group-data-[focus=true]:bg-card dark:group-data-[focus=true]:bg-muted group-data-[focus=true]:border-primary/65 group-data-[focus=true]:ring-2 group-data-[focus=true]:ring-primary/15",
          "transition-all duration-200"
        ),
        input: "text-sm text-foreground/90 placeholder:text-muted-foreground",
      }}
    />
  );
}

// ─── 子菜单项组件 ──────────────────────────────────────────────

function SubItemRow({
  item,
  index,
  isFirst,
  isLast,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  reorderValue,
}: {
  item: MenuSubItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (field: keyof MenuSubItem, val: unknown) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  reorderValue?: MenuSubItem;
}) {
  const dragControls = useDragControls();

  const content = (
    <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/30 p-3 transition-colors hover:border-border/80 hover:bg-muted/30">
      {reorderValue != null && (
        <div
          onPointerDown={e => {
            e.stopPropagation();
            dragControls.start(e);
          }}
          className="mt-2 flex w-6 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      )}
      <span className="mt-2 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-background text-[11px] font-medium text-muted-foreground ring-1 ring-border/60/80">
        {index + 1}
      </span>
      <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
        <SmallInput
          label="标题"
          value={item.title || ""}
          placeholder="子菜单标题"
          onChange={v => onUpdate("title", v)}
        />
        <SmallInput label="路径" value={item.path || ""} placeholder="/path" onChange={v => onUpdate("path", v)} />
        <div className="flex flex-col gap-[5px]">
          <label className="text-[11px] font-medium tracking-wide text-foreground/60">图标</label>
          <FormIconSelector
            value={item.icon || ""}
            onValueChange={v => onUpdate("icon", v)}
            placeholder="选择图标或输入 URL"
            size="sm"
          />
        </div>
      </div>
      <div className="mt-5 flex shrink-0 items-center gap-1.5">
        <Tooltip content={item.isExternal ? "设为内部链接" : "设为外部链接"} size="sm" delay={300} closeDelay={0}>
          <button
            type="button"
            onClick={() => onUpdate("isExternal", !item.isExternal)}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent transition-all duration-200",
              item.isExternal
                ? "border-primary/20 bg-primary/10 text-primary"
                : "text-muted-foreground hover:border-border/60 hover:bg-background hover:text-foreground"
            )}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </button>
        </Tooltip>
        <Tooltip content="上移" size="sm" delay={300} closeDelay={0}>
          <button type="button" onClick={onMoveUp} disabled={isFirst} className={ICON_BUTTON_CLASS}>
            <svg
              className="w-3 h-3 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </Tooltip>
        <Tooltip content="下移" size="sm" delay={300} closeDelay={0}>
          <button type="button" onClick={onMoveDown} disabled={isLast} className={ICON_BUTTON_CLASS}>
            <svg
              className="w-3 h-3 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </Tooltip>
        <Tooltip content="删除" size="sm" delay={300} closeDelay={0}>
          <button type="button" onClick={onRemove} className={DANGER_ICON_BUTTON_CLASS}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </Tooltip>
      </div>
    </div>
  );

  if (reorderValue != null) {
    return (
      <Reorder.Item value={reorderValue} dragListener={false} dragControls={dragControls} className="relative">
        {content}
      </Reorder.Item>
    );
  }
  return content;
}

// ─── 菜单项组件（用于 Reorder.Item，需接收 reorderValue） ─────────

function MenuItemCard({
  item,
  index,
  isFirst,
  isLast,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  reorderValue,
  dragHandleProps,
}: {
  item: MenuItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (updated: MenuItem) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  reorderValue?: MenuItem;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const isDropdown = item.type === "dropdown";
  const dragControls = useDragControls();

  const handleFieldChange = (field: keyof MenuItem, val: unknown) => {
    onUpdate({ ...item, [field]: val });
  };

  // 子菜单操作
  const subItems = item.items || [];

  const addSubItem = () => {
    onUpdate({
      ...item,
      items: [...subItems, { ...defaultSubItem, _id: `si-${Date.now()}-${Math.random().toString(36).slice(2)}` }],
    });
  };

  const removeSubItem = (subIndex: number) => {
    onUpdate({ ...item, items: subItems.filter((_, i) => i !== subIndex) });
  };

  const updateSubItem = (subIndex: number, field: keyof MenuSubItem, val: unknown) => {
    const newSubs = [...subItems];
    newSubs[subIndex] = { ...newSubs[subIndex], [field]: val };
    onUpdate({ ...item, items: newSubs });
  };

  const moveSubItem = (from: number, to: number) => {
    if (to < 0 || to >= subItems.length) return;
    const newSubs = [...subItems];
    [newSubs[from], newSubs[to]] = [newSubs[to], newSubs[from]];
    onUpdate({ ...item, items: newSubs });
  };

  const content = (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/95 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.6)] transition-all duration-200 hover:border-border/80">
      {/* 头部 */}
      <div
        className="flex cursor-pointer select-none items-center gap-2.5 bg-linear-to-r from-default-50/60 via-default-50/20 to-transparent px-3.5 py-2.5 transition-colors hover:from-default-100/55"
        onClick={() => setExpanded(!expanded)}
      >
        {dragHandleProps && (
          <div
            onPointerDown={e => {
              e.stopPropagation();
              dragControls.start(e);
            }}
            className="flex w-8 shrink-0 touch-none items-center justify-center self-stretch rounded-lg text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground active:cursor-grabbing"
            onClick={e => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        <svg
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0",
            expanded && "rotate-90"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background text-[11px] font-semibold text-muted-foreground">
          {index + 1}
        </span>
        <span className="flex flex-1 items-center gap-2 truncate text-sm font-medium text-foreground/85">
          {item.title || "未命名菜单"}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-normal",
              isDropdown ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"
            )}
          >
            {isDropdown ? "下拉" : "直链"}
          </span>
        </span>
        <div className="flex shrink-0 items-center gap-1" onClick={e => e.stopPropagation()}>
          <Tooltip content="上移" size="sm" delay={300} closeDelay={0}>
            <button type="button" onClick={onMoveUp} disabled={isFirst} className={ICON_BUTTON_CLASS}>
              <svg
                className="w-3.5 h-3.5 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </Tooltip>
          <Tooltip content="下移" size="sm" delay={300} closeDelay={0}>
            <button type="button" onClick={onMoveDown} disabled={isLast} className={ICON_BUTTON_CLASS}>
              <svg
                className="w-3.5 h-3.5 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </Tooltip>
          <Tooltip content="删除" size="sm" delay={300} closeDelay={0}>
            <button type="button" onClick={onRemove} className={DANGER_ICON_BUTTON_CLASS}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </Tooltip>
        </div>
      </div>

      {/* 展开内容 */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-border/60 bg-muted/30 px-3.5 py-3.5">
              {/* 基本字段 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SmallInput
                  label="标题"
                  value={item.title || ""}
                  placeholder="菜单标题"
                  onChange={v => handleFieldChange("title", v)}
                />
                <Select
                  label="类型"
                  labelPlacement="outside"
                  size="sm"
                  selectedKeys={[item.type || "direct"]}
                  onSelectionChange={keys => {
                    if (keys === "all") return;
                    const selected = Array.from(keys)[0];
                    if (selected !== undefined) handleFieldChange("type", String(selected));
                  }}
                  aria-label="菜单类型"
                  classNames={{
                    label: "text-[11px] font-medium tracking-wide text-foreground/60",
                    trigger: cn(
                      "h-9 min-h-9 rounded-xl border border-border/60 bg-card shadow-none!",
                      "data-[hover=true]:bg-card dark:data-[hover=true]:bg-muted data-[hover=true]:border-border/80",
                      "data-[open=true]:bg-card dark:data-[open=true]:bg-muted data-[open=true]:border-primary/65 data-[open=true]:ring-2 data-[open=true]:ring-primary/15",
                      "transition-all duration-200"
                    ),
                    value: "text-sm text-foreground/90",
                    popoverContent: "rounded-xl",
                  }}
                >
                  <SelectItem key="direct">直链</SelectItem>
                  <SelectItem key="dropdown">下拉菜单</SelectItem>
                </Select>
                {!isDropdown && (
                  <SmallInput
                    label="路径"
                    value={item.path || ""}
                    placeholder="/path"
                    onChange={v => handleFieldChange("path", v)}
                  />
                )}
                <div className="flex flex-col gap-[5px]">
                  <label className="text-[11px] font-medium tracking-wide text-foreground/60">图标</label>
                  <FormIconSelector
                    value={item.icon || ""}
                    onValueChange={v => handleFieldChange("icon", v)}
                    placeholder="选择图标或输入 URL"
                    size="sm"
                  />
                </div>
              </div>

              {/* 外部链接开关 */}
              {!isDropdown && (
                <div className="flex items-center justify-between py-1">
                  <label className="text-xs font-medium text-foreground/60">外部链接</label>
                  <Switch
                    size="sm"
                    isSelected={!!item.isExternal}
                    onValueChange={checked => handleFieldChange("isExternal", checked)}
                    aria-label="外部链接"
                    classNames={{
                      wrapper: "group-data-[selected=true]:bg-primary",
                    }}
                  />
                </div>
              )}

              {/* 下拉子菜单 */}
              {isDropdown && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h6 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">子菜单项</h6>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
                      {subItems.length} 项
                    </span>
                  </div>
                  {subItems.length > 0 ? (
                    <Reorder.Group
                      axis="y"
                      values={subItems}
                      onReorder={(newOrder: MenuSubItem[]) => {
                        onUpdate({ ...item, items: newOrder });
                      }}
                      className="flex flex-col gap-2"
                    >
                      {subItems.map((sub, subIdx) => (
                        <SubItemRow
                          key={sub._id ?? subIdx}
                          item={sub}
                          index={subIdx}
                          isFirst={subIdx === 0}
                          isLast={subIdx === subItems.length - 1}
                          onUpdate={(field, val) => updateSubItem(subIdx, field, val)}
                          onRemove={() => removeSubItem(subIdx)}
                          onMoveUp={() => moveSubItem(subIdx, subIdx - 1)}
                          onMoveDown={() => moveSubItem(subIdx, subIdx + 1)}
                          reorderValue={sub}
                        />
                      ))}
                    </Reorder.Group>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/80 bg-background/70 py-4 text-center">
                      <p className="text-xs text-muted-foreground">暂无子菜单项，点击下方添加</p>
                    </div>
                  )}
                  <button type="button" onClick={addSubItem} className={DASHED_ADD_BUTTON_CLASS}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    添加子菜单项
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (reorderValue != null) {
    return (
      <Reorder.Item value={reorderValue} dragListener={false} dragControls={dragControls} className="relative">
        {content}
      </Reorder.Item>
    );
  }
  return content;
}

// ─── 主组件 ───────────────────────────────────────────────────────

export function HeaderMenuEditor({ label, description, value, onValueChange, className }: HeaderMenuEditorProps) {
  const [items, setItems] = React.useState<MenuItem[]>(() => ensureStableMenuItemIds(parseMenuArray(value)));

  React.useEffect(() => {
    setItems(prevItems => {
      const parsedItems = parseMenuArray(value);
      const nextItems = ensureStableMenuItemIds(parsedItems, prevItems);
      return serializeMenuItems(nextItems) === serializeMenuItems(prevItems) ? prevItems : nextItems;
    });
  }, [value]);

  const updateItems = React.useCallback(
    (newItems: MenuItem[]) => {
      setItems(newItems);
      onValueChange?.(serializeMenuItems(newItems));
    },
    [onValueChange]
  );

  const handleAdd = () => {
    updateItems([...items, { ...defaultMenuItem, _id: `mi-${Date.now()}-${Math.random().toString(36).slice(2)}` }]);
  };

  const handleRemove = (index: number) => {
    updateItems(items.filter((_, i) => i !== index));
  };

  const handleUpdate = (index: number, updated: MenuItem) => {
    const newItems = [...items];
    newItems[index] = { ...updated, _id: items[index]._id };
    updateItems(newItems);
  };

  const handleMove = (from: number, to: number) => {
    const newItems = [...items];
    [newItems[from], newItems[to]] = [newItems[to], newItems[from]];
    updateItems(newItems);
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border/60 bg-linear-to-b from-background to-default-50/25 p-4 shadow-[0_12px_36px_-30px_rgba(15,23,42,0.7)] md:p-5",
        className
      )}
    >
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold tracking-tight text-foreground/80">{label}</label>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {items.length} 项
          </span>
        </div>
      )}

      {items.length > 0 ? (
        <Reorder.Group axis="y" values={items} onReorder={updateItems} className="flex flex-col gap-2.5">
          {items.map((item, index) => (
            <MenuItemCard
              key={item._id ?? index}
              item={item}
              index={index}
              isFirst={index === 0}
              isLast={index === items.length - 1}
              onUpdate={updated => handleUpdate(index, updated)}
              onRemove={() => handleRemove(index)}
              onMoveUp={() => handleMove(index, index - 1)}
              onMoveDown={() => handleMove(index, index + 1)}
              reorderValue={item}
              dragHandleProps={{}}
            />
          ))}
        </Reorder.Group>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/80 bg-background/70 py-8 text-center">
          <p className="text-sm text-muted-foreground">暂无菜单项</p>
          <p className="mt-1 text-xs text-muted-foreground">点击下方添加直链或下拉菜单</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleAdd}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/80 bg-background/80 py-2.5",
          "text-sm font-medium text-foreground/70 transition-all duration-200",
          "hover:border-primary/45 hover:bg-primary/5 hover:text-primary"
        )}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        添加菜单项
      </button>

      {description && <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}
