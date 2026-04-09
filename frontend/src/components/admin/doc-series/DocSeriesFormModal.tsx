"use client";

import { useState, useCallback } from "react";
import { ModalBody, ModalFooter, Button, Input, Textarea, addToast } from "@heroui/react";
import { BookOpen, Pencil } from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { useCreateDocSeries, useUpdateDocSeries } from "@/hooks/queries/use-doc-series";
import type { DocSeries } from "@/types/doc-series";

interface DocSeriesFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: DocSeries | null;
}

/**
 * 文档系列创建/编辑弹窗
 * 使用 wrapper + inner content 模式，避免 useEffect setState
 * 内部组件在 Modal 打开时挂载，初始值直接从 props 传入 useState
 */
export default function DocSeriesFormModal({ isOpen, onClose, editItem }: DocSeriesFormModalProps) {
  const isEdit = !!editItem;

  return (
    <AdminDialog
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      scrollBehavior="inside"
      header={{
        title: isEdit ? "编辑文档系列" : "新增文档系列",
        description: isEdit ? "修改系列信息与展示顺序" : "创建新的文档系列用于内容归档",
        icon: isEdit ? Pencil : BookOpen,
      }}
    >
      {isOpen && <DocSeriesFormContent editItem={editItem} onClose={onClose} />}
    </AdminDialog>
  );
}

function DocSeriesFormContent({ editItem, onClose }: { editItem?: DocSeries | null; onClose: () => void }) {
  const isEdit = !!editItem;

  // 表单状态 - 初始值直接来自 editItem
  const [name, setName] = useState(editItem?.name ?? "");
  const [description, setDescription] = useState(editItem?.description ?? "");
  const [sort, setSort] = useState(String(editItem?.sort ?? 0));

  // Mutations
  const createDocSeries = useCreateDocSeries();
  const updateDocSeries = useUpdateDocSeries();

  const handleSubmit = useCallback(async () => {
    // 验证
    if (!name.trim()) {
      addToast({ title: "请输入系列名称", color: "warning", timeout: 3000 });
      return;
    }

    const formData = {
      name: name.trim(),
      description: description.trim(),
      sort: Number(sort) || 0,
    };

    try {
      if (isEdit && editItem) {
        await updateDocSeries.mutateAsync({ id: editItem.id, data: formData });
        addToast({ title: "更新成功", color: "success", timeout: 2000 });
      } else {
        await createDocSeries.mutateAsync(formData);
        addToast({ title: "创建成功", color: "success", timeout: 2000 });
      }
      onClose();
    } catch (error) {
      addToast({
        title: error instanceof Error ? error.message : "操作失败",
        color: "danger",
        timeout: 3000,
      });
    }
  }, [name, description, sort, isEdit, editItem, createDocSeries, updateDocSeries, onClose]);

  const isSubmitting = createDocSeries.isPending || updateDocSeries.isPending;

  return (
    <>
      <ModalBody className="gap-4">
        <Input
          label="系列名称"
          placeholder="请输入系列名称"
          value={name}
          onValueChange={setName}
          isRequired
          maxLength={50}
        />

        <Textarea
          label="描述"
          placeholder="请输入系列描述（可选）"
          value={description}
          onValueChange={setDescription}
          minRows={2}
          maxRows={4}
          maxLength={200}
        />

        <Input
          label="排序"
          placeholder="数值越小越靠前"
          type="number"
          value={sort}
          onValueChange={setSort}
          description="数值越小越靠前，默认为 0"
        />
      </ModalBody>

      <ModalFooter>
        <Button variant="flat" onPress={onClose}>
          取消
        </Button>
        <Button color="primary" onPress={handleSubmit} isLoading={isSubmitting}>
          {isEdit ? "保存修改" : "创建系列"}
        </Button>
      </ModalFooter>
    </>
  );
}
