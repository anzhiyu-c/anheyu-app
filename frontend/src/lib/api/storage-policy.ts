/**
 * 存储策略 API
 * 对接 anheyu-app 后端 /api/policies 端点
 */

import { apiClient } from "./client";
import type {
  StoragePolicy,
  StoragePolicyListResponse,
  StoragePolicyCreateRequest,
  StoragePolicyUpdateRequest,
  OneDriveAuthUrlResponse,
  OneDriveAuthCompleteRequest,
} from "@/types/storage-policy";

const PRO_POLICIES_BASE = "/api/policies";

export const storagePolicyApi = {
  /** 获取所有存储策略（PRO版 ListAll，后端返回全量，前端分页） */
  listAll: async (): Promise<StoragePolicyListResponse> => {
    const res = await apiClient.get<StoragePolicyListResponse>(PRO_POLICIES_BASE);
    return res.data;
  },

  /** 获取单个存储策略 */
  getById: async (id: string): Promise<StoragePolicy> => {
    const res = await apiClient.get<StoragePolicy>(`${PRO_POLICIES_BASE}/${id}`);
    return res.data;
  },

  /** 创建存储策略 */
  create: async (data: Partial<StoragePolicyCreateRequest>): Promise<void> => {
    await apiClient.post<null>(PRO_POLICIES_BASE, data);
  },

  /** 更新存储策略 */
  update: async (id: string, data: StoragePolicyUpdateRequest): Promise<void> => {
    await apiClient.put<null>(`${PRO_POLICIES_BASE}/${id}`, data);
  },

  /** 删除存储策略 */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete<null>(`${PRO_POLICIES_BASE}/${id}`);
  },

  /** 获取 OneDrive 授权链接 */
  getOneDriveAuthUrl: async (id: string): Promise<OneDriveAuthUrlResponse> => {
    const res = await apiClient.get<OneDriveAuthUrlResponse>(`/api/policies/connect/onedrive/${id}`);
    return res.data;
  },

  /** 完成 OneDrive 授权流程 */
  completeOneDriveAuth: async (data: OneDriveAuthCompleteRequest): Promise<void> => {
    await apiClient.post<null>("/api/policies/authorize/onedrive", data);
  },
};
