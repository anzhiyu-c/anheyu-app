/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-01-31 14:55:40
 * @LastEditTime: 2026-02-06 10:51:33
 * @LastEditors: 安知鱼
 */
"use client";

import { IconButton } from "@/components/ui";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { useShallow } from "zustand/shallow";
import { AdminSidebar } from "@/components/admin";
import { Logo } from "@/components/common";
import { cn } from "@/lib/utils";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const { _hasHydrated, accessToken, user, isAdmin } = useAuthStore(
    useShallow(state => ({
      _hasHydrated: state._hasHydrated,
      accessToken: state.accessToken,
      user: state.user,
      isAdmin: state.isAdmin,
    }))
  );
  const isAuthenticated = !!accessToken && !!user;
  const hasAdminAccess = isAuthenticated && isAdmin();

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) {
      router.replace("/login");
    } else if (!hasAdminAccess) {
      router.replace("/");
    }
  }, [_hasHydrated, isAuthenticated, hasAdminAccess, router]);

  return (
    <div className="admin-layout h-screen flex flex-col overflow-hidden bg-muted/30">
      {/* 移动端顶部导航 */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-card border-b border-border shrink-0">
        <Logo href="/admin" />
        <IconButton size="sm" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </IconButton>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* 侧边栏 - 始终固定定位 */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-64 h-screen bg-card border-r border-border transition-transform duration-300",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            "lg:translate-x-0"
          )}
        >
          {_hasHydrated && hasAdminAccess ? (
            <AdminSidebar onClose={() => setSidebarOpen(false)} />
          ) : (
            <div className="p-6">
              <div className="h-8 w-28 bg-muted/50 rounded-lg animate-pulse" />
              <div className="mt-8 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-9 bg-muted/30 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* 遮罩层 */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* 主内容区 - scrollbar-gutter:stable 避免弹窗展开时滚动条出现导致布局右移 */}
        <main className="flex-1 min-h-0 overflow-auto p-4 lg:p-8 lg:ml-64 [scrollbar-gutter:stable]">
          {_hasHydrated && hasAdminAccess ? (
            children
          ) : (
            <div className="space-y-6 animate-pulse">
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-7 w-32 bg-muted/50 rounded-lg" />
                  <div className="h-4 w-48 bg-muted/30 rounded mt-2" />
                </div>
                <div className="h-9 w-24 bg-muted/50 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 bg-card border border-border/50 rounded-xl" />
                ))}
              </div>
              <div className="h-64 bg-card border border-border/50 rounded-xl" />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
