"use client";

import * as React from "react";
import { Input, Button } from "@heroui/react";
import { cn } from "@/lib/utils";
import { Plus, X, GripVertical } from "lucide-react";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";

export interface FormStringListProps {
  /** 标签 */
  label?: string;
  /** 描述文本 */
  description?: string;
  /** 受控值（JSON 字符串数组） */
  value?: string;
  /** 值变化回调（JSON 字符串） */
  onValueChange?: (value: string) => void;
  /** 输入框占位符 */
  placeholder?: string;
  /** 新增按钮文字 */
  addButtonText?: string;
  /** 最大项数 */
  maxItems?: number;
  /** 容器额外 className */
  className?: string;
}

interface InternalItem {
  _id: string;
  value: string;
}

let _nextId = 0;
function nextId() {
  return `sli_${++_nextId}`;
}

function parseItems(raw: string | undefined): InternalItem[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((v: unknown) => ({ _id: nextId(), value: String(v ?? "") }));
  } catch {
    return [];
  }
}

function serializeItems(items: InternalItem[]): string {
  return JSON.stringify(items.map(i => i.value));
}

const FormStringList = React.forwardRef<HTMLDivElement, FormStringListProps>(
  (
    {
      label,
      description,
      value,
      onValueChange,
      placeholder = "请输入内容",
      addButtonText = "添加项目",
      maxItems,
      className,
    },
    ref
  ) => {
    const [items, setItems] = React.useState<InternalItem[]>(() => parseItems(value));

    // 同步外部值
    const lastExternal = React.useRef(value);
    React.useEffect(() => {
      if (value !== lastExternal.current) {
        lastExternal.current = value;
        setItems(parseItems(value));
      }
    }, [value]);

    const emit = React.useCallback(
      (next: InternalItem[]) => {
        const json = serializeItems(next);
        lastExternal.current = json;
        onValueChange?.(json);
      },
      [onValueChange]
    );

    const handleAdd = React.useCallback(() => {
      if (maxItems && items.length >= maxItems) return;
      const next = [...items, { _id: nextId(), value: "" }];
      setItems(next);
      emit(next);
    }, [items, maxItems, emit]);

    const handleRemove = React.useCallback(
      (id: string) => {
        const next = items.filter(i => i._id !== id);
        setItems(next);
        emit(next);
      },
      [items, emit]
    );

    const handleChange = React.useCallback(
      (id: string, val: string) => {
        const next = items.map(i => (i._id === id ? { ...i, value: val } : i));
        setItems(next);
        emit(next);
      },
      [items, emit]
    );

    const handleReorder = React.useCallback(
      (reordered: InternalItem[]) => {
        setItems(reordered);
        emit(reordered);
      },
      [emit]
    );

    return (
      <div ref={ref} className={cn("flex flex-col gap-1.5", className)}>
        {label && <label className="text-sm font-medium text-foreground/80">{label}</label>}

        <div
          className={cn(
            "rounded-xl border border-border/60 bg-card overflow-hidden",
            "shadow-[0_0_0_0.5px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.04)]",
            "dark:shadow-none"
          )}
        >
          <Reorder.Group axis="y" values={items} onReorder={handleReorder} className="divide-y divide-border/30">
            <AnimatePresence initial={false}>
              {items.map(item => (
                <StringListItem
                  key={item._id}
                  item={item}
                  placeholder={placeholder}
                  onChange={handleChange}
                  onRemove={handleRemove}
                />
              ))}
            </AnimatePresence>
          </Reorder.Group>

          {items.length === 0 && (
            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground/50">暂无项目</div>
          )}

          {/* 添加按钮 */}
          <button
            type="button"
            onClick={handleAdd}
            disabled={!!maxItems && items.length >= maxItems}
            className={cn(
              "flex items-center justify-center gap-1.5 w-full py-2.5",
              "text-xs font-medium text-primary",
              "border-t border-border/30 bg-muted/5!",
              "hover:bg-primary/5 transition-colors",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            {addButtonText}
          </button>
        </div>

        {description && <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>}
      </div>
    );
  }
);
FormStringList.displayName = "FormStringList";

// ─── 单行子组件 ──────────────────────────────────────────

function StringListItem({
  item,
  placeholder,
  onChange,
  onRemove,
}: {
  item: InternalItem;
  placeholder: string;
  onChange: (id: string, val: string) => void;
  onRemove: (id: string) => void;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div className="flex items-center gap-2 px-3 py-2 bg-transparent">
        {/* 拖拽手柄 */}
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
          onPointerDown={e => controls.start(e)}
          tabIndex={-1}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* 输入框 - 与 FormInput 保持一致 */}
        <Input
          size="sm"
          placeholder={placeholder}
          value={item.value}
          onValueChange={v => onChange(item._id, v)}
          classNames={{
            inputWrapper: cn(
              "rounded-xl border border-border/60 bg-muted/50 shadow-none! h-9 min-h-9",
              "data-[hover=true]:border-border-hover/40",
              "group-data-[focus=true]:border-primary/65 group-data-[focus=true]:ring-2 group-data-[focus=true]:ring-primary/15",
              "transition-all duration-200"
            ),
            input: "text-sm text-foreground/90 placeholder:text-muted-foreground/60",
          }}
        />

        {/* 删除按钮 */}
        <Button
          isIconOnly
          size="sm"
          variant="light"
          onPress={() => onRemove(item._id)}
          className="text-muted-foreground/40 hover:text-danger min-w-6 w-6 h-6 shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </motion.div>
    </Reorder.Item>
  );
}

export { FormStringList };
