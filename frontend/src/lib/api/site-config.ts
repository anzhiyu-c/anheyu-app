/**
 * 站点配置 API
 */
import { apiClient } from "./client";
import type { ApiResponse } from "@/types";
import type { SiteConfigData } from "@/types/site-config";

export const siteConfigApi = {
  /** 获取站点配置 */
  getSiteConfig(): Promise<ApiResponse<SiteConfigData>> {
    return apiClient.get<SiteConfigData>("/api/public/site-config");
  },

  /** 获取配置版本号（轻量接口，供缓存校验） */
  getConfigVersion(): Promise<ApiResponse<{ version: number }>> {
    return apiClient.get<{ version: number }>("/api/public/site-config/version");
  },
};

/** @deprecated 使用 siteConfigApi 代替 */
export const siteConfigService = siteConfigApi;
