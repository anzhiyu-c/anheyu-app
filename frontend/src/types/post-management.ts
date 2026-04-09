/**
 * 管理端文章相关类型定义
 * 对接 anheyu-app 后端 /api/articles 接口
 */

import type { PostTag, PostCategory, ArticleExtraConfig } from "./article";

// ===================================
//     管理端文章响应 (AdminArticle)
// ===================================

/**
 * 管理端文章项，包含 PRO 扩展字段
 * 对应后端 ArticleResponse
 */
export interface AdminArticle {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  abbrlink: string;
  cover_url?: string;
  top_img_url?: string;
  status: ArticleStatus;
  view_count: number;
  word_count: number;
  reading_time: number;
  comment_count?: number;
  ip_location?: string;
  primary_color?: string;
  is_primary_color_manual?: boolean;
  show_on_home?: boolean;
  home_sort?: number;
  pin_sort?: number;
  summaries?: string[];
  keywords?: string;
  // 版权字段
  copyright?: boolean;
  is_reprint?: boolean;
  copyright_author?: string;
  copyright_author_href?: string;
  copyright_url?: string;
  // 分类标签
  post_tags: PostTag[];
  post_categories: PostCategory[];
  // 定时发布
  scheduled_at?: string | null;
  // 多作者审核字段
  review_status?: ReviewStatus;
  review_comment?: string;
  owner_id?: number;
  owner_nickname?: string;
  owner_avatar?: string;
  owner_email?: string;
  // PRO 下架字段
  is_takedown?: boolean;
  takedown_reason?: string;
  takedown_at?: string | null;
  takedown_by?: number | null;
  // 文档模式
  is_doc?: boolean;
  doc_series_id?: string;
  doc_sort?: number;
  // 扩展配置
  extra_config?: ArticleExtraConfig;
}

// ===================================
//          状态枚举
// ===================================

export type ArticleStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED" | "SCHEDULED";

export type ReviewStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED";

// ===================================
//        查询参数类型
// ===================================

export interface AdminArticleListParams {
  page?: number;
  pageSize?: number;
  query?: string;
  status?: ArticleStatus | "";
  review_status?: ReviewStatus | "";
  author_id?: string;
  category?: string;
}

// ===================================
//          响应类型
// ===================================

export interface AdminArticleListResponse {
  list: AdminArticle[];
  total: number;
  page: number;
  pageSize: number;
}

// ===================================
//        审核相关类型
// ===================================

export interface ReviewArticleRequest {
  review_comment?: string;
}

export interface RejectArticleRequest {
  review_comment: string;
}

// ===================================
//        下架相关类型
// ===================================

export interface TakedownArticleRequest {
  takedown_reason: string;
}

// ===================================
//        批量操作类型
// ===================================

export interface BatchDeleteRequest {
  article_ids: string[];
}

export interface ExportArticlesRequest {
  article_ids: string[];
}

// ===================================
//        导入相关类型
// ===================================

export interface ImportArticlesParams {
  file: File;
  create_categories?: boolean;
  create_tags?: boolean;
  skip_existing?: boolean;
  default_status?: ArticleStatus;
  import_paid_content?: boolean;
  import_password_content?: boolean;
  import_full_text_hidden?: boolean;
}

export interface ImportArticlesResult {
  total_count: number;
  success_count: number;
  skipped_count: number;
  failed_count: number;
  errors: string[];
  created_ids?: string[];
}

// ===================================
//      创建/更新文章请求类型
// ===================================

/**
 * 创建文章请求
 * 对应后端 CreateArticleWithPaidContentRequest
 */
export interface CreateArticleRequest {
  title: string;
  content_md: string;
  content_html: string;
  status: ArticleStatus;
  post_category_ids?: string[];
  post_tag_ids?: string[];
  cover_url?: string;
  top_img_url?: string;
  summaries?: string[];
  abbrlink?: string;
  keywords?: string;
  // 显示与排序
  show_on_home?: boolean;
  home_sort?: number;
  pin_sort?: number;
  primary_color?: string;
  is_primary_color_manual?: boolean;
  // 版权
  copyright?: boolean;
  is_reprint?: boolean;
  copyright_author?: string;
  copyright_author_href?: string;
  copyright_url?: string;
  // 扩展配置
  extra_config?: ArticleExtraConfig;
  // 文档模式
  is_doc?: boolean;
  doc_series_id?: string;
  doc_sort?: number;
  // 时间：RFC3339；scheduled_at 在非 SCHEDULED 状态下传空字符串可清除定时
  scheduled_at?: string;
  custom_published_at?: string;
}

/**
 * 更新文章请求（所有字段可选）
 */
export type UpdateArticleRequest = Partial<CreateArticleRequest>;

/**
 * 编辑页面使用的文章详情（包含内容字段）
 */
export interface ArticleDetailForEdit extends AdminArticle {
  content_md?: string;
  content_html?: string;
}

// ===================================
//        文章统计类型
// ===================================

export interface ArticleStatusCounts {
  total: number;
  published: number;
  draft: number;
  archived: number;
  scheduled: number;
  pending_review: number;
  takedown: number;
}

// ===================================
//        文章历史版本类型
// ===================================

/** 历史版本列表项 */
export interface ArticleHistoryListItem {
  id: string;
  version: number;
  title: string;
  word_count: number;
  editor_nickname: string;
  change_note: string;
  created_at: string;
}

/** 历史版本列表响应 */
export interface ArticleHistoryListResponse {
  list: ArticleHistoryListItem[];
  total: number;
  page: number;
  page_size: number;
}

/** 历史版本详情 */
export interface ArticleHistoryDetail {
  id: string;
  article_id: string;
  version: number;
  title: string;
  content_md?: string;
  content_html?: string;
  cover_url: string;
  top_img_url: string;
  primary_color: string;
  summaries: string[];
  word_count: number;
  keywords: string;
  editor_id: number;
  editor_nickname: string;
  change_note: string;
  created_at: string;
  extra_data?: Record<string, unknown>;
}
