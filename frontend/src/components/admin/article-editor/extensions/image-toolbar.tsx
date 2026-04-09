/**
 * ImageToolbar - 图片浮动工具栏
 * 选中图片时在图片上方显示，提供旋转、裁剪、尺寸、链接、描述、对齐、样式、批量应用、复原等功能
 */
"use client";

import { useState, useCallback } from "react";
import type { Editor } from "@tiptap/core";
import {
  Tooltip,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Input,
  Button,
  ButtonGroup,
  ModalBody,
  ModalFooter,
  Checkbox,
} from "@heroui/react";
import {
  RotateCw,
  Crop,
  Scaling,
  Pencil,
  Link2,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ImageIcon,
  CopyCheck,
  RotateCcw,
  Check,
  ChevronDown,
} from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";

// ---- 类型 ----

interface ImageToolbarProps {
  editor: Editor;
  attrs: Record<string, unknown>;
  updateAttributes: (attrs: Record<string, unknown>) => void;
  onCropClick: () => void;
  onCaptionFocus: () => void;
}

// ---- 工具栏按钮 ----

function TBtn({
  onClick,
  tip,
  isActive,
  children,
}: {
  onClick: () => void;
  tip: string;
  isActive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={tip} size="sm" delay={300} closeDelay={0} placement="bottom">
      <button
        type="button"
        className={`image-toolbar-btn${isActive ? " is-active" : ""}`}
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }}
        onMouseDown={e => e.preventDefault()}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function TDivider() {
  return <div className="image-toolbar-divider" />;
}

// ---- 主组件 ----

export function ImageToolbar({ editor, attrs, updateAttributes, onCropClick, onCaptionFocus }: ImageToolbarProps) {
  const align = (attrs.align as string) || "center";
  const imageStyle = (attrs.imageStyle as string) || "none";
  const rotation = (attrs.rotation as number) || 0;
  const link = (attrs.link as string) || "";
  const width = attrs.width as number | null;
  const height = attrs.height as number | null;

  const src = (attrs.src as string) || "";
  const alt = (attrs.alt as string) || "";

  // ---- Popover 状态 ----
  const [sizeOpen, setSizeOpen] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);

  // ---- 尺寸 ----
  const [sizeW, setSizeW] = useState<string>(width ? String(width) : "");
  const [sizeH, setSizeH] = useState<string>(height ? String(height) : "");

  // ---- 编辑图片对话框 ----
  const [editOpen, setEditOpen] = useState(false);
  const [editSrc, setEditSrc] = useState(src);
  const [editAlt, setEditAlt] = useState(alt);
  const [editW, setEditW] = useState<string>(width ? String(width) : "");
  const [editH, setEditH] = useState<string>(height ? String(height) : "");
  const [keepAspectRatio, setKeepAspectRatio] = useState(true);

  // ---- 链接 ----
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState(link);

  // ---- 旋转 ----
  const handleRotate = useCallback(() => {
    const next = ((rotation + 90) % 360) as 0 | 90 | 180 | 270;
    updateAttributes({ rotation: next });
  }, [rotation, updateAttributes]);

  // ---- 尺寸确认 ----
  const handleSizeConfirm = useCallback(() => {
    const w = sizeW ? parseInt(sizeW, 10) : null;
    const h = sizeH ? parseInt(sizeH, 10) : null;
    updateAttributes({
      width: w && w > 0 ? w : null,
      height: h && h > 0 ? h : null,
    });
    setSizeOpen(false);
  }, [sizeW, sizeH, updateAttributes]);

  // ---- 百分比预设 ----
  const handleSizePercent = useCallback(
    (percent: number) => {
      // 基于编辑器内容区宽度计算（减去左右 padding 64px）
      const editorWidth = editor.view.dom.clientWidth - 64;
      const newWidth = Math.round((editorWidth * percent) / 100);
      const aspectRatio = width && height ? height / width : null;
      const newHeight = aspectRatio ? Math.round(newWidth * aspectRatio) : null;
      updateAttributes({ width: newWidth, height: newHeight });
      setSizeW(String(newWidth));
      setSizeH(newHeight ? String(newHeight) : "");
    },
    [editor, width, height, updateAttributes]
  );

  // ---- 编辑图片确认 ----
  const handleEditConfirm = useCallback(() => {
    const newSrc = editSrc.trim();
    const newAlt = editAlt.trim();
    const w = editW ? parseInt(editW, 10) : null;
    const h = editH ? parseInt(editH, 10) : null;
    updateAttributes({
      ...(newSrc ? { src: newSrc } : {}),
      alt: newAlt || null,
      width: w && w > 0 ? w : null,
      height: h && h > 0 ? h : null,
    });
    setEditOpen(false);
  }, [editSrc, editAlt, editW, editH, updateAttributes]);

  // ---- 编辑对话框中宽度变化（保持长宽比） ----
  const handleEditWidthChange = useCallback(
    (val: string) => {
      setEditW(val);
      if (keepAspectRatio && width && height && val) {
        const newW = parseInt(val, 10);
        if (newW > 0) {
          setEditH(String(Math.round((newW * height) / width)));
        }
      }
    },
    [keepAspectRatio, width, height]
  );

  // ---- 编辑对话框中高度变化（保持长宽比） ----
  const handleEditHeightChange = useCallback(
    (val: string) => {
      setEditH(val);
      if (keepAspectRatio && width && height && val) {
        const newH = parseInt(val, 10);
        if (newH > 0) {
          setEditW(String(Math.round((newH * width) / height)));
        }
      }
    },
    [keepAspectRatio, width, height]
  );

  // ---- 链接确认 ----
  const handleLinkConfirm = useCallback(() => {
    const url = linkUrl.trim();
    updateAttributes({
      link: url || null,
      linkTarget: url ? "_blank" : null,
    });
    setLinkOpen(false);
  }, [linkUrl, updateAttributes]);

  // ---- 对齐 ----
  const handleAlign = useCallback(
    (a: string) => {
      updateAttributes({ align: a });
      setAlignOpen(false);
    },
    [updateAttributes]
  );

  // ---- 样式 ----
  const handleStyle = useCallback(
    (s: string) => {
      updateAttributes({ imageStyle: s });
      setStyleOpen(false);
    },
    [updateAttributes]
  );

  // ---- 批量应用 ----
  const applyToAll = useCallback(
    (type: "style" | "width") => {
      const { doc, tr } = editor.state;
      doc.descendants((node, pos) => {
        if (node.type.name === "image") {
          if (type === "style") {
            tr.setNodeMarkup(pos, null, { ...node.attrs, imageStyle });
          } else {
            tr.setNodeMarkup(pos, null, { ...node.attrs, width, height });
          }
        }
      });
      editor.view.dispatch(tr);
      setBatchOpen(false);
    },
    [editor, imageStyle, width, height]
  );

  // ---- 复原 ----
  const handleReset = useCallback(() => {
    updateAttributes({
      align: "center",
      imageStyle: "none",
      rotation: 0,
      width: null,
      height: null,
      link: null,
      linkTarget: null,
    });
  }, [updateAttributes]);

  return (
    <div className="image-floating-toolbar" contentEditable={false} onMouseDown={e => e.preventDefault()}>
      {/* 旋转 */}
      <TBtn onClick={handleRotate} tip="旋转">
        <RotateCw />
      </TBtn>

      {/* 裁剪 */}
      <TBtn onClick={onCropClick} tip="裁剪">
        <Crop />
      </TBtn>

      {/* 宽高 */}
      <Popover
        placement="bottom"
        isOpen={sizeOpen}
        onOpenChange={open => {
          setSizeOpen(open);
          if (open) {
            setSizeW(width ? String(width) : "");
            setSizeH(height ? String(height) : "");
          }
        }}
      >
        <PopoverTrigger>
          <div>
            <Tooltip content="设置图片尺寸" size="sm" delay={300} closeDelay={0} placement="bottom">
              <button
                type="button"
                className="image-toolbar-btn"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSizeOpen(!sizeOpen);
                }}
                onMouseDown={e => e.preventDefault()}
              >
                <Scaling />
                <span>宽高</span>
              </button>
            </Tooltip>
          </div>
        </PopoverTrigger>
        <PopoverContent>
          <div className="flex flex-col gap-3 p-2">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                label="宽"
                labelPlacement="outside-left"
                size="sm"
                placeholder="宽度"
                value={sizeW}
                onValueChange={setSizeW}
                min={1}
                classNames={{ base: "max-w-[140px]", input: "text-center", label: "text-sm font-medium" }}
                onKeyDown={e => {
                  if (e.key === "Enter") handleSizeConfirm();
                }}
              />
              <Input
                type="number"
                label="高"
                labelPlacement="outside-left"
                size="sm"
                placeholder="高度"
                value={sizeH}
                onValueChange={setSizeH}
                min={1}
                classNames={{ base: "max-w-[140px]", input: "text-center", label: "text-sm font-medium" }}
                onKeyDown={e => {
                  if (e.key === "Enter") handleSizeConfirm();
                }}
              />
            </div>
            <ButtonGroup size="sm" variant="flat" fullWidth>
              {([25, 50, 75, 100] as const).map(p => (
                <Button key={p} onPress={() => handleSizePercent(p)}>
                  {p}%
                </Button>
              ))}
            </ButtonGroup>
          </div>
        </PopoverContent>
      </Popover>

      <TDivider />

      {/* 编辑图片 */}
      <TBtn
        onClick={() => {
          setEditSrc(src);
          setEditAlt(alt);
          setEditW(width ? String(width) : "");
          setEditH(height ? String(height) : "");
          setEditOpen(true);
        }}
        tip="编辑图片"
      >
        <Pencil />
        <span>编辑</span>
      </TBtn>

      {/* 编辑图片 Modal */}
      <AdminDialog
        isOpen={editOpen}
        onOpenChange={setEditOpen}
        size="md"
        classNames={{ wrapper: "z-[200]", backdrop: "z-[199]" }}
        onMouseDown={e => e.stopPropagation()}
        header={{ title: "编辑图片", description: "修改图片地址、描述与尺寸设置", icon: ImageIcon }}
      >
        {onClose => (
          <>
            <ModalBody className="gap-3">
              <Input
                label="源"
                placeholder="图片地址"
                value={editSrc}
                onValueChange={setEditSrc}
                variant="bordered"
                size="sm"
                description="图片的 URL 地址"
              />
              <Input
                label="图片说明"
                placeholder="用于无障碍访问的图片描述"
                value={editAlt}
                onValueChange={setEditAlt}
                variant="bordered"
                size="sm"
              />
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">尺寸</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="宽度"
                    value={editW}
                    onValueChange={handleEditWidthChange}
                    variant="bordered"
                    size="sm"
                    min={1}
                    classNames={{ base: "flex-1" }}
                    startContent={<span className="text-muted-foreground text-xs">W</span>}
                  />
                  <span className="text-muted-foreground/40">×</span>
                  <Input
                    type="number"
                    placeholder="高度"
                    value={editH}
                    onValueChange={handleEditHeightChange}
                    variant="bordered"
                    size="sm"
                    min={1}
                    classNames={{ base: "flex-1" }}
                    startContent={<span className="text-muted-foreground text-xs">H</span>}
                  />
                </div>
                <Checkbox size="sm" isSelected={keepAspectRatio} onValueChange={setKeepAspectRatio}>
                  保持长宽比
                </Checkbox>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onClose} size="sm">
                取消
              </Button>
              <Button color="primary" onPress={handleEditConfirm} size="sm">
                确定
              </Button>
            </ModalFooter>
          </>
        )}
      </AdminDialog>

      {/* 链接 */}
      <Popover
        placement="bottom"
        isOpen={linkOpen}
        onOpenChange={open => {
          setLinkOpen(open);
          if (open) {
            setLinkUrl(link);
          }
        }}
      >
        <PopoverTrigger>
          <div>
            <Tooltip content="设置图片链接" size="sm" delay={300} closeDelay={0} placement="bottom">
              <button
                type="button"
                className={`image-toolbar-btn${link ? " is-active" : ""}`}
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setLinkOpen(!linkOpen);
                }}
                onMouseDown={e => e.preventDefault()}
              >
                <Link2 />
              </button>
            </Tooltip>
          </div>
        </PopoverTrigger>
        <PopoverContent>
          <div className="flex flex-col gap-2 p-2 min-w-[220px]">
            <Input
              size="sm"
              placeholder="请输入跳转链接"
              value={linkUrl}
              onValueChange={setLinkUrl}
              onKeyDown={e => {
                if (e.key === "Enter") handleLinkConfirm();
              }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              {link && (
                <Button
                  size="sm"
                  variant="light"
                  color="danger"
                  onPress={() => {
                    updateAttributes({ link: null, linkTarget: null });
                    setLinkOpen(false);
                  }}
                >
                  移除
                </Button>
              )}
              <Button size="sm" color="primary" onPress={handleLinkConfirm}>
                确定
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* 描述 */}
      <TBtn
        onClick={onCaptionFocus}
        tip={attrs.caption !== null ? "隐藏图片描述" : "添加图片描述"}
        isActive={attrs.caption !== null}
      >
        <Type />
        <span>描述</span>
      </TBtn>

      <TDivider />

      {/* 对齐 */}
      <Popover placement="bottom" isOpen={alignOpen} onOpenChange={setAlignOpen}>
        <PopoverTrigger>
          <div>
            <Tooltip content="对齐方式" size="sm" delay={300} closeDelay={0} placement="bottom">
              <button
                type="button"
                className="image-toolbar-btn"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setAlignOpen(!alignOpen);
                }}
                onMouseDown={e => e.preventDefault()}
              >
                {align === "left" ? <AlignLeft /> : align === "right" ? <AlignRight /> : <AlignCenter />}
                <ChevronDown style={{ width: 10, height: 10 }} />
              </button>
            </Tooltip>
          </div>
        </PopoverTrigger>
        <PopoverContent>
          <div style={{ display: "flex", flexDirection: "column", padding: 4, minWidth: 130 }}>
            {(
              [
                { key: "left", label: "左对齐", icon: <AlignLeft style={{ width: 14, height: 14 }} /> },
                { key: "center", label: "居中对齐", icon: <AlignCenter style={{ width: 14, height: 14 }} /> },
                { key: "right", label: "右对齐", icon: <AlignRight style={{ width: 14, height: 14 }} /> },
              ] as const
            ).map(item => (
              <button
                key={item.key}
                type="button"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "6px 10px",
                  border: "none",
                  background: "transparent",
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: "pointer",
                }}
                className="hover:bg-muted transition-colors"
                onClick={() => handleAlign(item.key)}
              >
                {align === item.key ? (
                  <Check style={{ width: 14, height: 14, color: "var(--anzhiyu-theme, #4259ef)" }} />
                ) : (
                  <span style={{ width: 14 }} />
                )}
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* 样式 */}
      <Popover placement="bottom" isOpen={styleOpen} onOpenChange={setStyleOpen}>
        <PopoverTrigger>
          <div>
            <Tooltip content="图片样式" size="sm" delay={300} closeDelay={0} placement="bottom">
              <button
                type="button"
                className="image-toolbar-btn"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setStyleOpen(!styleOpen);
                }}
                onMouseDown={e => e.preventDefault()}
              >
                <ImageIcon />
                <span>样式</span>
                <ChevronDown style={{ width: 10, height: 10 }} />
              </button>
            </Tooltip>
          </div>
        </PopoverTrigger>
        <PopoverContent>
          <div style={{ display: "flex", flexDirection: "column", padding: 4, minWidth: 120 }}>
            {(
              [
                { key: "none", label: "无样式" },
                { key: "border", label: "图片描边" },
                { key: "shadow", label: "图片阴影" },
              ] as const
            ).map(item => (
              <button
                key={item.key}
                type="button"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "6px 10px",
                  border: "none",
                  background: "transparent",
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: "pointer",
                }}
                className="hover:bg-muted transition-colors"
                onClick={() => handleStyle(item.key)}
              >
                {imageStyle === item.key ? (
                  <Check style={{ width: 14, height: 14, color: "var(--anzhiyu-theme, #4259ef)" }} />
                ) : (
                  <span style={{ width: 14 }} />
                )}
                {item.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* 批量应用 */}
      <Popover placement="bottom" isOpen={batchOpen} onOpenChange={setBatchOpen}>
        <PopoverTrigger>
          <div>
            <Tooltip
              content={
                <span>
                  批量应用格式：
                  <br />
                  对本文档的图片一键应用样式和宽度
                </span>
              }
              size="sm"
              delay={300}
              closeDelay={0}
              placement="bottom"
            >
              <button
                type="button"
                className="image-toolbar-btn"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setBatchOpen(!batchOpen);
                }}
                onMouseDown={e => e.preventDefault()}
              >
                <CopyCheck />
                <ChevronDown style={{ width: 10, height: 10 }} />
              </button>
            </Tooltip>
          </div>
        </PopoverTrigger>
        <PopoverContent>
          <div style={{ display: "flex", flexDirection: "column", padding: 4, minWidth: 160 }}>
            <button
              type="button"
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                padding: "6px 10px",
                border: "none",
                background: "transparent",
                borderRadius: 8,
                fontSize: 13,
                cursor: "pointer",
                textAlign: "left",
              }}
              className="hover:bg-muted transition-colors"
              onClick={() => applyToAll("style")}
            >
              同步图片样式到全文
            </button>
            <button
              type="button"
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                padding: "6px 10px",
                border: "none",
                background: "transparent",
                borderRadius: 8,
                fontSize: 13,
                cursor: "pointer",
                textAlign: "left",
              }}
              className="hover:bg-muted transition-colors"
              onClick={() => applyToAll("width")}
            >
              同步图片宽度到全文
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <TDivider />

      {/* 复原 */}
      <TBtn onClick={handleReset} tip="复原">
        <RotateCcw />
      </TBtn>
    </div>
  );
}
