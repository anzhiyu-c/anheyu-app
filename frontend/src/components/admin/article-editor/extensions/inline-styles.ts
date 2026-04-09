/**
 * Inline Style Mark 扩展
 * 6 种行内样式标记，每种支持可选的 color 属性
 * 对应主题前端的 inline-underline / inline-emphasis-mark / inline-wavy 等 class
 */
import { Mark, mergeAttributes } from "@tiptap/core";

function createInlineStyleMark(name: string, className: string, styleProperty: string) {
  return Mark.create({
    name,

    addAttributes() {
      return {
        color: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.getPropertyValue(styleProperty) || el.style.color || null,
          renderHTML: (attrs: Record<string, unknown>) => {
            if (!attrs.color) return {};
            return { style: `${styleProperty}: ${attrs.color}` };
          },
        },
      };
    },

    parseHTML() {
      return [{ tag: `span.${className}` }];
    },

    renderHTML({ HTMLAttributes }) {
      return ["span", mergeAttributes(HTMLAttributes, { class: className }), 0];
    },
  });
}

/** 下划线 */
export const InlineUnderline = createInlineStyleMark("inlineUnderline", "inline-underline", "text-decoration-color");

/** 着重号 */
export const InlineEmphasis = createInlineStyleMark("inlineEmphasis", "inline-emphasis-mark", "text-emphasis-color");

/** 波浪线 */
export const InlineWavy = createInlineStyleMark("inlineWavy", "inline-wavy", "text-decoration-color");

/** 删除线 */
export const InlineDelete = createInlineStyleMark("inlineDelete", "inline-delete", "text-decoration-color");

/** 键盘按键 */
export const InlineKbd = createInlineStyleMark("inlineKbd", "inline-kbd", "color");

/** 密码遮罩 */
export const InlinePassword = createInlineStyleMark("inlinePassword", "inline-password", "background-color");

/** 所有行内样式标记的数组，方便批量注册 */
export const allInlineStyleMarks = [
  InlineUnderline,
  InlineEmphasis,
  InlineWavy,
  InlineDelete,
  InlineKbd,
  InlinePassword,
];
