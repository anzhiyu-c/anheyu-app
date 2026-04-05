export const siteConfig = {
  name: "AnHeYu",
  description: "基于 Next.js 和 HeroUI 构建的现代化博客主题",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  author: {
    name: "安知鱼",
    url: "https://anheyu.com",
    github: "https://github.com/anzhiyu-c",
    email: "contact@anheyu.com",
  },
  links: {
    github: "https://github.com/anzhiyu-c",
    docs: "https://docs.anheyu.com",
  },
};

export const navConfig = {
  mainNav: [
    { href: "/", label: "首页" },
    { href: "/archives", label: "归档" },
    { href: "/about", label: "关于" },
  ],
  adminNav: [
    { href: "/admin", label: "仪表盘", icon: "LayoutDashboard" },
    { href: "/admin/articles", label: "文章管理", icon: "FileText" },
    { href: "/admin/comments", label: "评论管理", icon: "MessageSquare" },
    { href: "/admin/settings", label: "系统设置", icon: "Settings" },
  ],
};
