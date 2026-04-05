"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { useState, useEffect, useRef } from "react";
import { TextSelection } from "@tiptap/pm/state";
import { Coins, Settings2, Check, Trash2 } from "lucide-react";

// ---- React NodeView 组件 ----
function PaidContentView({ node, updateAttributes, deleteNode, editor, getPos }: NodeViewProps) {
  // editor 和 getPos 仅用于 contentLength 自动计算
  const [showSettings, setShowSettings] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const title = (node.attrs.title as string) || "付费内容";
  const price = (node.attrs.price as string) || "0";
  const originalPrice = (node.attrs.originalPrice as string) || "";
  const currency = (node.attrs.currency as string) || "¥";

  // 自动计算内容字数（不写入撤回历史）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (contentRef.current && editor && typeof getPos === "function") {
        const text = contentRef.current.textContent || "";
        const len = text.replace(/\s/g, "").length;
        const current = node.attrs.contentLength as string;
        if (String(len) !== current) {
          const pos = getPos();
          if (typeof pos === "number") {
            const tr = editor.view.state.tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              contentLength: String(len),
            });
            tr.setMeta("addToHistory", false);
            editor.view.dispatch(tr);
          }
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  });

  return (
    <NodeViewWrapper className="paid-content-wrapper">
      <div className="editor-pro-block editor-pro-block--amber">
        {/* 头部 */}
        <div className="editor-pro-toolbar" contentEditable={false}>
          <div className="editor-pro-toolbar-left">
            <Coins className="w-3.5 h-3.5" />
            <span className="editor-pro-toolbar-label">{title}</span>
          </div>
          <div className="editor-pro-toolbar-right">
            {!showSettings && (
              <span className="editor-pro-price">
                {currency}
                {price}
                {originalPrice && (
                  <span className="editor-pro-price-original">
                    {currency}
                    {originalPrice}
                  </span>
                )}
              </span>
            )}
            <button
              type="button"
              className="editor-pro-toolbar-btn"
              onClick={() => setShowSettings(!showSettings)}
              title={showSettings ? "完成" : "设置"}
            >
              {showSettings ? <Check className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              className="editor-pro-toolbar-btn editor-pro-toolbar-btn--danger"
              onClick={deleteNode}
              title="删除此块"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 设置面板 */}
        {showSettings && (
          <div className="editor-pro-settings" contentEditable={false}>
            <div className="editor-pro-settings-row">
              <label className="editor-pro-settings-label">标题</label>
              <input
                value={title}
                onChange={e => updateAttributes({ title: e.target.value })}
                className="editor-pro-settings-input editor-pro-settings-input--wide"
                placeholder="付费内容标题"
              />
            </div>
            <div className="editor-pro-settings-row">
              <label className="editor-pro-settings-label">货币</label>
              <input
                value={currency}
                onChange={e => updateAttributes({ currency: e.target.value })}
                className="editor-pro-settings-input editor-pro-settings-input--xs"
                placeholder="¥"
              />
            </div>
            <div className="editor-pro-settings-row">
              <label className="editor-pro-settings-label">价格</label>
              <input
                value={price}
                onChange={e => updateAttributes({ price: e.target.value })}
                className="editor-pro-settings-input editor-pro-settings-input--sm"
                placeholder="0.00"
                type="number"
                step="0.01"
                min="0"
              />
            </div>
            <div className="editor-pro-settings-row">
              <label className="editor-pro-settings-label">原价</label>
              <input
                value={originalPrice}
                onChange={e => updateAttributes({ originalPrice: e.target.value })}
                className="editor-pro-settings-input editor-pro-settings-input--sm"
                placeholder="可选"
                type="number"
                step="0.01"
                min="0"
              />
            </div>
          </div>
        )}

        {/* 内容区域 */}
        <div className="editor-pro-content" ref={contentRef}>
          <NodeViewContent className="paid-content-editable min-h-[1.5em]" />
        </div>

        {/* 底部信息条 */}
        <div className="editor-pro-footer editor-pro-footer--amber" contentEditable={false}>
          <Coins className="w-3 h-3" />
          <span>付费内容 · 约 {(node.attrs.contentLength as string) || "0"} 字</span>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// ---- Tiptap 扩展 ----

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    paidContent: {
      /** 插入付费内容块 */
      insertPaidContent: (attrs?: {
        title?: string;
        price?: string;
        originalPrice?: string | null;
        currency?: string;
        contentLength?: string;
      }) => ReturnType;
    };
  }
}

export const PaidContent = Node.create({
  name: "paidContent",

  group: "block",

  content: "block+",

  defining: true,

  isolating: true,

  addAttributes() {
    return {
      title: {
        default: "付费内容",
      },
      price: {
        default: "0",
      },
      originalPrice: {
        default: null,
      },
      currency: {
        default: "¥",
      },
      contentLength: {
        default: "0",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div.paid-content-editor-preview",
        getAttrs: (el: HTMLElement) => ({
          title: el.getAttribute("data-title") || "付费内容",
          price: el.getAttribute("data-price") || "0",
          originalPrice: el.getAttribute("data-original-price"),
          currency: el.getAttribute("data-currency") || "¥",
          contentLength: el.getAttribute("data-content-length") || "0",
        }),
        contentElement: (el: HTMLElement) => {
          const preview = el.querySelector(".paid-content-preview") as HTMLElement;
          if (preview) {
            const placeholder = preview.querySelector(".paid-content-placeholder");
            if (placeholder) placeholder.remove();
            return preview;
          }
          const body = el.querySelector(".paid-content-body") as HTMLElement;
          return body || el;
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { title, price, originalPrice, currency, contentLength } = node.attrs;
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "paid-content-editor-preview",
        "data-title": title as string,
        "data-price": price as string,
        "data-currency": currency as string,
        "data-content-length": contentLength as string,
        ...(originalPrice ? { "data-original-price": originalPrice as string } : {}),
      }),
      [
        "div",
        { class: "paid-content-header", contenteditable: "false" },
        ["span", { class: "paid-icon" }, "\u{1F4B0}"],
        ["span", { class: "paid-title" }, title as string],
        [
          "div",
          { class: "paid-header-actions" },
          ["span", { class: "paid-price" }, `${currency as string}${price as string}`],
        ],
      ],
      [
        "div",
        { class: "paid-content-body" },
        ["div", { class: "paid-content-preview" }, 0],
        [
          "div",
          { class: "paid-content-meta", contenteditable: "false" },
          ["span", { class: "content-length" }, `约 ${(contentLength as string) || "0"} 字`],
        ],
      ],
    ];
  },

  addKeyboardShortcuts() {
    return {
      "Mod-a": () => {
        const { state, dispatch } = this.editor.view;
        const { $from } = state.selection;

        for (let d = $from.depth; d >= 0; d--) {
          if ($from.node(d).type.name === this.name) {
            const from = $from.start(d);
            const to = $from.end(d);
            dispatch(state.tr.setSelection(TextSelection.create(state.doc, from, to)));
            return true;
          }
        }

        return false;
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(PaidContentView);
  },

  addCommands() {
    return {
      insertPaidContent:
        attrs =>
        ({ commands, editor }) => {
          // 限制每篇文章只能有一个付费内容块
          let hasPaidContent = false;
          editor.state.doc.descendants(node => {
            if (node.type.name === "paidContent") {
              hasPaidContent = true;
              return false;
            }
          });
          if (hasPaidContent) {
            return false;
          }
          return commands.insertContent({
            type: this.name,
            attrs: {
              title: "付费内容",
              price: "0",
              currency: "¥",
              contentLength: "0",
              ...attrs,
            },
            content: [
              {
                type: "paragraph",
              },
            ],
          });
        },
    };
  },
});
