/**
 * MermaidBlock 扩展
 * 支持 Mermaid 图表的显示、插入、编辑和缩放
 */
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Pencil } from "lucide-react";

// ---- Mermaid 渲染辅助（懒加载） ----
let mermaidInstance: (typeof import("mermaid"))["default"] | null = null;
let mermaidInitialized = false;

async function getMermaid() {
  if (!mermaidInstance) {
    const mod = await import("mermaid");
    mermaidInstance = mod.default;
  }
  if (!mermaidInitialized) {
    mermaidInstance.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme:
        typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "default",
      flowchart: { useMaxWidth: true, htmlLabels: true },
      sequence: { useMaxWidth: true },
      gantt: { useMaxWidth: true },
      logLevel: 3,
    });
    mermaidInitialized = true;
  }
  return mermaidInstance;
}

// ---- 缩放/平移 Hook ----
function useMermaidZoom(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [zoomEnabled, setZoomEnabled] = useState(false);
  const stateRef = useRef({ scale: 1, translateX: 0, translateY: 0, isDragging: false, startX: 0, startY: 0 });

  const applyTransform = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const svg = el.querySelector("svg") as HTMLElement | null;
    if (!svg) return;
    const { scale, translateX, translateY } = stateRef.current;
    svg.style.transformOrigin = "top left";
    svg.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
  }, [containerRef]);

  const resetTransform = useCallback(() => {
    stateRef.current = { scale: 1, translateX: 0, translateY: 0, isDragging: false, startX: 0, startY: 0 };
    const el = containerRef.current;
    if (!el) return;
    const svg = el.querySelector("svg") as HTMLElement | null;
    if (svg) svg.style.transform = "";
    el.style.cursor = "";
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !zoomEnabled) {
      if (el) {
        resetTransform();
      }
      return;
    }

    el.style.cursor = "grab";
    const s = stateRef.current;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      s.scale = Math.max(0.3, Math.min(5, s.scale + delta));
      applyTransform();
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      s.isDragging = true;
      s.startX = e.clientX - s.translateX;
      s.startY = e.clientY - s.translateY;
      el.style.cursor = "grabbing";
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!s.isDragging) return;
      s.translateX = e.clientX - s.startX;
      s.translateY = e.clientY - s.startY;
      applyTransform();
    };

    const onMouseUp = () => {
      s.isDragging = false;
      el.style.cursor = "grab";
    };

    const onMouseLeave = () => {
      s.isDragging = false;
      el.style.cursor = "grab";
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("mouseup", onMouseUp);
    el.addEventListener("mouseleave", onMouseLeave);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("mouseleave", onMouseLeave);
      resetTransform();
    };
  }, [zoomEnabled, containerRef, applyTransform, resetTransform]);

  return { zoomEnabled, toggleZoom: () => setZoomEnabled(v => !v) };
}

// ---- Pin 图标 SVG ----
const PinOffIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 17v5" />
    <path d="M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89" />
    <path d="m2 2 20 20" />
    <path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11" />
  </svg>
);

const PinIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 17v5" />
    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
  </svg>
);

// ---- React NodeView 组件 ----
function MermaidBlockView({ node, updateAttributes, selected }: NodeViewProps) {
  const code = (node.attrs.code as string) || "";
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(code);
  const hasCode = code.trim().length > 0;
  const [renderState, setRenderState] = useState<{
    svg: string;
    error: string;
    loading: boolean;
  }>({ svg: "", error: "", loading: hasCode });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const renderIdRef = useRef(0);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  const { zoomEnabled, toggleZoom } = useMermaidZoom(svgContainerRef);

  // 渲染 Mermaid 图表
  useEffect(() => {
    if (!hasCode) return;

    const currentId = ++renderIdRef.current;
    let cancelled = false;

    (async () => {
      try {
        const mermaid = await getMermaid();
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const { svg } = await mermaid.render(id, code);
        if (!cancelled && currentId === renderIdRef.current) {
          setRenderState({ svg, error: "", loading: false });
        }
      } catch (e) {
        if (!cancelled && currentId === renderIdRef.current) {
          setRenderState({
            svg: "",
            error: e instanceof Error ? e.message : "Mermaid 渲染失败",
            loading: false,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, hasCode]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    updateAttributes({ code: editValue });
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      setEditValue(code);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <NodeViewWrapper className="mermaid-block-wrapper">
        <div className="editor-mermaid-edit-panel" contentEditable={false}>
          <div className="editor-btn-header">
            <span className="editor-btn-title">Mermaid 图表</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Ctrl+Enter 保存 · Esc 取消</span>
              <button type="button" className="editor-btn-done" onClick={handleSave}>
                保存
              </button>
            </div>
          </div>
          <div className="editor-mermaid-edit-body">
            <textarea
              ref={inputRef}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={10}
              className="editor-mermaid-textarea"
              placeholder={`graph TD\n A[开始] --> B[结束]`}
            />
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="mermaid-block-wrapper">
      <div className="editor-node-hover-wrap" contentEditable={false}>
        <div
          className="editor-node-edit-btn"
          onClick={e => {
            e.stopPropagation();
            setEditValue(code);
            setIsEditing(true);
          }}
          contentEditable={false}
        >
          <Pencil /> 编辑
        </div>
        <div
          className={`editor-mermaid-display ${selected ? "is-selected" : ""}`}
          onClick={() => {
            if (!zoomEnabled) {
              setEditValue(code);
              setIsEditing(true);
            }
          }}
          title={zoomEnabled ? "滚轮缩放 · 拖拽平移" : "点击编辑图表"}
        >
          {renderState.loading && <div className="text-muted-foreground text-sm py-8">加载图表中...</div>}
          {renderState.error && (
            <div className="text-danger text-sm py-4">
              <div className="font-medium mb-1">Mermaid 渲染错误</div>
              <div className="text-xs opacity-70">{renderState.error}</div>
            </div>
          )}
          {!renderState.loading && !renderState.error && renderState.svg && (
            <>
              <div
                ref={svgContainerRef}
                className="mermaid-svg-container"
                style={{ overflow: zoomEnabled ? "hidden" : "auto" }}
                dangerouslySetInnerHTML={{ __html: renderState.svg }}
              />
              {/* 缩放按钮 */}
              <button
                type="button"
                className={`editor-mermaid-zoom-btn ${zoomEnabled ? "is-active" : ""}`}
                onClick={e => {
                  e.stopPropagation();
                  toggleZoom();
                }}
                title={zoomEnabled ? "退出缩放模式" : "启用缩放/平移"}
              >
                {zoomEnabled ? <PinIcon /> : <PinOffIcon />}
              </button>
            </>
          )}
          {!renderState.loading && !renderState.error && !renderState.svg && (
            <div className="text-muted-foreground/40 text-sm py-8">点击输入 Mermaid 代码</div>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// ---- Tiptap 扩展 ----

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mermaidBlock: {
      insertMermaidBlock: (code?: string) => ReturnType;
    };
  }
}

export const MermaidBlock = Node.create({
  name: "mermaidBlock",

  group: "block",

  atom: true,

  addAttributes() {
    return {
      code: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "pre",
        getAttrs: (element: HTMLElement) => {
          const code = element.querySelector("code.language-mermaid");
          if (!code) return false;
          return { code: code.textContent || "" };
        },
      },
      {
        tag: "div.mermaid",
        priority: 60,
        getAttrs: (element: HTMLElement) => {
          const code = element.getAttribute("data-code") || element.textContent || "";
          return { code };
        },
      },
      {
        tag: "div[data-mermaid-code]",
        getAttrs: (element: HTMLElement) => ({
          code: element.getAttribute("data-mermaid-code") || "",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const code = (node.attrs.code as string) || "";
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-mermaid-code": code,
        "data-type": "mermaid-block",
        class: "mermaid-block",
      }),
      ["pre", {}, ["code", { class: "language-mermaid" }, code]],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidBlockView);
  },

  addCommands() {
    return {
      insertMermaidBlock:
        (code = "graph TD\n A[开始] --> B[结束]") =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { code },
          });
        },
    };
  },
});
