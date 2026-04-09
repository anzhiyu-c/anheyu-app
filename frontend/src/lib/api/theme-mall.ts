import { apiClient } from "./client";
import type {
  Theme,
  ThemeListParams,
  ThemeListData,
  SSRThemeInfo,
  SSRThemeInstallRequest,
  SSRThemeStartRequest,
  ThemeUploadResponse,
  ThemeValidationResult,
  ThemeSettingGroup,
  ThemeConfigResponse,
  ThemeConfigSaveRequest,
} from "@/types/theme-mall";

/**
 * 主题商城 API（对齐 anheyu-app assets/src/api/theme-mall/index.ts）
 *
 * 路由前缀说明：
 * - /api/public/theme/* — 公开接口
 * - /api/theme/*        — 需要登录
 * - /api/admin/ssr-theme/* — 需要管理员权限
 */
export const themeMallApi = {
  // ===== 核心接口 =====

  /** 检查静态模式状态（公开） */
  checkStaticMode: async (): Promise<{ is_active: boolean }> => {
    const res = await apiClient.get<{ is_active: boolean }>("/api/public/theme/static-mode");
    return res.data;
  },

  /** 获取商城主题列表（公开） */
  getMarketThemes: async (params?: ThemeListParams): Promise<ThemeListData> => {
    const res = await apiClient.get<ThemeListData>("/api/public/theme/market", { params });
    return res.data;
  },

  /** 获取当前主题（需登录） */
  getCurrentTheme: async (): Promise<Theme> => {
    const res = await apiClient.get<Theme>("/api/theme/current");
    return res.data;
  },

  /** 获取已安装主题列表（需登录） */
  getInstalledThemes: async (): Promise<Theme[]> => {
    const res = await apiClient.get<Theme[]>("/api/theme/installed");
    return res.data;
  },

  /** 安装主题（需登录） */
  installTheme: async (data: { theme_name: string; download_url: string; theme_market_id?: number }): Promise<void> => {
    await apiClient.post("/api/theme/install", data);
  },

  /** 切换主题（需登录） */
  switchTheme: async (data: { theme_name: string }): Promise<void> => {
    await apiClient.post("/api/theme/switch", data);
  },

  /** 切换到官方主题（需登录） */
  switchToOfficial: async (): Promise<void> => {
    await apiClient.post("/api/theme/official");
  },

  /** 卸载主题（需登录） */
  uninstallTheme: async (data: { theme_name: string }): Promise<void> => {
    await apiClient.post("/api/theme/uninstall", data);
  },

  /** 上传主题 ZIP（需登录） */
  uploadTheme: async (file: File, forceUpdate = false): Promise<ThemeUploadResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    if (forceUpdate) {
      formData.append("force_update", "true");
    }
    const res = await apiClient.post<ThemeUploadResponse>("/api/theme/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  /** 验证主题 ZIP（需登录） */
  validateTheme: async (file: File): Promise<ThemeValidationResult> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await apiClient.post<ThemeValidationResult>("/api/theme/validate", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  // ===== 主题配置接口 =====

  /** 获取主题配置定义（需登录） */
  getThemeSettings: async (themeName: string): Promise<ThemeSettingGroup[]> => {
    const res = await apiClient.get<ThemeSettingGroup[]>("/api/theme/settings", { params: { theme_name: themeName } });
    return res.data;
  },

  /** 获取用户主题配置（需登录） */
  getUserThemeConfig: async (themeName: string): Promise<Record<string, unknown>> => {
    const res = await apiClient.get<Record<string, unknown>>("/api/theme/config", {
      params: { theme_name: themeName },
    });
    return res.data;
  },

  /** 保存用户主题配置（需登录） */
  saveUserThemeConfig: async (data: ThemeConfigSaveRequest): Promise<void> => {
    await apiClient.post("/api/theme/config", data);
  },

  /** 获取当前主题完整配置（定义+值，需登录） */
  getCurrentThemeConfig: async (): Promise<ThemeConfigResponse> => {
    const res = await apiClient.get<ThemeConfigResponse>("/api/theme/current-config");
    return res.data;
  },

  // ===== SSR 主题管理接口 =====

  /** 安装 SSR 主题（管理员） */
  installSSRTheme: async (data: SSRThemeInstallRequest): Promise<void> => {
    await apiClient.post("/api/admin/ssr-theme/install", data);
  },

  /** 列出已安装 SSR 主题（管理员） */
  getInstalledSSRThemes: async (): Promise<SSRThemeInfo[]> => {
    const res = await apiClient.get<SSRThemeInfo[]>("/api/admin/ssr-theme/list");
    return res.data;
  },

  /** 卸载 SSR 主题（管理员） */
  uninstallSSRTheme: async (name: string): Promise<void> => {
    await apiClient.delete(`/api/admin/ssr-theme/${name}`);
  },

  /** 启动 SSR 主题（管理员） */
  startSSRTheme: async (name: string, data?: SSRThemeStartRequest): Promise<{ port: number }> => {
    const res = await apiClient.post<{ port: number }>(`/api/admin/ssr-theme/${name}/start`, data ?? {});
    return res.data;
  },

  /** 停止 SSR 主题（管理员） */
  stopSSRTheme: async (name: string): Promise<void> => {
    await apiClient.post(`/api/admin/ssr-theme/${name}/stop`);
  },

  /** 获取 SSR 主题状态（管理员） */
  getSSRThemeStatus: async (name: string): Promise<SSRThemeInfo> => {
    const res = await apiClient.get<SSRThemeInfo>(`/api/admin/ssr-theme/${name}/status`);
    return res.data;
  },
};
