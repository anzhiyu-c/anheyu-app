/**
 * PreserveHTML 扩展
 * 保留复杂 HTML 结构（画廊、视频画廊等），在编辑器中以不可编辑块显示
 * 参考 anheyu-app FrontendEditor/extensions/PreserveHTML.ts
 */
import { Node } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const PreserveHTML = Node.create({
  name: "preserveHTML",

  group: "block",

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      html: {
        default: "",
        parseHTML: (element: HTMLElement) => element.outerHTML,
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-html": attributes.html as string,
        }),
      },
    };
  },

  parseHTML() {
    // 注意：gallery-container, video-gallery-container, markdown-music-player,
    // btns-container, tabs, folding-tag, anzhiyu-tag-link, hide-block
    // 现在由各自的专用 Node 扩展处理。
    // PreserveHTML 仅作为最后的兜底，处理未被专用 Node 匹配到的复杂 HTML。
    return [
      // 恢复已保存的 preserve-html-wrapper
      {
        tag: "div.preserve-html-wrapper[data-html]",
        priority: 100,
        getAttrs: (element: HTMLElement) => {
          const html = element.getAttribute("data-html");
          return html ? { html } : false;
        },
      },
    ];
  },

  renderHTML({ node }) {
    const html = (node.attrs.html as string) || "";
    return [
      "div",
      {
        "data-preserve-html": "true",
        class: "preserve-html-wrapper",
        "data-html": html,
      },
      0,
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("div");
      dom.className = "preserve-html-wrapper";
      dom.setAttribute("contenteditable", "false");
      dom.setAttribute("data-preserve-html", "true");

      // 插入原始 HTML 以显示预览
      const html = (node.attrs.html as string) || "";
      dom.innerHTML = html;

      // 添加选中时的视觉提示
      dom.style.cursor = "default";
      dom.style.position = "relative";

      return {
        dom,
        contentDOM: null,
        ignoreMutation: () => true,
      };
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("preserveHTMLPlugin"),
        props: {
          handleDOMEvents: {
            mousedown: (_view, event) => {
              const target = event.target as HTMLElement;
              const preserveNode = target.closest(".preserve-html-wrapper");
              if (preserveNode) {
                event.preventDefault();
                return true;
              }
              return false;
            },
          },
        },
      }),
    ];
  },
});
