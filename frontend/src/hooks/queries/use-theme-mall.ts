import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { themeMallApi } from "@/lib/api/theme-mall";
import type { ThemeListParams, SSRThemeInstallRequest } from "@/types/theme-mall";

// ===== Query Keys =====

export const themeKeys = {
  all: ["themes"] as const,
  market: (params?: ThemeListParams) => [...themeKeys.all, "market", params] as const,
  installed: () => [...themeKeys.all, "installed"] as const,
  current: () => [...themeKeys.all, "current"] as const,
  ssrList: () => [...themeKeys.all, "ssr-list"] as const,
};

// ===== Queries =====

/** 获取商城主题列表 */
export function useMarketThemes(params?: ThemeListParams) {
  return useQuery({
    queryKey: themeKeys.market(params),
    queryFn: () => themeMallApi.getMarketThemes(params),
  });
}

/** 获取已安装主题列表 */
export function useInstalledThemes() {
  return useQuery({
    queryKey: themeKeys.installed(),
    queryFn: () => themeMallApi.getInstalledThemes(),
  });
}

/** 获取当前主题 */
export function useCurrentTheme() {
  return useQuery({
    queryKey: themeKeys.current(),
    queryFn: () => themeMallApi.getCurrentTheme(),
  });
}

/** 获取已安装 SSR 主题列表 */
export function useInstalledSSRThemes() {
  return useQuery({
    queryKey: themeKeys.ssrList(),
    queryFn: () => themeMallApi.getInstalledSSRThemes(),
  });
}

// ===== Mutations =====

/** 安装主题 */
export function useInstallTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { theme_name: string; download_url: string; theme_market_id?: number }) =>
      themeMallApi.installTheme(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: themeKeys.installed() });
      qc.invalidateQueries({ queryKey: themeKeys.current() });
    },
  });
}

/** 切换主题 */
export function useSwitchTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { theme_name: string }) => themeMallApi.switchTheme(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: themeKeys.all });
    },
  });
}

/** 切换到官方主题 */
export function useSwitchToOfficial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => themeMallApi.switchToOfficial(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: themeKeys.all });
    },
  });
}

/** 卸载主题 */
export function useUninstallTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { theme_name: string }) => themeMallApi.uninstallTheme(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: themeKeys.installed() });
      qc.invalidateQueries({ queryKey: themeKeys.current() });
    },
  });
}

/** 上传主题 */
export function useUploadTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, forceUpdate }: { file: File; forceUpdate?: boolean }) =>
      themeMallApi.uploadTheme(file, forceUpdate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: themeKeys.installed() });
    },
  });
}

// ===== SSR Theme Mutations =====

/** 安装 SSR 主题 */
export function useInstallSSRTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SSRThemeInstallRequest) => themeMallApi.installSSRTheme(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: themeKeys.ssrList() });
      qc.invalidateQueries({ queryKey: themeKeys.installed() });
    },
  });
}

/** 卸载 SSR 主题 */
export function useUninstallSSRTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => themeMallApi.uninstallSSRTheme(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: themeKeys.ssrList() });
      qc.invalidateQueries({ queryKey: themeKeys.installed() });
      qc.invalidateQueries({ queryKey: themeKeys.current() });
    },
  });
}

/** 启动 SSR 主题 */
export function useStartSSRTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => themeMallApi.startSSRTheme(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: themeKeys.all });
    },
  });
}

/** 停止 SSR 主题 */
export function useStopSSRTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => themeMallApi.stopSSRTheme(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: themeKeys.ssrList() });
    },
  });
}
