"use client";

import { useRef, useState } from "react";
import { Button, ModalBody, ModalFooter, addToast } from "@heroui/react";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { ShieldAlert, Upload, Pencil, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import type { CommentPageState } from "../_hooks/use-comment-page";
import { ShieldCheck, ShieldX, Download, Trash2 } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { FloatingSelectionBar } from "@/components/admin/FloatingSelectionBar";

// ===================================
// 编辑评论弹窗
// ===================================

function EditCommentModal({ cm }: { cm: CommentPageState }) {
  return (
    <AdminDialog
      isOpen={cm.editModal.isOpen}
      onClose={cm.editModal.onClose}
      size="lg"
      scrollBehavior="inside"
      header={{
        title: "编辑评论",
        description: "修改评论者信息与内容",
        icon: Pencil,
      }}
    >
      <ModalBody className="gap-4">
        <div className="grid grid-cols-2 gap-3">
          <FormInput
            label="昵称"
            size="sm"
            value={cm.editForm.nickname ?? ""}
            onValueChange={v => cm.setEditForm({ ...cm.editForm, nickname: v })}
          />
          <FormInput
            label="邮箱"
            size="sm"
            value={cm.editForm.email ?? ""}
            onValueChange={v => cm.setEditForm({ ...cm.editForm, email: v })}
          />
        </div>
        <FormInput
          label="网站"
          size="sm"
          value={cm.editForm.website ?? ""}
          onValueChange={v => cm.setEditForm({ ...cm.editForm, website: v })}
        />
        <FormTextarea
          label="评论内容（Markdown）"
          minRows={4}
          value={cm.editForm.content ?? ""}
          onValueChange={v => cm.setEditForm({ ...cm.editForm, content: v })}
        />
      </ModalBody>
      <ModalFooter>
        <Button variant="flat" onPress={cm.editModal.onClose} isDisabled={cm.updateCommentInfo.isPending}>
          取消
        </Button>
        <Button color="primary" onPress={cm.handleEditConfirm} isLoading={cm.updateCommentInfo.isPending}>
          保存
        </Button>
      </ModalFooter>
    </AdminDialog>
  );
}

// ===================================
// 导入评论弹窗
// ===================================

function ImportCommentModal({ cm }: { cm: CommentPageState }) {
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!file) {
      addToast({ title: "请选择文件", color: "warning", timeout: 3000 });
      return;
    }
    try {
      const result = await cm.importCommentsHook.mutateAsync({ file });
      addToast({
        title: `导入完成：成功 ${result.imported} 条，跳过 ${result.skipped} 条`,
        color: "success",
        timeout: 5000,
      });
      setFile(null);
      cm.importModal.onClose();
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "导入失败", color: "danger", timeout: 3000 });
    }
  };

  return (
    <AdminDialog
      isOpen={cm.importModal.isOpen}
      onClose={cm.importModal.onClose}
      scrollBehavior="inside"
      header={{
        title: "导入评论",
        description: "支持 JSON 或 ZIP 格式",
        icon: Upload,
      }}
    >
      <ModalBody>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.zip"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "w-full border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer",
            file ? "border-primary/50 bg-primary-50/30" : "border-border/60 hover:border-primary/30 hover:bg-muted/30"
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
              <span className="text-sm font-medium">点击选择文件</span>
              <span className="text-xs text-muted-foreground/40">JSON / ZIP</span>
            </div>
          )}
        </button>
      </ModalBody>
      <ModalFooter>
        <Button variant="flat" onPress={cm.importModal.onClose} isDisabled={cm.importCommentsHook.isPending}>
          取消
        </Button>
        <Button color="primary" onPress={handleImport} isDisabled={!file} isLoading={cm.importCommentsHook.isPending}>
          开始导入
        </Button>
      </ModalFooter>
    </AdminDialog>
  );
}

// ===================================
// 浮动操作栏 + 确认弹窗
// ===================================

interface CommentModalsProps {
  cm: CommentPageState;
}

export function CommentModals({ cm }: CommentModalsProps) {
  // 根据选中评论的状态动态构建操作按钮
  const selectionActions = (() => {
    const actions: Array<{
      key: string;
      label: string;
      icon: React.ReactNode;
      onClick: () => void;
      disabled?: boolean;
      variant?: "danger";
    }> = [];

    // 选中的评论中有待审核的 → 显示"通过"
    if (cm.hasPendingSelected) {
      actions.push({
        key: "approve",
        label: "通过",
        icon: <ShieldCheck className="w-3.5 h-3.5" />,
        onClick: cm.handleBatchApprove,
        disabled: cm.updateCommentStatus.isPending,
      });
    }

    // 选中的评论中有已发布的 → 显示"设为待审核"
    if (cm.hasPublishedSelected) {
      actions.push({
        key: "reject",
        label: "设为待审核",
        icon: <ShieldX className="w-3.5 h-3.5" />,
        onClick: cm.handleBatchReject,
        disabled: cm.updateCommentStatus.isPending,
      });
    }

    actions.push(
      {
        key: "export",
        label: "导出",
        icon: <Download className="w-3.5 h-3.5" />,
        onClick: cm.handleExport,
        disabled: cm.exportComments.isPending,
      },
      {
        key: "delete",
        label: "删除",
        icon: <Trash2 className="w-3.5 h-3.5" />,
        onClick: cm.batchDeleteModal.onOpen,
        variant: "danger",
      }
    );

    return actions;
  })();

  return (
    <>
      {/* 浮动选择操作栏 */}
      <AnimatePresence>
        {cm.isSomeSelected && (
          <FloatingSelectionBar
            count={cm.selectedIds.size}
            actions={selectionActions}
            onClear={() => cm.setSelectedIds(new Set())}
          />
        )}
      </AnimatePresence>

      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={cm.deleteModal.isOpen}
        onOpenChange={cm.deleteModal.onOpenChange}
        title="删除评论"
        description={`确定要删除「${cm.deleteTarget?.nickname}」的评论吗？此操作不可撤销。`}
        confirmText="删除"
        confirmColor="danger"
        icon={<ShieldAlert className="w-5 h-5 text-danger" />}
        iconBg="bg-danger-50"
        loading={cm.deleteComments.isPending}
        onConfirm={cm.handleDeleteConfirm}
      />

      {/* 批量删除确认 */}
      <ConfirmDialog
        isOpen={cm.batchDeleteModal.isOpen}
        onOpenChange={cm.batchDeleteModal.onOpenChange}
        title="批量删除"
        description={`确定要删除选中的 ${cm.selectedIds.size} 条评论吗？此操作不可撤销。`}
        confirmText={`删除 ${cm.selectedIds.size} 条`}
        confirmColor="danger"
        icon={<ShieldAlert className="w-5 h-5 text-danger" />}
        iconBg="bg-danger-50"
        loading={cm.deleteComments.isPending}
        onConfirm={cm.handleBatchDeleteConfirm}
      />

      {/* 编辑弹窗 */}
      <EditCommentModal cm={cm} />

      {/* 导入弹窗 */}
      <ImportCommentModal cm={cm} />
    </>
  );
}
