"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

interface QuickAction {
  icon: string;
  label: string;
  href: string;
  color: string;
}

const actions: QuickAction[] = [
  {
    icon: "ri:add-line",
    label: "写文章",
    href: "/admin/post-management",
    color: "bg-primary/10 text-primary hover:bg-primary/20",
  },
  {
    icon: "ri:image-line",
    label: "上传文件",
    href: "/admin/file-management",
    color: "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20",
  },
  {
    icon: "ri:chat-3-line",
    label: "管理评论",
    href: "/admin/comments",
    color: "bg-green-500/10 text-green-500 hover:bg-green-500/20",
  },
  {
    icon: "ri:price-tag-3-line",
    label: "文档系列",
    href: "/admin/doc-series",
    color: "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20",
  },
  {
    icon: "ri:links-line",
    label: "友链管理",
    href: "/admin/friends",
    color: "bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20",
  },
  {
    icon: "ri:settings-3-line",
    label: "系统设置",
    href: "/admin/settings",
    color: "bg-slate-500/10 text-slate-500 hover:bg-slate-500/20",
  },
];

interface QuickActionsProps {
  className?: string;
}

export function QuickActions({ className }: QuickActionsProps) {
  return (
    <div className={cn("bg-card border border-border rounded-2xl p-5", className)}>
      <h3 className="text-base font-semibold mb-4">快速操作</h3>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {actions.map(action => (
          <Link
            key={action.label}
            href={action.href}
            className={cn(
              "flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-all",
              action.color
            )}
          >
            <Icon icon={action.icon} className="w-5 h-5" />
            <span className="text-xs font-medium">{action.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
