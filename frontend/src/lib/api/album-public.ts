/**
 * 前台相册 API（对齐 anheyu-app /api/public/albums）
 */

import { apiClient } from "./client";
import { useSiteConfigStore } from "@/store/site-config-store";
import type { AlbumStatType, PublicAlbumCategory, PublicAlbumListData, PublicAlbumListParams } from "@/types/album";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * 动态解析相册公开 API 地址。
 * 优先使用站点配置 API_URL，回退到 Next 相对路径（由 rewrites 代理）。
 */
function resolvePublicAlbumApiPath(endpoint: string): string {
  const normalizedEndpoint = endpoint.replace(/^\/+/, "");
  const apiUrl = useSiteConfigStore.getState().siteConfig?.API_URL;

  if (typeof apiUrl === "string" && apiUrl.trim() !== "") {
    const normalizedApiUrl = trimTrailingSlash(apiUrl.trim());
    if (/\/api$/i.test(normalizedApiUrl)) {
      return `${normalizedApiUrl}/${normalizedEndpoint}`;
    }
    return `${normalizedApiUrl}/api/${normalizedEndpoint}`;
  }

  return `/api/${normalizedEndpoint}`;
}

export const albumPublicApi = {
  /**
   * 获取公开相册列表
   * GET /api/public/albums
   */
  async getPublicAlbums(params: PublicAlbumListParams = {}): Promise<PublicAlbumListData> {
    const { page = 1, pageSize = 24, sort = "display_order_asc", categoryId = null } = params;

    const queryParams = new URLSearchParams();
    queryParams.append("page", String(page));
    queryParams.append("pageSize", String(pageSize));
    queryParams.append("sort", sort);

    if (categoryId !== null && categoryId !== undefined) {
      queryParams.append("categoryId", String(categoryId));
    }

    const requestUrl = resolvePublicAlbumApiPath("public/albums");
    const response = await apiClient.get<PublicAlbumListData>(`${requestUrl}?${queryParams.toString()}`);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "获取公开相册列表失败");
  },

  /**
   * 获取公开相册分类
   * GET /api/public/album-categories
   */
  async getPublicAlbumCategories(): Promise<PublicAlbumCategory[]> {
    const requestUrl = resolvePublicAlbumApiPath("public/album-categories");
    const response = await apiClient.get<PublicAlbumCategory[]>(requestUrl);

    if (response.code === 200 && response.data) {
      return response.data;
    }

    throw new Error(response.message || "获取公开相册分类失败");
  },

  /**
   * 更新公开相册统计（浏览/下载）
   * PUT /api/public/stat/:id?type=view|download
   */
  async updatePublicAlbumStat(id: number | string, type: AlbumStatType): Promise<void> {
    const queryParams = new URLSearchParams();
    queryParams.append("type", type);

    const requestUrl = resolvePublicAlbumApiPath(`public/stat/${id}`);
    const response = await apiClient.put<null>(`${requestUrl}?${queryParams.toString()}`);

    if (response.code === 200) {
      return;
    }

    throw new Error(response.message || "更新相册统计失败");
  },
};

export { resolvePublicAlbumApiPath };
