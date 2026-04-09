/**
 * 文件管理 API（对齐 anheyu-app）
 */

import { apiClient, axiosInstance } from "./client";
import type {
  BaseResponse,
  CreateDirectLinksRequest,
  CreateDirectLinksResponse,
  CreateShareLinkRequest,
  CreateShareLinkResponse,
  CreateUploadSessionResponse,
  DownloadInfo,
  FileInfoResponse,
  FileListData,
  FilePreviewUrlsResponse,
  FolderViewConfig,
  FolderSizeResponse,
  FolderTreeResponse,
  GetThumbnailCredentialResponse,
  UpdateFileContentData,
  UpdateFolderViewResponse,
  ValidateUploadSessionResponse,
} from "@/types/file-manager";
import { buildFullUri } from "@/utils/file-manager";

const apiPath = (url: string) => {
  if (url.startsWith("/api/")) return url;
  return url.startsWith("/") ? `/api${url}` : `/api/${url}`;
};

export const fetchFilesByPathApi = async (
  path: string,
  next_token?: string | null
): Promise<BaseResponse<FileListData>> => {
  const params: Record<string, string> = { uri: buildFullUri(path) };
  if (next_token) params.next_token = next_token;
  return apiClient.get<FileListData>(apiPath("file"), { params });
};

export const createUploadSessionApi = (
  fullPath: string,
  size: number,
  policyId: string,
  overwrite = false
): Promise<BaseResponse<CreateUploadSessionResponse["data"]>> => {
  return apiClient.put<CreateUploadSessionResponse["data"]>(apiPath("file/upload"), {
    uri: buildFullUri(fullPath),
    size,
    policy_id: policyId,
    overwrite,
  });
};

export const uploadChunkApi = async (sessionId: string, index: number, chunk: Blob): Promise<BaseResponse<unknown>> => {
  const response = await axiosInstance.post<BaseResponse<unknown>>(
    apiPath(`file/upload/${sessionId}/${index}`),
    chunk,
    { headers: { "Content-Type": "application/octet-stream" } }
  );
  return response.data;
};

export const deleteUploadSessionApi = async (sessionId: string, fullPath: string): Promise<BaseResponse<unknown>> => {
  const response = await axiosInstance.delete<BaseResponse<unknown>>(apiPath("file/upload"), {
    data: { id: sessionId, uri: buildFullUri(fullPath) },
  });
  return response.data;
};

export const finalizeClientUploadApi = (
  fullPath: string,
  policyId: string,
  size: number
): Promise<BaseResponse<{ file_id: string; name: string; size: number }>> => {
  return apiClient.post<{ file_id: string; name: string; size: number }>(apiPath("file/upload/finalize"), {
    uri: buildFullUri(fullPath),
    policy_id: policyId,
    size,
  });
};

export const createItemApi = (
  type: number,
  logicalPath: string,
  errOnConflict = false
): Promise<BaseResponse<unknown>> => {
  return apiClient.post<unknown>(apiPath("file/create"), {
    type,
    uri: buildFullUri(logicalPath),
    err_on_conflict: errOnConflict,
  });
};

export const updateFolderViewApi = (
  folder_id: string,
  viewConfig: FolderViewConfig
): Promise<BaseResponse<UpdateFolderViewResponse["data"]>> => {
  return apiClient.put<UpdateFolderViewResponse["data"]>(apiPath("folder/view"), {
    folder_id,
    view: viewConfig,
  });
};

export const validateUploadSessionApi = (
  sessionId: string
): Promise<BaseResponse<ValidateUploadSessionResponse["data"]>> => {
  return apiClient.get<ValidateUploadSessionResponse["data"]>(apiPath(`file/upload/session/${sessionId}`));
};

export const deleteFilesApi = (ids: string[]): Promise<BaseResponse<unknown>> => {
  return apiClient.delete<unknown>(apiPath("file"), { data: { ids } });
};

export const renameFileApi = (id: string, newName: string): Promise<BaseResponse<unknown>> => {
  return apiClient.put<unknown>(apiPath("file/rename"), { id, new_name: newName });
};

export const getFileDetailsApi = (id: string): Promise<BaseResponse<FileInfoResponse>> => {
  return apiClient.get<FileInfoResponse>(apiPath(`file/${id}`));
};

export const getDownloadInfoApi = (id: string): Promise<BaseResponse<DownloadInfo>> => {
  return apiClient.get<DownloadInfo>(apiPath(`file/download-info/${id}`));
};

export const fetchBlobFromUrl = async (url: string): Promise<Blob> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`文件下载失败，状态: ${response.status} ${response.statusText}`);
  }
  return response.blob();
};

const triggerBrowserDownload = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const downloadFileApi = async (id: string, fallbackName: string) => {
  const response = await getDownloadInfoApi(id);
  if (response.code !== 200 || !response.data) {
    throw new Error(response.message || "获取下载信息失败");
  }

  const info = response.data;
  if (info.type === "cloud" && info.url) {
    const blob = await fetchBlobFromUrl(info.url);
    triggerBrowserDownload(blob, info.file_name);
    return;
  }

  const blobResponse = await axiosInstance.get<Blob>(apiPath(`file/download/${id}`), {
    responseType: "blob",
  });
  triggerBrowserDownload(blobResponse.data, info.file_name || fallbackName);
};

export const getFolderTreeApi = (id: string): Promise<BaseResponse<FolderTreeResponse["data"]>> => {
  return apiClient.get<FolderTreeResponse["data"]>(apiPath(`folder/tree/${id}`));
};

export const calculateFolderSize = (folderId: string): Promise<BaseResponse<FolderSizeResponse["data"]>> => {
  return apiClient.get<FolderSizeResponse["data"]>(apiPath(`folder/size/${folderId}`));
};

export const moveFilesApi = (sourceIDs: string[], destinationID: string): Promise<BaseResponse<null>> => {
  return apiClient.post<null>(apiPath("folder/move"), { sourceIDs, destinationID });
};

export const copyFilesApi = (sourceIDs: string[], destinationID: string): Promise<BaseResponse<null>> => {
  return apiClient.post<null>(apiPath("folder/copy"), { sourceIDs, destinationID });
};

export const createDirectLinksApi = (fileIds: string[]): Promise<CreateDirectLinksResponse> => {
  const requestData: CreateDirectLinksRequest = { file_ids: fileIds };
  return apiClient.post<CreateDirectLinksResponse["data"]>(apiPath("pro/direct-links"), requestData);
};

export const getFilePreviewUrlsApi = (publicId: string): Promise<FilePreviewUrlsResponse> => {
  return apiClient.get<FilePreviewUrlsResponse["data"]>(apiPath("file/preview-urls"), {
    params: { id: publicId },
  });
};

export const getThumbnailCredentialApi = (publicId: string): Promise<GetThumbnailCredentialResponse> => {
  return apiClient.get<GetThumbnailCredentialResponse["data"]>(apiPath(`thumbnail/${publicId}`));
};

export const regenerateThumbnailApi = (publicId: string): Promise<BaseResponse<{ status: string }>> => {
  return apiClient.post<{ status: string }>(apiPath("thumbnail/regenerate"), { id: publicId });
};

export const updateFileContentByPublicIdApi = (
  publicId: string,
  uri: string,
  content: string | Blob
): Promise<BaseResponse<UpdateFileContentData>> => {
  return apiClient.put<UpdateFileContentData>(apiPath(`file/content/${publicId}`), content, {
    params: { uri },
    headers: { "Content-Type": "application/octet-stream" },
  });
};

export const regenerateDirectoryThumbnailsApi = (
  directoryId: string
): Promise<BaseResponse<{ filesToProcess: number }>> => {
  return apiClient.post<{ filesToProcess: number }>(apiPath("thumbnail/regenerate/directory"), {
    directoryId,
  });
};

export const createShareLinkApi = (params: CreateShareLinkRequest): Promise<CreateShareLinkResponse> => {
  return apiClient.post<CreateShareLinkResponse["data"]>(apiPath("files/share/create"), params);
};
