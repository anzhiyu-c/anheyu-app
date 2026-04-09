"use client";

import Image from "next/image";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import styles from "./styles.module.css";
import type { NavConfig } from "../../types";

interface BackMenuListGroupsProps {
  navConfig?: NavConfig;
  isTextWhite?: boolean;
}

// 默认图标
const DEFAULT_ICON = "ri:link";

// 判断是否为图片 URL
const isImageUrl = (icon?: string) => {
  return icon && (icon.startsWith("http://") || icon.startsWith("https://"));
};

// 判断是否为 Iconify 图标（包含 ":"）
const isIconifyIcon = (icon?: string) => {
  return icon && icon.includes(":");
};

// 获取图标类型
const getIconType = (icon?: string): "image" | "iconify" | "default" => {
  if (!icon) return "default";
  if (isImageUrl(icon)) return "image";
  if (isIconifyIcon(icon)) return "iconify";
  return "default";
};

// 渲染图标
function MenuItemIcon({ icon }: { icon?: string }) {
  const iconType = getIconType(icon);

  switch (iconType) {
    case "image":
      return <Image className={styles.backMenuItemIcon} src={icon!} alt="" width={24} height={24} unoptimized />;
    case "iconify":
      return (
        <Icon
          icon={icon!}
          width={24}
          height={24}
          className={cn(styles.backMenuItemIcon, styles.backMenuItemIconIconify)}
        />
      );
    case "default":
    default:
      return (
        <Icon
          icon={DEFAULT_ICON}
          width={24}
          height={24}
          className={cn(styles.backMenuItemIcon, styles.backMenuItemIconIconify)}
        />
      );
  }
}

export function BackMenuListGroups({ navConfig, isTextWhite = false }: BackMenuListGroupsProps) {
  if (!navConfig?.menu || navConfig.menu.length === 0) {
    return null;
  }

  return (
    <div className={cn(styles.backHomeButton, isTextWhite && styles.textIsWhite)}>
      <Icon icon="ri:apps-fill" className={styles.triggerIcon} />
      <div className={styles.backMenuListGroups}>
        {navConfig.menu.map(group => (
          <div key={group.title} className={styles.backMenuListGroup}>
            <div className={styles.backMenuListTitle}>{group.title}</div>
            <div className={styles.backMenuList}>
              {group.items.map(item => (
                <a
                  key={item.name}
                  className={styles.backMenuItem}
                  href={item.link}
                  title={item.name}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MenuItemIcon icon={item.icon} />
                  <span className={styles.backMenuItemText}>{item.name}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BackMenuListGroups;
