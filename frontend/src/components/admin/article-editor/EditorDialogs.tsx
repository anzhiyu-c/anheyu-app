"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Switch } from "@heroui/react";
import { Link2, ImageIcon, Unlink, ExternalLink, Upload, ImagePlus } from "lucide-react";
import { postManagementApi } from "@/lib/api/post-management";

/** 校验是否为合法 URL（支持 http/https/mailto/tel 等协议） */
function isValidUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return ["http:", "https:", "mailto:", "tel:", "ftp:"].includes(url.protocol);
  } catch {
    // 允许相对路径（以 / 开头）
    return value.trim().startsWith("/");
  }
}

// ===================================
// 链接插入对话框
// ===================================

interface LinkDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** 当前已有的链接地址（编辑模式） */
  currentUrl?: string;
  /** 当前链接的 target 属性 */
  currentTarget?: string | null;
  onConfirm: (url: string, target: string) => void;
  onRemove: () => void;
}

export function LinkDialog({ isOpen, onOpenChange, currentUrl, currentTarget, onConfirm, onRemove }: LinkDialogProps) {
  const [url, setUrl] = useState("");
  const [openInNewTab, setOpenInNewTab] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const [prevIsOpen, setPrevIsOpen] = useState(false);

  // 打开时重置状态（渲染阶段调整状态，React 推荐模式）
  if (isOpen && !prevIsOpen) {
    setUrl(currentUrl || "");
    // 编辑模式：保留当前 target；新建模式：默认新标签页打开
    setOpenInNewTab(currentUrl ? currentTarget === "_blank" : true);
    setPrevIsOpen(true);
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

  // 打开时聚焦（仅副作用）
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 链接校验：有输入且不合法时显示错误
  const urlTrimmed = url.trim();
  const urlError = useMemo(() => {
    if (!urlTrimmed) return "";
    return isValidUrl(urlTrimmed) ? "" : "请输入有效的链接地址";
  }, [urlTrimmed]);
  const canConfirm = urlTrimmed.length > 0 && !urlError;

  const handleConfirm = useCallback(() => {
    if (!canConfirm) return;
    onConfirm(urlTrimmed, openInNewTab ? "_blank" : "_self");
    onOpenChange(false);
  }, [canConfirm, urlTrimmed, openInNewTab, onConfirm, onOpenChange]);

  const handleRemove = useCallback(() => {
    onRemove();
    onOpenChange(false);
  }, [onRemove, onOpenChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
      }
    },
    [handleConfirm]
  );

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="md"
      classNames={{ wrapper: "z-[200]", backdrop: "z-[199]" }}
    >
      <ModalContent>
        {onClose => (
          <>
            <ModalHeader className="flex items-center gap-2 text-base">
              <Link2 className="w-4 h-4" />
              <span>{currentUrl ? "编辑链接" : "插入链接"}</span>
            </ModalHeader>

            <ModalBody className="gap-3">
              <Input
                ref={inputRef}
                label="链接地址"
                placeholder="https://example.com"
                value={url}
                onValueChange={setUrl}
                onKeyDown={handleKeyDown}
                variant="bordered"
                autoComplete="url"
                isInvalid={!!urlError}
                errorMessage={urlError}
                startContent={<Link2 className="w-4 h-4 text-muted-foreground shrink-0" />}
              />

              <Switch
                size="sm"
                isSelected={openInNewTab}
                onValueChange={setOpenInNewTab}
                classNames={{
                  base: "flex-row-reverse justify-between w-full max-w-full py-1.5 px-1",
                  label: "text-sm text-foreground/70",
                }}
                thumbIcon={<ExternalLink className="w-2.5 h-2.5" />}
              >
                在新标签页打开
              </Switch>
            </ModalBody>

            <ModalFooter>
              {currentUrl && (
                <Button
                  variant="flat"
                  color="danger"
                  onPress={handleRemove}
                  size="sm"
                  startContent={<Unlink className="w-3.5 h-3.5" />}
                  className="mr-auto"
                >
                  移除链接
                </Button>
              )}
              <Button variant="flat" onPress={onClose} size="sm">
                取消
              </Button>
              <Button color="primary" onPress={handleConfirm} isDisabled={!canConfirm} size="sm">
                {currentUrl ? "更新" : "插入"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

// ===================================
// 图片插入对话框
// ===================================

interface ImageDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (url: string, alt?: string) => void;
}

export function ImageDialog({ isOpen, onOpenChange, onConfirm }: ImageDialogProps) {
  const [mode, setMode] = useState<string>("url");
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [previewError, setPreviewError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prevIsOpen, setPrevIsOpen] = useState(false);

  // 上传相关状态
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // 打开时重置状态（渲染阶段调整状态）
  if (isOpen && !prevIsOpen) {
    setMode("url");
    setUrl("");
    setAlt("");
    setPreviewError(false);
    setSelectedFile(null);
    setFilePreviewUrl("");
    setIsUploading(false);
    setIsDragOver(false);
    setPrevIsOpen(true);
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

  // 打开时聚焦
  useEffect(() => {
    if (isOpen && mode === "url") {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, mode]);

  // 清理 blob URL
  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    };
  }, [filePreviewUrl]);

  // 图片地址校验
  const imgUrlTrimmed = url.trim();
  const imgUrlError = useMemo(() => {
    if (!imgUrlTrimmed) return "";
    return isValidUrl(imgUrlTrimmed) ? "" : "请输入有效的图片地址";
  }, [imgUrlTrimmed]);
  const canInsertByUrl = imgUrlTrimmed.length > 0 && !imgUrlError;
  const canInsertByUpload = selectedFile !== null && !isUploading;
  const canInsert = mode === "url" ? canInsertByUrl : canInsertByUpload;

  // 选择文件
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    setSelectedFile(file);
    const blobUrl = URL.createObjectURL(file);
    setFilePreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return blobUrl;
    });
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
      e.target.value = "";
    },
    [handleFileSelect]
  );

  // 拖拽
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  // 确认插入
  const handleConfirm = useCallback(async () => {
    if (mode === "url") {
      if (!canInsertByUrl) return;
      onConfirm(imgUrlTrimmed, alt.trim() || undefined);
      onOpenChange(false);
    } else {
      if (!selectedFile) return;
      setIsUploading(true);
      try {
        const remoteUrl = await postManagementApi.uploadArticleImage(selectedFile);
        onConfirm(remoteUrl, alt.trim() || undefined);
        onOpenChange(false);
      } catch (err) {
        console.error("图片上传失败:", err);
      } finally {
        setIsUploading(false);
      }
    }
  }, [mode, canInsertByUrl, imgUrlTrimmed, alt, selectedFile, onConfirm, onOpenChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleConfirm();
      }
    },
    [handleConfirm]
  );

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="lg"
      classNames={{ wrapper: "z-[200]", backdrop: "z-[199]" }}
    >
      <ModalContent>
        {onClose => (
          <>
            <ModalHeader className="flex items-center gap-2 text-base">
              <ImagePlus className="w-4 h-4" />
              <span>插入图片</span>
            </ModalHeader>

            <ModalBody className="gap-3">
              <div className="flex p-1 rounded-xl bg-muted gap-1">
                <button
                  type="button"
                  className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    mode === "url"
                      ? "bg-white text-foreground shadow-sm dark:bg-secondary"
                      : "text-muted-foreground hover:text-foreground/80"
                  }`}
                  onClick={() => setMode("url")}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  图片链接
                </button>
                <button
                  type="button"
                  className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    mode === "upload"
                      ? "bg-white text-foreground shadow-sm dark:bg-secondary"
                      : "text-muted-foreground hover:text-foreground/80"
                  }`}
                  onClick={() => setMode("upload")}
                >
                  <Upload className="w-3.5 h-3.5" />
                  上传图片
                </button>
              </div>

              {mode === "url" ? (
                <>
                  <Input
                    ref={inputRef}
                    label="图片地址"
                    placeholder="https://example.com/image.png"
                    value={url}
                    onValueChange={v => {
                      setUrl(v);
                      setPreviewError(false);
                    }}
                    onKeyDown={handleKeyDown}
                    variant="bordered"
                    autoComplete="url"
                    isInvalid={!!imgUrlError}
                    errorMessage={imgUrlError}
                    startContent={<ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />}
                  />

                  <Input
                    label="替代文本（可选）"
                    placeholder="图片描述，用于无障碍访问"
                    value={alt}
                    onValueChange={setAlt}
                    onKeyDown={handleKeyDown}
                    variant="bordered"
                    size="sm"
                  />

                  {/* 图片预览 */}
                  {canInsertByUrl && (
                    <div className="border border-border/60 rounded-lg overflow-hidden bg-muted/30">
                      <div className="px-3 py-1.5 text-xs text-muted-foreground border-b border-border/60">预览</div>
                      <div className="p-3 flex items-center justify-center min-h-[120px]">
                        {previewError ? (
                          <span className="text-xs text-muted-foreground/40">无法加载预览</span>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={url}
                            alt={alt || "预览"}
                            className="max-h-[200px] max-w-full object-contain rounded"
                            onError={() => setPreviewError(true)}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* 上传区域 */}
                  <div
                    className={`flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                      isDragOver
                        ? "border-primary bg-primary/5"
                        : "border-border/80 hover:border-primary/50 hover:bg-muted/30"
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    {selectedFile ? (
                      <>
                        {/* 已选择文件：显示预览 */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={filePreviewUrl}
                          alt="预览"
                          className="max-h-[180px] max-w-full object-contain rounded"
                        />
                        <div className="text-sm text-muted-foreground text-center">
                          <span className="font-medium">{selectedFile.name}</span>
                          <span className="text-muted-foreground ml-2">
                            ({(selectedFile.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <Button size="sm" variant="flat" onPress={() => fileInputRef.current?.click()}>
                          重新选择
                        </Button>
                      </>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 text-muted-foreground/40" />
                        <div className="text-sm text-muted-foreground">点击或拖拽图片到此处上传</div>
                        <div className="text-xs text-muted-foreground">支持 JPG、PNG、GIF、WebP 格式</div>
                      </>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />

                  <Input
                    label="替代文本（可选）"
                    placeholder="图片描述，用于无障碍访问"
                    value={alt}
                    onValueChange={setAlt}
                    variant="bordered"
                    size="sm"
                  />
                </>
              )}
            </ModalBody>

            <ModalFooter>
              <Button variant="flat" onPress={onClose} size="sm">
                取消
              </Button>
              <Button color="primary" onPress={handleConfirm} isDisabled={!canInsert} isLoading={isUploading} size="sm">
                {isUploading ? "上传中..." : "插入图片"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
