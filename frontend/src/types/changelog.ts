/**
 * 更新日志相关类型（与 assets-old api/update 保持一致）
 */

export interface ChangelogAsset {
  id: number;
  name: string;
  contentType: string;
  size: number;
  downloadCount: number;
  browserDownloadUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChangelogItem {
  type: string;
  scope?: string;
  message: string;
  description: string;
  commitHash?: string;
  breaking: boolean;
}

export interface ChangelogSection {
  title: string;
  icon: string;
  type: string;
  order: number;
  items: ChangelogItem[];
  count: number;
}

export interface BuildInfo {
  version?: string;
  commit?: string;
  commitUrl?: string;
  buildTime?: string;
  goVersion?: string;
}

export interface ChangelogSummary {
  totalChanges: number;
  byType: Record<string, number>;
}

export interface ParsedChangelog {
  sections: ChangelogSection[];
  buildInfo: BuildInfo;
  summary: ChangelogSummary;
  rawContent: string;
  hasBreaking: boolean;
}

export interface Changelog {
  id: number;
  githubReleaseId: number;
  tagName: string;
  name: string;
  body: string;
  targetCommitish: string;
  draft: boolean;
  prerelease: boolean;
  publishedAt: string;
  htmlUrl: string;
  tarballUrl: string;
  zipballUrl: string;
  assets: ChangelogAsset[];
  authorLogin: string;
  authorAvatarUrl: string;
  downloadCount: number;
  isLatest: boolean;
  syncStatus: string;
  parsedContent?: ParsedChangelog;
  createdAt: string;
  updatedAt: string;
}

export interface ChangelogListResponse {
  list: Changelog[];
  total: number;
}

export interface ChangelogQuery {
  page?: number;
  limit?: number;
  search?: string;
  draft?: boolean;
  prerelease?: boolean;
  latest?: boolean;
  detail?: boolean;
}

export interface ChangelogApiResponse<T> {
  code: number;
  message: string;
  data: T;
}
