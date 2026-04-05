"use client";

import { Button, ModalBody, ModalFooter } from "@heroui/react";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect, FormSelectItem } from "@/components/ui/form-select";
import { Plus } from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";

interface UserGroup {
  id: string;
  name: string;
}

interface CreateUserForm {
  username: string;
  password: string;
  email: string;
  nickname: string;
  userGroupID: string;
}

interface CreateUserModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  form: CreateUserForm;
  onFormChange: (updater: (prev: CreateUserForm) => CreateUserForm) => void;
  userGroups: UserGroup[];
  onConfirm: () => void;
  isLoading: boolean;
}

export function CreateUserModal({
  isOpen,
  onOpenChange,
  form,
  onFormChange,
  userGroups,
  onConfirm,
  isLoading,
}: CreateUserModalProps) {
  return (
    <AdminDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="lg"
      header={{
        title: "新增用户",
        description: "创建一个新的系统用户",
        icon: Plus,
      }}
    >
      <ModalBody>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            label="用户名"
            placeholder="3-50 个字符"
            isRequired
            value={form.username}
            onValueChange={v => onFormChange(f => ({ ...f, username: v }))}
          />
          <FormInput
            label="密码"
            placeholder="至少 6 位"
            type="password"
            isRequired
            value={form.password}
            onValueChange={v => onFormChange(f => ({ ...f, password: v }))}
          />
          <FormInput
            label="邮箱"
            placeholder="user@example.com"
            type="email"
            isRequired
            value={form.email}
            onValueChange={v => onFormChange(f => ({ ...f, email: v }))}
          />
          <FormInput
            label="昵称"
            placeholder="可选"
            value={form.nickname}
            onValueChange={v => onFormChange(f => ({ ...f, nickname: v }))}
          />
          <FormSelect
            label="用户组"
            placeholder="请选择用户组"
            isRequired
            value={form.userGroupID}
            onValueChange={(v: string) => onFormChange(f => ({ ...f, userGroupID: v }))}
          >
            {userGroups.map(group => (
              <FormSelectItem key={group.id}>{group.name}</FormSelectItem>
            ))}
          </FormSelect>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="flat" onPress={() => onOpenChange(false)} isDisabled={isLoading}>
          取消
        </Button>
        <Button color="primary" onPress={onConfirm} isLoading={isLoading}>
          创建
        </Button>
      </ModalFooter>
    </AdminDialog>
  );
}
