/**
 * GalleryBlock 扩展
 * 图片画廊节点，支持多图网格展示
 */
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useState, useRef } from "react";
import { ImageIcon, Pencil, Upload } from "lucide-react";
import { postManagementApi } from "@/lib/api/post-management";

// ---- 类型定义 ----
interface GalleryItem {
  src: string;
  alt?: string;
  title?: string;
  desc?: string;
}

// ---- React NodeView 组件 ----
function GalleryBlockView({ node, updateAttributes }: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<number>(0);

  const cols = parseInt((node.attrs.cols as string) || "3", 10);
  const gap = (node.attrs.gap as string) || "10px";
  const ratio = (node.attrs.ratio as string) || "";
  const itemsRaw = (node.attrs.items as string) || "[]";

  let items: GalleryItem[] = [];
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    items = [];
  }

  // ---- 上传处理 ----
  const handleUpload = async (file: File, index: number) => {
    setUploadingIndex(index);
    try {
      const url = await postManagementApi.uploadArticleImage(file);
      const newItems = [...items];
      newItems[index] = { ...newItems[index], src: url };
      updateAttributes({ items: JSON.stringify(newItems) });
    } catch (err) {
      console.error("上传失败", err);
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleClickUpload = (index: number) => {
    setUploadTarget(index);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file, uploadTarget);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleUpload(file, index);
  };

  // ---- 编辑模式 ----
  if (editing) {
    return (
      <NodeViewWrapper className="gallery-block-wrapper my-3">
        <div className="editor-btn-edit-panel" contentEditable={false}>
          <div className="editor-btn-header">
            <span className="editor-btn-title">编辑图片画廊</span>
            <button type="button" className="editor-btn-done" onClick={() => setEditing(false)}>
              完成
            </button>
          </div>

          <div className="editor-btn-form">
            <div className="editor-btn-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <label className="editor-btn-field">
                <span className="editor-btn-label">列数</span>
                <select
                  value={cols}
                  onChange={e => updateAttributes({ cols: e.target.value })}
                  className="editor-btn-input"
                >
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <option key={n} value={n}>
                      {n} 列
                    </option>
                  ))}
                </select>
              </label>
              <label className="editor-btn-field">
                <span className="editor-btn-label">间距</span>
                <input
                  value={gap}
                  onChange={e => updateAttributes({ gap: e.target.value })}
                  className="editor-btn-input"
                  placeholder="10px"
                />
              </label>
              <label className="editor-btn-field">
                <span className="editor-btn-label">宽高比</span>
                <input
                  value={ratio}
                  onChange={e => updateAttributes({ ratio: e.target.value })}
                  className="editor-btn-input"
                  placeholder="16/9 或留空"
                />
              </label>
            </div>

            {/* 图片列表编辑 */}
            <div className="editor-btn-field">
              <span className="editor-btn-label">图片项（{items.length} 个）</span>
              <div className="editor-btngroup-items">
                {items.map((item, i) => (
                  <div key={i} className="editor-btngroup-item">
                    <div className="editor-btngroup-item-header">
                      <span className="editor-btngroup-item-index">{i + 1}</span>
                      <button
                        type="button"
                        className="editor-btngroup-item-remove"
                        onClick={() => {
                          const newItems = items.filter((_, idx) => idx !== i);
                          updateAttributes({ items: JSON.stringify(newItems) });
                        }}
                        title="删除此项"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                    <div className="editor-btngroup-item-fields">
                      <label className="editor-btn-field">
                        <span className="editor-btn-label">图片 URL</span>
                        <input
                          value={item.src}
                          onChange={e => {
                            const newItems = [...items];
                            newItems[i] = { ...newItems[i], src: e.target.value };
                            updateAttributes({ items: JSON.stringify(newItems) });
                          }}
                          className="editor-btn-input"
                          placeholder="图片 URL"
                        />
                      </label>
                      <div className="editor-btn-row">
                        <label className="editor-btn-field">
                          <span className="editor-btn-label">Alt 文本</span>
                          <input
                            value={item.alt || ""}
                            onChange={e => {
                              const newItems = [...items];
                              newItems[i] = { ...newItems[i], alt: e.target.value };
                              updateAttributes({ items: JSON.stringify(newItems) });
                            }}
                            className="editor-btn-input"
                            placeholder="Alt 文本"
                          />
                        </label>
                        <label className="editor-btn-field">
                          <span className="editor-btn-label">标题</span>
                          <input
                            value={item.title || ""}
                            onChange={e => {
                              const newItems = [...items];
                              newItems[i] = { ...newItems[i], title: e.target.value };
                              updateAttributes({ items: JSON.stringify(newItems) });
                            }}
                            className="editor-btn-input"
                            placeholder="标题"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="editor-btngroup-add"
                onClick={() => {
                  const newItems = [...items, { src: "", alt: "", title: "", desc: "" }];
                  updateAttributes({ items: JSON.stringify(newItems) });
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                添加图片
              </button>
            </div>
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  // ---- 预览模式 ----
  return (
    <NodeViewWrapper className="gallery-block-wrapper my-3">
      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
      <div className="editor-node-hover-wrap" contentEditable={false}>
        <div
          className="editor-node-edit-btn"
          onClick={e => {
            e.stopPropagation();
            setEditing(true);
          }}
          contentEditable={false}
        >
          <Pencil /> 编辑
        </div>
        {items.length > 0 ? (
          <div
            className={`gallery-container gallery-cols-${cols}`}
            style={{
              gap,
              ...(ratio ? ({ "--gallery-ratio": ratio } as React.CSSProperties) : {}),
            }}
          >
            {items.map((item, i) =>
              item.src ? (
                <div key={i} className="gallery-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.src} alt={item.alt || ""} title={item.title || ""} loading="lazy" />
                </div>
              ) : uploadingIndex === i ? (
                <div key={i} className="editor-gallery-uploading">
                  <div className="editor-gallery-spinner" />
                  <span>上传中...</span>
                </div>
              ) : (
                <div
                  key={i}
                  className="editor-gallery-empty-item"
                  onClick={() => handleClickUpload(i)}
                  onDragOver={e => {
                    e.preventDefault();
                    e.currentTarget.classList.add("is-dragover");
                  }}
                  onDragLeave={e => e.currentTarget.classList.remove("is-dragover")}
                  onDrop={e => {
                    e.currentTarget.classList.remove("is-dragover");
                    handleDrop(e, i);
                  }}
                >
                  <ImageIcon />
                  <span className="editor-gallery-empty-text">在此上传或拖入图片</span>
                  <span className="editor-gallery-upload-btn">
                    <Upload className="w-3 h-3" /> 上传图片
                  </span>
                </div>
              )
            )}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "2rem 0",
              border: "1px dashed var(--anzhiyu-card-border, #e3e8f7)",
              borderRadius: "12px",
              color: "var(--anzhiyu-secondtext, #999)",
              fontSize: "13px",
            }}
          >
            图片画廊（空）
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// ---- 命令类型声明 ----
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    galleryBlock: {
      /** 插入图片画廊 */
      insertGallery: (attrs?: { cols?: number; gap?: string; ratio?: string; items?: string }) => ReturnType;
    };
  }
}

// ---- Tiptap 扩展 ----
export const GalleryBlock = Node.create({
  name: "galleryBlock",

  group: "block",

  atom: true,

  addAttributes() {
    return {
      cols: { default: "3" },
      gap: { default: "10px" },
      ratio: { default: "" },
      items: { default: "[]" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div.gallery-container",
        getAttrs: (el: HTMLElement) => {
          const classList = el.className || "";
          const colsMatch = classList.match(/gallery-cols-(\d)/);
          const gapStyle = el.style.gap || "10px";
          const ratioStyle = el.style.getPropertyValue("--gallery-ratio") || "";

          const galleryItems: GalleryItem[] = [];
          el.querySelectorAll(".gallery-item").forEach(itemEl => {
            const img = itemEl.querySelector("img");
            galleryItems.push({
              src: img?.getAttribute("data-src") || img?.getAttribute("src") || "",
              alt: img?.getAttribute("alt") || "",
              title: itemEl.querySelector(".gallery-item-title")?.textContent || "",
              desc: itemEl.querySelector(".gallery-item-desc")?.textContent || "",
            });
          });

          return {
            cols: colsMatch ? colsMatch[1] : "3",
            gap: gapStyle,
            ratio: ratioStyle,
            items: JSON.stringify(galleryItems),
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const cols = (node.attrs.cols as string) || "3";
    const gap = (node.attrs.gap as string) || "10px";
    const ratio = (node.attrs.ratio as string) || "";

    let items: GalleryItem[] = [];
    try {
      items = JSON.parse((node.attrs.items as string) || "[]");
    } catch {
      items = [];
    }

    const containerClass = `gallery-container gallery-cols-${cols}`;
    const containerStyle = [`gap: ${gap}`, ratio ? `--gallery-ratio: ${ratio}` : ""].filter(Boolean).join("; ");

    const children = items.map(item => {
      const imgAttrs: Record<string, string> = {
        src: item.src || "",
        alt: item.alt || "",
        loading: "lazy",
      };

      const itemChildren: (string | (string | Record<string, string>)[])[] = [["img", imgAttrs]];

      if (item.title) {
        itemChildren.push(["span", { class: "gallery-item-title" }, item.title]);
      }
      if (item.desc) {
        itemChildren.push(["span", { class: "gallery-item-desc" }, item.desc]);
      }

      return ["div", { class: "gallery-item" }, ...itemChildren];
    });

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: containerClass,
        style: containerStyle,
      }),
      ...children,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(GalleryBlockView);
  },

  addCommands() {
    return {
      insertGallery:
        (attrs = {}) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              cols: String(attrs?.cols ?? 3),
              gap: attrs?.gap ?? "10px",
              ratio: attrs?.ratio ?? "",
              items:
                attrs?.items ??
                JSON.stringify([
                  { src: "", alt: "", title: "", desc: "" },
                  { src: "", alt: "", title: "", desc: "" },
                  { src: "", alt: "", title: "", desc: "" },
                ]),
            },
          });
        },
    };
  },
});
