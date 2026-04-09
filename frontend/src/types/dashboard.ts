/**
 * 仪表盘数据类型定义
 * 与后端 API 数据结构对应
 */

// ============================================
// 访问统计相关类型（对应后端 model/visitor_stat.go）
// ============================================

/** 基础访问统计数据 - 对应后端 VisitorStatistics */
export interface VisitorStatistics {
  today_visitors: number;
  today_views: number;
  yesterday_visitors: number;
  yesterday_views: number;
  month_views: number;
  year_views: number;
}

/** 日期范围统计 - 对应后端 DateRangeStats */
export interface DateRangeStats {
  date: string;
  visitors: number;
  views: number;
}

/** 访客趋势数据 - 对应后端 VisitorTrendData */
export interface VisitorTrendData {
  daily: DateRangeStats[];
  weekly: DateRangeStats[];
  monthly: DateRangeStats[];
}

/** URL 统计信息 - 对应后端 URLStatistics */
export interface URLStatistics {
  url_path: string;
  page_title: string;
  total_views: number;
  unique_views: number;
  bounce_count: number;
  bounce_rate: number;
  avg_duration: number;
  last_visited_at?: string;
}

/** 国家统计 */
export interface CountryStats {
  country: string;
  count: number;
}

/** 城市统计 */
export interface CityStats {
  city: string;
  count: number;
}

/** 浏览器统计 */
export interface BrowserStats {
  browser: string;
  count: number;
}

/** 操作系统统计 */
export interface OSStats {
  os: string;
  count: number;
}

/** 设备统计 */
export interface DeviceStats {
  device: string;
  count: number;
}

/** 来源统计 */
export interface RefererStats {
  referer: string;
  count: number;
}

/** 访客分析数据 - 对应后端 VisitorAnalytics */
export interface VisitorAnalytics {
  top_countries: CountryStats[];
  top_cities: CityStats[];
  top_browsers: BrowserStats[];
  top_os: OSStats[];
  top_devices: DeviceStats[];
  top_referers: RefererStats[];
}

/** 统计概览 - 对应后端 StatisticsSummary */
export interface StatisticsSummary {
  basic_stats: VisitorStatistics;
  top_pages: URLStatistics[];
  analytics: VisitorAnalytics;
  trend_data: VisitorTrendData;
}

// ============================================
// 内容统计相关类型
// ============================================

/** 内容统计 */
export interface ContentStats {
  total_articles: number;
  published_articles: number;
  draft_articles: number;
  total_comments: number;
  pending_comments: number;
  total_categories: number;
  total_tags: number;
}

/** 文章统计响应 */
export interface ArticleStatsResponse {
  total: number;
  published: number;
  draft: number;
  pending: number;
}

/** 评论统计响应 */
export interface CommentStatsResponse {
  total: number;
  approved: number;
  pending: number;
  spam: number;
}

// ============================================
// 最近数据相关类型
// ============================================

/** 热门文章 */
export interface TopArticle {
  id: string;
  title: string;
  slug?: string;
  total_views: number;
  unique_views: number;
  avg_duration: number;
}

/** 最近评论 */
export interface RecentComment {
  id: string;
  author: string;
  avatar?: string;
  content: string;
  article_title: string;
  article_id: string;
  created_at: string;
  status: "approved" | "pending" | "spam";
}

// ============================================
// 仪表盘汇总数据
// ============================================

/** 仪表盘完整数据 */
export interface DashboardData {
  // 访问统计
  statistics: StatisticsSummary;
  // 内容统计
  content: ContentStats;
  // 热门文章
  top_articles: TopArticle[];
  // 最近评论
  recent_comments: RecentComment[];
}

// ============================================
// 工具类型
// ============================================

/** 趋势信息 */
export interface TrendInfo {
  value: number;
  isUp: boolean;
  label?: string;
}

// ============================================
// 兼容旧类型（逐步废弃）
// ============================================

/** @deprecated 使用 VisitorStatistics */
export type BasicStats = VisitorStatistics;

/** @deprecated 使用 DateRangeStats */
export interface TrendDataPoint {
  date: string;
  visitors: number;
  views: number;
}

/** @deprecated 使用 VisitorTrendData */
export interface VisitorTrend {
  daily: TrendDataPoint[];
  weekly?: TrendDataPoint[];
  monthly?: TrendDataPoint[];
}

/** @deprecated 使用对应的具体统计类型 */
export interface DistributionItem {
  name: string;
  count: number;
  percentage?: number;
}

/** @deprecated 使用 URLStatistics */
export interface TopPage {
  url_path: string;
  page_title: string;
  total_views: number;
  unique_views: number;
  bounce_rate: number;
  avg_duration: number;
}

/** @deprecated 使用 TopArticle */
export interface RecentArticle {
  id: string;
  title: string;
  views: number;
  comments: number;
  created_at: string;
  status: "published" | "draft" | "pending";
}

/** @deprecated 使用 DashboardData */
export interface DashboardSummary {
  basic_stats: VisitorStatistics;
  content_stats: ContentStats;
  trend_data: VisitorTrend;
  analytics?: VisitorAnalytics;
  top_pages?: TopPage[];
  recent_articles: RecentArticle[];
  recent_comments?: RecentComment[];
}
