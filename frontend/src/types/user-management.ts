/**
 * 管理端用户管理相关类型定义
 * 对接 anheyu-app 后端 /api/admin/users 和 /api/admin/user-groups 接口
 */

// ===================================
//          用户状态常量
// ===================================

/** 用户状态：1=正常, 2=未激活, 3=已封禁 */
export const USER_STATUS = {
  ACTIVE: 1,
  INACTIVE: 2,
  BANNED: 3,
} as const;

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  [USER_STATUS.ACTIVE]: "正常",
  [USER_STATUS.INACTIVE]: "未激活",
  [USER_STATUS.BANNED]: "已封禁",
};

export const USER_STATUS_COLOR: Record<UserStatus, string> = {
  [USER_STATUS.ACTIVE]: "success",
  [USER_STATUS.INACTIVE]: "default",
  [USER_STATUS.BANNED]: "danger",
};

// ===================================
//          用户组类型
// ===================================

export interface UserGroupDTO {
  id: string;
  name: string;
  description: string;
}

// ===================================
//     管理端用户响应 (AdminUser)
// ===================================

/**
 * 管理端用户 DTO
 * 对应后端 AdminUserDTO
 */
export interface AdminUser {
  id: string;
  created_at: string;
  updated_at: string;
  username: string;
  nickname: string;
  avatar: string;
  email: string;
  website: string;
  lastLoginAt: string | null;
  userGroupID: string;
  userGroup: UserGroupDTO;
  status: UserStatus;
}

// ===================================
//        查询参数类型
// ===================================

export interface AdminUserListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  groupID?: string;
  status?: UserStatus;
}

// ===================================
//          响应类型
// ===================================

export interface AdminUserListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  size: number;
}

// ===================================
//        请求类型
// ===================================

/** 创建用户请求 */
export interface AdminCreateUserRequest {
  username: string;
  password: string;
  email: string;
  nickname?: string;
  userGroupID: string;
}

/** 更新用户请求 */
export interface AdminUpdateUserRequest {
  username?: string;
  email?: string;
  nickname?: string;
  userGroupID?: string;
  status?: UserStatus;
}

/** 重置密码请求 */
export interface AdminResetPasswordRequest {
  newPassword: string;
}

/** 更新用户状态请求 */
export interface AdminUpdateUserStatusRequest {
  status: UserStatus;
}
