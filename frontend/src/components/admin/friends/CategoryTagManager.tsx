"use client";

import { useState, useCallback } from "react";
import { ModalBody, Tabs, Tab, Button, Chip, addToast } from "@heroui/react";
import { Edit, Trash2, Plus, Shield, Tags } from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect, FormSelectItem } from "@/components/ui/form-select";
import { FormColorPicker } from "@/components/ui/form-color-picker";
import {
  useLinkCategories,
  useLinkTags,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
} from "@/hooks/queries/use-friends";
import type { LinkCategory, LinkTag } from "@/types/friends";

interface CategoryTagManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

/** 系统保护分类 ID（不可删除） */
const PROTECTED_CATEGORY_IDS = [1, 2];

export default function CategoryTagManager({ isOpen, onClose }: CategoryTagManagerProps) {
  const [activeTab, setActiveTab] = useState("categories");

  // 分类相关状态
  const [editingCategory, setEditingCategory] = useState<LinkCategory | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryStyle, setNewCategoryStyle] = useState("card");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);

  // 标签相关状态
  const [editingTag, setEditingTag] = useState<LinkTag | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3B82F6");
  const [showAddTag, setShowAddTag] = useState(false);

  // Queries & Mutations
  const { data: categories = [] } = useLinkCategories();
  const { data: tags = [] } = useLinkTags();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  // ---- 分类操作 ----
  const handleAddCategory = useCallback(async () => {
    if (!newCategoryName.trim()) {
      addToast({ title: "请输入分类名称", color: "warning", timeout: 3000 });
      return;
    }
    try {
      await createCategory.mutateAsync({
        name: newCategoryName.trim(),
        style: newCategoryStyle as "card" | "list",
        description: newCategoryDesc.trim(),
      });
      setNewCategoryName("");
      setNewCategoryDesc("");
      setShowAddCategory(false);
      addToast({ title: "分类创建成功", color: "success", timeout: 2000 });
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "创建分类失败", color: "danger", timeout: 3000 });
    }
  }, [newCategoryName, newCategoryStyle, newCategoryDesc, createCategory]);

  const handleEditCategory = useCallback((cat: LinkCategory) => {
    setEditingCategory(cat);
    setNewCategoryName(cat.name);
    setNewCategoryStyle(cat.style);
    setNewCategoryDesc(cat.description || "");
  }, []);

  const handleSaveCategory = useCallback(async () => {
    if (!editingCategory || !newCategoryName.trim()) return;
    try {
      await updateCategory.mutateAsync({
        id: editingCategory.id,
        data: {
          name: newCategoryName.trim(),
          style: newCategoryStyle as "card" | "list",
          description: newCategoryDesc.trim(),
        },
      });
      setEditingCategory(null);
      setNewCategoryName("");
      setNewCategoryDesc("");
      addToast({ title: "分类更新成功", color: "success", timeout: 2000 });
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "更新分类失败", color: "danger", timeout: 3000 });
    }
  }, [editingCategory, newCategoryName, newCategoryStyle, newCategoryDesc, updateCategory]);

  const handleDeleteCategory = useCallback(
    async (id: number) => {
      if (PROTECTED_CATEGORY_IDS.includes(id)) {
        addToast({ title: "系统保护分类不可删除", color: "warning", timeout: 3000 });
        return;
      }
      try {
        await deleteCategory.mutateAsync(id);
        addToast({ title: "分类已删除", color: "success", timeout: 2000 });
      } catch (error) {
        addToast({ title: error instanceof Error ? error.message : "删除分类失败", color: "danger", timeout: 3000 });
      }
    },
    [deleteCategory]
  );

  const cancelEditCategory = useCallback(() => {
    setEditingCategory(null);
    setNewCategoryName("");
    setNewCategoryDesc("");
  }, []);

  // ---- 标签操作 ----
  const handleAddTag = useCallback(async () => {
    if (!newTagName.trim()) {
      addToast({ title: "请输入标签名称", color: "warning", timeout: 3000 });
      return;
    }
    try {
      await createTag.mutateAsync({
        name: newTagName.trim(),
        color: newTagColor,
      });
      setNewTagName("");
      setShowAddTag(false);
      addToast({ title: "标签创建成功", color: "success", timeout: 2000 });
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "创建标签失败", color: "danger", timeout: 3000 });
    }
  }, [newTagName, newTagColor, createTag]);

  const handleEditTag = useCallback((tag: LinkTag) => {
    setEditingTag(tag);
    setNewTagName(tag.name);
    setNewTagColor(tag.color || "#3B82F6");
  }, []);

  const handleSaveTag = useCallback(async () => {
    if (!editingTag || !newTagName.trim()) return;
    try {
      await updateTag.mutateAsync({
        id: editingTag.id,
        data: {
          name: newTagName.trim(),
          color: newTagColor,
        },
      });
      setEditingTag(null);
      setNewTagName("");
      addToast({ title: "标签更新成功", color: "success", timeout: 2000 });
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "更新标签失败", color: "danger", timeout: 3000 });
    }
  }, [editingTag, newTagName, newTagColor, updateTag]);

  const handleDeleteTag = useCallback(
    async (id: number) => {
      try {
        await deleteTag.mutateAsync(id);
        addToast({ title: "标签已删除", color: "success", timeout: 2000 });
      } catch (error) {
        addToast({ title: error instanceof Error ? error.message : "删除标签失败", color: "danger", timeout: 3000 });
      }
    },
    [deleteTag]
  );

  const cancelEditTag = useCallback(() => {
    setEditingTag(null);
    setNewTagName("");
  }, []);

  // ---- 分类表单渲染 ----
  const renderCategoryForm = (isEditing: boolean) => (
    <div className="space-y-3">
      <FormInput size="sm" label="分类名称" value={newCategoryName} onValueChange={setNewCategoryName} />
      <div className="flex gap-3">
        <FormSelect
          size="sm"
          label="展示样式"
          value={newCategoryStyle}
          onValueChange={setNewCategoryStyle}
          className="flex-1"
        >
          <FormSelectItem key="card">卡片</FormSelectItem>
          <FormSelectItem key="list">列表</FormSelectItem>
        </FormSelect>
        <FormInput
          size="sm"
          label="描述"
          value={newCategoryDesc}
          onValueChange={setNewCategoryDesc}
          className="flex-1"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          size="sm"
          variant="flat"
          onPress={
            isEditing
              ? cancelEditCategory
              : () => {
                  setShowAddCategory(false);
                  setNewCategoryName("");
                  setNewCategoryDesc("");
                }
          }
        >
          取消
        </Button>
        <Button
          size="sm"
          color="primary"
          isLoading={isEditing ? updateCategory.isPending : createCategory.isPending}
          onPress={isEditing ? handleSaveCategory : handleAddCategory}
        >
          {isEditing ? "保存" : "创建"}
        </Button>
      </div>
    </div>
  );

  return (
    <AdminDialog
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
      header={{ title: "管理分类标签", description: "统一维护友链分类与标签信息", icon: Tags }}
    >
      <ModalBody className="pb-6">
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={key => setActiveTab(String(key))}
          variant="underlined"
          color="primary"
        >
          {/* 分类管理 Tab */}
          <Tab key="categories" title={`分类 (${categories.length})`}>
            <div className="space-y-3 pt-2">
              {!showAddCategory && !editingCategory && (
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                  startContent={<Plus className="w-4 h-4" />}
                  onPress={() => setShowAddCategory(true)}
                >
                  新建分类
                </Button>
              )}

              {showAddCategory && (
                <div className="p-3 rounded-lg border border-primary-200 bg-primary-50/30">
                  {renderCategoryForm(false)}
                </div>
              )}

              {categories.map(cat => (
                <div
                  key={cat.id}
                  className="p-3 rounded-lg border border-border/60 bg-muted/30 hover:border-border/80 transition-colors"
                >
                  {editingCategory?.id === cat.id ? (
                    renderCategoryForm(true)
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{cat.name}</span>
                        <Chip size="sm" variant="flat" color={cat.style === "card" ? "primary" : "secondary"}>
                          {cat.style === "card" ? "卡片" : "列表"}
                        </Chip>
                        {PROTECTED_CATEGORY_IDS.includes(cat.id) && (
                          <Chip size="sm" variant="flat" color="warning" startContent={<Shield className="w-3 h-3" />}>
                            系统
                          </Chip>
                        )}
                        {cat.description && <span className="text-xs text-muted-foreground">{cat.description}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button isIconOnly size="sm" variant="light" onPress={() => handleEditCategory(cat)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        {!PROTECTED_CATEGORY_IDS.includes(cat.id) && (
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            onPress={() => handleDeleteCategory(cat.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {categories.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">暂无分类</div>
              )}
            </div>
          </Tab>

          {/* 标签管理 Tab */}
          <Tab key="tags" title={`标签 (${tags.length})`}>
            <div className="space-y-3 pt-2">
              {!showAddTag && !editingTag && (
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                  startContent={<Plus className="w-4 h-4" />}
                  onPress={() => setShowAddTag(true)}
                >
                  新建标签
                </Button>
              )}

              {showAddTag && (
                <div className="p-3 rounded-lg border border-primary-200 bg-primary-50/30 space-y-3">
                  <div className="flex items-center gap-3">
                    <FormInput
                      size="sm"
                      label="标签名称"
                      value={newTagName}
                      onValueChange={setNewTagName}
                      className="flex-1"
                    />
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs text-muted-foreground">颜色</span>
                      <FormColorPicker value={newTagColor} onChange={setNewTagColor} />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={() => {
                        setShowAddTag(false);
                        setNewTagName("");
                      }}
                    >
                      取消
                    </Button>
                    <Button size="sm" color="primary" isLoading={createTag.isPending} onPress={handleAddTag}>
                      创建
                    </Button>
                  </div>
                </div>
              )}

              {tags.map(tag => (
                <div
                  key={tag.id}
                  className="p-3 rounded-lg border border-border/60 bg-muted/30 hover:border-border/80 transition-colors"
                >
                  {editingTag?.id === tag.id ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <FormInput
                          size="sm"
                          label="标签名称"
                          value={newTagName}
                          onValueChange={setNewTagName}
                          className="flex-1"
                        />
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-muted-foreground">颜色</span>
                          <FormColorPicker value={newTagColor} onChange={setNewTagColor} />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="flat" onPress={cancelEditTag}>
                          取消
                        </Button>
                        <Button size="sm" color="primary" isLoading={updateTag.isPending} onPress={handleSaveTag}>
                          保存
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-4 h-4 rounded-full border border-border/60"
                          style={{ backgroundColor: tag.color || "#999" }}
                        />
                        <span className="font-medium text-sm">{tag.name}</span>
                        <span className="text-xs text-muted-foreground">{tag.color}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button isIconOnly size="sm" variant="light" onPress={() => handleEditTag(tag)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          color="danger"
                          onPress={() => handleDeleteTag(tag.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {tags.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">暂无标签</div>}
            </div>
          </Tab>
        </Tabs>
      </ModalBody>
    </AdminDialog>
  );
}
