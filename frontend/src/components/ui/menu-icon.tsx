/**
 * 菜单图标组件
 * 支持 Iconify 图标和图片 URL
 */

import Image from "next/image";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

interface MenuIconProps {
  /** 图标（Iconify 格式如 "ri:home-fill" 或图片 URL） */
  icon?: string;
  /** 图标大小（默认 20） */
  size?: number;
  /** 额外的 className */
  className?: string;
  /** 图片图标的额外 className */
  imageClassName?: string;
  /** Iconify 图标的额外 className */
  iconifyClassName?: string;
}

/**
 * 判断是否为图片 URL
 */
export function isImageUrl(icon?: string): boolean {
  return !!icon && (icon.startsWith("http://") || icon.startsWith("https://"));
}

/**
 * 判断是否为 Iconify 图标（包含 ":"）
 */
export function isIconifyIcon(icon?: string): boolean {
  return !!icon && icon.includes(":");
}

/**
 * 菜单图标组件
 * 自动识别 Iconify 图标或图片 URL 并渲染对应组件
 */
export function MenuIcon({ icon, size = 20, className, imageClassName, iconifyClassName }: MenuIconProps) {
  if (!icon) return null;

  // 图片 URL
  if (isImageUrl(icon)) {
    return (
      <Image
        src={icon}
        alt=""
        width={size}
        height={size}
        className={cn("inline-block", className, imageClassName)}
        unoptimized
      />
    );
  }

  // Iconify 图标（如 "ri:home-fill"）
  if (isIconifyIcon(icon)) {
    return <Icon icon={icon} width="1em" height="1em" className={cn("inline-block", className, iconifyClassName)} />;
  }

  return null;
}

export default MenuIcon;
