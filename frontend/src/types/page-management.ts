/**
 * 自定义页面管理相关类型定义
 * 对接 anheyu-app 后端 /api/pages 和 /api/public/pages 接口
 */

// ===================================
//          页面模型
// ===================================

export interface CustomPage {
  id: number;
  title: string;
  path: string;
  content: string;
  markdown_content: string;
  custom_js: string;
  custom_css: string;
  description: string;
  is_published: boolean;
  show_comment: boolean;
  sort: number;
  created_at: string;
  updated_at: string;
}

// ===================================
//        查询参数类型
// ===================================

export interface PageListParams {
  page?: number;
  page_size?: number;
  search?: string;
  is_published?: boolean;
}

// ===================================
//          响应类型
// ===================================

export interface PageListResponse {
  pages: CustomPage[];
  total: number;
  page: number;
  size: number;
}

// ===================================
//      创建/更新页面请求类型
// ===================================

export interface CreatePageRequest {
  title: string;
  path: string;
  content: string;
  markdown_content?: string;
  custom_js?: string;
  custom_css?: string;
  description?: string;
  is_published?: boolean;
  show_comment?: boolean;
  sort?: number;
}

export interface UpdatePageRequest {
  title?: string;
  path?: string;
  content?: string;
  markdown_content?: string;
  custom_js?: string;
  custom_css?: string;
  description?: string;
  is_published?: boolean;
  show_comment?: boolean;
  sort?: number;
}
