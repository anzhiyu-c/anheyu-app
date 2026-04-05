/**
 * 版本检测工具
 * 从 /api/version 获取版本信息
 */

export interface VersionInfo {
  name?: string;
  version?: string;
  commit?: string;
  date?: string;
  go_version?: string;
}

const VERSION_CACHE_KEY = "anheyu_version";
const CACHE_DURATION = 60 * 60 * 1000; // 1小时

interface CachedVersion extends VersionInfo {
  timestamp: number;
}

function getCached(): CachedVersion | null {
  try {
    const raw = localStorage.getItem(VERSION_CACHE_KEY);
    if (!raw) return null;
    const cached: CachedVersion = JSON.parse(raw);
    if (cached.timestamp && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached;
    }
    return null;
  } catch {
    return null;
  }
}

function setCache(info: VersionInfo): void {
  try {
    localStorage.setItem(VERSION_CACHE_KEY, JSON.stringify({ ...info, timestamp: Date.now() }));
  } catch {
    /* ignore */
  }
}

export async function getVersionInfo(forceRefresh = false): Promise<VersionInfo> {
  if (!forceRefresh) {
    const cached = getCached();
    if (cached) return cached;
  }

  try {
    const res = await fetch("/api/version", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const result = await res.json();
      if (result.code === 200 && result.data) {
        const info: VersionInfo = {
          name: "anheyu-app",
          version: result.data.version?.replace(/^v/, "") || "未知版本",
          commit: result.data.commit,
          date: result.data.date,
          go_version: result.data.go_version,
        };
        setCache(info);
        return info;
      }
    }
  } catch {
    /* ignore */
  }

  return { name: "anheyu-app", version: "未知版本" };
}

export async function isProEdition(): Promise<boolean> {
  return false;
}
