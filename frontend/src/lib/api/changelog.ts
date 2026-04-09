/**
 * 更新日志 API（调用官网聚合 API）
 */
import type { Changelog, ChangelogListResponse, ChangelogQuery, ChangelogApiResponse } from "@/types/changelog";

const CHANGELOG_API_BASE = "https://anheyuofficialwebsiteapi.anheyu.com/api/v1";

export async function getChangelogList(
  query: ChangelogQuery = {}
): Promise<ChangelogApiResponse<ChangelogListResponse>> {
  const defaultQuery: ChangelogQuery = {
    page: 1,
    limit: 10,
    detail: true,
    prerelease: false,
    draft: false,
    ...query,
  };

  const params = new URLSearchParams();
  Object.entries(defaultQuery).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  });

  const url = `${CHANGELOG_API_BASE}/changelog?${params.toString()}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  try {
    return await response.json();
  } catch {
    throw new Error("获取更新日志失败：响应格式无效");
  }
}

export type { Changelog, ChangelogListResponse, ChangelogQuery, ChangelogApiResponse };
