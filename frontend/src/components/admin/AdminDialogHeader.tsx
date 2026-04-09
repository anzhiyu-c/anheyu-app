"use client";

import { ModalHeader } from "@heroui/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminDialogTone = "primary" | "success" | "warning" | "danger" | "default";

export interface AdminDialogHeaderProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  tone?: AdminDialogTone;
  className?: string;
}

const TONE_CLASS_MAP: Record<AdminDialogTone, { bg: string; text: string }> = {
  primary: { bg: "bg-primary-50", text: "text-primary" },
  success: { bg: "bg-success-50", text: "text-success" },
  warning: { bg: "bg-warning-50", text: "text-warning" },
  danger: { bg: "bg-danger-50", text: "text-danger" },
  default: { bg: "bg-muted", text: "text-foreground/70" },
};

export function AdminDialogHeader({
  title,
  description,
  icon: Icon,
  tone = "primary",
  className,
}: AdminDialogHeaderProps) {
  const toneClass = TONE_CLASS_MAP[tone];

  return (
    <ModalHeader className={cn("border-b border-border/60 pb-3", className)}>
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-xl", toneClass.bg)}>
          <Icon className={cn("w-5 h-5", toneClass.text)} />
        </div>
        <div>
          <span>{title}</span>
          {description ? <p className="text-xs text-muted-foreground font-normal mt-0.5">{description}</p> : null}
        </div>
      </div>
    </ModalHeader>
  );
}
