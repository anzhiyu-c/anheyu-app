/**
 * 后台管理菜单配置
 * 使用 Iconify 图标格式
 */

export interface AdminMenuItem {
  id: string;
  label: string;
  href?: string;
  icon: string;
  children?: AdminMenuItem[];
  badge?: string | number;
  roles?: string[];
}

export interface AdminMenuGroup {
  id: string;
  label: string;
  icon: string;
  items: AdminMenuItem[];
  rank: number;
}

export const adminMenuConfig: AdminMenuGroup[] = [
  {
    id: "overview",
    label: "概览",
    icon: "ri:dashboard-line",
    rank: 0,
    items: [
      {
        id: "dashboard",
        label: "首页",
        href: "/admin/dashboard",
        icon: "ri:home-4-line",
        roles: ["admin", "user"],
      },
      {
        id: "files",
        label: "文件管理",
        href: "/admin/file-management",
        icon: "ri:folder-open-line",
        roles: ["admin"],
      },
    ],
  },
  {
    id: "content",
    label: "内容管理",
    icon: "ri:newspaper-line",
    rank: 2,
    items: [
      {
        id: "post-management",
        label: "文章管理",
        href: "/admin/post-management",
        icon: "ri:file-text-line",
        roles: ["admin", "user"],
      },
      {
        id: "page-management",
        label: "页面管理",
        href: "/admin/page-management",
        icon: "ri:pages-line",
        roles: ["admin"],
      },
      {
        id: "doc-series",
        label: "文档系列",
        href: "/admin/doc-series",
        icon: "ri:book-open-line",
        roles: ["admin"],
      },
      {
        id: "comments",
        label: "评论管理",
        href: "/admin/comments",
        icon: "ri:chat-3-line",
        roles: ["admin"],
      },
      {
        id: "albums",
        label: "相册管理",
        href: "/admin/albums",
        icon: "ri:image-line",
        roles: ["admin"],
      },
    ],
  },
  {
    id: "interaction",
    label: "互动管理",
    icon: "ri:links-line",
    rank: 4,
    items: [
      {
        id: "friends",
        label: "友链管理",
        href: "/admin/friends",
        icon: "ri:link",
        roles: ["admin"],
      },
      {
        id: "users",
        label: "用户管理",
        href: "/admin/users",
        icon: "ri:user-line",
        roles: ["admin"],
      },
    ],
  },
  {
    id: "system",
    label: "系统管理",
    icon: "ri:settings-3-line",
    rank: 6,
    items: [
      {
        id: "settings",
        label: "系统设置",
        href: "/admin/settings",
        icon: "ri:settings-4-line",
        roles: ["admin"],
      },
      {
        id: "storage",
        label: "存储策略",
        href: "/admin/storage",
        icon: "ri:hard-drive-2-line",
        roles: ["admin"],
      },
      {
        id: "themes",
        label: "主题商城",
        href: "/admin/themes",
        icon: "ri:palette-line",
        roles: ["admin"],
      },
    ],
  },
];
