"use client";

import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@heroui/react";
import { FormTextarea } from "@/components/ui/form-textarea";
import { AlertCircle } from "lucide-react";
import type { AdminArticle } from "@/types/post-management";

interface TakedownModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  target: AdminArticle | null;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export function TakedownModal({
  isOpen,
  onOpenChange,
  target,
  reason,
  onReasonChange,
  onConfirm,
  isLoading,
}: TakedownModalProps) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur" placement="center">
      <ModalContent>
        {onClose => (
          <>
            <ModalHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-warning-50">
                  <AlertCircle className="w-5 h-5 text-warning" />
                </div>
                <span>下架文章</span>
              </div>
            </ModalHeader>
            <ModalBody>
              <p className="text-muted-foreground mb-3">
                下架「<strong>{target?.title}</strong>」
              </p>
              <FormTextarea
                label="下架原因（必填）"
                placeholder="请输入下架原因..."
                value={reason}
                onValueChange={onReasonChange}
                minRows={3}
                isRequired
              />
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose} isDisabled={isLoading}>
                取消
              </Button>
              <Button color="warning" onPress={onConfirm} isLoading={isLoading} isDisabled={!reason.trim()}>
                确认下架
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
