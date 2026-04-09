"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { useState, useEffect } from "react";
import { TextSelection } from "@tiptap/pm/state";
import { UserCheck, Settings2, Check, Trash2 } from "lucide-react";

/** 生成唯一的内容 ID */
function generateContentId(): string {
  return `login-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ---- React NodeView 组件 ----
function LoginRequiredContentView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const [showSettings, setShowSettings] = useState(false);
  const title = (node.attrs.title as string) || "登录后可查看";
  const hint = (node.attrs.hint as string) || "此内容需要登录后才能查看";
  const contentId = (node.attrs.contentId as string) || "";

  // 自动生成 contentId
  useEffect(() => {
    if (!contentId) {
      updateAttributes({ contentId: generateContentId() });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <NodeViewWrapper className="login-required-content-wrapper">
      <div className="editor-pro-block editor-pro-block--purple">
        {/* 头部 */}
        <div className="editor-pro-toolbar" contentEditable={false}>
          <div className="editor-pro-toolbar-left">
            <UserCheck className="w-3.5 h-3.5" />
            <span className="editor-pro-toolbar-label">{title}</span>
          </div>
          <div className="editor-pro-toolbar-right">
            {!showSettings && <span className="editor-pro-badge editor-pro-badge--purple">需登录</span>}
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
                placeholder="登录后可查看"
              />
            </div>
            <div className="editor-pro-settings-row">
              <label className="editor-pro-settings-label">ID</label>
              <input
                value={contentId}
                onChange={e => updateAttributes({ contentId: e.target.value })}
                className="editor-pro-settings-input editor-pro-settings-input--md"
                placeholder="自动生成"
                readOnly
              />
            </div>
            <div className="editor-pro-settings-row">
              <label className="editor-pro-settings-label">提示</label>
              <input
                value={hint}
                onChange={e => updateAttributes({ hint: e.target.value })}
                className="editor-pro-settings-input editor-pro-settings-input--wide"
                placeholder="提示文字"
              />
            </div>
          </div>
        )}

        {/* 内容区域 */}
        <div className="editor-pro-content">
          <NodeViewContent className="login-required-content-editable min-h-[1.5em]" />
        </div>

        {/* 底部信息条 */}
        <div className="editor-pro-footer editor-pro-footer--purple" contentEditable={false}>
          <UserCheck className="w-3 h-3" />
          <span>登录可见</span>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// ---- Tiptap 扩展 ----

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    loginRequiredContent: {
      /** 插入登录可见内容块 */
      insertLoginRequiredContent: (attrs?: {
        title?: string;
        contentId?: string;
        contentLength?: string;
        hint?: string;
      }) => ReturnType;
    };
  }
}

export const LoginRequiredContent = Node.create({
  name: "loginRequiredContent",

  group: "block",

  content: "block+",

  defining: true,

  isolating: true,

  addAttributes() {
    return {
      title: {
        default: "登录后可查看",
      },
      contentId: {
        default: "",
      },
      contentLength: {
        default: "0",
      },
      hint: {
        default: "此内容需要登录后才能查看",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div.login-required-content-editor-preview",
        getAttrs: (el: HTMLElement) => ({
          title: el.getAttribute("data-title") || "登录后可查看",
          contentId: el.getAttribute("data-content-id") || "",
          contentLength: el.getAttribute("data-content-length") || "0",
          hint: el.getAttribute("data-hint") || "此内容需要登录后才能查看",
        }),
        contentElement: (el: HTMLElement) => {
          const preview = el.querySelector(".login-required-content-preview") as HTMLElement;
          if (preview) {
            const placeholder = preview.querySelector(".login-required-content-placeholder");
            if (placeholder) placeholder.remove();
            return preview;
          }
          const body = el.querySelector(".login-required-content-body") as HTMLElement;
          return body || el;
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { title, contentId, contentLength, hint } = node.attrs;
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "login-required-content-editor-preview",
        "data-title": title as string,
        "data-content-id": contentId as string,
        "data-content-length": contentLength as string,
        "data-hint": hint as string,
      }),
      [
        "div",
        { class: "login-required-content-header", contenteditable: "false" },
        ["span", { class: "login-required-icon" }, "\u{1F464}"],
        ["span", { class: "login-required-title" }, title as string],
        ["span", { class: "login-required-badge" }, "需登录"],
      ],
      [
        "div",
        { class: "login-required-content-body" },
        ["div", { class: "login-required-content-preview" }, 0],
        [
          "div",
          { class: "login-required-content-meta", contenteditable: "false" },
          ["span", { class: "content-hint" }, hint as string],
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
    return ReactNodeViewRenderer(LoginRequiredContentView);
  },

  addCommands() {
    return {
      insertLoginRequiredContent:
        attrs =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              title: "登录后可查看",
              hint: "此内容需要登录后才能查看",
              contentId: generateContentId(),
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
