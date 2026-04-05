/**
 * MathInline 扩展
 * 行内 KaTeX 数学公式节点
 */
import { Node, mergeAttributes } from "@tiptap/core";
import katex from "katex";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mathInline: {
      /** 插入行内公式 */
      insertMathInline: (latex?: string) => ReturnType;
    };
  }
}

export const MathInline = Node.create({
  name: "mathInline",

  group: "inline",

  inline: true,

  atom: true,

  addAttributes() {
    return {
      latex: {
        default: "",
      },
    };
  },

  parseHTML() {
    return [
      // 解析 KaTeX 行内输出（排除 display 模式）
      {
        tag: ".katex:not(.katex-display .katex)",
        getAttrs: (element: HTMLElement) => {
          const annotation =
            element.querySelector('annotation[encoding="application/x-tex"]') ||
            element.querySelector("annotation");
          if (annotation?.textContent) {
            return { latex: annotation.textContent };
          }
          return { latex: element.textContent || "" };
        },
      },
      // 解析带 data-latex 的 span
      {
        tag: "span[data-latex]",
        getAttrs: (element: HTMLElement) => ({
          latex: element.getAttribute("data-latex") || "",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const latex = (node.attrs.latex as string) || "";
    const dom = document.createElement("span");
    const attrs = mergeAttributes(HTMLAttributes, {
      "data-latex": latex,
      "data-type": "math-inline",
      class: "math-inline",
      contenteditable: "false",
    });
    Object.entries(attrs).forEach(([key, val]) => {
      if (val !== undefined && val !== null) dom.setAttribute(key, String(val));
    });
    if (latex) {
      try {
        dom.innerHTML = katex.renderToString(latex, {
          displayMode: false,
          throwOnError: false,
          output: "html",
        });
      } catch {
        dom.textContent = latex;
      }
    }
    return dom;
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("span");
      dom.className = "math-inline";
      dom.setAttribute("contenteditable", "false");
      dom.setAttribute("data-latex", (node.attrs.latex as string) || "");

      const latex = (node.attrs.latex as string) || "";
      try {
        dom.innerHTML = katex.renderToString(latex, {
          displayMode: false,
          throwOnError: false,
          output: "html",
        });
      } catch {
        dom.textContent = latex;
      }

      return {
        dom,
        contentDOM: null,
        ignoreMutation: () => true,
      };
    };
  },

  addCommands() {
    return {
      insertMathInline:
        (latex = "") =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { latex },
          });
        },
    };
  },
});
