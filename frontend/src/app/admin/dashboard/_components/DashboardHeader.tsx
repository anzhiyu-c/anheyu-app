"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import { useAuthStore } from "@/store/auth-store";
import { useShallow } from "zustand/shallow";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 6) return "夜深了";
  if (hour < 9) return "早上好";
  if (hour < 12) return "上午好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  if (hour < 22) return "晚上好";
  return "夜深了";
}

export function DashboardHeader() {
  const { user } = useAuthStore(
    useShallow(state => ({
      user: state.user,
    }))
  );

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {getGreeting()}，{user?.nickname || "管理员"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">这是您的网站数据概览</p>
      </div>
      <Link
        href="/admin/post-management"
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <Icon icon="ri:add-line" className="w-4 h-4" />
        写文章
      </Link>
    </div>
  );
}
