/**
 * 文件管理相关类型定义（对齐 anheyu-app）
 */

export interface ColumnConfig {
  type: number;
  width?: number;
}

export interface FolderViewConfig {
  view: "list" | "grid";
  order: string;
  order_direction: "asc" | "desc";
  page_size: number;
  columns?: ColumnConfig[];
}

export interface BaseResponse<T> {
  code: number;
  message: string;
  data: T;
}

/**
 * 0/1 在后端存在歧义，这里沿用 anheyu-app 的枚举约定
 * File = 1, Dir = 2
 */
export enum FileType {
  File = 1,
  Dir = 2,
}

export interface FileItem {
  id: string;
  name: string;
  type: number;
  size: number;
  created_at: string;
  updated_at: string;
  etag?: string;
  path: string;
  owned: boolean;
  shared: boolean;
  permission: Record<string, unknown> | null;
  capability: string;
  primary_entity_public_id: string;
  ext?: string;
  metadata?: Record<string, unknown>;
  url?: string;
  relative_path?: string;
}

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  status: "pending" | "uploading" | "success" | "error" | "conflict" | "canceled" | "resumable" | "processing";
  overwrite?: boolean;
  progress: number;
  file: File;
  relativePath: string;
  targetPath: string;
  abortController?: AbortController;
  needsRefresh?: boolean;

  sessionId?: string;
  totalChunks?: number;
  chunkSize?: number;
  uploadedChunks?: Set<number>;
  errorMessage?: string;
  retries?: number;

  instantSpeed: number;
  averageSpeed: number;
  uploadedSize: number;
  isResuming?: boolean;

  startTime?: number;
  lastSize?: number;
  lastTime?: number;

  uploadMethod?: "client" | "server";
  contentType?: string;
  uploadUrl?: string;
  storageType?: "local" | "onedrive" | "tencent_cos" | "aliyun_oss" | "aws_s3" | "qiniu_kodo";
  policyId?: string;
}

export interface Pagination {
  page: number;
  page_size: number;
  is_cursor: boolean;
  next_token?: string;
}

export interface ParentInfo {
  id: string;
  name: string;
  type: number;
  size: number;
  created_at: string;
  updated_at: string;
  path: string;
  owned: boolean;
  shared: boolean;
  permission: Record<string, unknown> | null;
  capability: string;
  primary_entity_public_id: string;
}

export interface FileProps {
  order_by_options: string[];
  order_direction_options: string[];
}

export interface StoragePolicy {
  id: string;
  name: string;
  type: string;
  max_size: number;
}

export interface FileListData {
  files: FileItem[];
  parent: ParentInfo | null;
  pagination: Pagination;
  props: FileProps;
  context_hint?: string;
  storage_policy?: StoragePolicy;
  view?: FolderViewConfig;
}

export interface FileListResponse {
  code: number;
  message: string;
  data: FileListData;
}

export interface UploadSessionData {
  session_id: string;
  chunk_size: number;
  expires?: number;
  storage_policy?: StoragePolicy | Record<string, unknown>;
  upload_method?: "client" | "server";
  upload_url?: string;
  content_type?: string;
}

export interface CreateUploadSessionResponse {
  code: number;
  message: string;
  data: UploadSessionData;
}

export interface UpdateFolderViewResponse {
  code: number;
  data: { view: FolderViewConfig } | null;
  message: string;
}

export interface UploadSessionStatus {
  session_id: string;
  is_valid: true;
  chunk_size: number;
  total_chunks: number;
  uploaded_chunks: number[];
  expires_at: string;
}

export interface InvalidUploadSessionStatus {
  is_valid: false;
}

export interface ValidateUploadSessionResponse {
  code: number;
  data: UploadSessionStatus | InvalidUploadSessionStatus;
  message: string;
}

export interface FolderTreeFile {
  url: string;
  relative_path: string;
  size: number;
}

export interface FolderTreeData {
  files: FolderTreeFile[];
  expires: string;
}

export interface FolderTreeResponse {
  code: number;
  message: string;
  data: FolderTreeData;
}

export interface FolderSizeData {
  logicalSize: number;
  storageConsumption: number;
  fileCount: number;
}

export interface FolderSizeResponse {
  code: number;
  message: string;
  data: FolderSizeData;
}

export interface CreateDirectLinksRequest {
  file_ids: string[];
}

export interface DirectLinkItem {
  link: string;
  file_url: string;
}

export type CreateDirectLinksData = DirectLinkItem[];
export type CreateDirectLinksResponse = BaseResponse<CreateDirectLinksData | null>;

export interface ThumbnailCredential {
  sign: string;
  expires: string;
  status?: "processing";
}

export type GetThumbnailCredentialResponse = BaseResponse<ThumbnailCredential>;

export interface PreviewURLItem {
  url: string;
  file_id: string;
  file_name: string;
  file_size: number;
}

export interface FilePreviewUrlsData {
  urls: PreviewURLItem[];
  initialIndex: number;
}

export type FilePreviewUrlsResponse = BaseResponse<FilePreviewUrlsData>;

export interface UpdateFileContentData {
  id: string;
  size: number;
  updated: string;
}

export interface FileInfoResponse {
  file: FileItem;
  storagePolicy: StoragePolicy | null;
}

export interface CreateShareLinkRequest {
  file_ids: string[];
  expiration_days?: number;
  payment_amount?: number;
  password?: string;
  show_readme?: boolean;
  download_limit?: number;
  allowed_user_groups?: number[];
}

export interface ShareLinkData {
  share_id: string;
  link: string;
  password?: string;
  expiration_time?: string;
  download_limit?: number;
  created_at: string;
}

export type CreateShareLinkResponse = BaseResponse<ShareLinkData>;

export interface DownloadInfo {
  type: "local" | "cloud";
  url?: string;
  storage_type: string;
  file_name: string;
  file_size: number;
}
