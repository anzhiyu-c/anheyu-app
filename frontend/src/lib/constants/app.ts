/**
 * 应用常量
 * 集中管理缓存键、缓存时间、断点等常量
 */

// ===================== 缓存相关 =====================

/**
 * 本地存储键
 */
export const CACHE_KEYS = {
  /** 站点配置缓存 */
  SITE_CONFIG: "site_config_cache",
  /** 用户认证信息 */
  AUTH_INFO: "anheyu-user-info",
  /** 主题设置 */
  THEME: "theme-storage",
  /** 搜索历史 */
  SEARCH_HISTORY: "search-history",
} as const;

/**
 * 缓存过期时间（毫秒）
 */
export const CACHE_TTL = {
  /** 站点配置：24小时 */
  SITE_CONFIG: 24 * 60 * 60 * 1000,
  /** 文章列表：1分钟 */
  ARTICLES: 60 * 1000,
  /** 分类/标签：10分钟 */
  CATEGORIES: 10 * 60 * 1000,
  /** 统计数据：5分钟 */
  STATISTICS: 5 * 60 * 1000,
} as const;

// ===================== 响应式断点 =====================

/**
 * 响应式断点（与 Tailwind CSS 保持一致）
 */
export const BREAKPOINTS = {
  /** 移动端 */
  MOBILE: 768,
  /** 平板端 */
  TABLET: 1024,
  /** 桌面端 */
  DESKTOP: 1280,
  /** 大屏幕 */
  WIDE: 1536,
} as const;

// ===================== API 相关 =====================

/**
 * API 响应码
 */
export const API_RESPONSE_CODE = {
  /** 成功 */
  SUCCESS: 200,
  /** 未授权 */
  UNAUTHORIZED: 401,
  /** 禁止访问 */
  FORBIDDEN: 403,
  /** 未找到 */
  NOT_FOUND: 404,
  /** 服务器错误 */
  SERVER_ERROR: 500,
} as const;

// ===================== 动画相关 =====================

/**
 * 动画持续时间（毫秒）
 */
export const ANIMATION_DURATION = {
  /** 快速 */
  FAST: 150,
  /** 正常 */
  NORMAL: 300,
  /** 慢速 */
  SLOW: 500,
} as const;

// ===================== 滚动阈值 =====================

/**
 * 滚动阈值
 */
export const SCROLL_THRESHOLD = {
  /** Header 收起阈值 */
  HEADER_HIDE: 60,
  /** 返回顶部按钮显示阈值 */
  BACK_TO_TOP: 300,
} as const;
