"use client";

import { useState, useCallback } from "react";
import { ModalBody, Tabs, Tab, Button, addToast } from "@heroui/react";
import { Edit, Trash2, Plus, Tags } from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { FormInput } from "@/components/ui/form-input";
import { articleApi } from "@/lib/api/article";
import { useCategories, useTags } from "@/hooks/queries/use-articles";
import { useQueryClient } from "@tanstack/react-query";
import type { PostCategory, PostTag } from "@/types/article";

interface PostCategoryTagManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PostCategoryTagManager({ isOpen, onClose }: PostCategoryTagManagerProps) {
  const [activeTab, setActiveTab] = useState("categories");

  const { data: categories = [] } = useCategories();
  const { data: tags = [] } = useTags();
  const queryClient = useQueryClient();

  const [editingCategory, setEditingCategory] = useState<PostCategory | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategorySlug, setNewCategorySlug] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);

  const [editingTag, setEditingTag] = useState<PostTag | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagSlug, setNewTagSlug] = useState("");
  const [showAddTag, setShowAddTag] = useState(false);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["post-categories"] });
    queryClient.invalidateQueries({ queryKey: ["post-tags"] });
    queryClient.invalidateQueries({ queryKey: ["articles"] });
  }, [queryClient]);

  const handleAddCategory = useCallback(async () => {
    if (!newCategoryName.trim()) {
      addToast({ title: "请输入分类名称", color: "warning", timeout: 3000 });
      return;
    }
    try {
      await articleApi.createCategory({
        name: newCategoryName.trim(),
        slug: newCategorySlug.trim() || undefined,
      });
      setNewCategoryName("");
      setNewCategorySlug("");
      setShowAddCategory(false);
      invalidate();
      addToast({ title: "分类创建成功", color: "success", timeout: 2000 });
    } catch (err) {
      addToast({ title: err instanceof Error ? err.message : "创建失败", color: "danger", timeout: 3000 });
    }
  }, [newCategoryName, newCategorySlug, invalidate]);

  const handleUpdateCategory = useCallback(async () => {
    if (!editingCategory) return;
    try {
      await articleApi.updateCategory(editingCategory.id, {
        name: editingCategory.name,
        slug: editingCategory.slug || undefined,
      });
      setEditingCategory(null);
      invalidate();
      addToast({ title: "分类更新成功", color: "success", timeout: 2000 });
    } catch (err) {
      addToast({ title: err instanceof Error ? err.message : "更新失败", color: "danger", timeout: 3000 });
    }
  }, [editingCategory, invalidate]);

  const handleDeleteCategory = useCallback(
    async (cat: PostCategory) => {
      if (cat.count > 0) {
        addToast({ title: `该分类下有 ${cat.count} 篇文章，无法删除`, color: "warning", timeout: 3000 });
        return;
      }
      try {
        await articleApi.deleteCategory(cat.id);
        invalidate();
        addToast({ title: "分类已删除", color: "success", timeout: 2000 });
      } catch (err) {
        addToast({ title: err instanceof Error ? err.message : "删除失败", color: "danger", timeout: 3000 });
      }
    },
    [invalidate]
  );

  const handleAddTag = useCallback(async () => {
    if (!newTagName.trim()) {
      addToast({ title: "请输入标签名称", color: "warning", timeout: 3000 });
      return;
    }
    try {
      await articleApi.createTag({
        name: newTagName.trim(),
        slug: newTagSlug.trim() || undefined,
      });
      setNewTagName("");
      setNewTagSlug("");
      setShowAddTag(false);
      invalidate();
      addToast({ title: "标签创建成功", color: "success", timeout: 2000 });
    } catch (err) {
      addToast({ title: err instanceof Error ? err.message : "创建失败", color: "danger", timeout: 3000 });
    }
  }, [newTagName, newTagSlug, invalidate]);

  const handleUpdateTag = useCallback(async () => {
    if (!editingTag) return;
    try {
      await articleApi.updateTag(editingTag.id, {
        name: editingTag.name,
        slug: editingTag.slug || undefined,
      });
      setEditingTag(null);
      invalidate();
      addToast({ title: "标签更新成功", color: "success", timeout: 2000 });
    } catch (err) {
      addToast({ title: err instanceof Error ? err.message : "更新失败", color: "danger", timeout: 3000 });
    }
  }, [editingTag, invalidate]);

  const handleDeleteTag = useCallback(
    async (tag: PostTag) => {
      if (tag.count > 0) {
        addToast({ title: `该标签下有 ${tag.count} 篇文章，无法删除`, color: "warning", timeout: 3000 });
        return;
      }
      try {
        await articleApi.deleteTag(tag.id);
        invalidate();
        addToast({ title: "标签已删除", color: "success", timeout: 2000 });
      } catch (err) {
        addToast({ title: err instanceof Error ? err.message : "删除失败", color: "danger", timeout: 3000 });
      }
    },
    [invalidate]
  );

  const slugHint = "留空则自动从名称生成拼音";

  return (
    <AdminDialog
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      header={{ title: "管理分类与标签", description: "编辑分类/标签的名称和 Slug", icon: Tags }}
    >
      <ModalBody className="pb-6">
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={k => setActiveTab(k as string)}
          variant="underlined"
          classNames={{ tabList: "gap-4" }}
        >
          {/* ───── 分类 Tab ───── */}
          <Tab key="categories" title={`分类 (${categories.length})`}>
            <div className="space-y-3 mt-3">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-2 rounded-lg border border-border/60 p-3">
                  {editingCategory?.id === cat.id ? (
                    <div className="flex-1 space-y-2">
                      <FormInput
                        label="名称"
                        value={editingCategory.name}
                        onValueChange={v => setEditingCategory({ ...editingCategory, name: v })}
                      />
                      <FormInput
                        label="Slug"
                        value={editingCategory.slug || ""}
                        onValueChange={v => setEditingCategory({ ...editingCategory, slug: v })}
                        placeholder={slugHint}
                        description="URL 标识符，只允许小写字母、数字、连字符"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="flat" onPress={() => setEditingCategory(null)}>
                          取消
                        </Button>
                        <Button size="sm" color="primary" onPress={handleUpdateCategory}>
                          保存
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{cat.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {cat.slug ? `/${cat.slug}` : <span className="italic">无 slug</span>}
                          {` · ${cat.count} 篇文章`}
                        </div>
                      </div>
                      <Button isIconOnly size="sm" variant="light" onPress={() => setEditingCategory({ ...cat })}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => handleDeleteCategory(cat)}
                        isDisabled={cat.count > 0}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}

              {showAddCategory ? (
                <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
                  <FormInput
                    label="名称"
                    value={newCategoryName}
                    onValueChange={setNewCategoryName}
                    placeholder="分类名称"
                    autoFocus
                  />
                  <FormInput
                    label="Slug"
                    value={newCategorySlug}
                    onValueChange={setNewCategorySlug}
                    placeholder={slugHint}
                    description="URL 标识符，只允许小写字母、数字、连字符"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={() => {
                        setShowAddCategory(false);
                        setNewCategoryName("");
                        setNewCategorySlug("");
                      }}
                    >
                      取消
                    </Button>
                    <Button size="sm" color="primary" onPress={handleAddCategory}>
                      创建
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="flat"
                  startContent={<Plus className="w-3.5 h-3.5" />}
                  onPress={() => setShowAddCategory(true)}
                  className="w-full"
                >
                  添加分类
                </Button>
              )}
            </div>
          </Tab>

          {/* ───── 标签 Tab ───── */}
          <Tab key="tags" title={`标签 (${tags.length})`}>
            <div className="space-y-3 mt-3">
              {tags.map(tag => (
                <div key={tag.id} className="flex items-center gap-2 rounded-lg border border-border/60 p-3">
                  {editingTag?.id === tag.id ? (
                    <div className="flex-1 space-y-2">
                      <FormInput
                        label="名称"
                        value={editingTag.name}
                        onValueChange={v => setEditingTag({ ...editingTag, name: v })}
                      />
                      <FormInput
                        label="Slug"
                        value={editingTag.slug || ""}
                        onValueChange={v => setEditingTag({ ...editingTag, slug: v })}
                        placeholder={slugHint}
                        description="URL 标识符，只允许小写字母、数字、连字符"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="flat" onPress={() => setEditingTag(null)}>
                          取消
                        </Button>
                        <Button size="sm" color="primary" onPress={handleUpdateTag}>
                          保存
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{tag.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {tag.slug ? `/${tag.slug}` : <span className="italic">无 slug</span>}
                          {` · ${tag.count} 篇文章`}
                        </div>
                      </div>
                      <Button isIconOnly size="sm" variant="light" onPress={() => setEditingTag({ ...tag })}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => handleDeleteTag(tag)}
                        isDisabled={tag.count > 0}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}

              {showAddTag ? (
                <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
                  <FormInput
                    label="名称"
                    value={newTagName}
                    onValueChange={setNewTagName}
                    placeholder="标签名称"
                    autoFocus
                  />
                  <FormInput
                    label="Slug"
                    value={newTagSlug}
                    onValueChange={setNewTagSlug}
                    placeholder={slugHint}
                    description="URL 标识符，只允许小写字母、数字、连字符"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={() => {
                        setShowAddTag(false);
                        setNewTagName("");
                        setNewTagSlug("");
                      }}
                    >
                      取消
                    </Button>
                    <Button size="sm" color="primary" onPress={handleAddTag}>
                      创建
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="flat"
                  startContent={<Plus className="w-3.5 h-3.5" />}
                  onPress={() => setShowAddTag(true)}
                  className="w-full"
                >
                  添加标签
                </Button>
              )}
            </div>
          </Tab>
        </Tabs>
      </ModalBody>
    </AdminDialog>
  );
}
