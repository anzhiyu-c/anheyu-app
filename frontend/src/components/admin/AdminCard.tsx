/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-01-31 14:55:42
 * @LastEditTime: 2026-02-04 14:07:22
 * @LastEditors: 安知鱼
 */
"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AdminCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  noPadding?: boolean;
  delay?: number;
}

export function AdminCard({
  children,
  className,
  title,
  description,
  actions,
  noPadding = false,
  delay = 0,
}: AdminCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn(
        "bg-card border border-border/50 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300",
        className
      )}
    >
      {(title || description || actions) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div>
            {title && <h3 className="font-semibold">{title}</h3>}
            {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(noPadding ? "" : "p-6")}>{children}</div>
    </motion.div>
  );
}
