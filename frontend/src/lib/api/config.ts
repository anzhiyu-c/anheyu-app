/**
 * 配置导入导出 & 备份管理 API
 * 用于管理员后台导出/导入系统配置和管理配置备份
 */
import { apiClient } from "./client";
import { axiosInstance } from "./client";
import type { ApiResponse } from "@/types";

// ========== 备份信息类型 ==========

/** 备份信息 */
export interface BackupInfo {
  filename: string;
  size: number;
  created_at: string;
  description: string;
  is_auto: boolean;
}

// ========== 导入导出 API ==========

export const configApi = {
  /**
   * 导出配置
   * 从后端下载 JSON 格式的配置文件
   */
  async exportConfig(): Promise<Blob> {
    const response = await axiosInstance.get("/api/config/export", {
      responseType: "blob",
    });
    return response.data;
  },

  /**
   * 导入配置
   * 上传 JSON 配置文件到后端
   * @param file - 配置文件（.json 格式）
   */
  async importConfig(file: File): Promise<{ code: number; message: string }> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await axiosInstance.post("/api/config/import", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  // ========== 备份管理 API ==========

  /**
   * 获取备份列表
   */
  async listBackups(): Promise<ApiResponse<BackupInfo[]>> {
    return apiClient.get<BackupInfo[]>("/api/config/backup/list");
  },

  /**
   * 创建备份
   * @param description - 备份描述（可选）
   * @param isAuto - 是否自动备份（可选，用于在列表中显示「自动」标签，如导入前/恢复前自动备份）
   */
  async createBackup(description: string, isAuto?: boolean): Promise<ApiResponse<BackupInfo>> {
    const body: { description: string; is_auto?: boolean } = { description };
    if (isAuto === true) body.is_auto = true;
    return apiClient.post<BackupInfo>("/api/config/backup/create", body);
  },

  /**
   * 恢复备份
   * @param filename - 备份文件名
   */
  async restoreBackup(filename: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>("/api/config/backup/restore", { filename });
  },

  /**
   * 删除备份
   * @param filename - 备份文件名
   */
  async deleteBackup(filename: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>("/api/config/backup/delete", { filename });
  },

  /**
   * 清理旧备份
   * @param keepCount - 保留的备份数量
   */
  async cleanOldBackups(keepCount: number): Promise<ApiResponse<void>> {
    return apiClient.post<void>("/api/config/backup/clean", { keep_count: keepCount });
  },
};
