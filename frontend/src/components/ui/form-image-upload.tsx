"use client";

import * as React from "react";
import { Input, Button } from "@heroui/react";
import { cn } from "@/lib/utils";
import { Upload, Loader2 } from "lucide-react";
import { postManagementApi } from "@/lib/api/post-management";
import { addToast } from "@heroui/react";

export interface FormImageUploadProps {
  /** 标签 */
  label?: string;
  /** 内联标签（显示在输入框左侧的 badge） */
  inlineLabel?: string;
  /** 当前图片 URL */
  value?: string;
  /** 值变化回调 */
  onValueChange?: (value: string) => void;
  /** 描述文本 */
  description?: string;
  /** 占位文本 */
  placeholder?: string;
  /** 预览尺寸 */
  previewSize?: "sm" | "md" | "lg";
  /** 预览最大宽度（像素） */
  previewMaxWidth?: number;
  /** 预览最大高度（像素） */
  previewMaxHeight?: number;
  /** 是否圆形预览 */
  rounded?: boolean;
  /** 是否隐藏预览 */
  hidePreview?: boolean;
  /** 容器额外 className */
  className?: string;
  /** 接受的文件类型 */
  accept?: string;
  /** 是否必填（label 后显示红色星号） */
  isRequired?: boolean;
}

const FormImageUpload = React.forwardRef<HTMLDivElement, FormImageUploadProps>(
  (
    {
      label,
      inlineLabel,
      value,
      onValueChange,
      description,
      placeholder = "输入图片 URL",
      previewSize = "md",
      previewMaxWidth,
      previewMaxHeight,
      rounded,
      hidePreview,
      className,
      accept = "image/*",
      isRequired,
    },
    ref
  ) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [imgError, setImgError] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);

    const sizeMap = {
      sm: { maxW: 56, maxH: 56 },
      md: { maxW: 180, maxH: 100 },
      lg: { maxW: 260, maxH: 120 },
    };
    const sizeConfig = sizeMap[previewSize];

    // value 变化时重置图片错误状态
    React.useEffect(() => {
      setImgError(false);
    }, [value]);

    const showPreview = value && !imgError && !hidePreview;

    // 处理文件上传
    const handleFileSelect = React.useCallback(
      async (file: File) => {
        if (!file.type.startsWith("image/")) {
          addToast({ title: "请选择图片文件", color: "warning" });
          return;
        }
        setUploading(true);
        try {
          const url = await postManagementApi.uploadArticleImage(file);
          onValueChange?.(url);
          addToast({ title: "上传成功", color: "success" });
        } catch (err) {
          console.error("图片上传失败:", err);
          addToast({
            title: "上传失败",
            description: err instanceof Error ? err.message : "请稍后重试",
            color: "danger",
          });
        } finally {
          setUploading(false);
        }
      },
      [onValueChange]
    );

    const handleUploadClick = () => {
      fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
      // 重置 input 以便重复选择同一文件
      e.target.value = "";
    };

    return (
      <div ref={ref} className={cn("flex flex-col gap-2", className)}>
        {label && (
          <label className="text-sm font-medium text-foreground/80">
            {label}
            {isRequired && <span className="ml-0.5 text-danger">*</span>}
          </label>
        )}

        {/* 输入行：可选 inlineLabel + input + 上传按钮 */}
        <div className="flex min-w-0 items-center gap-2">
          {inlineLabel && (
            <span
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium",
                "bg-primary/10 text-primary border border-primary/20"
              )}
            >
              {inlineLabel}
            </span>
          )}

          <Input
            value={value || ""}
            placeholder={placeholder}
            onValueChange={onValueChange}
            isClearable
            onClear={() => onValueChange?.("")}
            className="min-w-0 flex-1"
            classNames={{
              inputWrapper: cn(
                "rounded-xl border border-border/60 bg-card shadow-none!",
                "data-[hover=true]:bg-card dark:data-[hover=true]:bg-muted data-[hover=true]:border-border/80",
                "group-data-[focus=true]:bg-card dark:group-data-[focus=true]:bg-muted group-data-[focus=true]:border-primary/65 group-data-[focus=true]:ring-2 group-data-[focus=true]:ring-primary/15",
                "h-10 min-h-10",
                "transition-all duration-200"
              ),
              input: "text-sm text-foreground/90 placeholder:text-muted-foreground",
              clearButton: "text-muted-foreground hover:text-danger",
            }}
          />

          {/* 上传按钮 */}
          <Button
            isIconOnly
            color="primary"
            aria-label="上传图片"
            isLoading={uploading}
            onPress={handleUploadClick}
            className="shrink-0 rounded-xl"
            size="md"
            spinner={<Loader2 className="w-4 h-4 animate-spin" />}
          >
            <Upload className="w-4 h-4" />
          </Button>

          <input ref={fileInputRef} type="file" accept={accept} onChange={handleFileChange} className="hidden" />
        </div>

        {description && <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>}

        {/* 预览区域 - 在输入框下方 */}
        {showPreview &&
          (rounded ? (
            /* 圆形预览（头像等场景） */
            <div
              className="overflow-hidden rounded-full border-2 border-border/60 bg-muted/30 shrink-0"
              style={{
                width: previewMaxWidth ?? sizeConfig.maxW,
                height: previewMaxWidth ?? sizeConfig.maxW,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt={label ? `${label}预览` : "图片预览"}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            </div>
          ) : (
            /* 矩形预览（Logo、封面等场景） */
            <div
              className="overflow-hidden border border-border/60 bg-muted/30 p-2 inline-flex items-center justify-center rounded-xl"
              style={{
                maxWidth: previewMaxWidth ?? sizeConfig.maxW,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt={label ? `${label}预览` : "图片预览"}
                className="object-contain"
                style={{
                  maxWidth: (previewMaxWidth ?? sizeConfig.maxW) - 16,
                  maxHeight: previewMaxHeight ?? sizeConfig.maxH,
                }}
                onError={() => setImgError(true)}
              />
            </div>
          ))}
      </div>
    );
  }
);
FormImageUpload.displayName = "FormImageUpload";

export { FormImageUpload };
