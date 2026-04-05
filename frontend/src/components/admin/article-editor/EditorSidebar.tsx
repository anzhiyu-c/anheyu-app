"use client";

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import { DatePicker } from "@heroui/date-picker";
import { AdminDatePickerLocale } from "@/components/admin/AdminDatePickerLocale";
import { parseAbsoluteToLocal } from "@internationalized/date";
import type { ZonedDateTime } from "@internationalized/date";
import {
  datetimeLocalToRFC3339,
  datetimeLocalAfterHoursFromNow,
  isoStringToDatetimeLocal,
} from "@/lib/datetime-local";
import {
  X,
  Plus,
  ChevronDown,
  Check,
  ImageIcon,
  Search,
  CircleDot,
  FileEdit,
  Clock3,
  Archive,
  Loader2,
  Upload,
  TextQuote,
} from "lucide-react";
import {
  addToast,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Button,
} from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { articleApi } from "@/lib/api/article";
import { postManagementApi } from "@/lib/api/post-management";
import type { Editor } from "@tiptap/react";
import type { ArticleStatus } from "@/types/post-management";
import type { PostCategory, PostTag } from "@/types/article";
import type { ArticleMeta } from "./use-article-meta";
import { clipSummaryPlainText, SUMMARY_AUTO_MAX_CHARS } from "@/lib/article-summary";

// ═══════════════════════════════════════════
// Props & 常量
// ═══════════════════════════════════════════

interface EditorSidebarProps {
  meta: ArticleMeta;
  onUpdateField: <K extends keyof ArticleMeta>(key: K, value: ArticleMeta[K]) => void;
  isAdmin: boolean;
  categories: PostCategory[];
  tags: PostTag[];
  isLoadingCategories?: boolean;
  isLoadingTags?: boolean;
  /** 社区版为 app（仅 1 条摘要）；与 PRO 共用组件时传 pro */
  editorVariant: "app" | "pro";
  getBodyPlainTextForSummary?: () => string;
  getCompleteHtmlForAISummary?: () => string;
}

const STATUS_OPTIONS: {
  key: ArticleStatus;
  label: string;
  icon: ReactNode;
  activeClass: string;
}[] = [
  {
    key: "PUBLISHED",
    label: "发布",
    icon: <CircleDot className="w-3.5 h-3.5" />,
    activeClass: "sb-status-published",
  },
  {
    key: "DRAFT",
    label: "草稿",
    icon: <FileEdit className="w-3.5 h-3.5" />,
    activeClass: "sb-status-draft",
  },
  {
    key: "SCHEDULED",
    label: "定时",
    icon: <Clock3 className="w-3.5 h-3.5" />,
    activeClass: "sb-status-scheduled",
  },
  {
    key: "ARCHIVED",
    label: "归档",
    icon: <Archive className="w-3.5 h-3.5" />,
    activeClass: "sb-status-archived",
  },
];

const QUICK_TIMES = [
  { label: "1小时后", hours: 1 },
  { label: "3小时后", hours: 3 },
  { label: "6小时后", hours: 6 },
  { label: "明天", hours: 24 },
  { label: "后天", hours: 48 },
  { label: "一周后", hours: 168 },
];

/** HeroUI 日期时间选择器：与相册/站点设置一致，替代原生 datetime-local */
function SbDateTimePicker({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: ReactNode;
}) {
  const pickerValue = useMemo(() => {
    const t = value?.trim();
    if (!t) return undefined;
    const rfc = datetimeLocalToRFC3339(t);
    if (!rfc) return undefined;
    try {
      return parseAbsoluteToLocal(rfc);
    } catch {
      return undefined;
    }
  }, [value]);

  return (
    <div className="sb-field">
      <span className="sb-label">{label}</span>
      <AdminDatePickerLocale>
        <DatePicker
          aria-label={label}
          label={undefined}
          granularity="minute"
          hourCycle={24}
          hideTimeZone
          value={pickerValue}
          onChange={(d: ZonedDateTime | null) => {
            if (!d) {
              onChange("");
              return;
            }
            onChange(isoStringToDatetimeLocal(d.toAbsoluteString()));
          }}
          labelPlacement="outside"
          classNames={{
            base: "w-full max-w-full min-w-0",
            inputWrapper:
              "h-9 min-h-9 gap-2 rounded-xl border border-border/70 bg-background/80 px-2 py-0 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-border data-[hover=true]:bg-background data-[focus=true]:border-primary/60 data-[focus=true]:shadow-md",
            innerWrapper: "min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
            input: "text-sm min-w-0",
            segment: "text-sm tabular-nums",
            selectorButton: "h-8 w-8 min-h-8 min-w-8 shrink-0 rounded-lg",
            selectorIcon: "text-muted-foreground",
            popoverContent: "rounded-2xl border border-border/60 shadow-xl",
          }}
        />
      </AdminDatePickerLocale>
      {hint}
    </div>
  );
}

// ═══════════════════════════════════════════
// 原子 UI 组件（纯手写，不依赖任何 UI 库）
// ═══════════════════════════════════════════

/** label/htmlFor 用短 id；非 HTTPS 环境下 crypto.randomUUID 不可用 */
function sbDomId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) {
    return `${prefix}-${uuid.replace(/-/g, "").slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.replace(/[^a-z0-9]/gi, "").slice(0, 12);
}

/** 自定义输入框 */
function SbInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  const [id] = useState(() => sbDomId("sb"));
  return (
    <div className={`sb-field ${className}`}>
      {label && (
        <label htmlFor={id} className="sb-label">
          {label}
        </label>
      )}
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="sb-input"
      />
    </div>
  );
}

/** 摘要等长文本：超过此高度后内部滚动（像素） */
const SUMMARY_TEXTAREA_MAX_HEIGHT_PX = 200;

/** 自定义文本域 */
function SbTextarea({
  value,
  onChange,
  placeholder,
  className = "",
  maxHeightPx,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  /** 设置后高度随内容增长，但不超过该值，超出部分在框内滚动 */
  maxHeightPx?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // 自适应高度（先 auto 再量 scrollHeight）；可选上限 + overflow 滚动
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const minH = 32;
    const natural = Math.max(el.scrollHeight, minH);
    if (maxHeightPx != null && maxHeightPx > 0) {
      const h = Math.min(natural, maxHeightPx);
      el.style.height = `${h}px`;
      el.style.overflowY = natural > maxHeightPx ? "auto" : "hidden";
    } else {
      el.style.height = `${natural}px`;
      el.style.overflowY = "hidden";
    }
  }, [value, maxHeightPx]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      className={`sb-input sb-textarea ${className}`}
    />
  );
}

/** 自定义开关 */
function SbToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="sb-toggle-row"
      onClick={() => onChange(!checked)}
    >
      <div className="min-w-0 flex-1">
        <span className="sb-toggle-label">{label}</span>
        {description && <span className="sb-toggle-desc">{description}</span>}
      </div>
      <span className={`sb-switch ${checked ? "sb-switch-on" : ""}`} aria-hidden>
        <span className="sb-switch-thumb" />
      </span>
    </button>
  );
}

/** 自定义多选下拉 */
function SbMultiSelect({
  label,
  placeholder,
  options,
  selectedIds,
  onChange,
  isLoading,
  onCreate,
  createLabel,
}: {
  label?: string;
  placeholder?: string;
  options: { id: string; name: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  isLoading?: boolean;
  onCreate?: (name: string) => Promise<{ id: string; name: string } | null>;
  createLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [listboxId] = useState(() => sbDomId("sb-ms-l"));

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeDropdown();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, closeDropdown]);

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  const filtered = search ? options.filter(o => o.name.toLowerCase().includes(search.toLowerCase())) : options;

  const selectedNames = selectedIds.map(id => options.find(o => o.id === id)?.name).filter(Boolean);

  // 是否显示「创建」按钮：有 onCreate 回调 + 搜索词不为空 + 搜索词不完全匹配已有选项
  const canCreate =
    onCreate && search.trim() && !options.some(o => o.name.toLowerCase() === search.trim().toLowerCase());

  const handleCreate = async () => {
    if (!onCreate || !search.trim()) return;
    setIsCreating(true);
    try {
      const created = await onCreate(search.trim());
      if (created) {
        onChange([...selectedIds, created.id]);
        setSearch("");
      }
    } catch (err) {
      console.error("创建失败:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const valueLabel = isLoading
    ? "加载中"
    : selectedNames.length > 0
      ? selectedNames.join("、")
      : placeholder || "请选择";
  const triggerAriaLabel = label ? `${label}：${valueLabel}` : valueLabel;

  return (
    <div className="sb-field" ref={containerRef}>
      {label && <span className="sb-label">{label}</span>}
      <button
        type="button"
        className="sb-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={triggerAriaLabel}
        onClick={() => setOpen(!open)}
      >
        {isLoading ? (
          <span className="sb-select-placeholder">
            <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
            加载中...
          </span>
        ) : selectedNames.length > 0 ? (
          <span className="sb-select-value truncate">{selectedNames.join("、")}</span>
        ) : (
          <span className="sb-select-placeholder">{placeholder || "请选择"}</span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="sb-dropdown">
          <div className="sb-dropdown-search">
            <Search className="w-3 h-3 text-(--sb-muted)" aria-hidden />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索..."
              className="sb-dropdown-search-input"
              aria-label="搜索选项"
              aria-controls={listboxId}
              autoFocus
              onKeyDown={e => {
                if (e.key === "Enter" && canCreate) {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
          </div>
          <div
            id={listboxId}
            role="listbox"
            aria-multiselectable="true"
            aria-label={label ?? "选项列表"}
            className="sb-dropdown-list"
          >
            {filtered.length === 0 && !canCreate && (
              <div className="sb-dropdown-empty" role="status">
                无匹配项
              </div>
            )}
            {filtered.map(opt => {
              const isSelected = selectedIds.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`sb-dropdown-item ${isSelected ? "sb-dropdown-item-active" : ""}`}
                  onClick={() => toggle(opt.id)}
                >
                  <span className={`sb-checkbox ${isSelected ? "sb-checkbox-checked" : ""}`} aria-hidden>
                    {isSelected && <Check className="w-2.5 h-2.5" />}
                  </span>
                  <span className="truncate">{opt.name}</span>
                </button>
              );
            })}
          </div>
          {canCreate && (
            <button
              type="button"
              className="sb-dropdown-item sb-dropdown-create"
              onClick={handleCreate}
              disabled={isCreating}
            >
              {isCreating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              <span className="truncate">
                {createLabel || "创建"} &ldquo;{search.trim()}&rdquo;
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** 可折叠分区 */
function SbSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(defaultOpen ? undefined : 0);

  useEffect(() => {
    if (!contentRef.current) return;
    if (open) {
      const h = contentRef.current.scrollHeight;
      setHeight(h);
      // 动画结束后切换到 auto，确保内部变动自动撑开
      const timer = setTimeout(() => setHeight(undefined), 250);
      return () => clearTimeout(timer);
    } else {
      // 先设为当前实际高度，然后下一帧设为 0 触发 CSS 过渡
      setHeight(contentRef.current.scrollHeight);
      requestAnimationFrame(() => setHeight(0));
    }
  }, [open]);

  return (
    <div className="sb-section">
      <button
        type="button"
        className="sb-section-trigger"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="sb-section-title">{title}</span>
        <ChevronDown
          className={`w-3 h-3 text-(--sb-muted) transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      <div
        ref={contentRef}
        className="sb-section-body"
        style={{ height: height !== undefined ? `${height}px` : "auto" }}
      >
        <div className="sb-section-content">{children}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 封面图预览
// ═══════════════════════════════════════════

function CoverPreview({ url }: { url: string }) {
  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!url || hasError) {
    return (
      <div className="sb-cover-empty">
        <ImageIcon className="w-5 h-5" />
        <span>粘贴图片链接预览</span>
      </div>
    );
  }

  return (
    <div className="sb-cover">
      {!loaded && (
        <div className="sb-cover-loading">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="封面预览"
        className={`sb-cover-img ${loaded ? "sb-cover-img-loaded" : ""}`}
        onLoad={() => setLoaded(true)}
        onError={() => setHasError(true)}
      />
    </div>
  );
}

// ═══════════════════════════════════════════
// 已选标签 pill
// ═══════════════════════════════════════════

function TagPill({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <span className="sb-tag">
      {name}
      <button type="button" className="sb-tag-remove" onClick={onRemove} aria-label={`移除标签 ${name}`}>
        <X className="w-2.5 h-2.5" aria-hidden />
      </button>
    </span>
  );
}

// ═══════════════════════════════════════════
// 大纲 (TOC) 组件
// ═══════════════════════════════════════════

interface Heading {
  level: number;
  text: string;
  pos: number;
}

interface TOCNode {
  heading: Heading;
  children: TOCNode[];
}

function extractHeadings(editor: Editor): Heading[] {
  const headings: Heading[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      headings.push({ level: node.attrs.level as number, text: node.textContent, pos });
    }
  });
  return headings;
}

function buildTree(headings: Heading[]): TOCNode[] {
  const root: TOCNode[] = [];
  const stack: { node: TOCNode; level: number }[] = [];
  for (const h of headings) {
    const newNode: TOCNode = { heading: h, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) stack.pop();
    if (stack.length === 0) root.push(newNode);
    else stack[stack.length - 1].node.children.push(newNode);
    stack.push({ node: newNode, level: h.level });
  }
  return root;
}

function TOCTreeNode({
  node,
  onClickPos,
  depth = 0,
}: {
  node: TOCNode;
  onClickPos: (pos: number) => void;
  depth?: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <li className="select-none">
      <div className="flex items-center gap-1 leading-8" style={{ paddingLeft: `${depth * 18}px` }}>
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "展开子大纲" : "收起子大纲"}
            onClick={e => {
              e.stopPropagation();
              setCollapsed(!collapsed);
            }}
            className="w-4 h-4 flex items-center justify-center shrink-0 text-muted-foreground hover:text-muted-foreground transition-colors"
          >
            <span
              className={`text-[9px] leading-none transition-transform duration-150 ${collapsed ? "" : "rotate-90"}`}
              aria-hidden
            >
              ▶
            </span>
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onClickPos(node.heading.pos)}
          className={`flex-1 text-left text-[13px] truncate hover:text-primary transition-colors min-w-0 ${
            depth === 0 ? "font-semibold text-foreground/80" : "text-muted-foreground"
          }`}
          title={node.heading.text || "（空标题）"}
        >
          {node.heading.text || <span className="text-muted-foreground/40 italic">（空标题）</span>}
        </button>
      </div>
      {hasChildren && !collapsed && (
        <ul>
          {node.children.map((child, i) => (
            <TOCTreeNode key={`${child.heading.pos}-${i}`} node={child} onClickPos={onClickPos} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function TOCContent({ editor }: { editor: Editor | null }) {
  const [headings, setHeadings] = useState<Heading[]>([]);

  useEffect(() => {
    if (!editor) return;
    const update = () => setHeadings(extractHeadings(editor));
    update();
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor]);

  const handleClick = useCallback(
    (pos: number) => {
      if (!editor) return;
      editor.chain().focus().setTextSelection(pos).scrollIntoView().run();
    },
    [editor]
  );

  if (!editor) return <p className="text-xs text-muted-foreground/40 py-2">编辑器未就绪</p>;
  if (headings.length === 0) return <p className="text-xs text-muted-foreground/40 py-2">暂无标题</p>;

  const tree = buildTree(headings);
  return (
    <ul>
      {tree.map((node, i) => (
        <TOCTreeNode key={`${node.heading.pos}-${i}`} node={node} onClickPos={handleClick} />
      ))}
    </ul>
  );
}

// ═══════════════════════════════════════════
// 文章设置主内容
// ═══════════════════════════════════════════

interface SettingsContentProps {
  meta: ArticleMeta;
  onUpdateField: EditorSidebarProps["onUpdateField"];
  isAdmin: boolean;
  categories: PostCategory[];
  tags: PostTag[];
  isLoadingCategories?: boolean;
  isLoadingTags?: boolean;
  editorVariant: EditorSidebarProps["editorVariant"];
  getBodyPlainTextForSummary?: EditorSidebarProps["getBodyPlainTextForSummary"];
}

function SettingsContent({
  meta,
  onUpdateField,
  isAdmin,
  categories,
  tags,
  isLoadingCategories,
  isLoadingTags,
  editorVariant,
  getBodyPlainTextForSummary,
}: SettingsContentProps) {
  const queryClient = useQueryClient();
  const topImgInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingTopImg, setIsUploadingTopImg] = useState(false);
  const coverImgInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [fillSummaryDialogOpen, setFillSummaryDialogOpen] = useState(false);
  const [pendingSummaryClip, setPendingSummaryClip] = useState<string | null>(null);

  const maxSummarySlots = editorVariant === "pro" ? 3 : 1;

  const confirmFillSummaryOverwrite = useCallback(() => {
    const clip = pendingSummaryClip;
    setFillSummaryDialogOpen(false);
    setPendingSummaryClip(null);
    if (!clip) return;
    if (editorVariant === "app") {
      onUpdateField("summaries", [clip]);
      return;
    }
    onUpdateField(
      "summaries",
      [clip, ...meta.summaries.slice(1, maxSummarySlots)].slice(0, maxSummarySlots)
    );
  }, [pendingSummaryClip, editorVariant, onUpdateField, meta.summaries, maxSummarySlots]);

  const handleFillSummaryFromBody = useCallback(() => {
    const raw = getBodyPlainTextForSummary?.() ?? "";
    const clip = clipSummaryPlainText(raw, SUMMARY_AUTO_MAX_CHARS);
    if (!clip) {
      addToast({ title: "正文中没有可用文字", color: "warning" });
      return;
    }
    if (editorVariant === "app") {
      if (meta.summaries[0]?.trim()) {
        setPendingSummaryClip(clip);
        setFillSummaryDialogOpen(true);
        return;
      }
      onUpdateField("summaries", [clip]);
      return;
    }
    const arr = [...meta.summaries];
    const emptyIdx = arr.findIndex(s => !s.trim());
    if (emptyIdx >= 0) {
      arr[emptyIdx] = clip;
      onUpdateField("summaries", arr.slice(0, maxSummarySlots));
      return;
    }
    if (arr.length < maxSummarySlots) {
      onUpdateField("summaries", [...arr, clip]);
      return;
    }
    setPendingSummaryClip(clip);
    setFillSummaryDialogOpen(true);
  }, [editorVariant, getBodyPlainTextForSummary, maxSummarySlots, meta.summaries, onUpdateField]);

  // 创建分类
  const handleCreateCategory = useCallback(
    async (name: string) => {
      const created = await articleApi.createCategory({ name });
      queryClient.invalidateQueries({ queryKey: ["post-categories"] });
      return created;
    },
    [queryClient]
  );

  // 创建标签
  const handleCreateTag = useCallback(
    async (name: string) => {
      const created = await articleApi.createTag({ name });
      queryClient.invalidateQueries({ queryKey: ["post-tags"] });
      return created;
    },
    [queryClient]
  );

  // 上传顶部大图
  const handleTopImgUpload = useCallback(
    async (file: File) => {
      setIsUploadingTopImg(true);
      try {
        const url = await postManagementApi.uploadArticleImage(file);
        onUpdateField("top_img_url", url);
      } catch (err) {
        console.error("顶部大图上传失败:", err);
      } finally {
        setIsUploadingTopImg(false);
      }
    },
    [onUpdateField]
  );

  // 上传封面图
  const handleCoverUpload = useCallback(
    async (file: File) => {
      setIsUploadingCover(true);
      try {
        const url = await postManagementApi.uploadArticleImage(file);
        onUpdateField("cover_url", url);
      } catch (err) {
        console.error("封面图上传失败:", err);
      } finally {
        setIsUploadingCover(false);
      }
    },
    [onUpdateField]
  );

  return (
    <>
      <div className="sb-body">
      {/* ── 状态选择器 ── */}
      <div className="sb-status-bar" role="radiogroup" aria-label="文章状态">
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={meta.status === opt.key}
            onClick={() => onUpdateField("status", opt.key)}
            className={`sb-status-item ${meta.status === opt.key ? opt.activeClass : ""}`}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        ))}
      </div>

      {meta.status !== "SCHEDULED" && (
        <SbSection title="发布时间" defaultOpen>
          <SbDateTimePicker
            label="自定义发布日期"
            value={meta.custom_published_at}
            onChange={v => onUpdateField("custom_published_at", v)}
            hint={
              <p className="text-[11px] text-muted-foreground mt-1.5 mb-0 leading-snug px-0.5">
                用于前台列表、归档与排序的发布日期（对应文章创建时间）。留空则使用保存时的当前时间。
              </p>
            }
          />
        </SbSection>
      )}

      {/* ── 基础设置 ── */}
      <SbSection title="基础" defaultOpen>
        <SbMultiSelect
          label="分类"
          placeholder="选择分类"
          options={categories}
          selectedIds={meta.post_category_ids}
          onChange={ids => onUpdateField("post_category_ids", ids)}
          isLoading={isLoadingCategories}
          onCreate={handleCreateCategory}
          createLabel="新建分类"
        />

        <SbMultiSelect
          label="标签"
          placeholder="选择标签"
          options={tags}
          selectedIds={meta.post_tag_ids}
          onChange={ids => onUpdateField("post_tag_ids", ids)}
          isLoading={isLoadingTags}
          onCreate={handleCreateTag}
          createLabel="新建标签"
        />
        {meta.post_tag_ids.length > 0 && (
          <div className="sb-tags-wrap">
            {meta.post_tag_ids.map(id => {
              const tag = tags.find(t => t.id === id);
              return tag ? (
                <TagPill
                  key={id}
                  name={tag.name}
                  onRemove={() =>
                    onUpdateField(
                      "post_tag_ids",
                      meta.post_tag_ids.filter(tid => tid !== id)
                    )
                  }
                />
              ) : null;
            })}
          </div>
        )}

        {/* 封面 */}
        <div className="sb-field">
          <span className="sb-label">封面图</span>
          <CoverPreview key={meta.cover_url || "cover-empty"} url={meta.cover_url} />
          <div className="flex gap-1.5 mt-1.5">
            <input
              type="text"
              value={meta.cover_url}
              onChange={e => onUpdateField("cover_url", e.target.value)}
              placeholder="https://..."
              className="sb-input flex-1"
            />
            <button
              type="button"
              className="sb-upload-btn"
              onClick={() => coverImgInputRef.current?.click()}
              disabled={isUploadingCover}
              title="上传封面图"
            >
              {isUploadingCover ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            </button>
            <input
              ref={coverImgInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleCoverUpload(file);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {/* 顶部大图 */}
        <div className="sb-field">
          <span className="sb-label">顶部大图</span>
          <CoverPreview key={meta.top_img_url || "topimg-empty"} url={meta.top_img_url} />
          <div className="flex gap-1.5 mt-1.5">
            <input
              type="text"
              value={meta.top_img_url}
              onChange={e => onUpdateField("top_img_url", e.target.value)}
              placeholder="https://..."
              className="sb-input flex-1"
            />
            <button
              type="button"
              className="sb-upload-btn"
              onClick={() => topImgInputRef.current?.click()}
              disabled={isUploadingTopImg}
              title="上传顶部大图"
            >
              {isUploadingTopImg ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
            </button>
            <input
              ref={topImgInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleTopImgUpload(file);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <SbToggle
          label="转载文章"
          description="开启后显示版权来源"
          checked={meta.is_reprint}
          onChange={v => onUpdateField("is_reprint", v)}
        />
      </SbSection>

      {/* ── 摘要 & SEO ── */}
      <SbSection title="摘要 & SEO" defaultOpen>
        <div className="sb-field">
          <span className="sb-label">摘要</span>
          <p className="text-[11px] text-muted-foreground leading-snug mb-1.5">
            可手动填写，或使用下方工具从正文取前 {SUMMARY_AUTO_MAX_CHARS} 字。
            {editorVariant === "pro"
              ? " PRO 最多 3 条，前台随机展示其中一条，读者可切换。"
              : " 社区版仅保存 1 条。"}
          </p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            <button type="button" className="sb-add-btn py-1! px-2! text-[11px]" onClick={handleFillSummaryFromBody}>
              <TextQuote className="w-3 h-3 shrink-0" />
              取自正文前{SUMMARY_AUTO_MAX_CHARS}字
            </button>
          </div>
          <div className="space-y-1.5">
            {editorVariant === "app" ? (
              <SbTextarea
                value={meta.summaries[0] ?? ""}
                onChange={v => onUpdateField("summaries", v.trim() ? [v] : [])}
                placeholder="文章摘要（可选）"
                className="flex-1"
                maxHeightPx={SUMMARY_TEXTAREA_MAX_HEIGHT_PX}
              />
            ) : (
              <>
                {meta.summaries.map((s, i) => (
                  <div key={i} className="group flex gap-1 items-start">
                    <SbTextarea
                      value={s}
                      onChange={v => {
                        const arr = [...meta.summaries];
                        arr[i] = v;
                        onUpdateField("summaries", arr);
                      }}
                      placeholder={`摘要 ${i + 1}`}
                      className="flex-1"
                      maxHeightPx={SUMMARY_TEXTAREA_MAX_HEIGHT_PX}
                    />
                    <button
                      type="button"
                      className="sb-icon-btn opacity-0 group-hover:opacity-100 mt-1.5"
                      onClick={() => onUpdateField("summaries", meta.summaries.filter((_, j) => j !== i))}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {meta.summaries.length < maxSummarySlots && (
                  <button
                    type="button"
                    className="sb-add-btn"
                    onClick={() => onUpdateField("summaries", [...meta.summaries, ""])}
                  >
                    <Plus className="w-3 h-3" />
                    添加摘要
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <SbInput
          label="关键词"
          value={meta.keywords}
          onChange={v => onUpdateField("keywords", v)}
          placeholder="用英文逗号分隔"
        />
        <SbInput
          label="永久链接"
          value={meta.abbrlink}
          onChange={v => onUpdateField("abbrlink", v)}
          placeholder="自动生成或手动输入"
        />
      </SbSection>

      {/* ── 显示 ── */}
      <SbSection title="显示">
        <SbToggle
          label="首页展示"
          description="在首页文章列表中可见"
          checked={meta.show_on_home}
          onChange={v => onUpdateField("show_on_home", v)}
        />
        <div className="grid grid-cols-2 gap-2">
          <SbInput
            label="首页排序"
            value={String(meta.home_sort)}
            onChange={v => onUpdateField("home_sort", Number(v) || 0)}
            type="number"
          />
          <SbInput
            label="置顶排序"
            value={String(meta.pin_sort)}
            onChange={v => onUpdateField("pin_sort", Number(v) || 0)}
            type="number"
          />
        </div>

        <SbToggle
          label="手动主色调"
          description="覆盖从封面自动提取的颜色"
          checked={meta.is_primary_color_manual}
          onChange={v => onUpdateField("is_primary_color_manual", v)}
        />
        {meta.is_primary_color_manual && (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={meta.primary_color || "#4259ef"}
              onChange={e => onUpdateField("primary_color", e.target.value)}
              className="sb-color-input"
            />
            <input
              type="text"
              value={meta.primary_color}
              onChange={e => onUpdateField("primary_color", e.target.value)}
              placeholder="#4259ef"
              className="sb-input flex-1"
            />
          </div>
        )}
      </SbSection>

      {/* ── 版权（仅转载时） ── */}
      {meta.is_reprint && (
        <SbSection title="版权" defaultOpen>
          <SbInput label="原作者" value={meta.copyright_author} onChange={v => onUpdateField("copyright_author", v)} />
          <SbInput
            label="作者链接"
            value={meta.copyright_author_href}
            onChange={v => onUpdateField("copyright_author_href", v)}
            placeholder="https://..."
          />
          <SbInput
            label="原文链接"
            value={meta.copyright_url}
            onChange={v => onUpdateField("copyright_url", v)}
            placeholder="https://..."
          />
        </SbSection>
      )}

      {/* ── 高级 ── */}
      <SbSection title="高级">
        <SbInput
          label="IP 属地"
          value={meta.ip_location}
          onChange={v => onUpdateField("ip_location", v)}
          placeholder="自动获取或手动填写"
        />
        {isAdmin && (
          <div className="sb-field">
            <span className="sb-label">单文章自定义 JS</span>
            <textarea
              value={meta.custom_js}
              onChange={e => onUpdateField("custom_js", e.target.value)}
              placeholder="仅管理员可用。填写后会在该文章详情页执行。"
              className="sb-input sb-textarea min-h-[120px] font-mono text-xs leading-relaxed"
            />
          </div>
        )}
        <SbToggle
          label="文档模式"
          description="作为系列文档的一部分"
          checked={meta.is_doc}
          onChange={v => onUpdateField("is_doc", v)}
        />
        {meta.is_doc && (
          <div className="sb-sub-group">
            <SbInput label="系列 ID" value={meta.doc_series_id} onChange={v => onUpdateField("doc_series_id", v)} />
            <SbInput
              label="文档排序"
              value={String(meta.doc_sort)}
              onChange={v => onUpdateField("doc_sort", Number(v) || 0)}
              type="number"
            />
          </div>
        )}
      </SbSection>

      {/* ── 定时发布（仅定时状态时） ── */}
      {meta.status === "SCHEDULED" && (
        <SbSection title="定时发布" defaultOpen>
          <SbDateTimePicker
            label="计划发布时间"
            value={meta.scheduled_at}
            onChange={v => onUpdateField("scheduled_at", v)}
          />
          <div className="sb-field">
            <span className="sb-label">快捷设定</span>
            <div className="sb-quick-times">
              {QUICK_TIMES.map(qt => (
                <button
                  key={qt.label}
                  type="button"
                  className="sb-quick-btn"
                  onClick={() => onUpdateField("scheduled_at", datetimeLocalAfterHoursFromNow(qt.hours))}
                >
                  {qt.label}
                </button>
              ))}
            </div>
          </div>
        </SbSection>
      )}
      </div>

      <Modal
        isOpen={fillSummaryDialogOpen}
        onOpenChange={open => {
          setFillSummaryDialogOpen(open);
          if (!open) setPendingSummaryClip(null);
        }}
        placement="center"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">覆盖摘要？</ModalHeader>
          <ModalBody className="text-sm text-default-600">
            {editorVariant === "app" ? (
              <p className="m-0">当前已有摘要，确定要用正文前 {SUMMARY_AUTO_MAX_CHARS} 字覆盖吗？</p>
            ) : (
              <p className="m-0">
                当前 {maxSummarySlots} 条摘要均已填写，确定要用正文前 {SUMMARY_AUTO_MAX_CHARS}{" "}
                字替换第一条吗？
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setFillSummaryDialogOpen(false)}>
              取消
            </Button>
            <Button color="primary" onPress={confirmFillSummaryOverwrite}>
              确定覆盖
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

// ═══════════════════════════════════════════
// EditorSidebar 主入口
// ═══════════════════════════════════════════

export function EditorSidebar({
  meta,
  onUpdateField,
  isAdmin,
  categories,
  tags,
  isLoadingCategories,
  isLoadingTags,
  editorVariant,
  getBodyPlainTextForSummary,
}: EditorSidebarProps) {
  return (
    <div className="sb-root">
      <div className="sb-header">
        <span>文章设置</span>
      </div>
      <div className="sb-scroll">
        <SettingsContent
          meta={meta}
          onUpdateField={onUpdateField}
          isAdmin={isAdmin}
          categories={categories}
          tags={tags}
          isLoadingCategories={isLoadingCategories}
          isLoadingTags={isLoadingTags}
          editorVariant={editorVariant}
          getBodyPlainTextForSummary={getBodyPlainTextForSummary}
        />
      </div>
    </div>
  );
}
