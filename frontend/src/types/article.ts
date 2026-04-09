/**
 * 文章相关类型定义（与 anheyu-app 后端 API 保持一致）
 */

// ===================================
//          文章标签 (PostTag)
// ===================================

export interface PostTag {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  slug?: string;
  count: number;
}

// ===================================
//          文章分类 (PostCategory)
// ===================================

export interface PostCategory {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  slug?: string;
  description: string;
  count: number;
  is_series: boolean;
  sort_order: number;
}

// ===================================
//      混合内容流项 (FeedItem)
// ===================================

/**
 * @description 混合内容项（文章或商品），用于首页文章列表
 */
export interface FeedItem {
  id: string;
  item_type: "article" | "product";
  title: string;
  cover_url: string;
  created_at: string;
  // 文章特有字段
  pin_sort?: number;
  comment_count?: number;
  post_tags?: PostTag[];
  post_categories?: PostCategory[];
  is_doc?: boolean;
  doc_series_id?: string;
  primary_color?: string; // 文章主色调，用于分类标签背景色
  // 商品特有字段
  min_price?: number;
  max_price?: number;
  total_sales?: number;
}

// ===================================
//          API 响应类型
// ===================================

export interface FeedListResponse {
  list: FeedItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface CategoryListResponse {
  list: PostCategory[];
  total: number;
}

export interface ArticleListResponse {
  list: Article[];
  total: number;
}

// ===================================
//          查询参数类型
// ===================================

export interface GetFeedListParams {
  page?: number;
  pageSize?: number;
  category?: string;
  tag?: string;
  year?: number;
  month?: number;
}

export interface GetArticleListParams {
  page?: number;
  pageSize?: number;
  category?: string;
  tag?: string;
  year?: number;
  month?: number;
}

export interface GetCategoryListParams {
  sort?: "count" | "name";
}

// ===================================
//          归档 (Archive)
// ===================================

export interface Archive {
  year: number;
  month: number;
  count: number;
}

// ===================================
//      文章详情 (Article)
// ===================================

/**
 * 相邻文章链接
 */
export interface ArticleLink {
  id: string;
  title: string;
  cover_url?: string;
  abbrlink: string;
  created_at: string;
  is_doc?: boolean;
  doc_series_id?: string;
}

/**
 * 最近文章（用于侧边栏等组件）
 */
export interface RecentArticle {
  id: number | string;
  title: string;
  abbrlink?: string;
  cover_url?: string;
  created_at: string;
  is_doc?: boolean;
  doc_series_id?: number | string;
}

/**
 * 全文隐藏配置
 */
export interface FullTextHiddenConfig {
  enabled: boolean;
  button_text?: string;
  initial_visible_height?: number;
  is_content_truncated?: boolean;
}

/**
 * 文章扩展配置
 */
export interface ArticleExtraConfig {
  enable_ai_podcast?: boolean;
  enable_toc?: boolean;
  custom_css?: string;
  custom_js?: string;
}

/**
 * 完整文章详情
 */
export interface Article {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  abbrlink: string;
  content_html: string;
  content_md?: string;
  cover_url?: string;
  top_img_url?: string;
  summaries?: string[];
  word_count: number;
  reading_time: number;
  view_count: number;
  comment_count?: number;
  is_reprint: boolean;
  copyright_author?: string;
  copyright_author_href?: string;
  copyright_url?: string;
  keywords?: string;
  primary_color?: string;
  ip_location?: string;
  status: string;
  review_status?: string;
  is_preview?: boolean;
  pin_sort?: number;
  post_tags: PostTag[];
  post_categories: PostCategory[];
  // 文档模式相关字段
  is_doc?: boolean;
  doc_series_id?: string | number;
  prev_article?: ArticleLink;
  next_article?: ArticleLink;
  related_articles?: ArticleLink[];
  full_text_hidden_config?: FullTextHiddenConfig;
  extra_config?: ArticleExtraConfig;
  // 版权相关字段
  copyright?: boolean; // 是否显示版权信息
  owner_nickname?: string; // 发布者昵称
  owner_name?: string; // 发布者名称
  owner_avatar?: string; // 发布者头像
  // 版权区域按钮显示控制（文章级别）
  show_reward_button?: boolean;
  show_share_button?: boolean;
  show_subscribe_button?: boolean;
}
