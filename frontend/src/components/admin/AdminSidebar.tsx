"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui";
import { useAuthStore } from "@/store/auth-store";
import { useSiteConfigStore } from "@/store/site-config-store";
import { useShallow } from "zustand/shallow";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { adminMenuConfig, type AdminMenuGroup, type AdminMenuItem } from "@/config/admin-menu";
import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getUserAvatarUrl } from "@/utils/avatar";

interface AdminSidebarProps {
  onClose?: () => void;
}

export function AdminSidebar({ onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const { isDark, toggleTheme, mounted } = useTheme();
  const { user, logout, isAdmin } = useAuthStore(
    useShallow(state => ({
      user: state.user,
      logout: state.logout,
      isAdmin: state.isAdmin,
    }))
  );
  const userIsAdmin = isAdmin();

  // 获取站点配置
  const { siteConfig, getLogo, getTitle } = useSiteConfigStore(
    useShallow(state => ({
      siteConfig: state.siteConfig,
      getLogo: state.getLogo,
      getTitle: state.getTitle,
    }))
  );

  // 获取 Logo URL
  const logoUrl = getLogo();
  const siteTitle = getTitle();

  // 计算用户头像
  const avatarUrl = useMemo(() => {
    if (!user) return null;
    return getUserAvatarUrl(
      {
        avatar: user.avatar,
        email: user.email,
        nickname: user.nickname,
      },
      {
        gravatarUrl: siteConfig.GRAVATAR_URL,
        defaultGravatarType: siteConfig.DEFAULT_GRAVATAR_TYPE,
      },
      80
    );
  }, [user, siteConfig.GRAVATAR_URL, siteConfig.DEFAULT_GRAVATAR_TYPE]);

  const userRole = userIsAdmin ? "admin" : "user";

  const filteredMenuConfig = useMemo(() => {
    return adminMenuConfig
      .map(group => ({
        ...group,
        items: group.items.filter(item => !item.roles || item.roles.includes(userRole)),
      }))
      .filter(group => group.items.length > 0);
  }, [userRole]);

  const [expandedGroups, setExpandedGroups] = useState<string[]>(() => {
    const currentGroup = filteredMenuConfig.find(group =>
      group.items.some(item => {
        if (!item.href) return false;
        return pathname.startsWith(item.href);
      })
    );
    return currentGroup ? [currentGroup.id] : ["overview"];
  });

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => (prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]));
  }, []);

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  const isItemActive = (href?: string) => {
    if (!href) return false;
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className="flex flex-col h-full bg-linear-to-b from-card to-card/95">
      {/* Logo */}
      <div className="hidden lg:flex items-center shrink-0 h-16 px-6 border-b border-border/50">
        <Link href="/admin" className="flex items-center gap-2">
          <Image src={logoUrl} alt={siteTitle} width={32} height={32} className="rounded-lg" priority />
          <span className="font-bold text-lg">{siteTitle}</span>
        </Link>
        <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">Admin</span>
      </div>

      {/* 用户信息 */}
      <div className="shrink-0 p-4 border-b border-border/50">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
          <div className="relative">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={user?.nickname || "用户"}
                width={40}
                height={40}
                className="w-10 h-10 rounded-full object-cover shadow-sm"
                unoptimized
                priority
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-semibold">
                {user?.nickname?.[0] || "U"}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green rounded-full border-2 border-card" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate text-sm">{user?.nickname || "用户"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email || ""}</p>
          </div>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-2 scrollbar-thin">
        {filteredMenuConfig.map(group => (
          <MenuGroup
            key={group.id}
            group={group}
            isExpanded={expandedGroups.includes(group.id)}
            onToggle={() => toggleGroup(group.id)}
            isItemActive={isItemActive}
            onItemClick={onClose}
          />
        ))}
      </nav>

      {/* 底部操作 - shrink-0 确保始终显示在底部 */}
      <div className="shrink-0 p-3 border-t border-border/50 space-y-1.5">
        <Link
          href="/"
          target="_blank"
          className="flex items-center w-full justify-start gap-2.5 h-10 px-3 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all text-sm"
        >
          <Icon icon="ri:external-link-line" className="w-4 h-4" />
          <span>访问前台</span>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2.5 h-10 px-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all"
          onClick={toggleTheme}
        >
          <Icon icon={mounted ? (isDark ? "ri:sun-line" : "ri:moon-line") : "ri:contrast-2-line"} className="w-4 h-4" />
          <span className="text-sm">{mounted ? (isDark ? "浅色模式" : "深色模式") : "切换主题"}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2.5 h-10 px-3 text-red hover:text-red hover:bg-red/10 rounded-lg transition-all"
          onClick={handleLogout}
        >
          <Icon icon="ri:logout-box-r-line" className="w-4 h-4" />
          <span className="text-sm">退出登录</span>
        </Button>
      </div>
    </div>
  );
}

interface MenuGroupProps {
  group: AdminMenuGroup;
  isExpanded: boolean;
  onToggle: () => void;
  isItemActive: (href?: string) => boolean;
  onItemClick?: () => void;
}

function MenuGroup({ group, isExpanded, onToggle, isItemActive, onItemClick }: MenuGroupProps) {
  const hasActiveItem = group.items.some(item => isItemActive(item.href));

  return (
    <div className="space-y-0.5">
      {/* 组标题 */}
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
          hasActiveItem ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
      >
        <Icon icon={group.icon} className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <Icon
          icon="ri:arrow-down-s-line"
          className={cn("w-4 h-4 transition-transform duration-200", isExpanded ? "rotate-180" : "")}
        />
      </button>

      {/* 子菜单项 */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pl-3 space-y-1 pt-1">
              {group.items.map(item => (
                <MenuItem key={item.id} item={item} isActive={isItemActive(item.href)} onClick={onItemClick} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface MenuItemProps {
  item: AdminMenuItem;
  isActive: boolean;
  onClick?: () => void;
}

function MenuItem({ item, isActive, onClick }: MenuItemProps) {
  return (
    <Link
      href={item.href || "#"}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 relative",
        isActive
          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
    >
      <Icon
        icon={item.icon}
        className={cn("w-4 h-4 shrink-0", isActive ? "" : "group-hover:scale-110 transition-transform")}
      />
      <span className="flex-1">{item.label}</span>

      {/* Badge */}
      {item.badge && (
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-semibold",
            isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"
          )}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}
