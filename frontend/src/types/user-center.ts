/** 更新用户资料请求 */
export interface UpdateUserProfileRequest {
  nickname?: string;
  website?: string;
}

/** 修改密码请求 */
export interface UpdatePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

/** 头像上传响应 */
export interface UploadAvatarResponseData {
  url: string;
}

/** 用户通知设置 */
export interface UserNotificationSettings {
  allowCommentReplyNotification: boolean;
}
