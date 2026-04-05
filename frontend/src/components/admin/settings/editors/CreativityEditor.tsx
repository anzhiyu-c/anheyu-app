"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import { Input } from "@heroui/react";
import { Plus, Palette, ImageIcon, GripVertical } from "lucide-react";
import Image from "next/image";
import { FormIconSelector } from "@/components/ui/form-icon-selector";

// ─── 类型 ──────────────────────────────────────────────────────────

interface CreativityItem {
  name: string;
  icon: string;
  color: string;
}

interface CreativityConfig {
  creativity_list?: CreativityItem[];
}

interface CreativityEditorProps {
  label?: string;
  description?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

interface InternalCreativityItem {
  _id: string;
  data: CreativityItem;
}

// ─── 工具函数 ──────────────────────────────────────────────────────

function parseConfig(value: string | undefined): CreativityConfig {
  if (value == null) return {};
  if (typeof value === "object") return value as unknown as CreativityConfig;
  if (!value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

// ─── 预设调色板 ──────────────────────────────────────────────────

const PRESET_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#f43f5e",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#1e293b",
  "#ffffff",
];

function getRandomColor(): string {
  const colorful = PRESET_COLORS.slice(0, 14);
  return colorful[Math.floor(Math.random() * colorful.length)];
}

// ─── 内联 SVG 图标 ──────────────────────────────────────────────

function TrashSmIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path
        d="M2.5 3.5h7M4.5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1M5 5.5v3M7 5.5v3M3.5 3.5l.5 6a1 1 0 001 1h2a1 1 0 001-1l.5-6"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExpandChevron({ expanded }: { expanded: boolean }) {
  return (
    <motion.div
      animate={{ rotate: expanded ? 180 : 0 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      className="shrink-0 text-muted-foreground/40"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M4.5 6L8 9.5L11.5 6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  );
}

// ─── 动画 ──────────────────────────────────────────────────────────

const expandTransition = {
  duration: 0.28,
  ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
};

// ─── 输入框样式 ──────────────────

const fieldInputClasses = {
  inputWrapper: cn(
    "h-9 min-h-9 rounded-xl border border-border/60 bg-card shadow-none!",
    "data-[hover=true]:bg-card dark:data-[hover=true]:bg-muted data-[hover=true]:border-border/80",
    "group-data-[focus=true]:bg-card dark:group-data-[focus=true]:bg-muted group-data-[focus=true]:border-primary/65",
    "group-data-[focus=true]:ring-2 group-data-[focus=true]:ring-primary/15",
    "transition-all duration-200"
  ),
  input: "text-sm text-foreground/90 placeholder:text-muted-foreground",
};

const fieldInputMonoClasses = {
  ...fieldInputClasses,
  input: "text-sm font-mono text-foreground/90 placeholder:text-muted-foreground tracking-wide",
};

// ─── 子组件：列表项行（支持拖拽排序） ─────────────────────────────

function CreativityRow({
  item,
  reorderValue,
  isExpanded,
  isLast,
  onToggle,
  onUpdate,
  onRemove,
}: {
  item: CreativityItem;
  reorderValue: InternalCreativityItem;
  isExpanded: boolean;
  isLast: boolean;
  onToggle: () => void;
  onUpdate: (field: keyof CreativityItem, val: string) => void;
  onRemove: () => void;
}) {
  const dragControls = useDragControls();
  const color = item.color || "#666";

  return (
    <Reorder.Item
      value={reorderValue}
      dragListener={false}
      dragControls={dragControls}
      as="div"
      layout="position"
      whileDrag={{
        scale: 1.02,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        zIndex: 50,
      }}
      className="relative bg-background"
    >
      {/* ── 行 ───────────────────────────────────── */}
      <div
        className={cn(
          "group/row flex items-center gap-2.5 pr-4 cursor-pointer select-none",
          "min-h-[52px]",
          "transition-colors duration-150",
          "hover:bg-[rgba(0,0,0,0.024)] dark:hover:bg-[rgba(255,255,255,0.04)]",
          "active:bg-[rgba(0,0,0,0.04)] dark:active:bg-[rgba(255,255,255,0.06)]"
        )}
        onClick={onToggle}
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

        {/* 图标方块 32×32 */}
        <div
          className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center overflow-hidden"
          style={{
            backgroundColor: color,
            boxShadow: `inset 0 0 0 0.5px rgba(0,0,0,0.1)`,
          }}
        >
          {item.icon ? (
            <Image
              src={item.icon}
              alt={item.name || "icon"}
              width={20}
              height={20}
              className="object-contain"
              unoptimized
            />
          ) : (
            <ImageIcon className="w-3.5 h-3.5 text-white/50" />
          )}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0 py-2.5">
          <div className="text-[14px] font-medium text-foreground leading-tight truncate tracking-[-0.08px]">
            {item.name || "未命名"}
          </div>
          <div className="text-[12px] text-muted-foreground leading-tight truncate mt-px font-mono tracking-[-0.2px]">
            {color}
          </div>
        </div>

        {/* 删除按钮 — hover 时淡入 */}
        <div
          className="flex items-center shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity duration-150"
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onRemove}
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center",
              "text-muted-foreground/40 hover:text-danger hover:bg-danger/8",
              "transition-all duration-150 active:scale-[0.92]"
            )}
            aria-label="删除"
          >
            <TrashSmIcon />
          </button>
        </div>

        {/* 展开指示器 */}
        <ExpandChevron expanded={isExpanded} />
      </div>

      {/* ── 分隔线 ─────────────────────────────── */}
      {!isLast && !isExpanded && <div className="mx-4 h-px bg-[rgba(60,60,67,0.08)] dark:bg-[rgba(84,84,88,0.4)]" />}

      {/* ── 展开编辑面板 ──────────────────────── */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={expandTransition}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">
              <div className="rounded-xl border border-border/60 bg-white dark:bg-card p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* 名称 */}
                  <div className="flex flex-col gap-[5px]">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.5px] leading-tight">
                      名称
                    </label>
                    <Input
                      size="sm"
                      value={item.name}
                      placeholder="例如：Vue"
                      onValueChange={v => onUpdate("name", v)}
                      classNames={fieldInputClasses}
                    />
                  </div>

                  {/* 图标 */}
                  <div className="flex flex-col gap-[5px]">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.5px] leading-tight">
                      图标
                    </label>
                    <FormIconSelector
                      value={item.icon}
                      onValueChange={v => onUpdate("icon", v)}
                      placeholder="选择图标或输入 URL"
                      size="sm"
                    />
                  </div>

                  {/* 颜色 — 跨两列 */}
                  <div className="md:col-span-2 flex flex-col gap-[5px]">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.5px] leading-tight">
                      颜色
                    </label>
                    <div className="flex items-center gap-2">
                      {/* 色块预览 */}
                      <div className="relative shrink-0">
                        <input
                          type="color"
                          value={color}
                          onChange={e => onUpdate("color", e.target.value)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div
                          className="w-9 h-9 rounded-md cursor-pointer transition-transform duration-150 hover:scale-105"
                          style={{
                            backgroundColor: color,
                            boxShadow: `inset 0 0 0 0.5px rgba(0,0,0,0.1)`,
                          }}
                        />
                      </div>
                      <Input
                        size="sm"
                        value={item.color}
                        placeholder="#000000"
                        onValueChange={v => onUpdate("color", v)}
                        classNames={{
                          ...fieldInputMonoClasses,
                          inputWrapper: cn(fieldInputMonoClasses.inputWrapper, "flex-1"),
                        }}
                      />
                    </div>

                    {/* 快速选色 */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {PRESET_COLORS.map(presetColor => {
                        const isActive = item.color?.toLowerCase() === presetColor.toLowerCase();
                        return (
                          <button
                            key={presetColor}
                            type="button"
                            onClick={() => onUpdate("color", presetColor)}
                            className={cn(
                              "w-[18px] h-[18px] rounded-[5px] transition-all duration-150",
                              "hover:scale-[1.15]",
                              isActive && "scale-105"
                            )}
                            style={{
                              backgroundColor: presetColor,
                              boxShadow: `inset 0 0 0 0.5px rgba(0,0,0,0.1)`,
                              outline: isActive ? `2px solid ${presetColor}` : "none",
                              outlineOffset: "2px",
                            }}
                            aria-label={`选择颜色 ${presetColor}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 展开时的分隔线 */}
            {!isLast && <div className="mx-4 h-px bg-[rgba(60,60,67,0.08)] dark:bg-[rgba(84,84,88,0.4)]" />}
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────────

export function CreativityEditor({ label, description, value, onValueChange, className }: CreativityEditorProps) {
  // ── 内部状态：为每个项目分配稳定的唯一 ID 以支持拖拽排序 ──
  const [internalItems, setInternalItems] = React.useState<InternalCreativityItem[]>([]);
  const lastValueRef = React.useRef<string | undefined>(undefined);
  const configRef = React.useRef<CreativityConfig>({});
  const idCounter = React.useRef(0);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  // 从外部 value 同步内部状态（仅当外部变化时触发）
  React.useEffect(() => {
    if (value === lastValueRef.current) return;
    const parsed = parseConfig(value);
    configRef.current = parsed;
    const list = parsed.creativity_list || [];
    setInternalItems(
      list.map(data => ({
        _id: `_${++idCounter.current}`,
        data,
      }))
    );
    lastValueRef.current = value;
  }, [value]);

  // 统一更新函数：同时更新内部状态和外部值
  const updateInternalItems = React.useCallback(
    (newItems: InternalCreativityItem[]) => {
      setInternalItems(newItems);
      const updated: CreativityConfig = {
        ...configRef.current,
        creativity_list: newItems.map(i => i.data),
      };
      const newValue = JSON.stringify(updated, null, 2);
      configRef.current = updated;
      lastValueRef.current = newValue;
      onValueChange?.(newValue);
    },
    [onValueChange]
  );

  const handleAdd = React.useCallback(() => {
    const newId = `_${++idCounter.current}`;
    const newItem: InternalCreativityItem = {
      _id: newId,
      data: { name: "", icon: "", color: getRandomColor() },
    };
    updateInternalItems([...internalItems, newItem]);
    setExpandedId(newId);
  }, [internalItems, updateInternalItems]);

  const handleRemove = React.useCallback(
    (id: string) => {
      updateInternalItems(internalItems.filter(i => i._id !== id));
      if (expandedId === id) setExpandedId(null);
    },
    [internalItems, expandedId, updateInternalItems]
  );

  const handleUpdate = React.useCallback(
    (index: number, field: keyof CreativityItem, val: string) => {
      const newItems = [...internalItems];
      newItems[index] = {
        ...newItems[index],
        data: { ...newItems[index].data, [field]: val },
      };
      updateInternalItems(newItems);
    },
    [internalItems, updateInternalItems]
  );

  /** 拖拽排序回调 */
  const handleReorder = (reorderedItems: InternalCreativityItem[]) => {
    updateInternalItems(reorderedItems);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* ── 标题栏 ─────────────────────────────── */}
      {label && (
        <div className="flex items-baseline justify-between px-0.5 mb-0.5">
          <label className="text-[13px] font-semibold text-foreground tracking-[-0.08px]">{label}</label>
          {internalItems.length > 0 && (
            <span className="text-[12px] text-muted-foreground/40 tabular-nums font-medium">
              {internalItems.length} 项
            </span>
          )}
        </div>
      )}

      {/* ── 列表（Reorder.Group 支持拖拽排序） ── */}
      {internalItems.length > 0 ? (
        <Reorder.Group
          axis="y"
          values={internalItems}
          onReorder={handleReorder}
          as="div"
          className={cn(
            "rounded-[14px] bg-background overflow-hidden",
            "shadow-[0_0_0_0.5px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.03)]",
            "dark:shadow-[0_0_0_0.5px_rgba(255,255,255,0.06),0_2px_8px_rgba(0,0,0,0.3),0_8px_24px_rgba(0,0,0,0.2)]"
          )}
        >
          {internalItems.map((internalItem, index) => (
            <CreativityRow
              key={internalItem._id}
              item={internalItem.data}
              reorderValue={internalItem}
              isExpanded={expandedId === internalItem._id}
              isLast={index === internalItems.length - 1}
              onToggle={() => setExpandedId(expandedId === internalItem._id ? null : internalItem._id)}
              onUpdate={(field, val) => handleUpdate(index, field, val)}
              onRemove={() => handleRemove(internalItem._id)}
            />
          ))}
        </Reorder.Group>
      ) : (
        /* ── 空状态 ────────────────────────────── */
        <div
          className={cn(
            "rounded-[14px] bg-background overflow-hidden",
            "shadow-[0_0_0_0.5px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.03)]",
            "dark:shadow-[0_0_0_0.5px_rgba(255,255,255,0.06),0_2px_8px_rgba(0,0,0,0.3),0_8px_24px_rgba(0,0,0,0.2)]",
            "flex flex-col items-center justify-center py-12 gap-2.5"
          )}
        >
          <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center mb-0.5">
            <Palette className="w-5 h-5 text-muted-foreground/40" />
          </div>
          <span className="text-[14px] text-muted-foreground/40 font-medium">暂无创意图标</span>
          <span className="text-[12px] text-muted-foreground/40">点击下方按钮添加</span>
        </div>
      )}

      {/* ── 添加按钮 ──────────────────────────── */}
      <button
        type="button"
        onClick={handleAdd}
        className={cn(
          "group flex items-center justify-center gap-1.5",
          "w-full h-10 rounded-xl",
          "bg-transparent",
          "text-[13px] font-medium text-primary tracking-[-0.08px]",
          "hover:bg-primary/6 active:bg-primary/10",
          "active:scale-[0.985]",
          "transition-all duration-150 ease-out"
        )}
      >
        <Plus className="w-4 h-4 transition-transform duration-150 group-hover:scale-110" />
        添加创意图标
      </button>

      {/* ── 描述 ──────────────────────────────── */}
      {description && <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}
