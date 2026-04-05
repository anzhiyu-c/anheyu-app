// 用户类型
export interface User {
  id: string;
  email: string;
  username: string;
  nickname: string;
  avatar: string;
  role: "admin" | "user";
  created_at: string;
  updated_at: string;
}

// 文章类型
export interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  cover: string;
  author: User;
  category: Category;
  tags: Tag[];
  views: number;
  likes: number;
  comments_count: number;
  is_published: boolean;
  is_top: boolean;
  created_at: string;
  updated_at: string;
  published_at: string;
}

// 分类类型
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  cover: string;
  count: number;
}

// 标签类型
export interface Tag {
  id: string;
  name: string;
  slug: string;
  color: string;
  count: number;
}

// 站点配置类型
export interface SiteConfig {
  site_name: string;
  site_description: string;
  site_logo: string;
  site_favicon: string;
  author: {
    name: string;
    avatar: string;
    description: string;
  };
  social: {
    github?: string;
    twitter?: string;
    email?: string;
  };
}

// 统计数据类型
export interface Statistics {
  today: {
    views: number;
    visitors: number;
    comments: number;
  };
  total: {
    articles: number;
    comments: number;
    views: number;
    visitors: number;
  };
  trend: TrendItem[];
  recentArticles: Article[];
}

export interface TrendItem {
  date: string;
  views: number;
  visitors: number;
}

// API 响应类型
export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

// 分页响应类型
export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  page_size: number;
}

// 导出认证相关类型
export * from "./auth";

// 导出站点配置类型
export * from "./site-config";

// 导出文章相关类型
export * from "./article";

// 导出文件管理相关类型
export * from "./file-manager";

// 导出用户管理相关类型
export * from "./user-management";

// 导出运营管理相关类型
export * from "./order";
export * from "./product";
export * from "./membership";
export * from "./support";
