/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-02-06 23:08:43
 * @LastEditTime: 2026-02-06 23:09:15
 * @LastEditors: 安知鱼
 */
"use client";

import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@heroui/react";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText: string;
  confirmColor: "primary" | "danger" | "warning" | "success";
  icon: React.ReactNode;
  iconBg: string;
  loading: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  confirmText,
  confirmColor,
  icon,
  iconBg,
  loading,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur" placement="center">
      <ModalContent>
        {onClose => (
          <>
            <ModalHeader>
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-xl", iconBg)}>{icon}</div>
                <span>{title}</span>
              </div>
            </ModalHeader>
            <ModalBody>
              <p className="text-muted-foreground">{description}</p>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose} isDisabled={loading}>
                取消
              </Button>
              <Button color={confirmColor} onPress={onConfirm} isLoading={loading}>
                {confirmText}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
