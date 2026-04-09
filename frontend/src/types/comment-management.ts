/**
 * 管理端评论相关类型定义
 * 对接后端 /api/comments 管理员接口
 */

// ===================================
//     管理端评论响应 (AdminComment)
// ===================================

/**
 * 管理端评论项
 * 对应后端 Comment entity
 */
export interface AdminComment {
  id: string;
  created_at: string;
  updated_at: string;
  /** 评论者昵称 */
  nickname: string;
  /** 邮箱 */
  email: string;
  /** 邮箱 MD5（用于 Gravatar） */
  email_md5: string;
  /** 头像 URL */
  avatar_url?: string;
  /** 网站 */
  website?: string;
  /** Markdown 原文 */
  content: string;
  /** 渲染后的 HTML */
  content_html: string;
  /** 状态：1=已发布, 2=待审核 */
  status: CommentStatus;
  /** 是否管理员评论 */
  is_admin_comment: boolean;
  /** 是否匿名评论 */
  is_anonymous: boolean;
  /** 评论目标路径 */
  target_path: string;
  /** 评论目标标题 */
  target_title?: string;
  /** 父评论 ID */
  parent_id?: string;
  /** 回复目标评论 ID */
  reply_to_id?: string;
  /** 回复目标昵称 */
  reply_to_nick?: string;
  /** 点赞数 */
  like_count: number;
  /** 子评论数 */
  total_children: number;
  /** IP 地址 */
  ip_address?: string;
  /** IP 归属地 */
  ip_location?: string;
  /** User Agent */
  user_agent?: string;
  /** 置顶时间（null 表示未置顶） */
  pinned_at?: string | null;
}

// ===================================
//          状态枚举
// ===================================

/** 评论状态：1=已发布, 2=待审核 */
export type CommentStatus = 1 | 2;

export const COMMENT_STATUS = {
  PUBLISHED: 1 as CommentStatus,
  PENDING: 2 as CommentStatus,
} as const;

// ===================================
//        查询参数类型
// ===================================

export interface AdminCommentListParams {
  page?: number;
  pageSize?: number;
  /** 按昵称模糊搜索 */
  nickname?: string;
  /** 按邮箱模糊搜索 */
  email?: string;
  /** 按目标路径模糊搜索 */
  target_path?: string;
  /** 按 IP 地址模糊搜索 */
  ip_address?: string;
  /** 按内容模糊搜索 */
  content?: string;
  /** 按状态筛选 */
  status?: CommentStatus;
}

// ===================================
//          响应类型
// ===================================

export interface AdminCommentListResponse {
  list: AdminComment[];
  total: number;
  page: number;
  pageSize: number;
}

// ===================================
//        操作请求类型
// ===================================

export interface UpdateCommentInfoRequest {
  content?: string;
  nickname?: string;
  email?: string;
  website?: string;
}

export interface ImportCommentsParams {
  file: File;
  skip_existing?: boolean;
  default_status?: CommentStatus;
  keep_create_time?: boolean;
}

export interface ImportCommentsResult {
  imported: number;
  skipped: number;
  errors: string[];
}
