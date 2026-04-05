"use client";

import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { CustomImage } from "./extensions/custom-image";
import { PreserveHTML } from "./extensions/preserve-html";
import { PreserveId } from "./extensions/preserve-id";
import { MathBlock } from "./extensions/math-block";
import { MathInline } from "./extensions/math-inline";
import { MermaidBlock } from "./extensions/mermaid-block";
import { allInlineStyleMarks } from "./extensions/inline-styles";
import { FoldingBlock } from "./extensions/folding-block";
import { LinkCard } from "./extensions/link-card";
import { CalloutBlock } from "./extensions/callout-block";
import { HiddenBlock } from "./extensions/hidden-block";
import { MusicBlock } from "./extensions/music-block";
import { ButtonBlock } from "./extensions/button-block";
import { GalleryBlock } from "./extensions/gallery-block";
import { VideoGalleryBlock } from "./extensions/video-gallery-block";
import { TabsBlock, TabPanel } from "./extensions/tabs-block";
import { PaidContent } from "./extensions/paid-content";
import { PasswordContent } from "./extensions/password-content";
import { LoginRequiredContent } from "./extensions/login-required-content";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontSize } from "./extensions/font-size";
import Color from "@tiptap/extension-color";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { createEnhancedCodeBlock } from "./extensions/enhanced-code-block";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { common, createLowlight } from "lowlight";
import { postManagementApi } from "@/lib/api/post-management";
import type { EditorView } from "@tiptap/pm/view";

const lowlight = createLowlight(common);

// ============================================
// 图片粘贴/拖拽上传处理
// ============================================

/**
 * 从粘贴或拖拽事件中提取图片文件
 */
function getImageFiles(dataTransfer: DataTransfer | null): File[] {
  if (!dataTransfer) return [];
  const files: File[] = [];
  for (let i = 0; i < dataTransfer.files.length; i++) {
    const file = dataTransfer.files[i];
    if (file.type.startsWith("image/")) {
      files.push(file);
    }
  }
  return files;
}

/**
 * 处理图片上传：先插入带 uploading 遮罩的临时图片，上传完成后替换为远程 URL
 */
function handleImageUpload(view: EditorView, files: File[], pos?: number) {
  files.forEach(file => {
    const blobUrl = URL.createObjectURL(file);

    // 在指定位置或当前光标位置插入图片节点（带上传遮罩）
    const insertPos = pos ?? view.state.selection.from;
    const imageNode = view.state.schema.nodes.image.create({
      src: blobUrl,
      uploading: true,
      uploadError: "",
      _uploadFile: file,
    });
    const tr = view.state.tr.insert(insertPos, imageNode);
    view.dispatch(tr);
    // pos 在多文件场景下只用于第一张，后续由最新 selection 决定
    pos = undefined;

    // 根据 blobUrl 查找并更新对应的图片节点
    const findAndUpdate = (attrs: Record<string, unknown>) => {
      const { doc } = view.state;
      doc.descendants((node, nodePos) => {
        if (node.type.name === "image" && node.attrs.src === blobUrl) {
          const updateTr = view.state.tr.setNodeMarkup(nodePos, null, {
            ...node.attrs,
            ...attrs,
          });
          view.dispatch(updateTr);
          return false;
        }
      });
    };

    // 异步上传
    postManagementApi
      .uploadArticleImage(file)
      .then(url => {
        // 上传成功：替换为远程 URL，清除状态
        findAndUpdate({
          src: url,
          uploading: false,
          uploadError: "",
          _uploadFile: null,
        });
        // 延迟释放 blob URL，等远程图片有时间加载
        // 如果远程图片加载失败，NodeView 会显示占位符
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      })
      .catch(err => {
        console.error("图片上传失败:", err);
        // 上传失败：显示错误遮罩，保留文件引用以支持重试
        const errorMsg = err instanceof Error ? err.message : "上传失败，请重试";
        findAndUpdate({
          uploading: false,
          uploadError: errorMsg,
        });
      });
  });
}

interface UseArticleEditorOptions {
  /** 初始 HTML 内容 */
  initialContent?: string;
  /** 内容变更回调 */
  onUpdate?: (html: string) => void;
  /** 占位文字 */
  placeholder?: string;
}

/**
 * 文章编辑器 Hook
 * 将 Tiptap editor 实例提升到父组件，方便 Toolbar 和 EditorContent 共享
 */
export function useArticleEditor({
  initialContent = "",
  onUpdate,
  placeholder = "开始编写内容...",
}: UseArticleEditorOptions = {}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: false, // 由下方单独配置，避免与 StarterKit 内置的重复
        underline: false, // 由下方单独配置，避免与 StarterKit 内置的重复
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline cursor-pointer",
        },
      }),
      CustomImage.configure({
        inline: false,
        allowBase64: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
      TextStyle,
      FontSize,
      Color,
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Subscript,
      Superscript,
      createEnhancedCodeBlock(lowlight),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList.configure({
        HTMLAttributes: {
          class: "not-prose pl-2",
        },
      }),
      TaskItem.configure({
        nested: true,
      }),
      PreserveHTML,
      PreserveId,
      MathBlock,
      MathInline,
      MermaidBlock,
      // Phase 2: 自定义内容块
      ...allInlineStyleMarks,
      FoldingBlock,
      LinkCard,
      CalloutBlock,
      HiddenBlock,
      MusicBlock,
      ButtonBlock,
      GalleryBlock,
      VideoGalleryBlock,
      TabsBlock,
      TabPanel,
      // Phase 3: PRO 业务功能
      PaidContent,
      PasswordContent,
      LoginRequiredContent,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[500px] px-8 py-6",
      },
      handlePaste(view, event) {
        const imageFiles = getImageFiles(event.clipboardData);
        if (imageFiles.length > 0) {
          event.preventDefault();
          handleImageUpload(view, imageFiles);
          return true;
        }
        return false;
      },
      handleDrop(view, event) {
        const imageFiles = getImageFiles(event.dataTransfer);
        if (imageFiles.length > 0) {
          event.preventDefault();
          // 获取拖拽位置
          const coordinates = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });
          const pos = coordinates?.pos;
          handleImageUpload(view, imageFiles, pos);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => {
      onUpdate?.(e.getHTML());
    },
    immediatelyRender: false,
  });

  return editor;
}
