"use client";

import { useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Moon, Sun, FileText, Clock, Type } from "lucide-react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { useSiteConfigStore } from "@/store/site-config-store";
import { friendsApi } from "@/lib/api/friends";

import styles from "./styles.module.css";
import type { NavConfig, MenuItem } from "../../types";

// 判断是否为图片 URL
const isImageUrl = (icon?: string) => {
  return icon && (icon.startsWith("http://") || icon.startsWith("https://"));
};

// 判断是否为 Iconify 图标（包含 ":"）
const isIconifyIcon = (icon?: string) => {
  return icon && icon.includes(":");
};

// 渲染图标组件
function MenuIcon({ icon, className }: { icon?: string; className?: string }) {
  if (!icon) return null;

  // 图片 URL
  if (isImageUrl(icon)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={icon} alt="" className={cn(styles.menuIcon, styles.menuIconImg, className)} />;
  }

  // Iconify 图标
  if (isIconifyIcon(icon)) {
    return (
      <Icon icon={icon} width="1em" height="1em" className={cn(styles.menuIcon, styles.menuIconIconify, className)} />
    );
  }

  return null;
}

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  navConfig?: NavConfig;
  menuConfig?: MenuItem[];
}

// 模拟数据
const mockTags = [
  { name: "JavaScript", count: 12 },
  { name: "TypeScript", count: 8 },
  { name: "React", count: 15 },
  { name: "Next.js", count: 6 },
  { name: "Vue", count: 10 },
  { name: "Node.js", count: 7 },
  { name: "CSS", count: 5 },
  { name: "前端", count: 20 },
];

export function MobileMenu({ isOpen, onClose, navConfig, menuConfig }: MobileMenuProps) {
  const { isDark, toggleTheme, mounted } = useTheme();
  const siteConfig = useSiteConfigStore(state => state.siteConfig);
  const isDarkMode = mounted && isDark;
  // 菜单中 /travelling 项：跳转随机友链（对齐 anheyu-app articleStore.navigateToRandomLink）
  const navigateToRandomLink = useCallback(async () => {
    try {
      const links = await friendsApi.getRandomLinks(1);
      if (links.length > 0) {
        window.open(links[0].url, "_blank");
      }
    } catch (error) {
      console.error("获取随机友链失败:", error);
    }
  }, []);

  // 站点数据
  const siteData = useMemo(() => {
    // 从配置中获取侧边栏信息
    const sidebar = siteConfig?.sidebar as { siteinfo?: { totalPostCount?: number } } | undefined;
    const totalPostCount = sidebar?.siteinfo?.totalPostCount || 0;
    return [
      { name: "文章", link: "/archives", count: String(totalPostCount) },
      { name: "标签", link: "/tags", count: String(mockTags.length) },
      { name: "分类", link: "/categories", count: "10" },
      { name: "评论", link: "/recentcomments", count: "128" },
    ];
  }, [siteConfig]);

  // 快捷菜单组
  const quickMenuGroups = useMemo(() => {
    if (!navConfig?.menu) return [];
    return navConfig.menu.map(group => ({
      title: group.title,
      items: group.items.map(item => ({
        name: item.name,
        href: item.link,
        icon: item.icon,
        target: item.link.startsWith("http") ? "_blank" : "_self",
      })),
    }));
  }, [navConfig]);

  // 主菜单
  const mainMenus = useMemo(() => {
    if (!menuConfig || !Array.isArray(menuConfig)) return [];

    return menuConfig.map(menuItem => {
      const itemType = menuItem.type || (menuItem.items && menuItem.items.length > 0 ? "dropdown" : "direct");

      if (itemType === "direct") {
        return {
          name: menuItem.title,
          href: menuItem.path || "#",
          icon: menuItem.icon,
          isExternal: menuItem.isExternal,
          children: [],
        };
      } else {
        return {
          name: menuItem.title,
          children: (menuItem.items || []).map(item => ({
            name: item.title,
            href: item.path,
            icon: item.icon,
            isExternal: item.isExternal,
          })),
        };
      }
    });
  }, [menuConfig]);

  // 网站信息
  const websiteInfo = useMemo(() => {
    const config = siteConfig;
    // 类型断言访问配置
    type SidebarConfig = {
      siteinfo?: {
        totalPostCount?: number;
        runtimeEnable?: boolean;
        totalWordCount?: number;
      };
    };
    const sidebar = config?.sidebar as SidebarConfig | undefined;
    const siteinfo = sidebar?.siteinfo || {};
    const info = [];

    if (siteinfo.totalPostCount !== undefined && siteinfo.totalPostCount !== -1) {
      info.push({
        name: "文章总数",
        icon: FileText,
        value: String(siteinfo.totalPostCount),
      });
    }

    if (siteinfo.runtimeEnable) {
      let differenceInDays = 0;
      const launchTime = config?.footer?.runtime?.launch_time;
      if (launchTime && typeof launchTime === "string") {
        try {
          const launchDate = new Date(launchTime);
          const currentDate = new Date();
          const differenceInTime = currentDate.getTime() - launchDate.getTime();
          differenceInDays = Math.floor(differenceInTime / (1000 * 3600 * 24));
        } catch {
          differenceInDays = 0;
        }
      }
      info.push({
        name: "建站天数",
        icon: Clock,
        value: `${differenceInDays} 天`,
      });
    }

    if (siteinfo.totalWordCount !== undefined && siteinfo.totalWordCount !== -1) {
      info.push({
        name: "全站字数",
        icon: Type,
        value: String(siteinfo.totalWordCount),
      });
    }

    return info;
  }, [siteConfig]);

  // 切换主题
  const switchDarkMode = useCallback(() => {
    if (!mounted) return;
    toggleTheme();
  }, [mounted, toggleTheme]);

  // 处理内部链接点击
  const handleInternalLinkClick = useCallback(() => {
    onClose();
  }, [onClose]);

  // 禁止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* 遮罩 */}
      <div className={cn(styles.sidebarMask, isOpen && styles.show)} onClick={onClose} />

      {/* 菜单内容 */}
      <div className={cn(styles.sidebarMenus, isOpen && styles.open)}>
        {/* 站点数据统计 */}
        <div className={styles.siteData}>
          {siteData.map(item => (
            <div key={item.name} className={cn(styles.dataItem, styles.isCenter)}>
              <div className={styles.dataItemLink}>
                <Link href={item.link} prefetch={false} onClick={handleInternalLinkClick}>
                  <div className={styles.headline}>{item.name}</div>
                  <div className={styles.lengthNum}>{item.count}</div>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* 功能区域 */}
        <span className={styles.sidebarMenuItemTitle}>功能</span>
        <div className={styles.sidebarMenuItem}>
          <div className={cn(styles.darkmodeSwitchButton, isDarkMode && styles.isDark)} onClick={switchDarkMode}>
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            <span>{isDarkMode ? "浅色模式" : "深色模式"}</span>
          </div>
        </div>

        {/* 快捷菜单组 */}
        {quickMenuGroups.length > 0 && (
          <div className={styles.backMenuListGroups}>
            {quickMenuGroups.map(group => (
              <div key={group.title} className={styles.backMenuListGroup}>
                <div className={styles.backMenuListTitle}>{group.title}</div>
                <div className={styles.backMenuList}>
                  {group.items.map(item => (
                    <a
                      key={item.name}
                      href={item.href}
                      target={item.target}
                      rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
                      className={styles.backMenuItem}
                      onClick={item.target === "_self" ? handleInternalLinkClick : undefined}
                    >
                      <MenuIcon icon={item.icon} />
                      <span className={styles.backMenuItemText}>{item.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 主菜单 */}
        {mainMenus.length > 0 && (
          <div className={styles.menusItems}>
            {mainMenus.map(menu => (
              <div key={menu.name} className={styles.menuGroup}>
                <div className={styles.menuGroupTitle}>{menu.name}</div>
                <div className={styles.menuGroupList}>
                  {menu.children && menu.children.length > 0 ? (
                    menu.children.map(child =>
                      child.href === "/travelling" ? (
                        <a
                          key={child.name}
                          href="#"
                          className={styles.menuGroupItem}
                          onClick={() => {
                            navigateToRandomLink();
                            onClose();
                          }}
                        >
                          <MenuIcon icon={child.icon} />
                          <span>{child.name}</span>
                        </a>
                      ) : child.isExternal ||
                        child.href?.startsWith("http://") ||
                        child.href?.startsWith("https://") ? (
                        <a
                          key={child.name}
                          href={child.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.menuGroupItem}
                        >
                          <MenuIcon icon={child.icon} />
                          <span>{child.name}</span>
                        </a>
                      ) : (
                        <Link
                          key={child.name}
                          href={child.href || "#"}
                          prefetch={false}
                          className={styles.menuGroupItem}
                          onClick={handleInternalLinkClick}
                        >
                          <MenuIcon icon={child.icon} />
                          <span>{child.name}</span>
                        </Link>
                      )
                    )
                  ) : menu.href ? (
                    menu.href === "/travelling" ? (
                      <a
                        href="#"
                        className={styles.menuGroupItem}
                        onClick={() => {
                          navigateToRandomLink();
                          onClose();
                        }}
                      >
                        <MenuIcon icon={menu.icon} />
                        <span>{menu.name}</span>
                      </a>
                    ) : menu.isExternal || menu.href?.startsWith("http://") || menu.href?.startsWith("https://") ? (
                      <a href={menu.href} target="_blank" rel="noopener noreferrer" className={styles.menuGroupItem}>
                        <MenuIcon icon={menu.icon} />
                        <span>{menu.name}</span>
                      </a>
                    ) : (
                      <Link href={menu.href} prefetch={false} className={styles.menuGroupItem} onClick={handleInternalLinkClick}>
                        <MenuIcon icon={menu.icon} />
                        <span>{menu.name}</span>
                      </Link>
                    )
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 标签云 */}
        <span className={styles.sidebarMenuItemTitle}>标签</span>
        <div className={styles.cardWidget}>
          {mockTags.length > 0 ? (
            <div className={styles.cardTagCloud}>
              {mockTags.map(tag => (
                <Link key={tag.name} href={`/tags/${tag.name}/`} prefetch={false} onClick={handleInternalLinkClick}>
                  {tag.name}
                  <sup>{tag.count}</sup>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.noTags}>
              <span className={styles.noTagsText}>暂无标签</span>
            </div>
          )}
        </div>

        {/* 网站信息 */}
        {websiteInfo.length > 0 && (
          <>
            <span className={styles.sidebarMenuItemTitle}>网站信息</span>
            <div className={styles.webinfo}>
              {websiteInfo.map(info => {
                const IconComponent = info.icon;
                return (
                  <div key={info.name} className={styles.webinfoItem}>
                    <div className={styles.webinfoItemTitle}>
                      <IconComponent size={14} />
                      <div className={styles.itemName}>{info.name} :</div>
                    </div>
                    <div className={styles.itemCount}>{info.value}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
