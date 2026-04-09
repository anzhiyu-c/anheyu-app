"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { useState, useEffect } from "react";
import { TextSelection } from "@tiptap/pm/state";
import { Lock, Settings2, Check, Trash2, Eye, EyeOff } from "lucide-react";

/** 生成唯一的内容 ID */
function generateContentId(): string {
  return `pwd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ---- React NodeView 组件 ----
function PasswordContentView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const title = (node.attrs.title as string) || "密码保护内容";
  const hint = (node.attrs.hint as string) || "请输入密码";
  const contentId = (node.attrs.contentId as string) || "";
  const password = (node.attrs.password as string) || "";

  // 自动生成 contentId
  useEffect(() => {
    if (!contentId) {
      updateAttributes({ contentId: generateContentId() });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <NodeViewWrapper className="password-content-wrapper">
      <div className="editor-pro-block editor-pro-block--blue">
        {/* 头部 */}
        <div className="editor-pro-toolbar" contentEditable={false}>
          <div className="editor-pro-toolbar-left">
            <Lock className="w-3.5 h-3.5" />
            <span className="editor-pro-toolbar-label">{title}</span>
          </div>
          <div className="editor-pro-toolbar-right">
            {!showSettings && (
              <span className="editor-pro-badge editor-pro-badge--blue">{password ? "已设密码" : "未设密码"}</span>
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
                placeholder="密码保护内容"
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
              <label className="editor-pro-settings-label">密码</label>
              <div className="editor-pro-settings-password">
                <input
                  value={password}
                  onChange={e => updateAttributes({ password: e.target.value })}
                  className="editor-pro-settings-input editor-pro-settings-input--md"
                  placeholder="设置访问密码"
                  type={showPassword ? "text" : "password"}
                />
                <button
                  type="button"
                  className="editor-pro-toolbar-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "隐藏密码" : "显示密码"}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
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
          <NodeViewContent className="password-content-editable min-h-[1.5em]" />
        </div>

        {/* 底部信息条 */}
        <div className="editor-pro-footer editor-pro-footer--blue" contentEditable={false}>
          <Lock className="w-3 h-3" />
          <span>密码保护{password ? "" : " · 尚未设置密码"}</span>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// ---- Tiptap 扩展 ----

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    passwordContent: {
      /** 插入密码保护内容块 */
      insertPasswordContent: (attrs?: {
        contentId?: string;
        title?: string;
        hint?: string;
        placeholder?: string;
        password?: string;
        contentLength?: string;
      }) => ReturnType;
    };
  }
}

export const PasswordContent = Node.create({
  name: "passwordContent",

  group: "block",

  content: "block+",

  defining: true,

  isolating: true,

  addAttributes() {
    return {
      contentId: {
        default: "",
      },
      title: {
        default: "密码保护内容",
      },
      hint: {
        default: "请输入密码",
      },
      placeholder: {
        default: "请输入密码",
      },
      password: {
        default: "",
      },
      contentLength: {
        default: "0",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div.password-content-editor-preview",
        getAttrs: (el: HTMLElement) => ({
          contentId: el.getAttribute("data-content-id") || "",
          title: el.getAttribute("data-title") || "密码保护内容",
          hint: el.getAttribute("data-hint") || "请输入密码",
          placeholder: el.getAttribute("data-placeholder") || "请输入密码",
          password: el.getAttribute("data-password") || "",
          contentLength: el.getAttribute("data-content-length") || "0",
        }),
        contentElement: (el: HTMLElement) => {
          const preview = el.querySelector(".password-content-preview") as HTMLElement;
          if (preview) {
            const placeholder = preview.querySelector(".password-content-placeholder");
            if (placeholder) placeholder.remove();
            return preview;
          }
          const body = el.querySelector(".password-content-body") as HTMLElement;
          return body || el;
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { contentId, title, hint, placeholder, password, contentLength } = node.attrs;
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "password-content-editor-preview",
        "data-content-id": contentId as string,
        "data-title": title as string,
        "data-hint": hint as string,
        "data-placeholder": placeholder as string,
        "data-password": password as string,
        "data-content-length": contentLength as string,
      }),
      [
        "div",
        { class: "password-content-header", contenteditable: "false" },
        ["span", { class: "password-icon" }, "\u{1F512}"],
        ["span", { class: "password-title" }, title as string],
        ["span", { class: "password-badge" }, "密码保护"],
      ],
      [
        "div",
        { class: "password-content-body" },
        ["div", { class: "password-content-preview" }, 0],
        [
          "div",
          { class: "password-content-meta", contenteditable: "false" },
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

        // 从当前选区位置向上查找是否在 passwordContent 节点内
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
    return ReactNodeViewRenderer(PasswordContentView);
  },

  addCommands() {
    return {
      insertPasswordContent:
        attrs =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              contentId: generateContentId(),
              title: "密码保护内容",
              hint: "请输入密码",
              placeholder: "请输入密码",
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
