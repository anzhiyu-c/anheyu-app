/**
 * 友链管理相关类型定义
 * 对接 anheyu-app 后端 /api/links 和相关接口
 */

// ===================================
//          核心数据模型
// ===================================

/** 友链状态 */
export type LinkStatus = "PENDING" | "APPROVED" | "REJECTED" | "INVALID";

/** 友链申请类型 */
export type LinkApplyType = "NEW" | "UPDATE";

/** 友链分类 */
export interface LinkCategory {
  id: number;
  name: string;
  style: "card" | "list";
  description: string;
}

/** 友链标签 */
export interface LinkTag {
  id: number;
  name: string;
  color: string;
}

/** 友链实体 */
export interface LinkItem {
  id: number;
  name: string;
  url: string;
  logo: string;
  description: string;
  status: LinkStatus;
  siteshot: string;
  sort_order: number;
  skip_health_check: boolean;
  email: string;
  type?: LinkApplyType;
  original_url?: string;
  update_reason?: string;
  category: LinkCategory | null;
  tag: LinkTag | null;
}

// ===================================
//        查询参数类型
// ===================================

/** 管理端友链列表查询参数 */
export interface AdminLinksParams {
  page?: number;
  pageSize?: number;
  name?: string;
  url?: string;
  description?: string;
  status?: LinkStatus | "";
  category_id?: number | "";
  tag_id?: number | "";
}

// ===================================
//          响应类型
// ===================================

/** 友链分页列表响应 */
export interface LinkListResponse {
  list: LinkItem[];
  total: number;
  page: number;
  pageSize: number;
}

// ===================================
//        请求体类型
// ===================================

/** 创建友链请求 */
export interface CreateLinkRequest {
  name: string;
  url: string;
  logo: string;
  description: string;
  siteshot: string;
  email?: string;
  type?: LinkApplyType;
  original_url?: string;
  update_reason?: string;
  category_id: number;
  tag_id: number | null;
  status: LinkStatus;
  sort_order: number;
  skip_health_check: boolean;
}

/** 更新友链请求 */
export type UpdateLinkRequest = CreateLinkRequest;

/** 审核友链请求 */
export interface ReviewLinkRequest {
  status: "APPROVED" | "REJECTED";
  siteshot?: string;
  reject_reason?: string;
}

/** 创建友链分类请求 */
export interface CreateCategoryRequest {
  name: string;
  style: "card" | "list";
  description?: string;
}

/** 更新友链分类请求 */
export type UpdateCategoryRequest = CreateCategoryRequest;

/** 创建友链标签请求 */
export interface CreateTagRequest {
  name: string;
  color?: string;
}

/** 更新友链标签请求 */
export type UpdateTagRequest = CreateTagRequest;

// ===================================
//        批量导入类型
// ===================================

/** 导入友链的单个数据项 */
export interface ImportLinkItem {
  name: string;
  url: string;
  logo?: string;
  description?: string;
  siteshot?: string;
  email?: string;
  category_name?: string;
  tag_name?: string;
  tag_color?: string;
  status?: LinkStatus;
}

/** 批量导入友链请求 */
export interface ImportLinksRequest {
  links: ImportLinkItem[];
  skip_duplicates?: boolean;
  create_categories?: boolean;
  create_tags?: boolean;
  default_category_id?: number;
}

/** 导入失败项 */
export interface ImportLinkFailure {
  link: ImportLinkItem;
  reason: string;
}

/** 导入跳过项 */
export interface ImportLinkSkipped {
  link: ImportLinkItem;
  reason: string;
}

/** 批量导入友链响应 */
export interface ImportLinksResponse {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  success_list: LinkItem[];
  failed_list: ImportLinkFailure[];
  skipped_list: ImportLinkSkipped[];
}

// ===================================
//        导出类型
// ===================================

/** 导出友链查询参数 */
export interface ExportLinksParams {
  name?: string;
  url?: string;
  description?: string;
  status?: LinkStatus;
  category_id?: number;
  tag_id?: number;
}

/** 导出友链响应 */
export interface ExportLinksResponse {
  links: ImportLinkItem[];
  total: number;
}

// ===================================
//        健康检查类型
// ===================================

/** 友链健康检查结果 */
export interface LinkHealthCheckResult {
  total: number;
  healthy: number;
  unhealthy: number;
  unhealthy_ids: number[];
}

/** 友链健康检查状态响应 */
export interface LinkHealthCheckResponse {
  is_running: boolean;
  start_time?: string;
  end_time?: string;
  result?: LinkHealthCheckResult;
  error?: string;
}

// ===================================
//        排序类型
// ===================================

/** 单个友链排序项 */
export interface LinkSortItem {
  id: number;
  sort_order: number;
}

/** 批量更新友链排序请求 */
export interface BatchUpdateLinkSortRequest {
  items: LinkSortItem[];
}

// ===================================
//        公开接口类型
// ===================================

/** 公开友链查询参数 */
export interface PublicLinksParams {
  page?: number;
  pageSize?: number;
  category_id?: number;
}

/** 公开友链列表响应 */
export interface PublicLinkListResponse {
  list: LinkItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** 友链申请请求（公开） */
export interface ApplyLinkRequest {
  type: LinkApplyType;
  name: string;
  url: string;
  logo: string;
  description: string;
  siteshot?: string;
  email: string;
  original_url?: string;
  update_reason?: string;
}

/** 检查友链 URL 是否存在响应 */
export interface CheckLinkExistsResponse {
  exists: boolean;
  url: string;
}

/** 友链随机文章数据（钓鱼功能）*/
export interface RandomPostData {
  author: string;
  avatar: string;
  created: string;
  link: string;
  title: string;
  updated: string;
}

/** 朋友圈排序类型 */
export type MomentsSortType = "published_at" | "fetched_at";

/** 朋友圈文章项 */
export interface Moment {
  id: number;
  link_id: number;
  link_name: string;
  link_logo: string;
  link_url: string;
  post_title: string;
  post_url: string;
  post_summary: string;
  published_at: string;
  created_at: string;
}

/** 朋友圈统计信息 */
export interface MomentsStatistics {
  total_links: number;
  active_links: number;
  total_moments: number;
  last_updated_time: string;
}

/** 朋友圈列表数据 */
export interface MomentsListData {
  list: Moment[];
  total: number;
  page: number;
  page_size: number;
  statistics: MomentsStatistics;
}

/** 指定友链的朋友圈文章列表数据 */
export interface LinkMomentsData {
  list: Moment[];
  total: number;
  page: number;
  page_size: number;
}

/** 友链申请列表查询参数 */
export interface LinkApplicationsParams {
  page?: number;
  pageSize?: number;
  status?: LinkStatus | "";
  name?: string;
}
