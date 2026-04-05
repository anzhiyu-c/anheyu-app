"use client";

import { useState, useRef, type ChangeEvent, type DragEvent } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, addToast } from "@heroui/react";
import { Upload, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { useImportArticles } from "@/hooks/queries/use-post-management";

interface ImportModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: ReturnType<typeof useImportArticles>;
}

export function ImportModal({ isOpen, onOpenChange, onImport }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSupportedFile = (nextFile: File) => {
    const lowerCaseName = nextFile.name.toLowerCase();
    return lowerCaseName.endsWith(".json") || lowerCaseName.endsWith(".zip");
  };

  const selectFile = (nextFile: File | null) => {
    if (!nextFile) return;

    if (!isSupportedFile(nextFile)) {
      addToast({ title: "仅支持 JSON 或 ZIP 文件", color: "warning", timeout: 3000 });
      return;
    }

    setFile(nextFile);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    selectFile(event.target.files?.[0] ?? null);
  };

  const handleDragEnter = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0] ?? null);
  };

  const handleImport = async () => {
    if (!file) {
      addToast({ title: "请选择文件", color: "warning", timeout: 3000 });
      return;
    }
    try {
      const result = await onImport.mutateAsync({ file });
      const msg =
        result.failed_count > 0
          ? `导入完成：成功 ${result.success_count} 篇，跳过 ${result.skipped_count} 篇，失败 ${result.failed_count} 篇`
          : `导入完成：成功 ${result.success_count} 篇，跳过 ${result.skipped_count} 篇`;
      addToast({
        title: msg,
        color: result.failed_count > 0 ? "warning" : "success",
        timeout: 5000,
      });
      setFile(null);
      onOpenChange(false);
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "导入失败", color: "danger", timeout: 3000 });
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur" placement="center">
      <ModalContent>
        {onClose => (
          <>
            <ModalHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary-50">
                  <Upload className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <span>导入文章</span>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">支持 JSON 或 ZIP 格式</p>
                </div>
              </div>
            </ModalHeader>
            <ModalBody>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.zip"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "w-full border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer",
                  isDragging
                    ? "border-primary bg-primary-50/40 ring-2 ring-primary/25"
                    : "",
                  file
                    ? "border-primary/50 bg-primary-50/30"
                    : "border-border/60 hover:border-primary/30 hover:bg-muted/30"
                )}
              >
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-2.5 rounded-xl bg-primary-100">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <div className="p-2.5 rounded-xl bg-muted">
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-medium">{isDragging ? "释放鼠标上传文件" : "拖拽文件到此处，或点击选择文件"}</span>
                    <span className="text-xs text-muted-foreground/40">JSON / ZIP</span>
                  </div>
                )}
              </button>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose} isDisabled={onImport.isPending}>
                取消
              </Button>
              <Button color="primary" onPress={handleImport} isDisabled={!file} isLoading={onImport.isPending}>
                开始导入
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
