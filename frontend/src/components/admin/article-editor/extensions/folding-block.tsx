"use client";

/**
 * FoldingBlock 扩展
 * 折叠/展开块（details/summary），使用 React NodeView
 * 样式与 anheyu-app 前端一致：标题栏有主题色背景，展开后有边框
 */
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { useState, useRef, useEffect } from "react";

// ---- 预设颜色 ----
const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#14b8a6",
  "#64748b",
];

// ---- 颜色选择器 ----
function ColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="editor-folding-color-wrap" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        className="editor-folding-color-btn"
        style={{ backgroundColor: color || "#3b82f6" }}
        onClick={() => setOpen(!open)}
        title="设置标题颜色"
      />
      {open && (
        <div className="editor-folding-color-panel">
          <div className="editor-folding-color-grid">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                className={`editor-folding-color-swatch ${color === c ? "is-active" : ""}`}
                style={{ backgroundColor: c }}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
              />
            ))}
          </div>
          {color && (
            <button
              type="button"
              className="editor-folding-color-clear"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              使用默认颜色
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---- React NodeView 组件 ----
function FoldingBlockView({ node, updateAttributes }: NodeViewProps) {
  const [open, setOpen] = useState((node.attrs.open as boolean) ?? true);
  const [titleEditing, setTitleEditing] = useState(false);
  const title = (node.attrs.title as string) || "点击展开";
  const color = (node.attrs.color as string) || "";

  const hasCustomColor = !!color;

  // 容器样式
  const containerStyle: React.CSSProperties = {};
  if (open && hasCustomColor) {
    containerStyle.borderColor = color;
  }

  // 标题栏样式
  const summaryStyle: React.CSSProperties = {};
  if (hasCustomColor && open) {
    summaryStyle.backgroundColor = color;
    summaryStyle.borderColor = color;
  }

  return (
    <NodeViewWrapper className="folding-block-wrapper my-3">
      <div
        className={`editor-folding-block ${open ? "is-open" : ""} ${hasCustomColor ? "has-color" : ""}`}
        style={containerStyle}
      >
        {/* 标题栏 */}
        <div
          className={`editor-folding-summary ${open ? "is-open" : ""}`}
          style={summaryStyle}
          onClick={() => {
            if (!titleEditing) {
              setOpen(!open);
              updateAttributes({ open: !open });
            }
          }}
          contentEditable={false}
        >
          <span className={`editor-folding-arrow ${open ? "is-open" : ""}`}>▶</span>

          {titleEditing ? (
            <input
              type="text"
              value={title}
              onChange={e => updateAttributes({ title: e.target.value })}
              onBlur={() => setTitleEditing(false)}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === "Escape") setTitleEditing(false);
              }}
              onClick={e => e.stopPropagation()}
              className="editor-folding-title-input"
              autoFocus
            />
          ) : (
            <span
              className="editor-folding-title"
              onClick={e => {
                e.stopPropagation();
                setTitleEditing(true);
              }}
            >
              {title}
            </span>
          )}

          {/* 颜色选择器 */}
          <ColorPicker color={color} onChange={c => updateAttributes({ color: c })} />
        </div>

        {/* 内容区 */}
        {open && (
          <div className="editor-folding-content">
            <NodeViewContent className="folding-content" />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// ---- 命令类型声明 ----
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    foldingBlock: {
      /** 插入折叠块 */
      insertFoldingBlock: (title?: string) => ReturnType;
    };
  }
}

// ---- Tiptap 扩展 ----
export const FoldingBlock = Node.create({
  name: "foldingBlock",

  group: "block",

  content: "block+",

  defining: true,

  addAttributes() {
    return {
      title: { default: "点击展开" },
      color: { default: null },
      open: { default: true },
    };
  },

  parseHTML() {
    return [
      {
        tag: "details.folding-tag",
        getAttrs: (el: HTMLElement) => {
          const summary = el.querySelector("summary");
          const style = el.getAttribute("style") || "";
          const colorMatch = style.match(/border-color:\s*([^;]+)/);
          return {
            title: summary?.textContent || "点击展开",
            color: colorMatch ? colorMatch[1].trim() : null,
            open: el.hasAttribute("open"),
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = mergeAttributes(HTMLAttributes, {
      class: `folding-tag${node.attrs.color ? " custom-color" : ""}`,
      ...(node.attrs.open ? { open: "true" } : {}),
    });

    if (node.attrs.color) {
      attrs.style = `border-color: ${node.attrs.color as string}`;
    }

    return [
      "details",
      attrs,
      ["summary", {}, (node.attrs.title as string) || "点击展开"],
      ["div", { class: "content" }, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FoldingBlockView);
  },

  addCommands() {
    return {
      insertFoldingBlock:
        (title = "点击展开") =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { title, open: true },
            content: [{ type: "paragraph" }],
          });
        },
    };
  },
});
