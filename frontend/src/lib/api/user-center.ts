/**
 * 用户中心相关 API
 */
import { apiClient } from "./client";
import type { ApiResponse } from "@/types";
import type {
  UpdateUserProfileRequest,
  UpdatePasswordRequest,
  UploadAvatarResponseData,
  UserNotificationSettings,
} from "@/types/user-center";

export const userCenterApi = {
  /** 更新用户资料（昵称、网站） */
  updateProfile(data: UpdateUserProfileRequest): Promise<ApiResponse<null>> {
    return apiClient.put<null>("/api/user/profile", data);
  },

  /** 修改用户密码 */
  updatePassword(data: UpdatePasswordRequest): Promise<ApiResponse<null>> {
    return apiClient.post<null>("/api/user/update-password", data);
  },

  /** 上传用户头像 */
  uploadAvatar(file: File): Promise<ApiResponse<UploadAvatarResponseData>> {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post<UploadAvatarResponseData>("/api/user/avatar", formData);
  },

  /** 获取用户通知设置 */
  getNotificationSettings(): Promise<ApiResponse<UserNotificationSettings>> {
    return apiClient.get<UserNotificationSettings>("/api/user/notification-settings");
  },

  /** 更新用户通知设置 */
  updateNotificationSettings(data: UserNotificationSettings): Promise<ApiResponse<null>> {
    return apiClient.put<null>("/api/user/notification-settings", data);
  },
};
