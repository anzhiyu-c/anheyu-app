/**
 * TabsBlock + TabPanel 扩展
 * 标签页面板，每个 Tab 支持任意富文本内容（图片、代码块、列表等）
 *
 * 节点结构：tabsBlock > tabPanel+ > block+
 */
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, X } from "lucide-react";

// ============================================================
// TabPanel 节点 —— 单个标签页，内部承载任意 block 内容
// ============================================================

function TabPanelView({ node }: NodeViewProps) {
  return (
    <NodeViewWrapper className="editor-tab-panel" data-title={node.attrs.title}>
      <NodeViewContent className="editor-tab-panel-content" />
    </NodeViewWrapper>
  );
}

export const TabPanel = Node.create({
  name: "tabPanel",

  group: "tabPanel",

  content: "block+",

  defining: true,

  isolating: true,

  addAttributes() {
    return {
      title: { default: "标签" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div.tab-item-content",
        getAttrs: (el: HTMLElement) => {
          const dataTitle = el.getAttribute("data-title");
          if (dataTitle) return { title: dataTitle };

          const tabsContainer = el.closest(".tabs");
          if (!tabsContainer) return { title: "标签" };

          const allContent = tabsContainer.querySelectorAll(".tab-item-content");
          const myIndex = Array.from(allContent).indexOf(el);
          const buttons = tabsContainer.querySelectorAll(".nav-tabs .tab, .nav-tabs button");
          return { title: buttons[myIndex]?.textContent?.trim() || `标签 ${myIndex + 1}` };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "tab-item-content",
        "data-title": node.attrs.title || "",
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TabPanelView);
  },
});

// ============================================================
// TabsBlock 节点 —— 标签页容器，管理标签导航和活跃状态
// ============================================================

const DEFAULT_PANEL_TITLES = ["标签 1", "标签 2"];

function TabsBlockView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const [editingTab, setEditingTab] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const activeIndex = parseInt((node.attrs.activeIndex as string) || "0", 10);
  const panelCount = node.content.childCount;
  const safeIdx = Math.min(Math.max(0, activeIndex), panelCount - 1);

  const titles: string[] = [];
  node.content.forEach(child => {
    titles.push((child.attrs.title as string) || "标签");
  });

  // NodeViewContent does NOT forward user refs (@tiptap/react v3 overrides ref
  // with its internal nodeViewContentRef), so we query from NodeViewWrapper instead.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const applyVisibility = () => {
      // Tiptap v3 inserts two intermediate wrappers between the NodeViewContent
      // container and each child's NodeViewWrapper: a contentDOMElement and
      // a per-node renderer element (.node-tabPanel). Use descendant selector.
      const panels = wrapper.querySelectorAll<HTMLElement>(
        ".editor-tabs-panels .node-tabPanel"
      );
      panels.forEach((panel, i) => {
        panel.style.display = i === safeIdx ? "" : "none";
      });
    };

    applyVisibility();
    const rafId = requestAnimationFrame(applyVisibility);
    return () => cancelAnimationFrame(rafId);
  }, [safeIdx, panelCount]);

  const resolvePos = useCallback(() => {
    return typeof getPos === "function" ? getPos() : 0;
  }, [getPos]);

  const switchTab = useCallback(
    (index: number) => {
      updateAttributes({ activeIndex: String(index) });
      try {
        const pos = resolvePos();
        if (pos === undefined) return;
        let childStart = pos + 1;
        for (let i = 0; i < index; i++) {
          childStart += node.content.child(i).nodeSize;
        }
        editor.commands.setTextSelection(childStart + 1);
      } catch {
        /* 切换 tab 时聚焦失败不影响功能 */
      }
    },
    [updateAttributes, resolvePos, node, editor]
  );

  const addTab = useCallback(() => {
    const pos = resolvePos();
    if (pos === undefined) return;
    const endPos = pos + node.nodeSize - 1;
    const newPanel = editor.schema.nodes.tabPanel.create(
      { title: `标签 ${panelCount + 1}` },
      editor.schema.nodes.paragraph.create()
    );
    editor.view.dispatch(editor.state.tr.insert(endPos, newPanel));
  }, [resolvePos, node, editor, panelCount]);

  const removeTab = useCallback(
    (index: number) => {
      if (panelCount <= 1) return;
      const pos = resolvePos();
      if (pos === undefined) return;
      let childPos = pos + 1;
      for (let i = 0; i < index; i++) {
        childPos += node.content.child(i).nodeSize;
      }
      const child = node.content.child(index);
      const tr = editor.state.tr.delete(childPos, childPos + child.nodeSize);

      const newCount = panelCount - 1;
      const newIdx = safeIdx >= newCount ? newCount - 1 : safeIdx;
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, activeIndex: String(newIdx) });
      editor.view.dispatch(tr);
    },
    [resolvePos, node, editor, panelCount, safeIdx]
  );

  const changeTitle = useCallback(
    (index: number, title: string) => {
      const pos = resolvePos();
      if (pos === undefined) return;
      let childPos = pos + 1;
      for (let i = 0; i < index; i++) {
        childPos += node.content.child(i).nodeSize;
      }
      editor.view.dispatch(
        editor.state.tr.setNodeMarkup(childPos, undefined, {
          ...node.content.child(index).attrs,
          title,
        })
      );
    },
    [resolvePos, node, editor]
  );

  return (
    <NodeViewWrapper ref={wrapperRef} className="editor-tabs-block">
      <div className="editor-tabs" contentEditable={false}>
        {/* 标签导航 */}
        <div className="editor-tabs-nav">
          {titles.map((title, i) => (
            <div key={i} className="editor-tabs-tab-wrap">
              <button
                type="button"
                className={`editor-tabs-tab ${i === safeIdx ? "is-active" : ""}`}
                onClick={() => switchTab(i)}
                onDoubleClick={e => {
                  e.stopPropagation();
                  setEditingTab(i);
                }}
              >
                {editingTab === i ? (
                  <input
                    value={title}
                    onChange={e => changeTitle(i, e.target.value)}
                    onBlur={() => setEditingTab(null)}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === "Escape") setEditingTab(null);
                    }}
                    onClick={e => e.stopPropagation()}
                    className="editor-tabs-tab-input"
                    autoFocus
                  />
                ) : (
                  title
                )}
              </button>
              {panelCount > 1 && (
                <button
                  type="button"
                  className="editor-tabs-tab-remove"
                  onClick={e => {
                    e.stopPropagation();
                    removeTab(i);
                  }}
                  title="删除标签"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}

          <button type="button" className="editor-tabs-add" onClick={addTab} title="添加标签">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 面板内容 — 由 TipTap 渲染子 TabPanel 节点 */}
      <NodeViewContent className="editor-tabs-panels" />
    </NodeViewWrapper>
  );
}

// ---- 命令类型声明 ----
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tabsBlock: {
      insertTabsBlock: (attrs?: { titles?: string[]; activeIndex?: number }) => ReturnType;
    };
  }
}

export const TabsBlock = Node.create({
  name: "tabsBlock",

  group: "block",

  content: "tabPanel+",

  defining: true,

  addAttributes() {
    return {
      activeIndex: { default: "0" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div.tabs",
        getAttrs: (el: HTMLElement) => {
          let activeIndex = "0";
          const activeBtn = el.querySelector(".nav-tabs .active, .nav-tabs [aria-selected='true']");
          if (activeBtn) {
            const allBtns = el.querySelectorAll(".nav-tabs .tab, .nav-tabs button");
            const idx = Array.from(allBtns).indexOf(activeBtn);
            if (idx >= 0) activeIndex = String(idx);
          }
          return { activeIndex };
        },
        contentElement: ".tab-contents",
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const activeIndex = parseInt((node.attrs.activeIndex as string) || "0", 10);

    const navButtons: unknown[] = [];
    let index = 0;
    node.content.forEach(child => {
      const title = (child.attrs.title as string) || `标签 ${index + 1}`;
      navButtons.push([
        "button",
        { class: `tab${index === activeIndex ? " active" : ""}`, "data-index": String(index) },
        title,
      ]);
      index++;
    });

    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: "tabs" }),
      ["div", { class: "nav-tabs" }, ...navButtons],
      ["div", { class: "tab-contents" }, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TabsBlockView);
  },

  addCommands() {
    return {
      insertTabsBlock:
        (attrs = {}) =>
        ({ commands }) => {
          const titles = attrs?.titles ?? DEFAULT_PANEL_TITLES;
          return commands.insertContent({
            type: this.name,
            attrs: { activeIndex: String(attrs?.activeIndex ?? 0) },
            content: titles.map(title => ({
              type: "tabPanel",
              attrs: { title },
              content: [{ type: "paragraph" }],
            })),
          });
        },
    };
  },
});
