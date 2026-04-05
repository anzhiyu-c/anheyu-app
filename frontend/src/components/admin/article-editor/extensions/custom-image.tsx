/**
 * CustomImage 扩展（React NodeView 版本）
 * 支持对齐、figcaption 标题、尺寸调整、图片样式、链接、旋转、上传遮罩、浮动工具栏
 */
"use client";

import Image from "@tiptap/extension-image";
import { mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useState, useRef, useCallback, useEffect } from "react";
import { ImageToolbar } from "./image-toolbar";
import { postManagementApi } from "@/lib/api/post-management";
import { AlertTriangle, RotateCw, Trash2 } from "lucide-react";

// ---- 命令类型声明 ----
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    customImage: {
      /** 设置图片对齐方式 */
      setImageAlign: (align: "left" | "center" | "right") => ReturnType;
      /** 设置图片尺寸 */
      setImageSize: (size: { width?: number | null; height?: number | null }) => ReturnType;
      /** 设置图片样式 */
      setImageStyle: (style: "none" | "border" | "shadow") => ReturnType;
      /** 设置图片链接 */
      setImageLink: (link: string | null, target?: string | null) => ReturnType;
      /** 设置图片旋转 */
      setImageRotation: (rotation: 0 | 90 | 180 | 270) => ReturnType;
      /** 重置图片所有自定义属性 */
      resetImageAttributes: () => ReturnType;
    };
  }
}

// ============================================
// React NodeView 组件
// ============================================

function ImageNodeView({ node, updateAttributes, selected, editor, deleteNode }: NodeViewProps) {
  const attrs = node.attrs as Record<string, unknown>;
  const src = attrs.src as string;
  const alt = (attrs.alt as string) || "";
  const caption = attrs.caption as string | null;
  const align = (attrs.align as string) || "center";
  const imageStyle = (attrs.imageStyle as string) || "none";
  const rotation = (attrs.rotation as number) || 0;
  const uploading = attrs.uploading as boolean;
  const uploadError = (attrs.uploadError as string) || "";
  const uploadFile = attrs._uploadFile as File | undefined;
  const width = attrs.width as number | null;
  const height = attrs.height as number | null;

  const imgRef = useRef<HTMLImageElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 图片加载状态
  const [imgLoadFailed, setImgLoadFailed] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);

  // src 变化时重置加载失败状态
  if (prevSrc !== src) {
    setPrevSrc(src);
    if (imgLoadFailed) setImgLoadFailed(false);
  }

  // 图片加载成功
  const handleImgLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      setImgLoadFailed(false);
      const img = e.currentTarget;
      // 保存自然尺寸（用于加载失败时占位符保持原图比例，img 本身通过 max-width:100% 约束不超出编辑器）
      if (!width && img.naturalWidth > 0) {
        updateAttributes({ width: img.naturalWidth, height: img.naturalHeight });
      }
    },
    [width, updateAttributes]
  );

  // 远程图片加载失败时显示错误占位
  const handleImgError = useCallback(() => {
    // blob URL 图片不会走到这里（blob URL 创建后立即可用）
    if (!src?.startsWith("blob:")) {
      setImgLoadFailed(true);
    }
  }, [src]);

  // ---- 裁剪模式 ----
  const [isCropping, setIsCropping] = useState(false);
  // 裁剪区域用百分比表示（0~1），相对于图片显示尺寸
  const [cropRect, setCropRect] = useState({ top: 0, left: 0, right: 1, bottom: 1 });
  const cropDragRef = useRef<{
    handle: string;
    startX: number;
    startY: number;
    startRect: typeof cropRect;
    imgRect: DOMRect;
  } | null>(null);

  const startCrop = useCallback(() => {
    setIsCropping(true);
    setCropRect({ top: 0, left: 0, right: 1, bottom: 1 });
  }, []);

  const cancelCrop = useCallback(() => {
    setIsCropping(false);
  }, []);

  const confirmCrop = useCallback(async () => {
    const img = imgRef.current;
    if (!img) return;

    // 用自然尺寸计算裁剪区域
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const cx = Math.round(cropRect.left * nw);
    const cy = Math.round(cropRect.top * nh);
    const cw = Math.round((cropRect.right - cropRect.left) * nw);
    const ch = Math.round((cropRect.bottom - cropRect.top) * nh);

    if (cw < 10 || ch < 10) {
      setIsCropping(false);
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);

    setIsCropping(false);
    updateAttributes({ uploading: true });

    canvas.toBlob(async blob => {
      if (!blob) {
        updateAttributes({ uploading: false });
        return;
      }
      const file = new File([blob], "cropped.png", { type: "image/png" });
      try {
        const url = await postManagementApi.uploadArticleImage(file);
        updateAttributes({ src: url, uploading: false, width: cw, height: ch });
      } catch (err) {
        console.error("上传裁剪图片失败", err);
        updateAttributes({ uploading: false, uploadError: err instanceof Error ? err.message : "裁剪上传失败" });
      }
    }, "image/png");
  }, [cropRect, updateAttributes]);

  // 裁剪手柄拖拽
  const handleCropHandleDown = useCallback(
    (e: React.MouseEvent, handle: string) => {
      e.preventDefault();
      e.stopPropagation();
      const img = imgRef.current;
      if (!img) return;
      cropDragRef.current = {
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startRect: { ...cropRect },
        imgRect: img.getBoundingClientRect(),
      };
    },
    [cropRect]
  );

  // 裁剪区域内点击 → 拖拽整体平移
  const handleCropAreaDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const img = imgRef.current;
      if (!img) return;
      cropDragRef.current = {
        handle: "move",
        startX: e.clientX,
        startY: e.clientY,
        startRect: { ...cropRect },
        imgRect: img.getBoundingClientRect(),
      };
    },
    [cropRect]
  );

  useEffect(() => {
    if (!isCropping) return;

    const handleMove = (e: MouseEvent) => {
      const d = cropDragRef.current;
      if (!d) return;
      const dx = (e.clientX - d.startX) / d.imgRect.width;
      const dy = (e.clientY - d.startY) / d.imgRect.height;
      const r = { ...d.startRect };
      const clamp = (v: number) => Math.max(0, Math.min(1, v));

      switch (d.handle) {
        case "move": {
          // 整体平移，保持裁剪框大小不变
          const w = r.right - r.left;
          const h = r.bottom - r.top;
          let newLeft = r.left + dx;
          let newTop = r.top + dy;
          // 边界约束
          newLeft = Math.max(0, Math.min(1 - w, newLeft));
          newTop = Math.max(0, Math.min(1 - h, newTop));
          r.left = newLeft;
          r.top = newTop;
          r.right = newLeft + w;
          r.bottom = newTop + h;
          break;
        }
        case "nw":
          r.left = clamp(r.left + dx);
          r.top = clamp(r.top + dy);
          break;
        case "ne":
          r.right = clamp(r.right + dx);
          r.top = clamp(r.top + dy);
          break;
        case "sw":
          r.left = clamp(r.left + dx);
          r.bottom = clamp(r.bottom + dy);
          break;
        case "se":
          r.right = clamp(r.right + dx);
          r.bottom = clamp(r.bottom + dy);
          break;
        case "e":
          r.right = clamp(r.right + dx);
          break;
        case "w":
          r.left = clamp(r.left + dx);
          break;
      }
      // 保证最小裁剪区域
      if (r.right - r.left > 0.05 && r.bottom - r.top > 0.05) {
        setCropRect(r);
      }
    };

    const handleUp = () => {
      cropDragRef.current = null;
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, [isCropping]);

  // 调整大小
  const [isResizing, setIsResizing] = useState(false);
  const resizeState = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    handle: string;
    aspectRatio: number;
  } | null>(null);

  // ---- 重试上传 ----
  const handleRetryUpload = useCallback(async () => {
    if (!uploadFile) return;
    updateAttributes({ uploading: true, uploadError: "" });
    try {
      const url = await postManagementApi.uploadArticleImage(uploadFile);
      updateAttributes({ src: url, uploading: false, uploadError: "", _uploadFile: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "上传失败";
      updateAttributes({ uploading: false, uploadError: msg });
    }
  }, [uploadFile, updateAttributes]);

  // ---- 删除失败的图片 ----
  const handleDeleteNode = useCallback(() => {
    deleteNode();
  }, [deleteNode]);

  // ---- 切换 caption 显示 ----
  const handleCaptionToggle = useCallback(() => {
    if (caption === null) {
      // 没有 caption → 显示并聚焦
      updateAttributes({ caption: "" });
      requestAnimationFrame(() => {
        captionRef.current?.focus();
      });
    } else if (caption === "") {
      // 空 caption → 隐藏
      updateAttributes({ caption: null });
    } else {
      // 有内容 → 聚焦编辑
      requestAnimationFrame(() => {
        captionRef.current?.focus();
      });
    }
  }, [caption, updateAttributes]);

  // ---- Caption 编辑 ----
  const handleCaptionBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      const text = (e.currentTarget.textContent || "").trim();
      // 仅在失焦时同步到节点属性，避免输入过程中因重渲染丢失光标
      // 隐藏操作统一由工具栏按钮的 handleCaptionToggle 控制
      updateAttributes({ caption: text });
    },
    [updateAttributes]
  );

  const handleCaptionKeyDown = useCallback((e: React.KeyboardEvent) => {
    // 阻止所有键盘事件向 ProseMirror 冒泡，避免编辑器拦截按键
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
  }, []);

  // ---- 调整大小 ----
  const handleResizeStart = useCallback((e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();

    const img = imgRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    resizeState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
      handle,
      aspectRatio: rect.width / rect.height,
    };
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMove = (e: MouseEvent) => {
      if (!resizeState.current) return;
      const { startX, startWidth, handle, aspectRatio } = resizeState.current;

      let deltaX = e.clientX - startX;
      // 左侧手柄方向反转
      if (handle === "w" || handle === "sw" || handle === "nw") deltaX = -deltaX;

      const newWidth = Math.max(50, Math.round(startWidth + deltaX));
      const newHeight = Math.round(newWidth / aspectRatio);

      updateAttributes({ width: newWidth, height: newHeight });
    };

    const handleUp = () => {
      setIsResizing(false);
      resizeState.current = null;
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, [isResizing, updateAttributes]);

  // ---- 样式类名 ----
  const styleClass = imageStyle !== "none" ? `image-style-${imageStyle}` : "";
  const rotationClass = rotation ? `image-rotation-${rotation}` : "";

  return (
    <NodeViewWrapper
      className={`image-node-view image-align-${align} ${selected ? "is-selected" : ""}`}
      // 裁剪模式下禁用拖拽，防止图片被拖走
      {...(!isCropping ? { "data-drag-handle": "" } : {})}
    >
      <div
        ref={containerRef}
        className={`image-node-container ${styleClass} ${rotationClass}${isCropping ? " is-cropping" : ""}`}
        contentEditable={false}
        // 裁剪模式下阻止默认行为（防止浏览器拖拽图片），但不阻止冒泡以保持手柄事件正常
        onMouseDown={isCropping ? e => e.preventDefault() : undefined}
      >
        {/* 浮动工具栏 */}
        {selected && !uploading && !isCropping && (
          <ImageToolbar
            editor={editor}
            attrs={attrs}
            updateAttributes={updateAttributes}
            onCropClick={startCrop}
            onCaptionFocus={handleCaptionToggle}
          />
        )}

        {/* 裁剪模式工具栏 */}
        {isCropping && (
          <div className="image-crop-toolbar" contentEditable={false} onMouseDown={e => e.preventDefault()}>
            <button type="button" className="image-crop-toolbar-btn image-crop-toolbar-cancel" onClick={cancelCrop}>
              取消
            </button>
            <button type="button" className="image-crop-toolbar-btn image-crop-toolbar-confirm" onClick={confirmCrop}>
              确认裁剪
            </button>
          </div>
        )}

        {/* 图片 */}
        {imgLoadFailed ? (
          <div
            className="image-load-failed-placeholder"
            style={{
              width: width ? `${width}px` : "100%",
              maxWidth: "100%",
              aspectRatio: width && height ? `${width} / ${height}` : undefined,
              minHeight: !height ? "120px" : undefined,
            }}
          >
            <AlertTriangle className="image-load-failed-icon" />
            <span className="image-load-failed-text">图片加载失败</span>
            <span className="image-load-failed-hint">图片可能已被删除或链接已失效</span>
            <div className="image-load-failed-actions">
              <button
                type="button"
                className="image-load-failed-btn"
                onClick={e => {
                  e.stopPropagation();
                  setImgLoadFailed(false);
                }}
                onMouseDown={e => e.preventDefault()}
              >
                <RotateCw className="w-3 h-3" />
                重新加载
              </button>
            </div>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            className="image-node-img"
            style={{
              ...(width ? { width: `${width}px`, maxWidth: "100%" } : {}),
              height: "auto",
            }}
            draggable={false}
            onLoad={handleImgLoad}
            onError={handleImgError}
          />
        )}

        {/* 上传遮罩 */}
        {uploading && (
          <div className="image-upload-overlay">
            <div className="image-upload-spinner" />
            <span>上传中...</span>
          </div>
        )}

        {/* 上传失败遮罩 */}
        {!uploading && uploadError && (
          <div className="image-upload-error-overlay" contentEditable={false}>
            <AlertTriangle className="image-upload-error-icon" />
            <span className="image-upload-error-text">上传失败</span>
            <span className="image-upload-error-detail">{uploadError}</span>
            <div className="image-upload-error-actions">
              {uploadFile && (
                <button
                  type="button"
                  className="image-upload-error-btn image-upload-error-btn-retry"
                  onClick={e => {
                    e.stopPropagation();
                    handleRetryUpload();
                  }}
                  onMouseDown={e => e.preventDefault()}
                >
                  <RotateCw className="w-3 h-3" />
                  重试
                </button>
              )}
              <button
                type="button"
                className="image-upload-error-btn image-upload-error-btn-delete"
                onClick={e => {
                  e.stopPropagation();
                  handleDeleteNode();
                }}
                onMouseDown={e => e.preventDefault()}
              >
                <Trash2 className="w-3 h-3" />
                删除
              </button>
            </div>
          </div>
        )}

        {/* 裁剪遮罩 + 裁剪手柄 */}
        {isCropping && (
          <>
            {/* 四个暗色遮罩区域 */}
            <div
              className="image-crop-mask image-crop-mask-top"
              style={{ top: 0, left: 0, right: 0, height: `${cropRect.top * 100}%` }}
            />
            <div
              className="image-crop-mask image-crop-mask-bottom"
              style={{ bottom: 0, left: 0, right: 0, height: `${(1 - cropRect.bottom) * 100}%` }}
            />
            <div
              className="image-crop-mask image-crop-mask-left"
              style={{
                top: `${cropRect.top * 100}%`,
                left: 0,
                width: `${cropRect.left * 100}%`,
                height: `${(cropRect.bottom - cropRect.top) * 100}%`,
              }}
            />
            <div
              className="image-crop-mask image-crop-mask-right"
              style={{
                top: `${cropRect.top * 100}%`,
                right: 0,
                width: `${(1 - cropRect.right) * 100}%`,
                height: `${(cropRect.bottom - cropRect.top) * 100}%`,
              }}
            />
            {/* 裁剪区域边框（可拖拽平移） */}
            <div
              className="image-crop-border"
              style={{
                top: `${cropRect.top * 100}%`,
                left: `${cropRect.left * 100}%`,
                width: `${(cropRect.right - cropRect.left) * 100}%`,
                height: `${(cropRect.bottom - cropRect.top) * 100}%`,
              }}
              onMouseDown={handleCropAreaDown}
            >
              {/* 三分法网格线 */}
              <div className="image-crop-grid-h" style={{ top: "33.33%" }} />
              <div className="image-crop-grid-h" style={{ top: "66.66%" }} />
              <div className="image-crop-grid-v" style={{ left: "33.33%" }} />
              <div className="image-crop-grid-v" style={{ left: "66.66%" }} />
            </div>
            {/* 裁剪手柄（6个） */}
            <div
              className="image-crop-handle handle-nw"
              style={{ top: `${cropRect.top * 100}%`, left: `${cropRect.left * 100}%` }}
              onMouseDown={e => handleCropHandleDown(e, "nw")}
            />
            <div
              className="image-crop-handle handle-ne"
              style={{ top: `${cropRect.top * 100}%`, left: `${cropRect.right * 100}%` }}
              onMouseDown={e => handleCropHandleDown(e, "ne")}
            />
            <div
              className="image-crop-handle handle-sw"
              style={{ top: `${cropRect.bottom * 100}%`, left: `${cropRect.left * 100}%` }}
              onMouseDown={e => handleCropHandleDown(e, "sw")}
            />
            <div
              className="image-crop-handle handle-se"
              style={{ top: `${cropRect.bottom * 100}%`, left: `${cropRect.right * 100}%` }}
              onMouseDown={e => handleCropHandleDown(e, "se")}
            />
            <div
              className="image-crop-handle handle-e"
              style={{ top: `${((cropRect.top + cropRect.bottom) / 2) * 100}%`, left: `${cropRect.right * 100}%` }}
              onMouseDown={e => handleCropHandleDown(e, "e")}
            />
            <div
              className="image-crop-handle handle-w"
              style={{ top: `${((cropRect.top + cropRect.bottom) / 2) * 100}%`, left: `${cropRect.left * 100}%` }}
              onMouseDown={e => handleCropHandleDown(e, "w")}
            />
          </>
        )}

        {/* 调整手柄（6个：四角 + 左右中） */}
        {selected && !uploading && !uploadError && !isCropping && (
          <>
            <div className="image-resize-handle handle-nw" onMouseDown={e => handleResizeStart(e, "nw")} />
            <div className="image-resize-handle handle-ne" onMouseDown={e => handleResizeStart(e, "ne")} />
            <div className="image-resize-handle handle-sw" onMouseDown={e => handleResizeStart(e, "sw")} />
            <div className="image-resize-handle handle-se" onMouseDown={e => handleResizeStart(e, "se")} />
            <div className="image-resize-handle handle-e" onMouseDown={e => handleResizeStart(e, "e")} />
            <div className="image-resize-handle handle-w" onMouseDown={e => handleResizeStart(e, "w")} />
          </>
        )}
      </div>

      {/* 图片描述：仅在用户通过按钮开启后显示 */}
      {caption !== null && (
        <div
          ref={captionRef}
          className={`image-caption-area${!caption ? " is-empty" : ""}`}
          contentEditable={!uploading}
          suppressContentEditableWarning
          onBlur={handleCaptionBlur}
          onKeyDown={handleCaptionKeyDown}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          {caption || ""}
        </div>
      )}
    </NodeViewWrapper>
  );
}

// ============================================
// Tiptap 扩展定义
// ============================================

export const CustomImage = Image.extend({
  name: "image",

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-src") || element.getAttribute("src"),
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      caption: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const figure = element.closest("figure");
          if (figure) {
            const figcaption = figure.querySelector("figcaption");
            return figcaption?.textContent || null;
          }
          return null;
        },
        renderHTML: () => ({}),
      },
      align: {
        default: "center",
        parseHTML: (element: HTMLElement) => {
          const cls = element.getAttribute("class") || "";
          const figureCls = element.closest("figure")?.getAttribute("class") || "";
          const combined = `${cls} ${figureCls}`;
          if (combined.includes("image-align-left")) return "left";
          if (combined.includes("image-align-right")) return "right";

          const style = element.getAttribute("style") || "";
          if (style.includes("margin-right: auto") && style.includes("margin-left: 0")) return "left";
          if (style.includes("margin-left: auto") && style.includes("margin-right: 0")) return "right";

          return "center";
        },
        renderHTML: () => ({}),
      },
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const w = element.getAttribute("width");
          return w ? parseInt(w) : null;
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.width) return {};
          return { width: String(attributes.width) };
        },
      },
      height: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const h = element.getAttribute("height");
          return h ? parseInt(h) : null;
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.height) return {};
          return { height: String(attributes.height) };
        },
      },
      imageStyle: {
        default: "none",
        parseHTML: (element: HTMLElement) => {
          const cls = element.getAttribute("class") || "";
          const figureCls = element.closest("figure")?.getAttribute("class") || "";
          const combined = `${cls} ${figureCls}`;
          if (combined.includes("image-style-border")) return "border";
          if (combined.includes("image-style-shadow")) return "shadow";
          return "none";
        },
        renderHTML: () => ({}),
      },
      link: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const a = element.closest("a");
          return a?.getAttribute("href") || null;
        },
        renderHTML: () => ({}),
      },
      linkTarget: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const a = element.closest("a");
          return a?.getAttribute("target") || null;
        },
        renderHTML: () => ({}),
      },
      rotation: {
        default: 0,
        parseHTML: (element: HTMLElement) => {
          const style = element.getAttribute("style") || "";
          if (style.includes("rotate(90deg)")) return 90;
          if (style.includes("rotate(180deg)")) return 180;
          if (style.includes("rotate(270deg)")) return 270;
          return 0;
        },
        renderHTML: () => ({}),
      },
      uploading: {
        default: false,
        // 不渲染到 HTML，不从 HTML 解析
        renderHTML: () => ({}),
        parseHTML: () => false,
      },
      uploadError: {
        default: "",
        renderHTML: () => ({}),
        parseHTML: () => "",
      },
      _uploadFile: {
        default: null,
        renderHTML: () => ({}),
        parseHTML: () => null,
      },
    };
  },

  parseHTML() {
    return [
      // 解析 a > figure > img 或 a > img
      {
        tag: "a",
        getAttrs: (element: HTMLElement) => {
          const img = element.querySelector("img[src], img[data-src]");
          if (!img) return false;

          const figure = element.querySelector("figure") || img.closest("figure");
          const figcaption = figure?.querySelector("figcaption");
          const cls = img.getAttribute("class") || "";
          const figureCls = figure?.getAttribute("class") || element.getAttribute("class") || "";
          const combined = `${cls} ${figureCls}`;

          let align: string = "center";
          if (combined.includes("image-align-left")) align = "left";
          else if (combined.includes("image-align-right")) align = "right";

          let imageStyle: string = "none";
          if (combined.includes("image-style-border")) imageStyle = "border";
          else if (combined.includes("image-style-shadow")) imageStyle = "shadow";

          const w = img.getAttribute("width");
          const h = img.getAttribute("height");

          const imgStyle = img.getAttribute("style") || "";
          let rotation = 0;
          if (imgStyle.includes("rotate(90deg)")) rotation = 90;
          else if (imgStyle.includes("rotate(180deg)")) rotation = 180;
          else if (imgStyle.includes("rotate(270deg)")) rotation = 270;

          return {
            src: img.getAttribute("data-src") || img.getAttribute("src"),
            alt: img.getAttribute("alt"),
            title: img.getAttribute("title"),
            caption: figcaption?.textContent || null,
            align,
            imageStyle,
            width: w ? parseInt(w) : null,
            height: h ? parseInt(h) : null,
            link: element.getAttribute("href"),
            linkTarget: element.getAttribute("target"),
            rotation,
          };
        },
        priority: 60,
      },
      // 解析 figure > img + figcaption
      {
        tag: "figure",
        getAttrs: (element: HTMLElement) => {
          const img = element.querySelector("img[src], img[data-src]");
          if (!img) return false;

          const figcaption = element.querySelector("figcaption");
          const figureClass = element.getAttribute("class") || "";
          const imgClass = img.getAttribute("class") || "";
          const combined = `${figureClass} ${imgClass}`;

          let align: string = "center";
          if (combined.includes("image-align-left")) align = "left";
          else if (combined.includes("image-align-right")) align = "right";

          let imageStyle: string = "none";
          if (combined.includes("image-style-border")) imageStyle = "border";
          else if (combined.includes("image-style-shadow")) imageStyle = "shadow";

          const w = img.getAttribute("width");
          const h = img.getAttribute("height");

          const imgStyle = img.getAttribute("style") || "";
          let rotation = 0;
          if (imgStyle.includes("rotate(90deg)")) rotation = 90;
          else if (imgStyle.includes("rotate(180deg)")) rotation = 180;
          else if (imgStyle.includes("rotate(270deg)")) rotation = 270;

          return {
            src: img.getAttribute("data-src") || img.getAttribute("src"),
            alt: img.getAttribute("alt"),
            title: img.getAttribute("title"),
            caption: figcaption?.textContent || null,
            align,
            imageStyle,
            width: w ? parseInt(w) : null,
            height: h ? parseInt(h) : null,
            rotation,
          };
        },
      },
      // 解析普通 img
      {
        tag: "img[src]",
        getAttrs: (element: HTMLElement) => {
          const cls = element.getAttribute("class") || "";
          let align: string = "center";
          if (cls.includes("image-align-left")) align = "left";
          else if (cls.includes("image-align-right")) align = "right";

          let imageStyle: string = "none";
          if (cls.includes("image-style-border")) imageStyle = "border";
          else if (cls.includes("image-style-shadow")) imageStyle = "shadow";

          const w = element.getAttribute("width");
          const h = element.getAttribute("height");

          const style = element.getAttribute("style") || "";
          let rotation = 0;
          if (style.includes("rotate(90deg)")) rotation = 90;
          else if (style.includes("rotate(180deg)")) rotation = 180;
          else if (style.includes("rotate(270deg)")) rotation = 270;

          return {
            src: element.getAttribute("data-src") || element.getAttribute("src"),
            alt: element.getAttribute("alt"),
            title: element.getAttribute("title"),
            align,
            imageStyle,
            width: w ? parseInt(w) : null,
            height: h ? parseInt(h) : null,
            rotation,
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { align, caption, imageStyle, link, linkTarget, rotation } = node.attrs;
    const alignClass = `image-align-${align || "center"}`;
    const styleClass = imageStyle && imageStyle !== "none" ? `image-style-${imageStyle}` : "";

    const rotationStyle = rotation && rotation !== 0 ? `transform: rotate(${rotation}deg);` : "";

    const imgAttrs = mergeAttributes(HTMLAttributes, {
      class: [`article-image`, alignClass, styleClass].filter(Boolean).join(""),
      draggable: "true",
      ...(rotationStyle ? { style: rotationStyle } : {}),
    });

    // 删除不需要在 HTML 中的属性
    delete imgAttrs.imageStyle;
    delete imgAttrs.link;
    delete imgAttrs.linkTarget;
    delete imgAttrs.rotation;
    delete imgAttrs.uploading;
    delete imgAttrs.caption;
    delete imgAttrs.align;

    // 构建 img 元素
    if (caption) {
      const figureContent = [
        "figure",
        { class: `image-figure ${alignClass} ${styleClass}`.trim() },
        ["img", imgAttrs],
        ["figcaption", {}, String(caption)],
      ] as const;

      if (link) {
        const aAttrs: Record<string, string> = { href: link };
        if (linkTarget) aAttrs.target = linkTarget;
        if (linkTarget === "_blank") aAttrs.rel = "noopener noreferrer";
        return ["a", aAttrs, figureContent] as unknown as readonly [string, ...unknown[]];
      }

      return figureContent as unknown as readonly [string, ...unknown[]];
    }

    if (link) {
      const aAttrs: Record<string, string> = { href: link };
      if (linkTarget) aAttrs.target = linkTarget;
      if (linkTarget === "_blank") aAttrs.rel = "noopener noreferrer";
      return ["a", aAttrs, ["img", imgAttrs]] as unknown as readonly [string, ...unknown[]];
    }

    return ["img", imgAttrs] as const;
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setImageAlign:
        (align: "left" | "center" | "right") =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, { align });
        },
      setImageSize:
        (size: { width?: number | null; height?: number | null }) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, size);
        },
      setImageStyle:
        (style: "none" | "border" | "shadow") =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, { imageStyle: style });
        },
      setImageLink:
        (link: string | null, target?: string | null) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, {
            link,
            linkTarget: link ? (target ?? "_blank") : null,
          });
        },
      setImageRotation:
        (rotation: 0 | 90 | 180 | 270) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, { rotation });
        },
      resetImageAttributes:
        () =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, {
            align: "center",
            imageStyle: "none",
            rotation: 0,
            width: null,
            height: null,
            link: null,
            linkTarget: null,
          });
        },
    };
  },
});
