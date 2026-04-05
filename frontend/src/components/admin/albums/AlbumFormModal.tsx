"use client";

import { useState, useCallback, useMemo } from "react";
import { ModalBody, ModalFooter, Button, addToast } from "@heroui/react";
import { DatePicker } from "@heroui/date-picker";
import { parseAbsoluteToLocal } from "@internationalized/date";
import type { ZonedDateTime } from "@internationalized/date";
import { Image as ImageIcon, Pencil } from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminDatePickerLocale } from "@/components/admin/AdminDatePickerLocale";
import { FormInput } from "@/components/ui/form-input";
import { FormImageUpload } from "@/components/ui/form-image-upload";
import { FormSelect, FormSelectItem } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { useCreateAlbum, useUpdateAlbum } from "@/hooks/queries/use-album";
import type { Album, AlbumCategory } from "@/types/album";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

interface AlbumFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: Album | null;
  categories?: AlbumCategory[];
}

/**
 * 相册图片创建/编辑弹窗
 * 使用 wrapper + inner content 模式，避免 useEffect setState
 */
export default function AlbumFormModal({ isOpen, onClose, editItem, categories = [] }: AlbumFormModalProps) {
  const isEdit = !!editItem;

  return (
    <AdminDialog
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      scrollBehavior="inside"
      header={{
        title: isEdit ? "编辑图片" : "添加图片",
        description: isEdit ? "修改图片信息与展示配置" : "填写图片信息并添加到相册",
        icon: isEdit ? Pencil : ImageIcon,
      }}
    >
      {isOpen && <AlbumFormContent editItem={editItem} categories={categories} onClose={onClose} />}
    </AdminDialog>
  );
}

function AlbumFormContent({
  editItem,
  categories,
  onClose,
}: {
  editItem?: Album | null;
  categories: AlbumCategory[];
  onClose: () => void;
}) {
  const isEdit = !!editItem;

  // 表单状态 - 初始值直接来自 editItem
  const [categoryId, setCategoryId] = useState(editItem?.categoryId ? String(editItem.categoryId) : "");
  const [imageUrl, setImageUrl] = useState(editItem?.imageUrl ?? "");
  const [bigImageUrl, setBigImageUrl] = useState(editItem?.bigImageUrl ?? "");
  const [downloadUrl, setDownloadUrl] = useState(editItem?.downloadUrl ?? "");
  const [thumbParam, setThumbParam] = useState(editItem?.thumbParam ?? "");
  const [bigParam, setBigParam] = useState(editItem?.bigParam ?? "");
  const [tags, setTags] = useState(editItem?.tags ?? "");
  const [displayOrder, setDisplayOrder] = useState(String(editItem?.displayOrder ?? 0));
  const [title, setTitle] = useState(editItem?.title ?? "");
  const [description, setDescription] = useState(editItem?.description ?? "");
  const [location, setLocation] = useState(editItem?.location ?? "");
  const [publishedAt, setPublishedAt] = useState<string | null>(editItem?.published_at ?? null);

  const publishedAtValue = useMemo(() => {
    if (!publishedAt) return null;
    try {
      return parseAbsoluteToLocal(publishedAt);
    } catch {
      return null;
    }
  }, [publishedAt]);

  const categoryOptions = [
    { key: "__none__", label: "未分类" },
    ...categories.map(category => ({
      key: String(category.id),
      label: category.name,
    })),
  ];

  // Mutations
  const createAlbum = useCreateAlbum();
  const updateAlbum = useUpdateAlbum();

  const handleSubmit = useCallback(async () => {
    // 验证
    if (!imageUrl.trim()) {
      addToast({ title: "请输入图片 URL", color: "warning", timeout: 3000 });
      return;
    }

    const formData = {
      categoryId: categoryId ? Number(categoryId) : null,
      imageUrl: imageUrl.trim(),
      bigImageUrl: bigImageUrl.trim() || undefined,
      downloadUrl: downloadUrl.trim() || undefined,
      thumbParam: thumbParam.trim() || undefined,
      bigParam: bigParam.trim() || undefined,
      tags: tags.trim() ? tags.split(",").map(t => t.trim()) : undefined,
      displayOrder: Number(displayOrder) || 0,
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      published_at: publishedAt || null,
    };

    try {
      if (isEdit && editItem) {
        await updateAlbum.mutateAsync({ id: editItem.id, data: formData });
        addToast({ title: "更新成功", color: "success", timeout: 2000 });
      } else {
        const fileHash = await sha256Hex(imageUrl.trim());
        await createAlbum.mutateAsync({ ...formData, fileHash });
        addToast({ title: "添加成功", color: "success", timeout: 2000 });
      }
      onClose();
    } catch (error) {
      addToast({
        title: error instanceof Error ? error.message : "操作失败",
        color: "danger",
        timeout: 3000,
      });
    }
  }, [
    categoryId,
    imageUrl,
    bigImageUrl,
    downloadUrl,
    thumbParam,
    bigParam,
    tags,
    displayOrder,
    title,
    description,
    location,
    publishedAt,
    isEdit,
    editItem,
    createAlbum,
    updateAlbum,
    onClose,
  ]);

  const isSubmitting = createAlbum.isPending || updateAlbum.isPending;

  return (
    <>
      <ModalBody className="gap-4">
        <FormSelect
          label="分类"
          placeholder="请选择分类（可选）"
          value={categoryId || "__none__"}
          onValueChange={value => setCategoryId(value === "__none__" ? "" : value)}
        >
          {categoryOptions.map(option => (
            <FormSelectItem key={option.key}>{option.label}</FormSelectItem>
          ))}
        </FormSelect>

        <FormImageUpload
          label="图片 URL"
          isRequired
          placeholder="粘贴外链或上传后自动填入，可随时修改"
          description="支持本地上传（右侧按钮）或手动填写/修改链接"
          value={imageUrl}
          onValueChange={setImageUrl}
          previewSize="md"
        />

        <FormInput label="标题" placeholder="图片标题（可选）" value={title} onValueChange={setTitle} maxLength={100} />

        <FormTextarea
          label="描述"
          placeholder="图片描述（可选）"
          value={description}
          onValueChange={setDescription}
          minRows={2}
          maxRows={4}
          maxLength={500}
        />

        <FormInput label="大图 URL" placeholder="大图地址（可选）" value={bigImageUrl} onValueChange={setBigImageUrl} />

        <FormInput label="下载 URL" placeholder="下载地址（可选）" value={downloadUrl} onValueChange={setDownloadUrl} />

        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="缩略图参数"
            placeholder="如 ?x-oss-process=..."
            value={thumbParam}
            onValueChange={setThumbParam}
          />
          <FormInput
            label="大图参数"
            placeholder="如 ?x-oss-process=..."
            value={bigParam}
            onValueChange={setBigParam}
          />
        </div>

        <FormInput
          label="标签"
          placeholder="多个标签用英文逗号分隔"
          value={tags}
          onValueChange={setTags}
          description="多个标签用英文逗号分隔，如：风景,旅行,自然"
        />

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold tracking-tight text-foreground/80">发布时间</label>
          <AdminDatePickerLocale>
            <DatePicker
              label={undefined}
              granularity="minute"
              hideTimeZone
              hourCycle={24}
              value={publishedAtValue ?? undefined}
              onChange={(d: ZonedDateTime | null) => {
                if (d) {
                  setPublishedAt(d.toAbsoluteString());
                } else {
                  setPublishedAt(null);
                }
              }}
              labelPlacement="outside"
              classNames={{
                inputWrapper:
                  "h-9 min-h-9 rounded-xl border border-border/60 bg-card shadow-none transition-all duration-200",
              }}
            />
          </AdminDatePickerLocale>
          <p className="text-xs leading-relaxed text-muted-foreground">
            可选，不设置则使用创建时间作为发布时间
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="排序"
            placeholder="数值越小越靠前"
            type="number"
            value={displayOrder}
            onValueChange={setDisplayOrder}
            description="数值越小越靠前"
          />
          <FormInput label="拍摄地点" placeholder="拍摄地点（可选）" value={location} onValueChange={setLocation} />
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="flat" onPress={onClose}>
          取消
        </Button>
        <Button color="primary" onPress={handleSubmit} isLoading={isSubmitting}>
          {isEdit ? "保存修改" : "添加图片"}
        </Button>
      </ModalFooter>
    </>
  );
}
