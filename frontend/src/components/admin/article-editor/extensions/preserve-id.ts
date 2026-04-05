import { Extension } from "@tiptap/core";

/**
 * 保留 HTML 元素上的 id 属性。
 * Tiptap 默认会丢弃 schema 中未声明的属性，
 * 该扩展让表格单元格、段落等节点在解析和序列化时保留 id，
 * 使自定义页面的 JS 能通过 getElementById 找到目标元素。
 */
export const PreserveId = Extension.create({
  name: "preserveId",

  addGlobalAttributes() {
    return [
      {
        types: [
          "paragraph",
          "heading",
          "tableCell",
          "tableHeader",
          "blockquote",
          "listItem",
          "bulletList",
          "orderedList",
        ],
        attributes: {
          id: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute("id") || null,
            renderHTML: (attributes: Record<string, unknown>) => {
              if (!attributes.id) return {};
              return { id: attributes.id };
            },
          },
        },
      },
    ];
  },
});
