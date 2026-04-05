/**
 * HiddenBlock 扩展
 * 隐藏/折叠内容块，样式与 anheyu-app 一致
 * 顶部有工具条：按钮文字编辑 + 预览切换
 */
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps, NodeViewContent } from "@tiptap/react";
import { useState } from "react";
import { Eye, EyeOff, Type } from "lucide-react";

// ---- React NodeView 组件 ----
function HiddenBlockView({ node, updateAttributes }: NodeViewProps) {
  const [revealed, setRevealed] = useState(true); // 编辑器中默认显示
  const display = (node.attrs.display as string) || "查看隐藏内容";

  return (
    <NodeViewWrapper className="hidden-block-wrapper my-3">
      <div className="editor-hide-block">
        {/* 顶部工具条 */}
        <div className="editor-hide-toolbar" contentEditable={false}>
          <div className="editor-hide-toolbar-left">
            <EyeOff className="w-3.5 h-3.5" />
            <span className="editor-hide-toolbar-label">隐藏内容</span>
          </div>
          <div className="editor-hide-toolbar-right">
            <div className="editor-hide-btn-edit">
              <Type className="w-3 h-3" />
              <input
                type="text"
                value={display}
                onChange={e => updateAttributes({ display: e.target.value })}
                className="editor-hide-btn-input"
                placeholder="按钮文字"
              />
            </div>
            <button
              type="button"
              className={`editor-hide-toggle ${revealed ? "is-on" : ""}`}
              onClick={() => setRevealed(!revealed)}
              title={revealed ? "预览隐藏效果" : "显示内容"}
            >
              {revealed ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className={`editor-hide-content-area ${revealed ? "" : "editor-hide-blurred"}`}>
          <NodeViewContent className="hidden-content" />
        </div>

        {/* 底部按钮预览提示 */}
        <div className="editor-hide-footer" contentEditable={false}>
          <span className="editor-hide-footer-label">发布后显示为：</span>
          <span className="editor-hide-footer-btn">{display}</span>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// ---- Tiptap 扩展 ----

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    hiddenBlock: {
      insertHiddenBlock: (display?: string) => ReturnType;
    };
  }
}

export const HiddenBlock = Node.create({
  name: "hiddenBlock",

  group: "block",

  content: "block+",

  defining: true,

  addAttributes() {
    return {
      display: { default: "查看隐藏内容" },
      bg: { default: "" },
      color: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div.hide-block",
        getAttrs: (element: HTMLElement) => {
          const button = element.querySelector(".hide-button");
          const display = button?.textContent || "查看隐藏内容";
          let bg = "";
          let color = "";
          if (button instanceof HTMLElement) {
            bg = button.style.backgroundColor || "";
            color = button.style.color || "";
          }
          return { display, bg, color };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const display = (node.attrs.display as string) || "查看隐藏内容";
    const bg = (node.attrs.bg as string) || "";
    const color = (node.attrs.color as string) || "";

    const buttonStyle = [bg ? `background-color:${bg}` : "", color ? `color:${color}` : ""].filter(Boolean).join(";");

    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: "hide-block" }),
      ["button", { class: "hide-button", ...(buttonStyle ? { style: buttonStyle } : {}) }, display],
      ["div", { class: "hide-content" }, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(HiddenBlockView);
  },

  addCommands() {
    return {
      insertHiddenBlock:
        (display = "查看隐藏内容") =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { display },
            content: [{ type: "paragraph" }],
          });
        },
    };
  },
});
