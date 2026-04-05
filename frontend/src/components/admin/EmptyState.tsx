/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-02-11 10:34:31
 * @LastEditTime: 2026-02-12 11:04:22
 * @LastEditors: 安知鱼
 */
"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui";
import { Plus, type LucideIcon, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    icon?: LucideIcon;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
  const ActionIcon = action?.icon || Plus;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn("flex flex-col items-center justify-center py-16 px-4", className)}
    >
      <div className="p-4 rounded-full bg-muted/50 mb-4">
        <Icon className="w-12 h-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {description && <p className="text-muted-foreground text-center max-w-sm mb-6">{description}</p>}
      {action && (
        <Button onClick={action.onClick} className="gap-2">
          <ActionIcon className="w-4 h-4" />
          {action.label}
        </Button>
      )}
    </motion.div>
  );
}
