"use client";

import * as React from "react";
import { Input, Switch, Select, SelectItem, Popover, PopoverTrigger, PopoverContent, Button } from "@heroui/react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import { ChevronDown, GripVertical, Plus } from "lucide-react";
import { FormIconSelector } from "@/components/ui/form-icon-selector";

// ─── 类型定义 ─────────────────────────────────────────────────────

export interface FieldDef {
  /** 字段在对象中的键名 */
  key: string;
  /** 显示标签 */
  label: string;
  /** 字段类型 */
  type: "text" | "url" | "color" | "switch" | "select" | "icon" | "textarea";
  /** 占位符 */
  placeholder?: string;
  /** select 类型的选项 */
  options?: { label: string; value: string }[];
  /** 栅格列宽（1 或 2），默认 1 */
  colSpan?: 1 | 2;
}

export interface VisualArrayEditorProps {
  /** 标签 */
  label?: string;
  /** 描述文本 */
  description?: string;
  /** 受控值（JSON 字符串） */
  value?: string;
  /** 值变化回调 */
  onValueChange?: (value: string) => void;
  /** 字段定义列表 */
  fields: FieldDef[];
  /** 新增项的默认值 */
  defaultItem: Record<string, unknown>;
  /** 项目标题渲染函数，用于折叠时显示摘要 */
  itemLabel?: (item: Record<string, unknown>, index: number) => string;
  /** 自定义项目图标渲染函数 */
  itemIcon?: (item: Record<string, unknown>, index: number) => React.ReactNode;
  /** 最大条目数 */
  maxItems?: number;
  /** 新增按钮文本 */
  addButtonText?: string;
  /** 容器额外 className */
  className?: string;
}

// ─── 常量 ─────────────────────────────────────────────────────────

/** 默认图标渐变色（Apple 系统调色板） */
const ICON_GRADIENTS = [
  "linear-gradient(135deg, #007AFF, #5AC8FA)",
  "linear-gradient(135deg, #FF9500, #FFCC00)",
  "linear-gradient(135deg, #FF2D55, #FF6482)",
  "linear-gradient(135deg, #34C759, #30D158)",
  "linear-gradient(135deg, #AF52DE, #BF5AF2)",
  "linear-gradient(135deg, #5856D6, #7A7AFF)",
  "linear-gradient(135deg, #FF3B30, #FF6961)",
  "linear-gradient(135deg, #00C7BE, #64D2FF)",
];

/** 容器样式 — 扁平边框，不使用多层阴影 */
const LIST_SHADOW = "border border-border/50";

// ─── 内部类型 ─────────────────────────────────────────────────────

interface InternalItem {
  _id: string;
  data: Record<string, unknown>;
}

// ─── 工具函数 ─────────────────────────────────────────────────────

function parseJsonArray(value: string | undefined): Record<string, unknown>[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value as unknown as Record<string, unknown>[];
  if (typeof value === "object") return [];
  if (!value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeArray(items: Record<string, unknown>[]): string {
  return JSON.stringify(items, null, 2);
}

// ─── 动画配置 ─────────────────────────────────────────────────────

const APPLE_EASE = [0.32, 0.72, 0, 1] as [number, number, number, number];

const expandTransition = { duration: 0.32, ease: APPLE_EASE };

const itemVariants = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: APPLE_EASE } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.2, ease: APPLE_EASE } },
};

// ─── 共享样式 ──────────────────────────

/** 输入框包裹器 */
const inputWrapperBase = cn(
  "h-9 min-h-9 rounded-xl border border-border/60 bg-card shadow-none!",
  "data-[hover=true]:border-border-hover/40",
  "group-data-[focus=true]:border-primary/65 group-data-[focus=true]:ring-2 group-data-[focus=true]:ring-primary/15",
  "transition-all duration-200"
);

/** 输入框文字 */
const inputTextBase = "text-sm text-foreground/90 placeholder:text-muted-foreground/60";

// ─── 子组件：单个字段渲染 ──────────────────────────────────────────

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  switch (field.type) {
    case "text":
    case "url":
      return (
        <div className="flex flex-col gap-[5px] min-w-0">
          <label className="text-[11px] font-medium tracking-wide text-foreground/60">{field.label}</label>
          <Input
            size="sm"
            value={(value as string) || ""}
            placeholder={field.placeholder}
            onValueChange={v => onChange(v)}
            classNames={{
              inputWrapper: cn(inputWrapperBase, "min-w-0"),
              input: inputTextBase,
            }}
          />
        </div>
      );

    case "color":
      return (
        <div className="flex flex-col gap-[5px]">
          <label className="text-[11px] font-medium tracking-wide text-foreground/60">{field.label}</label>
          <div className="flex items-center gap-2">
            {/* 颜色色块 - 可点击 */}
            <div className="relative shrink-0 group/swatch">
              <input
                type="color"
                value={(value as string) || "#000000"}
                onChange={e => onChange(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div
                className={cn(
                  "w-9 h-9 rounded-md",
                  "shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.1)]",
                  "group-hover/swatch:scale-105 group-hover/swatch:shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.1),0_2px_8px_rgba(0,0,0,0.15)]",
                  "transition-all duration-150"
                )}
                style={{ backgroundColor: (value as string) || "#000000" }}
              />
            </div>
            {/* 色值输入框 */}
            <Input
              size="sm"
              value={(value as string) || ""}
              placeholder={field.placeholder || "#000000"}
              onValueChange={v => onChange(v)}
              classNames={{
                inputWrapper: cn(inputWrapperBase, "flex-1"),
                input: cn(inputTextBase, "font-mono text-xs tracking-wider"),
              }}
            />
          </div>
        </div>
      );

    case "switch":
      return (
        <div className="flex items-center justify-between h-9">
          <label className="text-[11px] font-medium tracking-wide text-foreground/60">{field.label}</label>
          <Switch
            size="sm"
            isSelected={!!value}
            onValueChange={checked => onChange(checked)}
            aria-label={field.label}
            classNames={{
              wrapper: "group-data-[selected=true]:bg-primary",
            }}
          />
        </div>
      );

    case "select":
      return (
        <div className="flex flex-col gap-[5px]">
          <label className="text-[11px] font-medium tracking-wide text-foreground/60">{field.label}</label>
          <Select
            size="sm"
            selectedKeys={(value as string) ? [value as string] : []}
            onSelectionChange={keys => {
              if (keys === "all") return;
              const selected = Array.from(keys)[0];
              if (selected !== undefined) onChange(String(selected));
            }}
            aria-label={field.label}
            classNames={{
              trigger: cn(
                inputWrapperBase,
                "data-[open=true]:border-primary/65 data-[open=true]:ring-2 data-[open=true]:ring-primary/15"
              ),
              value: "text-sm text-foreground/90",
              popoverContent: "rounded-xl shadow-lg",
            }}
          >
            {(field.options || []).map(opt => (
              <SelectItem key={opt.value}>{opt.label}</SelectItem>
            ))}
          </Select>
        </div>
      );

    case "icon":
      return (
        <div className="flex flex-col gap-[5px] min-w-0">
          <label className="text-[11px] font-semibold text-[rgba(60,60,67,0.6)] dark:text-[rgba(235,235,245,0.6)] uppercase tracking-[0.5px] leading-tight">
            {field.label}
          </label>
          <FormIconSelector
            value={(value as string) || ""}
            onValueChange={v => onChange(v)}
            placeholder={field.placeholder || "选择图标或输入 URL"}
            size="sm"
            className="min-w-0"
          />
        </div>
      );

    case "textarea":
      return (
        <div className="flex flex-col gap-[5px]">
          <label className="text-[11px] font-semibold text-[rgba(60,60,67,0.6)] dark:text-[rgba(235,235,245,0.6)] uppercase tracking-[0.5px] leading-tight">
            {field.label}
          </label>
          <textarea
            value={(value as string) || ""}
            placeholder={field.placeholder}
            onChange={e => onChange(e.target.value)}
            rows={4}
            className={cn(
              "w-full px-3 py-2 text-[13px] rounded-lg resize-y",
              "bg-[rgba(120,120,128,0.08)] dark:bg-[rgba(120,120,128,0.16)]",
              "border border-transparent",
              "focus:outline-none focus:bg-card focus:border-primary focus:ring-1 focus:ring-primary/20",
              "placeholder:text-muted-foreground/60 text-foreground",
              "transition-all duration-200",
              "font-mono"
            )}
          />
        </div>
      );

    default:
      return null;
  }
}

// ─── 子组件：操作按钮 ───────────────────────────────────────────

function ActionButton({
  onClick,
  disabled,
  danger,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
        "border-0 bg-transparent cursor-pointer",
        "text-[rgba(60,60,67,0.3)] dark:text-[rgba(235,235,245,0.3)] transition-all duration-150",
        "hover:bg-[rgba(120,120,128,0.06)] hover:text-[rgba(60,60,67,0.6)] dark:hover:bg-[rgba(120,120,128,0.12)] dark:hover:text-[rgba(235,235,245,0.6)]",
        "active:scale-[0.92]",
        danger && "hover:text-danger! hover:bg-danger/10!",
        "disabled:opacity-0 disabled:pointer-events-none"
      )}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

// ─── 子组件：默认图标 ───────────────────────────────────────────

function DefaultItemIcon({ char, index }: { char: string; index: number }) {
  return (
    <div
      className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-white text-sm font-semibold tracking-tight"
      style={{ background: ICON_GRADIENTS[index % ICON_GRADIENTS.length] }}
    >
      {char}
    </div>
  );
}

// ─── SVG 图标 ───────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 3.5h7M4.5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1M5 5.5v3M7 5.5v3M3.5 3.5l.5 6a1 1 0 001 1h2a1 1 0 001-1l.5-6" />
    </svg>
  );
}

// ─── 子组件：删除确认按钮（Popover 二次确认） ─────────────────────

function DeleteConfirmButton({ onConfirm }: { onConfirm: () => void }) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      placement="bottom"
      showArrow
      classNames={{
        content: "px-3 py-2.5",
      }}
    >
      <PopoverTrigger>
        <div>
          <ActionButton onClick={() => setIsOpen(true)} danger ariaLabel="删除">
            <TrashIcon />
          </ActionButton>
        </div>
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-foreground/70">确定删除该项？</p>
          <div className="flex gap-1.5 justify-end">
            <Button size="sm" variant="flat" className="h-7 min-w-0 px-2.5 text-xs" onPress={() => setIsOpen(false)}>
              取消
            </Button>
            <Button
              size="sm"
              color="danger"
              className="h-7 min-w-0 px-2.5 text-xs"
              onPress={() => {
                setIsOpen(false);
                onConfirm();
              }}
            >
              删除
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── 子组件：单个列表项（支持拖拽排序） ────────────────────────────

function ArrayItem({
  item,
  index,
  reorderValue,
  fields,
  itemLabel,
  itemIcon,
  isLast,
  onUpdate,
  onRemove,
}: {
  item: Record<string, unknown>;
  index: number;
  reorderValue: InternalItem;
  fields: FieldDef[];
  itemLabel?: (item: Record<string, unknown>, index: number) => string;
  itemIcon?: (item: Record<string, unknown>, index: number) => React.ReactNode;
  isLast: boolean;
  onUpdate: (key: string, value: unknown) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const dragControls = useDragControls();
  const title = itemLabel ? itemLabel(item, index) : `项目 ${index + 1}`;

  // 副标题：自动从 path / url / link 字段中提取
  const subtitle = React.useMemo(() => {
    const pathField = fields.find(f => f.key === "path" || f.key === "url" || f.key === "link");
    if (pathField) {
      const val = item[pathField.key] as string;
      if (val) return val;
    }
    return null;
  }, [item, fields]);

  // 图标渲染
  const iconNode = React.useMemo(() => {
    if (itemIcon) return itemIcon(item, index);
    const firstChar = title.charAt(0) || "?";
    return <DefaultItemIcon char={firstChar} index={index} />;
  }, [itemIcon, item, index, title]);

  return (
    <Reorder.Item
      value={reorderValue}
      dragListener={false}
      dragControls={dragControls}
      as="div"
      layout="position"
      variants={itemVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      whileDrag={{
        scale: 1.02,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        zIndex: 50,
      }}
      className="relative bg-background"
    >
      {/* ── 行头部 ── */}
      <div
        className={cn(
          "group/row flex items-center gap-2.5 pr-4 cursor-pointer select-none",
          "min-h-[52px] py-[10px]",
          "transition-colors duration-150",
          "hover:bg-[rgba(0,0,0,0.024)] dark:hover:bg-[rgba(255,255,255,0.04)]",
          "active:bg-[rgba(0,0,0,0.04)] dark:active:bg-[rgba(255,255,255,0.06)]"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {/* 拖拽手柄 */}
        <div
          onPointerDown={e => {
            e.stopPropagation();
            dragControls.start(e);
          }}
          onClick={e => e.stopPropagation()}
          className={cn(
            "shrink-0 flex items-center justify-center w-8 self-stretch",
            "cursor-grab active:cursor-grabbing touch-none",
            "text-[rgba(60,60,67,0.15)] dark:text-[rgba(235,235,245,0.15)]",
            "hover:text-[rgba(60,60,67,0.4)] dark:hover:text-[rgba(235,235,245,0.4)]",
            "transition-colors duration-150"
          )}
        >
          <GripVertical className="w-[14px] h-[14px]" />
        </div>

        {/* 图标 */}
        {iconNode}

        {/* 标题区域 */}
        <div className="flex-1 min-w-0 py-px">
          <div className="text-sm font-medium text-foreground leading-snug truncate tracking-tight">{title}</div>
          {subtitle && (
            <div className="text-xs text-[rgba(60,60,67,0.3)] dark:text-[rgba(235,235,245,0.3)] leading-snug truncate mt-px font-mono tracking-tight">
              {subtitle}
            </div>
          )}
        </div>

        {/* Chevron 展开指示器 — 只旋转图标 */}
        <div
          className={cn(
            "mr-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            "text-[rgba(60,60,67,0.3)] dark:text-[rgba(235,235,245,0.3)]",
            "hover:bg-[rgba(120,120,128,0.08)] dark:hover:bg-[rgba(120,120,128,0.14)]"
          )}
        >
          <ChevronDown
            className="w-4 h-4 transition-transform duration-250"
            style={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transitionTimingFunction: "cubic-bezier(0.32,0.72,0,1)",
            }}
          />
        </div>

        {/* 删除按钮 — hover 时显示，带二次确认 */}
        <div
          className="flex shrink-0 items-center opacity-0 transition-opacity duration-150 group-hover/row:opacity-100"
          onClick={e => e.stopPropagation()}
        >
          <DeleteConfirmButton onConfirm={onRemove} />
        </div>
      </div>

      {/* ── 分隔线 ── */}
      {!isLast && !expanded && (
        <div className="mx-4">
          <div className="h-[0.5px] bg-[rgba(60,60,67,0.08)] dark:bg-[rgba(84,84,88,0.4)]" />
        </div>
      )}

      {/* ── 展开编辑面板 ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={expandTransition}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 min-w-0">
              <div className="rounded-xl border border-border/40 bg-muted/50 p-4 min-w-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 min-w-0">
                  {fields.map(field => (
                    <div
                      key={field.key}
                      className={cn(field.colSpan === 2 && "md:col-span-2", "min-w-0 overflow-hidden")}
                    >
                      <FieldRenderer field={field} value={item[field.key]} onChange={val => onUpdate(field.key, val)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 展开后的分隔线 */}
            {!isLast && (
              <div className="mx-4">
                <div className="h-[0.5px] bg-[rgba(60,60,67,0.08)] dark:bg-[rgba(84,84,88,0.4)]" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────────

export function VisualArrayEditor({
  label,
  description,
  value,
  onValueChange,
  fields,
  defaultItem,
  itemLabel,
  itemIcon,
  maxItems,
  addButtonText = "添加项目",
  className,
}: VisualArrayEditorProps) {
  // ── 内部状态：为每个项目分配稳定的唯一 ID 以支持拖拽排序 ──
  const [internalItems, setInternalItems] = React.useState<InternalItem[]>([]);
  const lastValueRef = React.useRef<string | undefined>(undefined);
  const idCounter = React.useRef(0);

  // 从外部 value 同步内部状态（仅当外部变化时触发）；保留已有项的 _id 避免展开项被 remount 收起
  React.useEffect(() => {
    if (value === lastValueRef.current) return;
    const parsed = parseJsonArray(value);
    setInternalItems(prev => {
      return parsed.map((data, i) => ({
        _id: i < prev.length ? prev[i]._id : `_${++idCounter.current}`,
        data,
      }));
    });
    lastValueRef.current = value;
  }, [value]);

  // 统一更新函数：同时更新内部状态和外部值
  const updateInternalItems = React.useCallback(
    (newItems: InternalItem[]) => {
      setInternalItems(newItems);
      const newValue = serializeArray(newItems.map(i => i.data));
      lastValueRef.current = newValue;
      onValueChange?.(newValue);
    },
    [onValueChange]
  );

  const handleAdd = () => {
    if (maxItems && internalItems.length >= maxItems) return;
    updateInternalItems([...internalItems, { _id: `_${++idCounter.current}`, data: { ...defaultItem } }]);
  };

  const handleRemove = (index: number) => {
    updateInternalItems(internalItems.filter((_, i) => i !== index));
  };

  const handleUpdate = (index: number, key: string, val: unknown) => {
    const newItems = [...internalItems];
    newItems[index] = {
      ...newItems[index],
      data: { ...newItems[index].data, [key]: val },
    };
    updateInternalItems(newItems);
  };

  /** 拖拽排序回调 */
  const handleReorder = (reorderedItems: InternalItem[]) => {
    updateInternalItems(reorderedItems);
  };

  const canAdd = !maxItems || internalItems.length < maxItems;

  return (
    <div className={cn("flex flex-col gap-2 min-w-0", className)}>
      {/* ── 标题栏 ── */}
      {label && (
        <div className="flex items-baseline justify-between px-0.5 mb-0.5">
          <label className="text-[13px] font-semibold text-foreground tracking-tight">{label}</label>
          {internalItems.length > 0 && (
            <span className="text-xs text-[rgba(60,60,67,0.3)] dark:text-[rgba(235,235,245,0.3)] font-medium tabular-nums">
              {internalItems.length} 项
            </span>
          )}
        </div>
      )}

      {/* ── 列表容器（Reorder.Group 支持拖拽排序） ── */}
      {internalItems.length > 0 ? (
        <Reorder.Group
          axis="y"
          values={internalItems}
          onReorder={handleReorder}
          as="div"
          className={cn("rounded-[14px] bg-background overflow-hidden min-w-0", LIST_SHADOW)}
        >
          <AnimatePresence initial={false}>
            {internalItems.map((internalItem, index) => (
              <ArrayItem
                key={internalItem._id}
                item={internalItem.data}
                index={index}
                reorderValue={internalItem}
                fields={fields}
                itemLabel={itemLabel}
                itemIcon={itemIcon}
                isLast={index === internalItems.length - 1}
                onUpdate={(key, val) => handleUpdate(index, key, val)}
                onRemove={() => handleRemove(index)}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>
      ) : (
        /* ── 空状态 ── */
        <div className={cn("rounded-[14px] bg-background py-12 px-6 flex flex-col items-center gap-2.5", LIST_SHADOW)}>
          <div className="w-11 h-11 rounded-full bg-[rgba(120,120,128,0.06)] dark:bg-[rgba(120,120,128,0.12)] flex items-center justify-center">
            <Plus
              className="w-[22px] h-[22px] text-[rgba(60,60,67,0.3)] dark:text-[rgba(235,235,245,0.3)]"
              strokeWidth={1.5}
            />
          </div>
          <p className="text-sm text-[rgba(60,60,67,0.3)] dark:text-[rgba(235,235,245,0.3)] font-medium">暂无项目</p>
          <p className="text-xs text-[rgba(60,60,67,0.25)] dark:text-[rgba(235,235,245,0.2)]">点击下方按钮添加</p>
        </div>
      )}

      {/* ── 添加按钮 ── */}
      {canAdd && (
        <button
          type="button"
          onClick={handleAdd}
          className={cn(
            "group/add flex items-center justify-center gap-1.5",
            "w-full h-10 rounded-xl",
            "bg-transparent border-0",
            "text-[13px] font-medium text-primary tracking-tight",
            "hover:bg-[rgba(0,122,255,0.06)] active:bg-[rgba(0,122,255,0.1)]",
            "dark:hover:bg-[rgba(10,132,255,0.12)] dark:active:bg-[rgba(10,132,255,0.18)]",
            "active:scale-[0.985]",
            "transition-all duration-150 cursor-pointer"
          )}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="transition-transform duration-150 group-hover/add:scale-110"
          >
            <path d="M8 3v10M3 8h10" />
          </svg>
          {addButtonText}
        </button>
      )}

      {/* ── 描述 ── */}
      {description && <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}
