/**
 * 相册管理类型定义
 * 对应后端 handler/album 中的请求和响应结构
 */

// ===================================
//          相册图片 (Album)
// ===================================

/** 相册图片数据结构 */
export interface Album {
  id: number;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
  categoryId: number | null;
  imageUrl: string;
  bigImageUrl: string;
  downloadUrl: string;
  thumbParam: string;
  bigParam: string;
  tags: string;
  viewCount: number;
  downloadCount: number;
  width: number;
  height: number;
  widthAndHeight: string;
  fileSize: number;
  format: string;
  aspectRatio: string;
  displayOrder: number;
  title: string;
  description: string;
  location: string;
}

/** 相册分类 */
export interface AlbumCategory {
  id: number;
  name: string;
  description?: string;
  displayOrder?: number;
}

/** 创建相册分类请求 */
export interface CreateAlbumCategoryRequest {
  name: string;
  description?: string;
  displayOrder?: number;
}

/** 更新相册分类请求 */
export type UpdateAlbumCategoryRequest = CreateAlbumCategoryRequest;

// ===================================
//       前台公开相册 (Public)
// ===================================

/** 相册页面布局模式 */
export type AlbumLayoutMode = "grid" | "waterfall";

/** 相册排序方式（对齐 anheyu-app） */
export type AlbumSortOrder =
  | "display_order_asc"
  | "display_order_desc"
  | "created_at_desc"
  | "created_at_asc"
  | "view_count_desc";

/** 相册统计类型 */
export type AlbumStatType = "view" | "download";

/** 公开相册分类 */
export interface PublicAlbumCategory {
  id: number;
  name: string;
  description?: string;
  coverImage?: string;
  displayOrder?: number;
}

/** 公开相册图片结构 */
export interface PublicAlbumItem {
  id: number;
  created_at?: string;
  updated_at?: string;
  published_at?: string | null;
  categoryId?: number | null;
  imageUrl: string;
  bigImageUrl?: string;
  downloadUrl?: string;
  thumbParam?: string;
  bigParam?: string;
  tags?: string;
  viewCount?: number;
  downloadCount?: number;
  width?: number;
  height?: number;
  widthAndHeight?: string;
  fileSize?: number;
  format?: string;
  aspectRatio?: string;
  displayOrder?: number;
  title?: string;
  description?: string;
  location?: string;
}

/** 前台公开列表响应 data */
export interface PublicAlbumListData {
  list: PublicAlbumItem[];
  total: number;
  pageNum: number;
  pageSize: number;
}

/** 前台公开列表查询参数 */
export interface PublicAlbumListParams {
  page?: number;
  pageSize?: number;
  sort?: AlbumSortOrder;
  categoryId?: number | null;
}

/** 创建/编辑表单数据 */
export interface AlbumForm {
  categoryId?: number | null;
  imageUrl: string;
  bigImageUrl?: string;
  downloadUrl?: string;
  thumbParam?: string;
  bigParam?: string;
  tags?: string[];
  width?: number;
  height?: number;
  fileSize?: number;
  format?: string;
  fileHash?: string;
  displayOrder?: number;
  title?: string;
  description?: string;
  location?: string;
  published_at?: string | null;
}

/** 导出格式 */
export type AlbumExportFormat = "json" | "zip";

/** 导出相册请求 */
export interface ExportAlbumsRequest {
  album_ids: number[];
  format?: AlbumExportFormat;
}

/** 导入模式 */
export type AlbumImportMode = "urls" | "json" | "file";

/** URL 批量导入请求 */
export interface BatchImportAlbumsRequest {
  categoryId?: number | null;
  urls: string[];
  thumbParam?: string;
  bigParam?: string;
  tags?: string[];
  displayOrder?: number;
}

/** URL 批量导入结果 */
export interface BatchImportAlbumsResult {
  successCount: number;
  failCount: number;
  skipCount: number;
  total: number;
  errors?: Array<{ url: string; reason: string }>;
  duplicates?: string[];
}

/** 文件/JSON 导入结果 */
export interface ImportAlbumsResult {
  total_count: number;
  success_count: number;
  skipped_count: number;
  failed_count: number;
  created_ids: number[];
  errors?: string[];
}

/** 相册列表响应 */
export interface AlbumListResponse {
  list: Album[];
  total: number;
  pageNum: number;
  pageSize: number;
}

/** 相册列表查询参数 */
export interface AlbumListParams {
  page?: number;
  pageSize?: number;
  categoryId?: number;
  tag?: string;
  sort?: string;
}

/** 排序选项 */
export const ALBUM_SORT_OPTIONS = [
  { key: "display_order_asc", label: "排序 (升序)" },
  { key: "display_order_desc", label: "排序 (降序)" },
  { key: "created_at_desc", label: "最新创建" },
  { key: "created_at_asc", label: "最早创建" },
  { key: "view_count_desc", label: "浏览最多" },
] as const;

export const ALBUM_PUBLIC_SORT_OPTIONS = [
  { key: "display_order_asc", label: "默认排序" },
  { key: "created_at_desc", label: "最新发布" },
  { key: "view_count_desc", label: "热度排序" },
] as const;
