"use client";

import type { ReactNode } from "react";
import { Modal, ModalContent } from "@heroui/react";
import type { ModalProps } from "@heroui/react";
import type { LucideIcon } from "lucide-react";
import { AdminDialogHeader, type AdminDialogTone } from "@/components/admin/AdminDialogHeader";

interface AdminDialogHeaderConfig {
  title: string;
  description?: string;
  icon: LucideIcon;
  tone?: AdminDialogTone;
  className?: string;
}

interface AdminDialogProps extends Omit<ModalProps, "children"> {
  header: AdminDialogHeaderConfig;
  contentClassName?: string;
  children: ReactNode | ((onClose: () => void) => ReactNode);
}

export function AdminDialog({ header, contentClassName, children, ...modalProps }: AdminDialogProps) {
  return (
    <Modal {...modalProps}>
      <ModalContent className={contentClassName}>
        {onClose => (
          <>
            <AdminDialogHeader
              title={header.title}
              description={header.description}
              icon={header.icon}
              tone={header.tone}
              className={header.className}
            />
            {typeof children === "function" ? children(onClose) : children}
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
