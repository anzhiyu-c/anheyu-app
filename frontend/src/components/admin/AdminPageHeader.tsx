"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui";
import { Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  primaryAction?: {
    label: string;
    icon?: LucideIcon;
    onClick?: () => void;
    disabled?: boolean;
  };
  className?: string;
}

export function AdminPageHeader({
  title,
  description,
  icon: Icon,
  actions,
  primaryAction,
  className,
}: AdminPageHeaderProps) {
  const PrimaryIcon = primaryAction?.icon || Plus;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4", className)}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Icon className="w-6 h-6" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {actions}
        {primaryAction && (
          <Button
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            className={cn(
              "gap-2 shadow-lg shadow-primary/20",
              primaryAction.disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <PrimaryIcon className="w-4 h-4" />
            {primaryAction.label}
          </Button>
        )}
      </div>
    </motion.div>
  );
}
