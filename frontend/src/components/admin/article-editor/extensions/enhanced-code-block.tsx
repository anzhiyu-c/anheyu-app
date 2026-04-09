/**
 * EnhancedCodeBlock 扩展
 * 基于 CodeBlockLowlight，添加 React NodeView：
 * - 标题输入 + 语言选择 + 复制 + 设置面板
 * - 展开/折叠箭头
 * - 行号列（带背景，可开关）
 * - 超过 N 行时折叠/展开
 * - 兼容 anheyu-app 后端 details.md-editor-code 格式
 */
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { useState, useCallback, useMemo, useRef, useEffect, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Copy, Check, ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react";
import { useSiteConfigStore } from "@/store/site-config-store";

/** 超过此行数时默认折叠 */
const COLLAPSE_THRESHOLD = 15;

/** 支持的编程语言列表 */
const LANGUAGES = [
  "plaintext",
  "javascript",
  "typescript",
  "vue",
  "python",
  "go",
  "rust",
  "java",
  "c",
  "cpp",
  "csharp",
  "html",
  "css",
  "scss",
  "json",
  "yaml",
  "markdown",
  "bash",
  "shell",
  "sql",
  "graphql",
  "xml",
  "php",
  "ruby",
  "swift",
  "kotlin",
  "dart",
  "lua",
  "r",
];

const CODE_FONT_SIZES = [
  { label: "跟随正文", value: "" },
  { label: "12px", value: "12px" },
  { label: "13px", value: "13px" },
  { label: "14px", value: "14px" },
  { label: "15px", value: "15px" },
  { label: "16px", value: "16px" },
  { label: "19px", value: "19px" },
  { label: "22px", value: "22px" },
];

const INDENT_MODES = [
  { label: "Tab", value: "tab" },
  { label: "Space", value: "space" },
];

const INDENT_WIDTHS = [
  { label: "2", value: "2" },
  { label: "4", value: "4" },
  { label: "8", value: "8" },
];

// ---- 设置面板（Portal 渲染，不受 overflow 限制） ----
function SettingsPanel({
  anchorRef,
  showLineNumbers,
  wordWrap,
  codeFontSize,
  indentMode,
  indentWidth,
  onToggleLineNumbers,
  onToggleWordWrap,
  onChangeFontSize,
  onChangeIndentMode,
  onChangeIndentWidth,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  showLineNumbers: boolean;
  wordWrap: boolean;
  codeFontSize: string;
  indentMode: string;
  indentWidth: string;
  onToggleLineNumbers: () => void;
  onToggleWordWrap: () => void;
  onChangeFontSize: (v: string) => void;
  onChangeIndentMode: (v: string) => void;
  onChangeIndentWidth: (v: string) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // 同步计算位置（避免从 0,0 闪烁）
  const getPos = () => {
    if (!anchorRef.current) return { top: -9999, left: -9999 };
    const rect = anchorRef.current.getBoundingClientRect();
    const menuWidth = 248;
    let left = rect.right - menuWidth;
    if (left < 8) left = 8;
    return { top: rect.bottom + 6, left };
  };

  const [pos, setPos] = useState(getPos);

  const handleSubEnter = (key: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenSub(key);
  };
  const handleSubLeave = () => {
    closeTimer.current = setTimeout(() => setOpenSub(null), 150);
  };

  // 滚动/resize 时更新位置
  useEffect(() => {
    const update = () => setPos(getPos());
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 点击外部关闭（排除设置按钮本身，避免与 toggle 冲突）
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, anchorRef]);

  const panel = (
    <div
      ref={menuRef}
      className="editor-code-settings-menu ecsm-enter"
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
    >
      {/* 字号 */}
      <div
        className="ecsm-item ecsm-has-sub"
        onMouseEnter={() => handleSubEnter("fontSize")}
        onMouseLeave={handleSubLeave}
      >
        <span>字号</span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        {openSub === "fontSize" && (
          <div className="ecsm-submenu" onMouseEnter={() => handleSubEnter("fontSize")} onMouseLeave={handleSubLeave}>
            {CODE_FONT_SIZES.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`ecsm-item ${codeFontSize === opt.value ? "is-active" : ""}`}
                onMouseDown={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChangeFontSize(opt.value);
                }}
              >
                {codeFontSize === opt.value && <Check className="w-3.5 h-3.5 shrink-0" />}
                {codeFontSize !== opt.value && <span className="w-3.5 shrink-0" />}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 缩进模式 */}
      <div
        className="ecsm-item ecsm-has-sub"
        onMouseEnter={() => handleSubEnter("indentMode")}
        onMouseLeave={handleSubLeave}
      >
        <span>缩进模式</span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        {openSub === "indentMode" && (
          <div className="ecsm-submenu" onMouseEnter={() => handleSubEnter("indentMode")} onMouseLeave={handleSubLeave}>
            {INDENT_MODES.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`ecsm-item ${indentMode === opt.value ? "is-active" : ""}`}
                onMouseDown={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChangeIndentMode(opt.value);
                }}
              >
                {indentMode === opt.value && <Check className="w-3.5 h-3.5 shrink-0" />}
                {indentMode !== opt.value && <span className="w-3.5 shrink-0" />}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 缩进宽度 */}
      <div
        className="ecsm-item ecsm-has-sub"
        onMouseEnter={() => handleSubEnter("indentWidth")}
        onMouseLeave={handleSubLeave}
      >
        <span>缩进宽度</span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        {openSub === "indentWidth" && (
          <div
            className="ecsm-submenu"
            onMouseEnter={() => handleSubEnter("indentWidth")}
            onMouseLeave={handleSubLeave}
          >
            {INDENT_WIDTHS.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`ecsm-item ${indentWidth === opt.value ? "is-active" : ""}`}
                onMouseDown={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChangeIndentWidth(opt.value);
                }}
              >
                {indentWidth === opt.value && <Check className="w-3.5 h-3.5 shrink-0" />}
                {indentWidth !== opt.value && <span className="w-3.5 shrink-0" />}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ecsm-divider" />

      {/* 自动换行 */}
      <div
        className="ecsm-item"
        onMouseDown={e => {
          e.preventDefault();
          e.stopPropagation();
          onToggleWordWrap();
        }}
      >
        <span>自动换行</span>
        <div className={`ecsm-toggle ${wordWrap ? "is-on" : ""}`}>
          <div className="ecsm-toggle-thumb" />
        </div>
      </div>

      {/* 行号 */}
      <div
        className="ecsm-item"
        onMouseDown={e => {
          e.preventDefault();
          e.stopPropagation();
          onToggleLineNumbers();
        }}
      >
        <span>行号</span>
        <div className={`ecsm-toggle ${showLineNumbers ? "is-on" : ""}`}>
          <div className="ecsm-toggle-thumb" />
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}

// ---- 语言下拉选择器（Portal 渲染） ----
function LangDropdown({
  language,
  anchorRef,
  onSelect,
  onClose,
}: {
  language: string;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onSelect: (lang: string) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const [pos, setPos] = useState({ top: -9999, left: -9999 });
  const [posReady, setPosReady] = useState(false);

  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
      setPosReady(true);
    }
    setTimeout(() => searchRef.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, anchorRef]);

  const filtered = search ? LANGUAGES.filter(l => l.toLowerCase().includes(search.toLowerCase())) : LANGUAGES;

  if (!posReady) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="editor-code-settings-menu ecsm-enter"
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, minWidth: 160, maxHeight: 320 }}
    >
      <div className="ecsm-search">
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索语言..."
          className="ecsm-search-input"
        />
      </div>
      <div className="ecsm-lang-list">
        {filtered.map(lang => (
          <button
            key={lang}
            type="button"
            className={`ecsm-item ${language === lang ? "is-active" : ""}`}
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(lang);
            }}
          >
            {language === lang && <Check className="w-3.5 h-3.5 shrink-0" />}
            {language !== lang && <span className="w-3.5 shrink-0" />}
            <span>{lang.charAt(0).toUpperCase() + lang.slice(1)}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="ecsm-item" style={{ color: "#999", cursor: "default" }}>
            无匹配语言
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ---- React NodeView 组件 ----
function EnhancedCodeBlockView({ node, updateAttributes }: NodeViewProps) {
  const [copied, setCopied] = useState(false);
  const [isCollapsible, setIsCollapsible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const open = node.attrs.isOpen !== false;
  const collapsed = node.attrs.isCollapsed === true;
  const [titleEditing, setTitleEditing] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const langBtnRef = useRef<HTMLButtonElement>(null);

  const siteConfig = useSiteConfigStore(state => state.siteConfig);
  const macStyle = siteConfig?.post?.code_block?.mac_style !== false;

  const language = (node.attrs.language as string) || "plaintext";
  const title = (node.attrs.title as string) || "";
  const showLineNumbers = node.attrs.showLineNumbers !== false;
  const wordWrap = node.attrs.wordWrap === true;
  const codeFontSize = (node.attrs.codeFontSize as string) || "";
  const indentMode = (node.attrs.indentMode as string) || "space";
  const indentWidth = (node.attrs.indentWidth as string) || "2";

  const lineCount = useMemo(() => {
    const text = node.textContent || "";
    if (!text) return 1;
    return text.split("\n").length + 1;
  }, [node.textContent]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(node.textContent || "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [node.textContent]);

  // 当行数超过阈值时标记为可折叠（但不自动折叠，避免打断编辑）
  const isCollapsibleNow = lineCount > COLLAPSE_THRESHOLD;
  if (isCollapsibleNow && !isCollapsible) {
    setIsCollapsible(true);
  }

  const codeStyle = useMemo(() => {
    const s: React.CSSProperties = {};
    if (codeFontSize) s.fontSize = codeFontSize;
    if (wordWrap) {
      s.whiteSpace = "pre-wrap";
      s.wordBreak = "break-all";
    }
    if (indentWidth) s.tabSize = parseInt(indentWidth, 10);
    return s;
  }, [codeFontSize, wordWrap, indentWidth]);

  const lineNumStyle = useMemo(() => {
    const s: React.CSSProperties = {};
    if (codeFontSize) s.fontSize = codeFontSize;
    return s;
  }, [codeFontSize]);

  return (
    <NodeViewWrapper className="enhanced-code-block-wrapper my-4">
      <div className="enhanced-code-block-active editor-code-block relative group">
        {/* 头部 */}
        <div className="editor-code-head" contentEditable={false}>
          {/* 左侧：折叠箭头 + 标题 */}
          <button
            type="button"
            onClick={() => updateAttributes({ isOpen: !open })}
            className={`editor-code-expand ${open ? "is-open" : ""}`}
          >
            <ChevronDown className="w-4 h-4" />
          </button>

          {macStyle && (
            <span className="editor-code-mac-dots" contentEditable={false}>
              <span className="mac-dot red" />
              <span className="mac-dot yellow" />
              <span className="mac-dot green" />
            </span>
          )}

          {titleEditing ? (
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={e => updateAttributes({ title: e.target.value })}
              onBlur={() => setTitleEditing(false)}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === "Enter" || e.key === "Escape") setTitleEditing(false);
              }}
              onClick={e => e.stopPropagation()}
              placeholder="输入代码标题..."
              className="editor-code-title is-editing"
              autoFocus
            />
          ) : (
            <button
              type="button"
              className={`editor-code-title-label ${title ? "" : "is-empty"}`}
              onClick={e => {
                e.stopPropagation();
                setTitleEditing(true);
              }}
              title="点击编辑标题"
            >
              {title || language.toUpperCase()}
            </button>
          )}

          {/* 弹性空间 */}
          <div className="flex-1" />

          {/* 右侧：语言 | 复制 | 设置 */}
          <div className="editor-code-head-right">
            {/* 语言下拉（自定义） */}
            <div className="relative">
              <button
                ref={langBtnRef}
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setLangDropdownOpen(prev => !prev);
                }}
                className="editor-code-lang-btn"
              >
                <span>{language.charAt(0).toUpperCase() + language.slice(1)}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {langDropdownOpen && (
                <LangDropdown
                  language={language}
                  anchorRef={langBtnRef}
                  onSelect={v => {
                    updateAttributes({ language: v });
                    setLangDropdownOpen(false);
                  }}
                  onClose={() => setLangDropdownOpen(false)}
                />
              )}
            </div>

            <div className="editor-code-head-divider" />

            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                handleCopy();
              }}
              className={`editor-code-copy ${copied ? "is-copied" : ""}`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              ref={settingsBtnRef}
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                e.stopPropagation();
                setSettingsOpen(prev => !prev);
              }}
              className="editor-code-copy"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 设置面板（Portal 渲染） */}
        {settingsOpen && (
          <SettingsPanel
            anchorRef={settingsBtnRef}
            showLineNumbers={showLineNumbers}
            wordWrap={wordWrap}
            codeFontSize={codeFontSize}
            indentMode={indentMode}
            indentWidth={indentWidth}
            onToggleLineNumbers={() => updateAttributes({ showLineNumbers: !showLineNumbers })}
            onToggleWordWrap={() => updateAttributes({ wordWrap: !wordWrap })}
            onChangeFontSize={v => updateAttributes({ codeFontSize: v })}
            onChangeIndentMode={v => updateAttributes({ indentMode: v })}
            onChangeIndentWidth={v => updateAttributes({ indentWidth: v })}
            onClose={() => setSettingsOpen(false)}
          />
        )}

        {/* 代码内容区 - NodeViewContent 必须始终挂载，否则 ProseMirror 会丢失内容 */}
        <div className={`editor-code-body ${collapsed ? "is-collapsed" : ""}`} style={open ? undefined : { display: "none" }}>
          <div className="editor-code-content-row">
            {showLineNumbers && (
              <div
                className="editor-code-line-numbers"
                contentEditable={false}
                aria-hidden="true"
                style={lineNumStyle}
              >
                {Array.from({ length: lineCount }, (_, i) => (
                  <span key={i}>{i + 1}</span>
                ))}
              </div>
            )}
            <div className="editor-code-pre-wrapper" style={codeStyle}>
              <NodeViewContent />
            </div>
          </div>

          {collapsed && (
              <button
                type="button"
                onClick={() => updateAttributes({ isCollapsed: false })}
                className="editor-code-expand-btn"
                contentEditable={false}
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            )}
          </div>

        {open && !collapsed && isCollapsible && (
          <button
            type="button"
            onClick={() => updateAttributes({ isCollapsed: true })}
            className="editor-code-collapse-trigger"
            contentEditable={false}
          >
            <ChevronDown className="w-4 h-4 rotate-180" />
          </button>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// ---- 扩展创建函数 ----
export function createEnhancedCodeBlock(lowlight: unknown) {
  return CodeBlockLowlight.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        title: {
          default: "",
          parseHTML: (element: HTMLElement) => {
            const langEl = element.querySelector(".code-lang");
            return langEl?.textContent || element.getAttribute("data-title") || "";
          },
          renderHTML: (attributes: Record<string, unknown>) => {
            if (!attributes.title) return {};
            return { "data-title": attributes.title };
          },
        },
        showLineNumbers: { default: true, parseHTML: () => true, renderHTML: () => ({}) },
        wordWrap: { default: false, parseHTML: () => false, renderHTML: () => ({}) },
        codeFontSize: { default: "", parseHTML: () => "", renderHTML: () => ({}) },
        indentMode: { default: "space", parseHTML: () => "space", renderHTML: () => ({}) },
        indentWidth: { default: "2", parseHTML: () => "2", renderHTML: () => ({}) },
        isOpen: {
          default: true,
          parseHTML: (element: HTMLElement) => {
            if (element.tagName === "DETAILS") return element.hasAttribute("open");
            const val = element.getAttribute("data-open");
            return val !== "false";
          },
          renderHTML: (attributes: Record<string, unknown>) => {
            if (attributes.isOpen === false) return { "data-open": "false" };
            return {};
          },
        },
        isCollapsed: {
          default: false,
          parseHTML: (element: HTMLElement) => {
            return element.getAttribute("data-collapsed") === "true" || element.classList.contains("is-collapsed");
          },
          renderHTML: (attributes: Record<string, unknown>) => {
            if (attributes.isCollapsed) return { "data-collapsed": "true" };
            return {};
          },
        },
      };
    },
    parseHTML() {
      return [
        {
          tag: "pre",
          preserveWhitespace: "full" as const,
          getAttrs: (element: HTMLElement) => {
            const code = element.querySelector("code");
            if (!code) return {};
            if (code.classList.contains("language-mermaid")) return false;
            const langMatch = code.className.match(/language-(\w+)/);
            return {
              language: langMatch ? langMatch[1] : null,
              isOpen: element.getAttribute("data-open") !== "false",
              isCollapsed: element.getAttribute("data-collapsed") === "true",
            };
          },
        },
        {
          tag: "details.md-editor-code",
          preserveWhitespace: "full" as const,
          contentElement: "pre",
          getAttrs: (element: HTMLElement) => {
            const code = element.querySelector("code");
            if (!code) return false;
            const langMatch = code.className.match(/language-(\w+)/);
            const langEl = element.querySelector(".code-lang");
            return {
              language: langMatch ? langMatch[1] : null,
              title: langEl?.textContent || "",
              isOpen: element.hasAttribute("open"),
              isCollapsed: element.getAttribute("data-collapsed") === "true",
            };
          },
        },
      ];
    },
    addKeyboardShortcuts() {
      return {
        ...this.parent?.(),
        "Mod-a": ({ editor }) => {
          const { state } = editor;
          const { $from, from: selFrom, to: selTo } = state.selection;

          if ($from.parent.type.name !== this.name) {
            return false;
          }

          const blockStart = $from.start($from.depth);
          const blockEnd = $from.end($from.depth);

          if (selFrom === blockStart && selTo === blockEnd) {
            return false;
          }

          editor.commands.setTextSelection({ from: blockStart, to: blockEnd });
          return true;
        },
      };
    },
    addNodeView() {
      return ReactNodeViewRenderer(EnhancedCodeBlockView);
    },
  }).configure({ lowlight });
}
