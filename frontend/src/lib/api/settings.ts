/**
 * 系统设置管理 API
 * 用于管理员后台获取和更新系统配置
 */
import { apiClient } from "./client";
import type { ApiResponse } from "@/types";

/** 设置值映射表 */
export type SettingsMap = Record<string, string>;

export const settingsApi = {
  /**
   * 批量获取设置
   * @param keys - 需要获取的配置键名数组
   */
  getByKeys(keys: string[]): Promise<ApiResponse<SettingsMap>> {
    return apiClient.post<SettingsMap>("/api/settings/get-by-keys", { keys });
  },

  /**
   * 批量更新设置
   * @param settings - 需要更新的配置项（键值对）
   */
  update(settings: SettingsMap): Promise<ApiResponse<void>> {
    return apiClient.post<void>("/api/settings/update", settings);
  },
};
