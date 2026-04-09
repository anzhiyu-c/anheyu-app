"use client";

import * as React from "react";
import { Input, Switch } from "@heroui/react";
import { AnimatePresence, motion, Reorder, useDragControls } from "framer-motion";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── 类型 ──────────────────────────────────────────────────────────

interface ProjectLink {
  title: string;
  link: string;
  external?: boolean;
}

interface ProjectGroup {
  title: string;
  links: ProjectLink[];
  _id?: string;
}

interface ProjectListEditorProps {
  label?: string;
  description?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

// ─── 工具函数 ──────────────────────────────────────────────────────

function parseGroups(value: string | undefined): ProjectGroup[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value as unknown as ProjectGroup[];
  if (typeof value === "object") return [];
  if (!value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((g: ProjectGroup) => ({ ...g }));
  } catch {
    return [];
  }
}

function ensureStableGroupIds(nextGroups: ProjectGroup[], prevGroups: ProjectGroup[] = []): ProjectGroup[] {
  return nextGroups.map((group, index) => ({
    ...group,
    _id: group._id || prevGroups[index]?._id || `pg-${index}-${Math.random().toString(36).slice(2)}`,
  }));
}

function serializeGroups(groups: ProjectGroup[]): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit _id for serialization
  const strip = groups.map(({ _id: _, ...rest }) => rest);
  return JSON.stringify(strip, null, 2);
}

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

// ─── 输入框 ─────────────────────────────────────────────────────

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

// ─── 链接行 ─────────────────────────────────────────────────────

function LinkRow({
  item,
  index,
  isFirst,
  isLast,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  item: ProjectLink;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (field: keyof ProjectLink, val: string | boolean) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 transition-colors hover:border-border/80 hover:bg-muted/30">
      <span className="mt-2 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-background text-[11px] font-medium text-muted-foreground ring-1 ring-border/60/80">
        {index + 1}
      </span>
      <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
        <SmallInput label="标题" value={item.title || ""} placeholder="链接标题" onChange={v => onUpdate("title", v)} />
        <SmallInput
          label="链接"
          value={item.link || ""}
          placeholder="https://..."
          onChange={v => onUpdate("link", v)}
        />
      </div>
      <div className="mt-5 flex shrink-0 items-center gap-1.5">
        <div className="flex items-center gap-1.5">
          <label className="whitespace-nowrap text-xs text-foreground/55">新标签页</label>
          <Switch
            size="sm"
            isSelected={!!item.external}
            onValueChange={v => onUpdate("external", v)}
            aria-label="新标签页打开"
            classNames={{ wrapper: "group-data-[selected=true]:bg-primary/85", thumb: "shadow-none" }}
          />
        </div>
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
        <button type="button" onClick={onRemove} className={DANGER_ICON_BUTTON_CLASS}>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── 分组卡片 ────────────────────────────────────────────────────

function GroupCard({
  group,
  index,
  isFirst,
  isLast,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  reorderValue,
}: {
  group: ProjectGroup;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (updated: ProjectGroup) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  reorderValue?: ProjectGroup;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const dragControls = useDragControls();
  const links = group.links || [];

  const addLink = () => {
    onUpdate({ ...group, links: [...links, { title: "", link: "", external: false }] });
  };

  const removeLink = (idx: number) => {
    onUpdate({ ...group, links: links.filter((_, i) => i !== idx) });
  };

  const updateLink = (idx: number, field: keyof ProjectLink, val: string | boolean) => {
    const newLinks = [...links];
    newLinks[idx] = { ...newLinks[idx], [field]: val };
    onUpdate({ ...group, links: newLinks });
  };

  const moveLink = (from: number, to: number) => {
    const newLinks = [...links];
    [newLinks[from], newLinks[to]] = [newLinks[to], newLinks[from]];
    onUpdate({ ...group, links: newLinks });
  };

  const content = (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/95 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.6)] transition-all duration-200 hover:border-border/80">
      <div
        className="flex cursor-pointer select-none items-center gap-2.5 bg-linear-to-r from-default-50/60 via-default-50/20 to-transparent px-3.5 py-2.5 transition-colors hover:from-default-100/55"
        onClick={() => setExpanded(!expanded)}
      >
        {reorderValue != null && (
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
          {group.title || "未命名分组"}
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
            {links.length} 条链接
          </span>
        </span>
        <div className="flex shrink-0 items-center gap-1" onClick={e => e.stopPropagation()}>
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
          <button type="button" onClick={onRemove} className={DANGER_ICON_BUTTON_CLASS}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-3.5 border-t border-border/60 bg-muted/30 px-3.5 py-3.5">
              <SmallInput
                label="分组标题"
                value={group.title || ""}
                placeholder="例如：我的项目"
                onChange={v => onUpdate({ ...group, title: v })}
              />
              <div className="space-y-2.5">
                {links.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {links.map((link, idx) => (
                      <LinkRow
                        key={idx}
                        item={link}
                        index={idx}
                        isFirst={idx === 0}
                        isLast={idx === links.length - 1}
                        onUpdate={(field, val) => updateLink(idx, field, val)}
                        onRemove={() => removeLink(idx)}
                        onMoveUp={() => moveLink(idx, idx - 1)}
                        onMoveDown={() => moveLink(idx, idx + 1)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/80 bg-background/70 py-4 text-center">
                    <p className="text-xs text-muted-foreground">暂无链接，点击下方添加</p>
                  </div>
                )}
                <button type="button" onClick={addLink} className={DASHED_ADD_BUTTON_CLASS}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  添加链接
                </button>
              </div>
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

export function ProjectListEditor({ label, description, value, onValueChange, className }: ProjectListEditorProps) {
  const [groups, setGroups] = React.useState<ProjectGroup[]>(() => ensureStableGroupIds(parseGroups(value)));

  React.useEffect(() => {
    setGroups(prevGroups => {
      const parsedGroups = parseGroups(value);
      const nextGroups = ensureStableGroupIds(parsedGroups, prevGroups);
      return serializeGroups(nextGroups) === serializeGroups(prevGroups) ? prevGroups : nextGroups;
    });
  }, [value]);

  const updateGroups = React.useCallback(
    (newGroups: ProjectGroup[]) => {
      setGroups(newGroups);
      onValueChange?.(serializeGroups(newGroups));
    },
    [onValueChange]
  );

  const handleAdd = () => {
    updateGroups([...groups, { title: "", links: [], _id: `pg-${Date.now()}-${Math.random().toString(36).slice(2)}` }]);
  };

  const handleRemove = (index: number) => {
    updateGroups(groups.filter((_, i) => i !== index));
  };

  const handleUpdate = (index: number, updated: ProjectGroup) => {
    const newGroups = [...groups];
    newGroups[index] = { ...updated, _id: groups[index]._id };
    updateGroups(newGroups);
  };

  const handleMove = (from: number, to: number) => {
    const newGroups = [...groups];
    [newGroups[from], newGroups[to]] = [newGroups[to], newGroups[from]];
    updateGroups(newGroups);
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
            {groups.length} 组
          </span>
        </div>
      )}

      {groups.length > 0 ? (
        <Reorder.Group axis="y" values={groups} onReorder={updateGroups} className="flex flex-col gap-2.5">
          {groups.map((group, index) => (
            <GroupCard
              key={group._id ?? index}
              group={group}
              index={index}
              isFirst={index === 0}
              isLast={index === groups.length - 1}
              onUpdate={updated => handleUpdate(index, updated)}
              onRemove={() => handleRemove(index)}
              onMoveUp={() => handleMove(index, index - 1)}
              onMoveDown={() => handleMove(index, index + 1)}
              reorderValue={group}
            />
          ))}
        </Reorder.Group>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/80 bg-background/70 py-8 text-center">
          <p className="text-sm text-muted-foreground">暂无项目分组</p>
          <p className="mt-1 text-xs text-muted-foreground">建议按功能建立 3-6 个分组</p>
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
        添加项目分组
      </button>

      {description && <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}
