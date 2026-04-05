/**
 * CalloutBlock 扩展
 * 行内提示块节点，支持 hover tooltip 效果
 * 编辑器中：显示下划线文字 + hover 弹出提示内容 + 双击编辑
 */
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Select, SelectItem, Input, Button } from "@heroui/react";

// 主题颜色映射
const THEME_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  dark: { bg: "#333", border: "#555", text: "#fff" },
  light: { bg: "#fff", border: "#e3e8f7", text: "#333" },
  info: { bg: "#e8f4fd", border: "#91d5ff", text: "#1890ff" },
  warning: { bg: "#fff7e6", border: "#ffd591", text: "#fa8c16" },
  error: { bg: "#fff1f0", border: "#ffa39e", text: "#f5222d" },
  success: { bg: "#f6ffed", border: "#b7eb8f", text: "#52c41a" },
};

const THEME_OPTIONS = [
  { value: "dark", label: "默认（深色）" },
  { value: "light", label: "浅色" },
  { value: "info", label: "信息（蓝）" },
  { value: "warning", label: "警告（橙）" },
  { value: "error", label: "错误（红）" },
  { value: "success", label: "成功（绿）" },
];

const TRIGGER_OPTIONS = [
  { value: "hover", label: "鼠标悬停" },
  { value: "click", label: "点击触发" },
];

// ---- Tooltip Portal 组件 ----
function TooltipPortal({
  triggerRef,
  bg,
  textColor,
  content,
}: {
  triggerRef: React.RefObject<HTMLSpanElement | null>;
  bg: string;
  textColor: string;
  content: string;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.top - 8, left: rect.left + rect.width / 2 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!pos) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        transform: "translate(-50%, -100%)",
        backgroundColor: bg,
        color: textColor,
        padding: "8px 12px",
        fontSize: "14px",
        fontWeight: 400,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
        borderRadius: "6px",
        backdropFilter: "blur(10px)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        zIndex: 99999,
        pointerEvents: "none",
        opacity: 0,
        animation: "calloutPortalFadeIn 0.12s ease-out forwards",
      }}
    >
      {content}
    </div>,
    document.body
  );
}

// ---- React NodeView 组件 ----
function CalloutBlockView({ node, updateAttributes, selected }: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const text = (node.attrs.text as string) || "提示";
  const content = (node.attrs.content as string) || "";
  const theme = (node.attrs.theme as string) || "dark";
  // trigger 用 state 管理，因为可能不在已有节点的 attrs 中
  const [localTrigger, setLocalTrigger] = useState<string>((node.attrs.trigger as string) || "hover");

  const colors = THEME_COLORS[theme] || THEME_COLORS.dark;
  const isClickTrigger = localTrigger === "click";

  // 选中节点或进入编辑时关闭 tooltip
  if ((selected || editing) && showTip) {
    setShowTip(false);
  }

  // 点击外部关闭编辑
  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as globalThis.Node)) {
        setEditing(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editing]);

  if (editing) {
    return (
      <NodeViewWrapper as="span" className="callout-inline-editor">
        <span ref={wrapperRef} className="editor-callout-edit-panel">
          <Input
            label="文字"
            labelPlacement="outside-left"
            value={text}
            onValueChange={v => updateAttributes({ text: v })}
            placeholder="触发文字"
            size="sm"
            variant="flat"
            autoFocus
            classNames={{ label: "min-w-[36px] text-xs font-semibold" }}
          />
          <Input
            label="内容"
            labelPlacement="outside-left"
            value={content}
            onValueChange={v => updateAttributes({ content: v })}
            placeholder="提示内容"
            size="sm"
            variant="flat"
            classNames={{ label: "min-w-[36px] text-xs font-semibold" }}
          />
          <Select
            label="触发"
            labelPlacement="outside-left"
            defaultSelectedKeys={[localTrigger]}
            onChange={e => {
              if (e.target.value) {
                setLocalTrigger(e.target.value);
                updateAttributes({ trigger: e.target.value });
              }
            }}
            size="sm"
            variant="flat"
            classNames={{ label: "min-w-[36px] text-xs font-semibold" }}
          >
            {TRIGGER_OPTIONS.map(opt => (
              <SelectItem key={opt.value}>{opt.label}</SelectItem>
            ))}
          </Select>
          <Select
            label="主题"
            labelPlacement="outside-left"
            defaultSelectedKeys={[theme]}
            onChange={e => {
              if (e.target.value) updateAttributes({ theme: e.target.value });
            }}
            size="sm"
            variant="flat"
            classNames={{ label: "min-w-[36px] text-xs font-semibold" }}
          >
            {THEME_OPTIONS.map(opt => (
              <SelectItem key={opt.value}>{opt.label}</SelectItem>
            ))}
          </Select>
          <Button size="sm" color="primary" className="self-end" onPress={() => setEditing(false)}>
            完成
          </Button>
        </span>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="span" className="callout-inline-wrapper">
      <span
        ref={wrapperRef}
        className="editor-callout-trigger"
        onMouseEnter={() => {
          if (!isClickTrigger) setShowTip(true);
        }}
        onMouseLeave={() => {
          if (!isClickTrigger) setShowTip(false);
        }}
        onClick={e => {
          if (isClickTrigger) {
            e.stopPropagation();
            setShowTip(prev => !prev);
          }
        }}
        onDoubleClick={() => setEditing(true)}
        contentEditable={false}
      >
        <span className="editor-callout-text">{text}</span>

        {/* Tooltip 弹出层 — Portal 渲染，脱离 ProseMirror DOM */}
        {showTip && content && (
          <TooltipPortal triggerRef={wrapperRef} bg={colors.bg} textColor={colors.text} content={content} />
        )}
      </span>
    </NodeViewWrapper>
  );
}

// ---- Tiptap 扩展 ----

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    calloutBlock: {
      insertCallout: (attrs?: { text?: string; content?: string; theme?: string; position?: string }) => ReturnType;
    };
  }
}

export const CalloutBlock = Node.create({
  name: "calloutBlock",

  group: "inline",

  inline: true,

  atom: true,

  addAttributes() {
    return {
      text: { default: "提示" },
      content: { default: "" },
      theme: { default: "dark" },
      trigger: { default: "hover" },
      position: { default: "top" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span.anzhiyu-tip-wrapper",
        getAttrs: (element: HTMLElement) => {
          const tipText = element.querySelector(".anzhiyu-tip-text");
          const tipContent = element.querySelector(".anzhiyu-tip");
          let theme = "dark";
          let position = "top";
          if (tipContent) {
            const classList = tipContent.className || "";
            const themeMatch = classList.match(/tip-(dark|light|info|warning|error|success)/);
            const positionMatch = classList.match(/tip-(top|bottom|left|right)/);
            if (themeMatch) theme = themeMatch[1];
            if (positionMatch) position = positionMatch[1];
          }
          return {
            text: tipText?.textContent || "",
            content: tipContent?.textContent || "",
            theme,
            position,
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const text = (node.attrs.text as string) || "提示";
    const content = (node.attrs.content as string) || "";
    const theme = (node.attrs.theme as string) || "dark";
    const trigger = (node.attrs.trigger as string) || "hover";
    const position = (node.attrs.position as string) || "top";

    const wrapperAttrs: Record<string, string> = { class: "anzhiyu-tip-wrapper" };
    if (trigger === "click") wrapperAttrs["data-trigger"] = "click";

    return [
      "span",
      mergeAttributes(HTMLAttributes, wrapperAttrs),
      ["span", { class: "anzhiyu-tip-text" }, text],
      ["span", { class: `anzhiyu-tip tip-${theme} tip-${position}` }, content],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutBlockView);
  },

  addCommands() {
    return {
      insertCallout:
        (attrs = {}) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              text: attrs.text ?? "提示",
              content: attrs.content ?? "这是提示内容",
              theme: attrs.theme ?? "dark",
              position: attrs.position ?? "top",
            },
          });
        },
    };
  },
});
