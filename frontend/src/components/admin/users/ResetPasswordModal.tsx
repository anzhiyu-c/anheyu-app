"use client";

import { Button, ModalBody, ModalFooter } from "@heroui/react";
import { FormInput } from "@/components/ui/form-input";
import { KeyRound } from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import type { AdminUser } from "@/types/user-management";

interface ResetPasswordModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  target: AdminUser | null;
  newPassword: string;
  onPasswordChange: (value: string) => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export function ResetPasswordModal({
  isOpen,
  onOpenChange,
  target,
  newPassword,
  onPasswordChange,
  onConfirm,
  isLoading,
}: ResetPasswordModalProps) {
  return (
    <AdminDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      header={{
        title: "重置密码",
        description: `为用户「${target?.nickname || target?.username || ""}」设置新密码`,
        icon: KeyRound,
        tone: "warning",
      }}
    >
      <ModalBody>
        <FormInput
          label="新密码"
          placeholder="至少 6 位"
          type="password"
          isRequired
          value={newPassword}
          onValueChange={onPasswordChange}
        />
      </ModalBody>
      <ModalFooter>
        <Button variant="flat" onPress={() => onOpenChange(false)} isDisabled={isLoading}>
          取消
        </Button>
        <Button
          color="warning"
          onPress={onConfirm}
          isLoading={isLoading}
          isDisabled={!newPassword.trim() || newPassword.length < 6}
        >
          确认重置
        </Button>
      </ModalFooter>
    </AdminDialog>
  );
}
