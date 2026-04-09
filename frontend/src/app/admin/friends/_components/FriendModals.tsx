"use client";

import { Button, ModalBody, ModalFooter } from "@heroui/react";
import { Trash2, ShieldCheck, ShieldX } from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { FormTextarea } from "@/components/ui/form-textarea";
import FriendFormModal from "@/components/admin/friends/FriendFormModal";
import CategoryTagManager from "@/components/admin/friends/CategoryTagManager";
import ImportDialog from "@/components/admin/friends/ImportDialog";
import HealthCheckPanel from "@/components/admin/friends/HealthCheckPanel";
import type { FriendsPageState } from "../_hooks/use-friends-page";

interface FriendModalsProps {
  cm: FriendsPageState;
}

export function FriendModals({ cm }: FriendModalsProps) {
  const isApprove = cm.reviewTarget?.action === "APPROVED";

  return (
    <>
      {/* 新建/编辑友链 */}
      <FriendFormModal isOpen={cm.formModal.isOpen} onClose={cm.formModal.onClose} editItem={cm.editItem} />

      {/* 分类标签管理 */}
      <CategoryTagManager isOpen={cm.categoryTagModal.isOpen} onClose={cm.categoryTagModal.onClose} />

      {/* 导入 */}
      <ImportDialog isOpen={cm.importModal.isOpen} onClose={cm.importModal.onClose} />

      {/* 健康检查 */}
      <HealthCheckPanel isOpen={cm.healthCheckModal.isOpen} onClose={cm.healthCheckModal.onClose} />

      {/* 删除确认弹窗 */}
      <AdminDialog
        isOpen={cm.deleteModal.isOpen}
        onClose={cm.deleteModal.onClose}
        size="sm"
        header={{
          title: "确认删除",
          description: "删除后不可恢复，请谨慎操作",
          icon: Trash2,
          tone: "danger",
        }}
      >
        <ModalBody>
          <p className="text-sm">
            确定要删除友链 <strong>{cm.deleteTarget?.name}</strong> 吗？此操作不可撤销。
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={cm.deleteModal.onClose}>
            取消
          </Button>
          <Button color="danger" onPress={cm.handleDeleteConfirm} isLoading={cm.deleteLink.isPending}>
            删除
          </Button>
        </ModalFooter>
      </AdminDialog>

      {/* 审核弹窗 */}
      <AdminDialog
        isOpen={cm.reviewModal.isOpen}
        onClose={cm.reviewModal.onClose}
        size="sm"
        header={{
          title: isApprove ? "通过审核" : "拒绝友链",
          description: isApprove ? "通过后该友链将展示在前台页面" : "拒绝前可填写原因通知申请方",
          icon: isApprove ? ShieldCheck : ShieldX,
          tone: isApprove ? "success" : "danger",
        }}
      >
        <ModalBody>
          <p className="text-sm">
            {isApprove
              ? `确定通过 "${cm.reviewTarget?.item.name}" 的友链申请吗？`
              : `确定拒绝 "${cm.reviewTarget?.item.name}" 的友链申请吗？`}
          </p>
          {!isApprove && (
            <FormTextarea
              label="拒绝原因"
              placeholder="请输入拒绝原因"
              value={cm.rejectReason}
              onValueChange={cm.setRejectReason}
              isRequired
              minRows={2}
              maxRows={4}
            />
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={cm.reviewModal.onClose}>
            取消
          </Button>
          <Button
            color={isApprove ? "success" : "danger"}
            onPress={cm.handleReviewConfirm}
            isLoading={cm.reviewLink.isPending}
          >
            {isApprove ? "通过" : "拒绝"}
          </Button>
        </ModalFooter>
      </AdminDialog>
    </>
  );
}
