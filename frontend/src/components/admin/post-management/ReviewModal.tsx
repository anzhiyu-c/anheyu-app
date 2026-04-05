"use client";

import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@heroui/react";
import { FormTextarea } from "@/components/ui/form-textarea";
import { ShieldCheck, ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminArticle } from "@/types/post-management";

interface ReviewModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  reviewTarget: { article: AdminArticle; action: "approve" | "reject" } | null;
  reviewComment: string;
  onReviewCommentChange: (value: string) => void;
  onConfirm: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}

export function ReviewModal({
  isOpen,
  onOpenChange,
  reviewTarget,
  reviewComment,
  onReviewCommentChange,
  onConfirm,
  isApproving,
  isRejecting,
}: ReviewModalProps) {
  const isLoading = isApproving || isRejecting;

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur" placement="center">
      <ModalContent>
        {onClose => (
          <>
            <ModalHeader>
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "p-2 rounded-xl",
                    reviewTarget?.action === "approve" ? "bg-success-50" : "bg-danger-50"
                  )}
                >
                  {reviewTarget?.action === "approve" ? (
                    <ShieldCheck className="w-5 h-5 text-success" />
                  ) : (
                    <ShieldX className="w-5 h-5 text-danger" />
                  )}
                </div>
                <span>{reviewTarget?.action === "approve" ? "审核通过" : "审核拒绝"}</span>
              </div>
            </ModalHeader>
            <ModalBody>
              <p className="text-muted-foreground mb-3">
                {reviewTarget?.action === "approve"
                  ? `通过「${reviewTarget?.article.title}」的审核`
                  : `拒绝「${reviewTarget?.article.title}」的审核`}
              </p>
              <FormTextarea
                label={reviewTarget?.action === "approve" ? "审核意见（可选）" : "拒绝原因（必填）"}
                placeholder={reviewTarget?.action === "approve" ? "可选填写审核意见..." : "请输入拒绝原因..."}
                value={reviewComment}
                onValueChange={onReviewCommentChange}
                minRows={3}
              />
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose} isDisabled={isLoading}>
                取消
              </Button>
              <Button
                color={reviewTarget?.action === "approve" ? "success" : "danger"}
                onPress={onConfirm}
                isLoading={isLoading}
                isDisabled={reviewTarget?.action === "reject" && !reviewComment.trim()}
              >
                {reviewTarget?.action === "approve" ? "通过" : "拒绝"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
