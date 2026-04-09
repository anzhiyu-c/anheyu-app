"use client";

import React, { useState, useCallback } from "react";
import {
  ModalBody,
  ModalFooter,
  Button,
  Switch,
  addToast,
  Chip,
  Input,
  Textarea,
  Select,
  SelectItem,
} from "@heroui/react";
import { Plus, Pencil, Globe, FolderOpen, Settings, Check } from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { FormColorPicker } from "@/components/ui/form-color-picker";
import {
  useLinkCategories,
  useLinkTags,
  useCreateLink,
  useUpdateLink,
  useCreateCategory,
  useCreateTag,
} from "@/hooks/queries/use-friends";
import type { LinkItem, LinkStatus, CreateLinkRequest } from "@/types/friends";

interface FriendFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: LinkItem | null;
}

const STATUS_OPTIONS = [
  { key: "APPROVED", label: "已通过" },
  { key: "PENDING", label: "待审核" },
  { key: "REJECTED", label: "已拒绝" },
];

export default function FriendFormModal({ isOpen, onClose, editItem }: FriendFormModalProps) {
  const isEdit = !!editItem;

  return (
    <AdminDialog
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
      header={{
        title: isEdit ? "编辑友链" : "新建友链",
        description: isEdit ? "修改友链信息与审核状态" : "填写站点信息并创建新的友链",
        icon: isEdit ? Pencil : Plus,
      }}
    >
      {isOpen && <FriendFormContent editItem={editItem} onClose={onClose} />}
    </AdminDialog>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm font-medium text-foreground/70">{children}</span>
    </div>
  );
}

function InlineCreateRow({
  isOpen,
  onClose,
  placeholder,
  value,
  onValueChange,
  isLoading,
  onSubmit,
  extra,
  successNode,
}: {
  isOpen: boolean;
  onClose: () => void;
  placeholder: string;
  value: string;
  onValueChange: (v: string) => void;
  isLoading: boolean;
  onSubmit: () => void;
  extra?: React.ReactNode;
  successNode?: React.ReactNode;
}) {
  if (!isOpen && !successNode) return null;
  if (!isOpen && successNode) return successNode;

  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-primary-200 bg-primary-50/20">
      <Input
        autoFocus
        size="sm"
        placeholder={placeholder}
        value={value}
        onValueChange={onValueChange}
        onKeyDown={e => {
          if (e.key === "Enter") onSubmit();
          if (e.key === "Escape") onClose();
        }}
        className="flex-1 min-w-0"
      />
      {extra}
      <div className="flex items-center gap-1 shrink-0">
        <Button size="sm" color="primary" isLoading={isLoading} onPress={onSubmit}>
          创建
        </Button>
        <Button size="sm" variant="flat" onPress={onClose}>
          取消
        </Button>
      </div>
    </div>
  );
}

function FriendFormContent({ editItem, onClose }: { editItem?: LinkItem | null; onClose: () => void }) {
  const isEdit = !!editItem;

  const [name, setName] = useState(editItem?.name ?? "");
  const [url, setUrl] = useState(editItem?.url ?? "");
  const [logo, setLogo] = useState(editItem?.logo ?? "");
  const [description, setDescription] = useState(editItem?.description ?? "");
  const [siteshot, setSiteshot] = useState(editItem?.siteshot ?? "");
  const [email, setEmail] = useState(editItem?.email ?? "");
  const [categoryId, setCategoryId] = useState<string>(editItem?.category?.id ? String(editItem.category.id) : "");
  const [tagId, setTagId] = useState<string>(editItem?.tag?.id ? String(editItem.tag.id) : "");
  const [status, setStatus] = useState<string>(editItem?.status ?? "PENDING");
  const [sortOrder, setSortOrder] = useState(String(editItem?.sort_order ?? 0));
  const [skipHealthCheck, setSkipHealthCheck] = useState(editItem?.skip_health_check ?? false);

  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3B82F6");

  const { data: categories = [] } = useLinkCategories();
  const { data: tags = [] } = useLinkTags();
  const createLink = useCreateLink();
  const updateLink = useUpdateLink();
  const createCategory = useCreateCategory();
  const createTag = useCreateTag();

  const [justCreated, setJustCreated] = useState<{ type: "category" | "tag"; name: string } | null>(null);

  const showInlineSuccess = useCallback((type: "category" | "tag", createdName: string) => {
    setJustCreated({ type, name: createdName });
    setTimeout(() => setJustCreated(null), 2000);
  }, []);

  const handleQuickCreateCategory = useCallback(async () => {
    if (!newCategoryName.trim()) return;
    try {
      const result = await createCategory.mutateAsync({ name: newCategoryName.trim(), style: "card" });
      setCategoryId(String(result.id));
      const createdName = newCategoryName.trim();
      setNewCategoryName("");
      setShowNewCategory(false);
      showInlineSuccess("category", createdName);
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "创建分类失败", color: "danger", timeout: 3000 });
    }
  }, [newCategoryName, createCategory, showInlineSuccess]);

  const handleQuickCreateTag = useCallback(async () => {
    if (!newTagName.trim()) return;
    try {
      const result = await createTag.mutateAsync({ name: newTagName.trim(), color: newTagColor });
      setTagId(String(result.id));
      const createdName = newTagName.trim();
      setNewTagName("");
      setShowNewTag(false);
      showInlineSuccess("tag", createdName);
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "创建标签失败", color: "danger", timeout: 3000 });
    }
  }, [newTagName, newTagColor, createTag, showInlineSuccess]);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      addToast({ title: "请输入网站名称", color: "warning", timeout: 3000 });
      return;
    }
    if (!url.trim()) {
      addToast({ title: "请输入网站地址", color: "warning", timeout: 3000 });
      return;
    }
    if (!logo.trim()) {
      addToast({ title: "请输入网站 Logo", color: "warning", timeout: 3000 });
      return;
    }
    if (!categoryId) {
      addToast({ title: "请选择分类", color: "warning", timeout: 3000 });
      return;
    }

    const data: CreateLinkRequest = {
      name: name.trim(),
      url: url.trim(),
      logo: logo.trim(),
      description: description.trim(),
      siteshot: siteshot.trim(),
      email: email.trim(),
      category_id: Number(categoryId),
      tag_id: tagId ? Number(tagId) : null,
      status: status as LinkStatus,
      sort_order: Number(sortOrder) || 0,
      skip_health_check: skipHealthCheck,
    };

    try {
      if (isEdit && editItem) {
        await updateLink.mutateAsync({ id: editItem.id, data });
        addToast({ title: "友链更新成功", color: "success", timeout: 3000 });
      } else {
        await createLink.mutateAsync(data);
        addToast({ title: "友链创建成功", color: "success", timeout: 3000 });
      }
      onClose();
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "操作失败", color: "danger", timeout: 3000 });
    }
  }, [
    name,
    url,
    logo,
    description,
    siteshot,
    email,
    categoryId,
    tagId,
    status,
    sortOrder,
    skipHealthCheck,
    isEdit,
    editItem,
    createLink,
    updateLink,
    onClose,
  ]);

  const isSubmitting = createLink.isPending || updateLink.isPending;

  const handleCategoryChange = useCallback((keys: "all" | Set<React.Key>) => {
    if (keys === "all") return;
    const selected = Array.from(keys)[0];
    if (selected !== undefined) setCategoryId(String(selected));
  }, []);

  const handleTagChange = useCallback((keys: "all" | Set<React.Key>) => {
    if (keys === "all") return;
    const selected = Array.from(keys)[0];
    if (selected !== undefined) setTagId(String(selected));
  }, []);

  const handleStatusChange = useCallback((keys: "all" | Set<React.Key>) => {
    if (keys === "all") return;
    const selected = Array.from(keys)[0];
    if (selected !== undefined) setStatus(String(selected));
  }, []);

  return (
    <>
      <ModalBody className="gap-0 py-4">
        {/* Section 1: 站点信息 */}
        <div className="pb-4">
          <SectionTitle icon={Globe}>站点信息</SectionTitle>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="网站名称"
                placeholder="输入网站名称"
                value={name}
                onValueChange={setName}
                isRequired
                labelPlacement="outside"
              />
              <Input
                label="网站地址"
                placeholder="https://example.com"
                value={url}
                onValueChange={setUrl}
                isRequired
                labelPlacement="outside"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="网站 Logo"
                placeholder="https://example.com/logo.png"
                value={logo}
                onValueChange={setLogo}
                isRequired
                labelPlacement="outside"
              />
              <Input
                label="网站快照"
                placeholder="https://example.com/screenshot.png"
                value={siteshot}
                onValueChange={setSiteshot}
                labelPlacement="outside"
              />
            </div>

            <Textarea
              label="网站描述"
              placeholder="输入网站描述"
              value={description}
              onValueChange={setDescription}
              minRows={2}
              maxRows={3}
              labelPlacement="outside"
            />

            <Input
              label="联系邮箱"
              placeholder="admin@example.com"
              value={email}
              onValueChange={setEmail}
              labelPlacement="outside"
            />
          </div>
        </div>

        <div className="border-t border-border/30" />

        {/* Section 2: 归类 */}
        <div className="py-4">
          <SectionTitle icon={FolderOpen}>归类</SectionTitle>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Select
                  label="分类"
                  placeholder="选择分类"
                  selectedKeys={categoryId ? [categoryId] : []}
                  onSelectionChange={handleCategoryChange}
                  isRequired
                  labelPlacement="outside"
                >
                  {categories.map(cat => (
                    <SelectItem key={String(cat.id)}>{cat.name}</SelectItem>
                  ))}
                </Select>
                {!showNewCategory && (
                  <button
                    type="button"
                    className="mt-1.5 text-xs text-primary hover:text-primary-600 transition-colors flex items-center gap-1"
                    onClick={() => {
                      setShowNewCategory(true);
                      setNewCategoryName("");
                    }}
                  >
                    <Plus className="w-3 h-3" />
                    新建分类
                  </button>
                )}
              </div>
              <div>
                <Select
                  label="标签"
                  placeholder="选择标签（可选）"
                  selectedKeys={tagId ? [tagId] : []}
                  onSelectionChange={handleTagChange}
                  labelPlacement="outside"
                >
                  {tags.map(tag => (
                    <SelectItem key={String(tag.id)} textValue={tag.name}>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: tag.color || "#999" }} />
                        {tag.name}
                      </div>
                    </SelectItem>
                  ))}
                </Select>
                {!showNewTag && (
                  <button
                    type="button"
                    className="mt-1.5 text-xs text-primary hover:text-primary-600 transition-colors flex items-center gap-1"
                    onClick={() => {
                      setShowNewTag(true);
                      setNewTagName("");
                    }}
                  >
                    <Plus className="w-3 h-3" />
                    新建标签
                  </button>
                )}
              </div>
            </div>

            <InlineCreateRow
              isOpen={showNewCategory}
              onClose={() => {
                setShowNewCategory(false);
                setNewCategoryName("");
              }}
              placeholder="输入新分类名称"
              value={newCategoryName}
              onValueChange={setNewCategoryName}
              isLoading={createCategory.isPending}
              onSubmit={handleQuickCreateCategory}
              successNode={
                justCreated?.type === "category" ? (
                  <Chip size="sm" color="success" variant="flat" startContent={<Check className="w-3 h-3" />}>
                    已创建「{justCreated.name}」并选中
                  </Chip>
                ) : undefined
              }
            />

            <InlineCreateRow
              isOpen={showNewTag}
              onClose={() => {
                setShowNewTag(false);
                setNewTagName("");
              }}
              placeholder="输入新标签名称"
              value={newTagName}
              onValueChange={setNewTagName}
              isLoading={createTag.isPending}
              onSubmit={handleQuickCreateTag}
              extra={<FormColorPicker value={newTagColor} onChange={setNewTagColor} />}
              successNode={
                justCreated?.type === "tag" ? (
                  <Chip size="sm" color="success" variant="flat" startContent={<Check className="w-3 h-3" />}>
                    已创建「{justCreated.name}」并选中
                  </Chip>
                ) : undefined
              }
            />
          </div>
        </div>

        <div className="border-t border-border/30" />

        {/* Section 3: 配置 */}
        <div className="pt-4">
          <SectionTitle icon={Settings}>配置</SectionTitle>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="状态"
                selectedKeys={[status]}
                onSelectionChange={handleStatusChange}
                labelPlacement="outside"
              >
                {STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.key}>{opt.label}</SelectItem>
                ))}
              </Select>
              <Input
                label="排序权重"
                placeholder="数字越大越靠前"
                type="number"
                value={sortOrder}
                onValueChange={setSortOrder}
                labelPlacement="outside"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/60">
              <div>
                <p className="text-sm font-medium">跳过健康检查</p>
                <p className="text-xs text-muted-foreground">开启后该友链不参与自动健康检查</p>
              </div>
              <Switch isSelected={skipHealthCheck} onValueChange={setSkipHealthCheck} size="sm" />
            </div>
          </div>
        </div>
      </ModalBody>

      <ModalFooter className="border-t border-border/30">
        <Button variant="flat" onPress={onClose}>
          取消
        </Button>
        <Button color="primary" onPress={handleSubmit} isLoading={isSubmitting}>
          {isEdit ? "保存修改" : "创建友链"}
        </Button>
      </ModalFooter>
    </>
  );
}
