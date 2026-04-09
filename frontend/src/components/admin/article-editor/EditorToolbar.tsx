"use client";

import type { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { Tooltip, Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Superscript,
  Subscript,
  Quote,
  Code,
  List,
  ListOrdered,
  ListChecks,
  Link,
  ImageIcon,
  Table,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Palette,
  Undo2,
  Redo2,
  GitBranch,
  Sigma,
  Plus,
  Sparkles,
  ChevronDown,
  Check,
  Coins,
  Lock,
  UserCheck,
  Eye,
  FileCode2,
  CodeXml,
} from "lucide-react";
import { useCallback, useState, useEffect } from "react";
import { MathFormulaDialog } from "./MathFormulaDialog";
import { LinkDialog, ImageDialog } from "./EditorDialogs";

export type EditorMode = "visual" | "html" | "markdown";

interface EditorToolbarProps {
  editor: Editor | null;
  onAIWriting?: () => void;
  editorMode?: EditorMode;
  onModeChange?: (mode: EditorMode) => void;
}

// ===================================
// 工具栏基础组件
// ===================================

/** 工具栏按钮（带 Tooltip） */
function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  title,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={title} size="sm" delay={400} closeDelay={0} placement="bottom">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors",
          "hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed",
          isActive && "bg-secondary text-foreground"
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/** 分割线 */
function Divider() {
  return <div className="w-px h-5 bg-secondary mx-1 shrink-0" />;
}

// ===================================
// 段落/标题下拉选择器
// ===================================

const HEADING_OPTIONS = [
  { key: "paragraph", label: "正文", shortcut: "⌥⌘0", level: 0 },
  { key: "h1", label: "标题1", shortcut: "⌥⌘1", level: 1 },
  { key: "h2", label: "标题2", shortcut: "⌥⌘2", level: 2 },
  { key: "h3", label: "标题3", shortcut: "⌥⌘3", level: 3 },
  { key: "h4", label: "标题4", shortcut: "⌥⌘4", level: 4 },
  { key: "h5", label: "标题5", shortcut: "⌥⌘5", level: 5 },
  { key: "h6", label: "标题6", shortcut: "⌥⌘6", level: 6 },
];

const HEADING_FONT_SIZES: Record<string, string> = {
  paragraph: "text-sm",
  h1: "text-2xl font-bold",
  h2: "text-xl font-bold",
  h3: "text-lg font-bold",
  h4: "text-base font-semibold",
  h5: "text-sm font-semibold",
  h6: "text-sm font-semibold",
};

function HeadingDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);

  // 获取当前激活的标题级别
  const getCurrentLabel = () => {
    for (let i = 1; i <= 6; i++) {
      if (editor.isActive("heading", { level: i })) return `标题${i}`;
    }
    return "正文";
  };

  const handleSelect = (level: number) => {
    if (level === 0) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor
        .chain()
        .focus()
        .toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 })
        .run();
    }
    setOpen(false);
  };

  const currentLabel = getCurrentLabel();

  return (
    <Popover placement="bottom-start" isOpen={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <button
          type="button"
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-border/60 text-sm hover:bg-muted transition-colors min-w-[72px]"
          onClick={() => setOpen(!open)}
        >
          <span className="font-medium">{currentLabel}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-1 min-w-[200px]">
        {HEADING_OPTIONS.map(opt => {
          const isActive =
            opt.level === 0 ? !editor.isActive("heading") : editor.isActive("heading", { level: opt.level });
          return (
            <button
              key={opt.key}
              type="button"
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors",
                isActive ? "bg-muted" : "hover:bg-muted/30"
              )}
              onClick={() => handleSelect(opt.level)}
            >
              <span className={cn("flex items-center gap-2", HEADING_FONT_SIZES[opt.key])}>
                {isActive && <Check className="w-4 h-4 shrink-0" />}
                {!isActive && <span className="w-4 shrink-0" />}
                {opt.label}
              </span>
              <span className="text-xs text-muted-foreground/40 ml-4 shrink-0">{opt.shortcut}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

// ===================================
// 字号下拉选择器
// ===================================

const FONT_SIZES = ["12px", "13px", "14px", "15px", "16px", "18px", "20px", "24px", "28px", "32px"];

function FontSizeDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);

  // 获取当前字号
  const getCurrentSize = (): string => {
    const attrs = editor.getAttributes("textStyle");
    return (attrs.fontSize as string) || "15px";
  };

  const handleSelect = (size: string) => {
    if (size === "15px") {
      // 15px 是默认字号，清除自定义
      (editor.commands as Record<string, (...args: unknown[]) => boolean>).unsetFontSize?.();
    } else {
      (editor.commands as Record<string, (...args: unknown[]) => boolean>).setFontSize?.(size);
    }
    setOpen(false);
  };

  const currentSize = getCurrentSize();

  return (
    <Popover placement="bottom-start" isOpen={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <button
          type="button"
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-border/60 text-sm hover:bg-muted transition-colors min-w-[64px]"
          onClick={() => setOpen(!open)}
        >
          <span className="tabular-nums">{currentSize}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-1 min-w-[100px]">
        {FONT_SIZES.map(size => {
          const isActive = currentSize === size;
          return (
            <button
              key={size}
              type="button"
              className={cn(
                "w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm transition-colors",
                isActive ? "bg-muted font-medium" : "hover:bg-muted/30"
              )}
              onClick={() => handleSelect(size)}
            >
              <span className="tabular-nums">{size}</span>
              {isActive && <Check className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

// ===================================
// 预设颜色
// ===================================

const PRESET_COLORS = [
  "#000000",
  "#434343",
  "#666666",
  "#999999",
  "#cccccc",
  "#d80020",
  "#e38100",
  "#c28b00",
  "#57bd6a",
  "#3e86f6",
  "#7a60d2",
  "#ff7c7c",
  "#ffa940",
  "#fadb14",
  "#73d13d",
  "#40a9ff",
  "#b37feb",
];

const HIGHLIGHT_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#e9d5ff", "#fecaca", "#fed7aa"];

// ===================================
// 主工具栏组件
// ===================================

export function EditorToolbar({ editor, onAIWriting, editorMode = "visual", onModeChange }: EditorToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);

  // 强制工具栏在编辑器状态变化时重新渲染
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const handler = () => forceUpdate(n => n + 1);
    editor.on("transaction", handler);
    return () => {
      editor.off("transaction", handler);
    };
  }, [editor]);

  // 链接对话框
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkCurrentUrl, setLinkCurrentUrl] = useState("");
  const [linkCurrentTarget, setLinkCurrentTarget] = useState<string | null>(null);

  const openLinkDialog = useCallback(() => {
    if (!editor) return;
    const attrs = editor.getAttributes("link");
    setLinkCurrentUrl(attrs.href || "");
    setLinkCurrentTarget(attrs.target ?? null);
    setLinkDialogOpen(true);
  }, [editor]);

  const handleLinkConfirm = useCallback(
    (url: string, target: string) => {
      if (!editor) return;
      if (!url) {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
      } else {
        editor
          .chain()
          .focus()
          .extendMarkRange("link")
          .setLink({ href: url, target, rel: target === "_blank" ? "noopener noreferrer" : null })
          .run();
      }
    },
    [editor]
  );

  const handleLinkRemove = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
  }, [editor]);

  // 图片对话框
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  const handleImageConfirm = useCallback(
    (url: string, alt?: string) => {
      if (!editor) return;
      // 使用 insertContent 以支持 caption 等自定义属性
      // 如果填写了图片描述，同时设置 caption 自动显示描述区域
      editor
        .chain()
        .focus()
        .insertContent({
          type: "image",
          attrs: { src: url, alt: alt || null, caption: alt || null },
        })
        .run();
    },
    [editor]
  );

  const handleInsertTable = useCallback(
    (rows: number, cols: number) => {
      if (!editor) return;
      editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    },
    [editor]
  );

  const insertMermaid = useCallback(() => {
    if (!editor) return;
    (editor.commands as Record<string, (...args: unknown[]) => boolean>).insertMermaidBlock?.();
  }, [editor]);

  // 数学公式对话框
  const [mathDialogOpen, setMathDialogOpen] = useState(false);

  const handleInsertMathBlock = useCallback(
    (latex: string) => {
      if (!editor) return;
      (editor.commands as Record<string, (...args: unknown[]) => boolean>).insertMathBlock?.(latex);
    },
    [editor]
  );

  const handleInsertMathInline = useCallback(
    (latex: string) => {
      if (!editor) return;
      (editor.commands as Record<string, (...args: unknown[]) => boolean>).insertMathInline?.(latex);
    },
    [editor]
  );

  if (!editor) return null;

  const modeSwitcher = onModeChange && (
    <div className="flex items-center bg-muted/60 rounded-lg p-0.5 gap-0.5 shrink-0 ml-auto">
      {([
        { mode: "visual" as const, icon: <Eye className="w-3.5 h-3.5" />, label: "可视化" },
        { mode: "html" as const, icon: <CodeXml className="w-3.5 h-3.5" />, label: "HTML" },
        { mode: "markdown" as const, icon: <FileCode2 className="w-3.5 h-3.5" />, label: "Markdown" },
      ]).map(item => (
        <Tooltip key={item.mode} content={`${item.label}编辑`} size="sm" delay={400} closeDelay={0} placement="bottom">
          <button
            type="button"
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all",
              editorMode === item.mode
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onModeChange(item.mode)}
          >
            {item.icon}
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        </Tooltip>
      ))}
    </div>
  );

  if (editorMode !== "visual") {
    return (
      <div className="flex items-center gap-0.5 px-4 py-2 border-b border-border bg-card shrink-0">
        <span className="text-xs text-muted-foreground mr-2">
          {editorMode === "html" ? "HTML 源码编辑" : "Markdown 源码编辑"}
        </span>
        {modeSwitcher}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 px-4 py-2 border-b border-border bg-card overflow-x-auto shrink-0 scrollbar-hide">
      {/* 撤销/重做 */}
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="撤销">
        <Undo2 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="重做">
        <Redo2 className="w-4 h-4" />
      </ToolbarButton>

      <Divider />

      {/* 段落/标题下拉 */}
      <HeadingDropdown editor={editor} />

      {/* 字号下拉 */}
      <FontSizeDropdown editor={editor} />

      <Divider />

      {/* 文字格式 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="加粗"
      >
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="斜体"
      >
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        title="下划线"
      >
        <Underline className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="删除线"
      >
        <Strikethrough className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
        isActive={editor.isActive("superscript")}
        title="上标"
      >
        <Superscript className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleSubscript().run()}
        isActive={editor.isActive("subscript")}
        title="下标"
      >
        <Subscript className="w-4 h-4" />
      </ToolbarButton>

      <Divider />

      {/* 文字颜色 */}
      <Popover placement="bottom" isOpen={showColorPicker} onOpenChange={setShowColorPicker}>
        <PopoverTrigger>
          <div>
            <ToolbarButton
              onClick={() => {
                setShowColorPicker(!showColorPicker);
                setShowHighlightPicker(false);
              }}
              title="文字颜色"
            >
              <Palette className="w-4 h-4" />
            </ToolbarButton>
          </div>
        </PopoverTrigger>
        <PopoverContent className="p-2">
          <div className="grid grid-cols-6 gap-1.5 w-[180px]">
            {PRESET_COLORS.map(color => (
              <button
                key={color}
                type="button"
                className="w-6 h-6 rounded-md border border-border/50 hover:scale-125 transition-transform cursor-pointer"
                style={{ backgroundColor: color }}
                onClick={() => {
                  editor.chain().focus().setColor(color).run();
                  setShowColorPicker(false);
                }}
              />
            ))}
          </div>
          <button
            type="button"
            className="w-full mt-2 pt-2 border-t border-border text-xs text-muted-foreground hover:text-primary text-center transition-colors"
            onClick={() => {
              editor.chain().focus().unsetColor().run();
              setShowColorPicker(false);
            }}
          >
            清除颜色
          </button>
        </PopoverContent>
      </Popover>

      {/* 高亮色 */}
      <Popover placement="bottom" isOpen={showHighlightPicker} onOpenChange={setShowHighlightPicker}>
        <PopoverTrigger>
          <div>
            <ToolbarButton
              onClick={() => {
                setShowHighlightPicker(!showHighlightPicker);
                setShowColorPicker(false);
              }}
              isActive={editor.isActive("highlight")}
              title="高亮"
            >
              <Highlighter className="w-4 h-4" />
            </ToolbarButton>
          </div>
        </PopoverTrigger>
        <PopoverContent className="p-2">
          <div className="grid grid-cols-6 gap-1.5 w-[180px]">
            {HIGHLIGHT_COLORS.map(color => (
              <button
                key={color}
                type="button"
                className="w-6 h-6 rounded-md border border-border/50 hover:scale-125 transition-transform cursor-pointer"
                style={{ backgroundColor: color }}
                onClick={() => {
                  editor.chain().focus().toggleHighlight({ color }).run();
                  setShowHighlightPicker(false);
                }}
              />
            ))}
          </div>
          <button
            type="button"
            className="w-full mt-2 pt-2 border-t border-border text-xs text-muted-foreground hover:text-primary text-center transition-colors"
            onClick={() => {
              editor.chain().focus().unsetHighlight().run();
              setShowHighlightPicker(false);
            }}
          >
            清除高亮
          </button>
        </PopoverContent>
      </Popover>

      <Divider />

      {/* 对齐 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        isActive={editor.isActive({ textAlign: "left" })}
        title="左对齐"
      >
        <AlignLeft className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        isActive={editor.isActive({ textAlign: "center" })}
        title="居中"
      >
        <AlignCenter className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        isActive={editor.isActive({ textAlign: "right" })}
        title="右对齐"
      >
        <AlignRight className="w-4 h-4" />
      </ToolbarButton>

      <Divider />

      {/* 段落块 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title="引用"
      >
        <Quote className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive("codeBlock")}
        title="代码块"
      >
        <Code className="w-4 h-4" />
      </ToolbarButton>

      <Divider />

      {/* 列表 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="无序列表"
      >
        <List className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="有序列表"
      >
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive("taskList")}
        title="任务列表"
      >
        <ListChecks className="w-4 h-4" />
      </ToolbarButton>

      <Divider />

      {/* 插入 */}
      <ToolbarButton onClick={openLinkDialog} isActive={editor.isActive("link")} title="链接">
        <Link className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => setImageDialogOpen(true)} title="图片">
        <ImageIcon className="w-4 h-4" />
      </ToolbarButton>
      <TableGridPicker onInsert={handleInsertTable} />
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="分割线">
        <Minus className="w-4 h-4" />
      </ToolbarButton>

      <Divider />

      {/* 高级插入 */}
      <ToolbarButton onClick={() => setMathDialogOpen(true)} title="数学公式 (KaTeX)">
        <Sigma className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={insertMermaid} title="Mermaid 图表">
        <GitBranch className="w-4 h-4" />
      </ToolbarButton>

      <Divider />

      {/* 插入块下拉 */}
      <InsertBlockMenu editor={editor} />

      {/* AI 写作 */}
      {onAIWriting && (
        <>
          <Divider />
          <ToolbarButton onClick={onAIWriting} title="AI 写作助手">
            <Sparkles className="w-4 h-4 text-primary" />
          </ToolbarButton>
        </>
      )}

      {/* 模式切换 */}
      {modeSwitcher}

      {/* 对话框 */}
      <MathFormulaDialog
        isOpen={mathDialogOpen}
        onOpenChange={setMathDialogOpen}
        onInsertBlock={handleInsertMathBlock}
        onInsertInline={handleInsertMathInline}
      />
      <LinkDialog
        isOpen={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        currentUrl={linkCurrentUrl}
        currentTarget={linkCurrentTarget}
        onConfirm={handleLinkConfirm}
        onRemove={handleLinkRemove}
      />
      <ImageDialog isOpen={imageDialogOpen} onOpenChange={setImageDialogOpen} onConfirm={handleImageConfirm} />
    </div>
  );
}

// ===================================
// 插入内容块下拉菜单
// ===================================

function InsertBlockMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);

  const cmds = editor.commands as Record<string, (...args: unknown[]) => boolean>;

  const ITEMS = [
    { label: "折叠块", action: () => cmds.insertFoldingBlock?.() },
    { label: "Tab 面板", action: () => cmds.insertTabsBlock?.() },
    { label: "链接卡片", action: () => cmds.insertLinkCard?.() },
    { label: "提示块", action: () => cmds.insertCallout?.() },
    { label: "隐藏内容", action: () => cmds.insertHiddenBlock?.() },
    { label: "音乐播放器", action: () => cmds.insertMusicBlock?.() },
    { label: "按钮", action: () => cmds.insertButton?.() },
    { label: "按钮组", action: () => cmds.insertButtonGroup?.() },
    { label: "图片画廊", action: () => cmds.insertGallery?.() },
    { label: "视频画廊", action: () => cmds.insertVideoGallery?.() },
    { label: "── PRO ──", action: () => {}, separator: true },
    { label: "付费内容", icon: <Coins className="w-4 h-4" />, action: () => cmds.insertPaidContent?.() },
    { label: "密码保护", icon: <Lock className="w-4 h-4" />, action: () => cmds.insertPasswordContent?.() },
    { label: "登录可见", icon: <UserCheck className="w-4 h-4" />, action: () => cmds.insertLoginRequiredContent?.() },
  ] as { label: string; icon?: React.ReactNode; action: () => void; separator?: boolean }[];

  return (
    <Popover placement="bottom" isOpen={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <div>
          <ToolbarButton onClick={() => setOpen(!open)} title="插入内容块">
            <Plus className="w-4 h-4" />
          </ToolbarButton>
        </div>
      </PopoverTrigger>
      <PopoverContent className="p-1 min-w-[140px]">
        {ITEMS.map(item =>
          item.separator ? (
            <div key={item.label} className="px-3 py-1 text-[10px] text-muted-foreground/40 font-medium">
              {item.label}
            </div>
          ) : (
            <button
              key={item.label}
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted rounded transition-colors flex items-center gap-2"
              onClick={() => {
                item.action();
                setOpen(false);
              }}
            >
              {item.icon && <span className="flex-shrink-0 text-muted-foreground">{item.icon}</span>}
              {item.label}
            </button>
          )
        )}
      </PopoverContent>
    </Popover>
  );
}

// ===================================
// 表格网格选择器
// ===================================

const MAX_GRID = 8;

function TableGridPicker({ onInsert }: { onInsert: (rows: number, cols: number) => void }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState({ row: 0, col: 0 });
  const [customRows, setCustomRows] = useState("");
  const [customCols, setCustomCols] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const handleGridClick = (row: number, col: number) => {
    onInsert(row, col);
    setOpen(false);
    setHover({ row: 0, col: 0 });
  };

  const handleCustomInsert = () => {
    const r = parseInt(customRows, 10);
    const c = parseInt(customCols, 10);
    if (r > 0 && c > 0 && r <= 50 && c <= 20) {
      onInsert(r, c);
      setOpen(false);
      setCustomRows("");
      setCustomCols("");
      setShowCustom(false);
    }
  };

  return (
    <Popover
      placement="bottom"
      isOpen={open}
      onOpenChange={v => {
        setOpen(v);
        if (!v) {
          setShowCustom(false);
          setHover({ row: 0, col: 0 });
        }
      }}
    >
      <PopoverTrigger>
        <div>
          <ToolbarButton onClick={() => setOpen(!open)} title="表格">
            <Table className="w-4 h-4" />
          </ToolbarButton>
        </div>
      </PopoverTrigger>
      <PopoverContent className="p-3">
        <div className="text-xs text-muted-foreground mb-2 font-medium">表格</div>
        <div
          className="grid gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${MAX_GRID}, 1fr)` }}
          onMouseLeave={() => setHover({ row: 0, col: 0 })}
        >
          {Array.from({ length: MAX_GRID * MAX_GRID }, (_, i) => {
            const row = Math.floor(i / MAX_GRID) + 1;
            const col = (i % MAX_GRID) + 1;
            const isActive = row <= hover.row && col <= hover.col;
            return (
              <button
                key={i}
                type="button"
                className={`w-5 h-5 rounded-[3px] border transition-colors ${
                  isActive ? "bg-primary/20 border-primary/40" : "bg-muted border-border/60 hover:border-border/80"
                }`}
                onMouseEnter={() => setHover({ row, col })}
                onClick={() => handleGridClick(row, col)}
              />
            );
          })}
        </div>
        <div className="text-xs text-center text-muted-foreground mt-2">
          {hover.row > 0 ? `${hover.row} x ${hover.col}` : "选择行列数"}
        </div>
        {!showCustom ? (
          <button
            type="button"
            className="w-full text-xs text-muted-foreground hover:text-primary text-center mt-2 pt-2 border-t border-border/60 transition-colors"
            onClick={() => setShowCustom(true)}
          >
            自定义行列数...
          </button>
        ) : (
          <div className="mt-2 pt-2 border-t border-border/60 flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={50}
              placeholder="行"
              value={customRows}
              onChange={e => setCustomRows(e.target.value)}
              className="w-14 h-7 px-2 text-xs border border-border/60 rounded-md outline-none focus:border-primary text-center"
            />
            <span className="text-xs text-muted-foreground">x</span>
            <input
              type="number"
              min={1}
              max={20}
              placeholder="列"
              value={customCols}
              onChange={e => setCustomCols(e.target.value)}
              className="w-14 h-7 px-2 text-xs border border-border/60 rounded-md outline-none focus:border-primary text-center"
            />
            <button
              type="button"
              onClick={handleCustomInsert}
              className="h-7 px-3 text-xs bg-primary text-white rounded-md hover:opacity-90 transition-opacity"
            >
              插入
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
