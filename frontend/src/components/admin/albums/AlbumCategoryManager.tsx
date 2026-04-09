"use client";

import { useMemo, useState, useCallback } from "react";
import { ModalBody, ModalFooter, Button, Chip, addToast } from "@heroui/react";
import { Edit, Plus, Trash2, FolderOpen } from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import {
  useAlbumCategories,
  useCreateAlbumCategory,
  useUpdateAlbumCategory,
  useDeleteAlbumCategory,
} from "@/hooks/queries/use-album";
import type { AlbumCategory } from "@/types/album";

interface AlbumCategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AlbumCategoryManager({ isOpen, onClose }: AlbumCategoryManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AlbumCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AlbumCategory | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");

  const { data: categories = [] } = useAlbumCategories();
  const createCategory = useCreateAlbumCategory();
  const updateCategory = useUpdateAlbumCategory();
  const deleteCategory = useDeleteAlbumCategory();

  const sortedCategories = useMemo(
    () =>
      [...categories].sort((a, b) => {
        const orderA = a.displayOrder ?? 0;
        const orderB = b.displayOrder ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.id - b.id;
      }),
    [categories]
  );

  const resetForm = useCallback(() => {
    setName("");
    setDescription("");
    setDisplayOrder("0");
  }, []);

  const handleStartCreate = useCallback(() => {
    setEditingCategory(null);
    setIsCreating(true);
    resetForm();
  }, [resetForm]);

  const handleStartEdit = useCallback((category: AlbumCategory) => {
    setIsCreating(false);
    setEditingCategory(category);
    setName(category.name);
    setDescription(category.description ?? "");
    setDisplayOrder(String(category.displayOrder ?? 0));
  }, []);

  const handleCancelEdit = useCallback(() => {
    setIsCreating(false);
    setEditingCategory(null);
    resetForm();
  }, [resetForm]);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      addToast({ title: "请输入分类名称", color: "warning", timeout: 3000 });
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      displayOrder: Number(displayOrder) || 0,
    };

    try {
      if (editingCategory) {
        await updateCategory.mutateAsync({ id: editingCategory.id, data: payload });
        addToast({ title: "分类更新成功", color: "success", timeout: 2000 });
      } else {
        await createCategory.mutateAsync(payload);
        addToast({ title: "分类创建成功", color: "success", timeout: 2000 });
      }
      handleCancelEdit();
    } catch (error) {
      addToast({
        title: error instanceof Error ? error.message : "分类操作失败",
        color: "danger",
        timeout: 3000,
      });
    }
  }, [name, description, displayOrder, editingCategory, updateCategory, createCategory, handleCancelEdit]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteCategory.mutateAsync(deleteTarget.id);
      addToast({ title: "分类删除成功", color: "success", timeout: 2000 });
      setDeleteTarget(null);
    } catch (error) {
      addToast({
        title: error instanceof Error ? error.message : "删除分类失败",
        color: "danger",
        timeout: 3000,
      });
    }
  }, [deleteTarget, deleteCategory]);

  const handleClose = useCallback(() => {
    handleCancelEdit();
    setDeleteTarget(null);
    onClose();
  }, [handleCancelEdit, onClose]);

  const isSaving = createCategory.isPending || updateCategory.isPending;

  return (
    <>
      <AdminDialog
        isOpen={isOpen}
        onClose={handleClose}
        size="2xl"
        scrollBehavior="inside"
        header={{ title: "相册分类管理", description: "维护相册分类并调整排序信息", icon: FolderOpen }}
      >
        <ModalBody className="gap-4">
          {!isCreating && !editingCategory && (
            <Button
              size="sm"
              color="primary"
              variant="flat"
              startContent={<Plus className="w-4 h-4" />}
              onPress={handleStartCreate}
              className="w-fit"
            >
              新增分类
            </Button>
          )}

          {(isCreating || editingCategory) && (
            <div className="rounded-xl border border-primary-200 bg-primary-50/30 p-3 space-y-3">
              <FormInput label="分类名称" value={name} onValueChange={setName} isRequired size="sm" />
              <FormTextarea
                label="描述"
                value={description}
                onValueChange={setDescription}
                minRows={2}
                maxRows={4}
                maxLength={200}
              />
              <FormInput
                label="排序"
                value={displayOrder}
                onValueChange={setDisplayOrder}
                type="number"
                size="sm"
                description="数字越小越靠前"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="flat" onPress={handleCancelEdit}>
                  取消
                </Button>
                <Button size="sm" color="primary" onPress={handleSubmit} isLoading={isSaving}>
                  {editingCategory ? "保存修改" : "创建分类"}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {sortedCategories.map(category => (
              <div
                key={category.id}
                className="rounded-xl border border-border/60 bg-muted/30 p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{category.name}</span>
                    <Chip size="sm" variant="flat">
                      排序 {category.displayOrder ?? 0}
                    </Chip>
                  </div>
                  {category.description && <p className="text-xs text-muted-foreground mt-1">{category.description}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <Button isIconOnly size="sm" variant="light" onPress={() => handleStartEdit(category)}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => setDeleteTarget(category)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}

            {sortedCategories.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">暂无分类，点击上方按钮创建</div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={handleClose}>
            关闭
          </Button>
        </ModalFooter>
      </AdminDialog>

      <AdminDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        size="sm"
        header={{ title: "删除分类", description: "删除后该分类下相册将解除关联", icon: Trash2, tone: "danger" }}
      >
        <ModalBody>
          <p className="text-sm">确定要删除分类「{deleteTarget?.name}」吗？删除后该分类下相册将解除关联。</p>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={() => setDeleteTarget(null)}>
            取消
          </Button>
          <Button color="danger" onPress={handleDeleteConfirm} isLoading={deleteCategory.isPending}>
            删除
          </Button>
        </ModalFooter>
      </AdminDialog>
    </>
  );
}
