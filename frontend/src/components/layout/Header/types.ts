/**
 * Header 组件共享类型定义
 */

// 导航菜单项
export interface NavMenuItem {
  name: string;
  link: string;
  icon: string;
}

// 导航菜单组
export interface NavMenuGroup {
  title: string;
  items: NavMenuItem[];
}

// 导航配置
export interface NavConfig {
  enable?: boolean;
  travelling?: boolean;
  menu?: NavMenuGroup[];
}

// 主菜单子项
export interface MenuSubItem {
  title: string;
  path: string;
  icon?: string;
  isExternal?: boolean;
}

// 主菜单项
export interface MenuItem {
  title: string;
  type?: "direct" | "dropdown";
  path?: string;
  icon?: string;
  isExternal?: boolean;
  items?: MenuSubItem[];
}

// Header 配置
export interface HeaderConfig {
  nav?: NavConfig;
  menu?: MenuItem[];
}
