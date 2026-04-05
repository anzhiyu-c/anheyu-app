import type { MetadataRoute } from "next";
import type { SiteConfigData } from "@/types/site-config";
import {
  fetchSiteConfigForSeo,
  getSeoBackendUrl,
  normalizePath,
  normalizeSiteUrl,
  resolveSeoSiteInfo,
} from "@/lib/seo";

interface PublicArticleItem {
  id: string | number;
  abbrlink?: string;
  created_at?: string;
  updated_at?: string;
}

interface PublicArticlesPage {
  list: PublicArticleItem[];
  total: number;
}

interface NamedResource {
  name?: string;
  count?: number | string;
  created_at?: string;
  updated_at?: string;
}

interface ArchiveResource {
  year?: number | string;
  month?: number | string;
  count?: number | string;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGINATION_PAGES = 200;
const DEFAULT_CHANGE_FREQUENCY: MetadataRoute.Sitemap[number]["changeFrequency"] = "weekly";
const DEFAULT_PRIORITY = 0.55;

const EXCLUDED_EXACT_PATHS = new Set(["/login", "/external-link-warning", "/callback"]);

export const SITEMAP_EXCLUDED_PREFIXES = ["/admin", "/api", "/callback"] as const;

const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/about", changeFrequency: "weekly", priority: 0.8 },
  { path: "/archives", changeFrequency: "weekly", priority: 0.8 },
  { path: "/categories", changeFrequency: "weekly", priority: 0.75 },
  { path: "/tags", changeFrequency: "weekly", priority: 0.75 },
  { path: "/link", changeFrequency: "weekly", priority: 0.75 },
  { path: "/fcircle", changeFrequency: "weekly", priority: 0.7 },
  { path: "/album", changeFrequency: "weekly", priority: 0.7 },
  { path: "/music", changeFrequency: "weekly", priority: 0.65 },
  { path: "/air-conditioner", changeFrequency: "monthly", priority: 0.5 },
  { path: "/article-statistics", changeFrequency: "daily", priority: 0.6 },
  { path: "/recentcomments", changeFrequency: "daily", priority: 0.7 },
  { path: "/update", changeFrequency: "weekly", priority: 0.65 },
  { path: "/equipment", changeFrequency: "monthly", priority: 0.6 },
];

function toPositiveInt(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function parseDate(date?: string): Date {
  if (!date) return new Date();
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function unwrapPayload(result: unknown): unknown {
  if (!result || typeof result !== "object") return result;
  return (result as { data?: unknown }).data ?? result;
}

function toList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { list?: unknown[] }).list)) {
    return (payload as { list: T[] }).list;
  }
  return [];
}

function toAbsoluteUrl(path: string, baseUrl: string): string {
  return new URL(path, `${baseUrl}/`).toString();
}

function getSitemapBaseUrl(configUrl?: string): string {
  return (
    configUrl || normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL) || "http://localhost:3000"
  );
}

function resolvePageSize(siteConfig?: SiteConfigData | null): number {
  return toPositiveInt(siteConfig?.post?.default?.page_size, DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE;
}

function shouldExcludeByPrefix(path: string): boolean {
  return SITEMAP_EXCLUDED_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
}

export function isSitemapPathIndexable(path: string): boolean {
  const normalizedPath = normalizePath(path);

  if (EXCLUDED_EXACT_PATHS.has(normalizedPath)) {
    return false;
  }

  if (shouldExcludeByPrefix(normalizedPath)) {
    return false;
  }

  return true;
}

export function normalizeSitemapCandidatePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("//")) {
    return null;
  }
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    lower.startsWith("#")
  ) {
    return null;
  }
  if (trimmed.includes("://")) return null;

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const withoutQuery = withLeadingSlash.split("?")[0]?.split("#")[0] || "/";
  const normalizedPath = normalizePath(withoutQuery);

  if (!isSitemapPathIndexable(normalizedPath)) {
    return null;
  }

  return normalizedPath;
}

export function buildPaginationPaths(basePath: string, totalCount: number, pageSize: number): string[] {
  const safePageSize = toPositiveInt(pageSize, DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE;
  const pageCount = Math.ceil(toPositiveInt(totalCount, 0) / safePageSize);
  if (pageCount <= 1) return [];

  const normalizedBase = normalizePath(basePath);
  const maxPage = Math.min(pageCount, MAX_PAGINATION_PAGES);
  const paths: string[] = [];

  for (let page = 2; page <= maxPage; page += 1) {
    if (normalizedBase === "/") {
      paths.push(`/page/${page}`);
      continue;
    }
    paths.push(`${normalizedBase}/page/${page}`);
  }

  return paths;
}

export function collectConfigInternalPaths(siteConfig?: SiteConfigData | null): string[] {
  if (!siteConfig) return [];
  const candidates: unknown[] = [];

  const collect = (value: unknown) => {
    candidates.push(value);
  };

  collect(siteConfig.ABOUT_LINK);
  collect(siteConfig.HOME_TOP?.banner?.link);

  siteConfig.HOME_TOP?.category?.forEach(item => {
    if (!item?.isExternal) {
      collect(item.path);
    }
  });

  siteConfig.header?.menu?.forEach(item => {
    if (!item?.isExternal) {
      collect(item.path);
    }
    item.items?.forEach(subItem => {
      if (!subItem?.isExternal) {
        collect(subItem.path);
      }
    });
  });

  siteConfig.header?.nav?.menu?.forEach(group => {
    group.items?.forEach(item => {
      collect(item.link);
    });
  });

  siteConfig.footer?.project?.list?.forEach(section => {
    section.links?.forEach(link => {
      if (!link?.external) {
        collect(link.link);
      }
    });
  });

  siteConfig.footer?.bar?.linkList?.forEach(link => {
    if (!link?.external) {
      collect(link.link);
    }
  });

  return Array.from(
    new Set(candidates.map(item => normalizeSitemapCandidatePath(item)).filter((item): item is string => Boolean(item)))
  );
}

async function fetchJson(endpoint: string, revalidate = 300): Promise<unknown | null> {
  try {
    const response = await fetch(`${getSeoBackendUrl()}${endpoint}`, {
      next: { revalidate },
    });
    if (!response.ok) {
      return null;
    }
    return response.json();
  } catch {
    return null;
  }
}

async function fetchPublicArticlesPage(page: number, pageSize: number): Promise<PublicArticlesPage | null> {
  const result = await fetchJson(`/api/public/articles?page=${page}&pageSize=${pageSize}`);
  if (!result) return null;

  const payload = unwrapPayload(result);
  const list = toList<PublicArticleItem>(payload);
  if (list.length === 0) return null;

  const total =
    payload && typeof payload === "object"
      ? toPositiveInt((payload as { total?: unknown }).total, list.length)
      : list.length;

  return { list, total };
}

async function fetchAllPublicArticles(pageSize: number): Promise<{ list: PublicArticleItem[]; total: number }> {
  const maxPages = 50;
  const all: PublicArticleItem[] = [];
  let total = 0;
  let page = 1;

  while (page <= maxPages) {
    const current = await fetchPublicArticlesPage(page, pageSize);
    if (!current) break;

    all.push(...current.list);
    total = current.total;

    if (all.length >= total) break;
    page += 1;
  }

  return { list: all, total: Math.max(total, all.length) };
}

async function fetchNamedResources(endpoint: string): Promise<NamedResource[]> {
  const result = await fetchJson(endpoint, 600);
  if (!result) return [];
  return toList<NamedResource>(unwrapPayload(result));
}

async function fetchArchives(): Promise<ArchiveResource[]> {
  const result = await fetchJson("/api/public/articles/archives", 600);
  if (!result) return [];
  return toList<ArchiveResource>(unwrapPayload(result));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteConfig = await fetchSiteConfigForSeo();
  const site = resolveSeoSiteInfo(siteConfig);
  const baseUrl = getSitemapBaseUrl(site.siteUrl);
  const pageSize = resolvePageSize(siteConfig);
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [];
  const existed = new Set<string>();

  const pushEntry = (
    path: string,
    lastModified: Date = now,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = DEFAULT_CHANGE_FREQUENCY,
    priority = DEFAULT_PRIORITY
  ) => {
    const normalizedPath = normalizeSitemapCandidatePath(path);
    if (!normalizedPath || existed.has(normalizedPath)) {
      return;
    }

    existed.add(normalizedPath);
    entries.push({
      url: toAbsoluteUrl(normalizedPath, baseUrl),
      lastModified,
      changeFrequency,
      priority,
    });
  };

  STATIC_ROUTES.forEach(route => {
    pushEntry(route.path, now, route.changeFrequency, route.priority);
  });

  collectConfigInternalPaths(siteConfig).forEach(path => {
    pushEntry(path, now, "weekly", 0.65);
  });

  const [articlesData, categories, tags, archives] = await Promise.all([
    fetchAllPublicArticles(pageSize),
    fetchNamedResources("/api/post-categories"),
    fetchNamedResources("/api/post-tags?sort=name"),
    fetchArchives(),
  ]);

  articlesData.list.forEach(article => {
    const slug = String(article.abbrlink || article.id || "").trim();
    if (!slug) return;
    pushEntry(`/posts/${encodeURIComponent(slug)}`, parseDate(article.updated_at || article.created_at), "weekly", 0.8);
  });

  categories.forEach(category => {
    const name = String(category.name || "").trim();
    if (!name) return;

    const basePath = `/categories/${encodeURIComponent(name)}`;
    pushEntry(basePath, parseDate(category.updated_at || category.created_at), "weekly", 0.65);
    buildPaginationPaths(basePath, toPositiveInt(category.count), pageSize).forEach(path => {
      pushEntry(path, parseDate(category.updated_at || category.created_at), "weekly", 0.55);
    });
  });

  tags.forEach(tag => {
    const name = String(tag.name || "").trim();
    if (!name) return;

    const basePath = `/tags/${encodeURIComponent(name)}`;
    pushEntry(basePath, parseDate(tag.updated_at || tag.created_at), "weekly", 0.6);
    buildPaginationPaths(basePath, toPositiveInt(tag.count), pageSize).forEach(path => {
      pushEntry(path, parseDate(tag.updated_at || tag.created_at), "weekly", 0.5);
    });
  });

  const yearCountMap = new Map<number, number>();
  let totalArchiveCount = 0;

  archives.forEach(item => {
    const year = toPositiveInt(item.year);
    const month = toPositiveInt(item.month);
    if (year < 1970 || month < 1 || month > 12) return;

    const count = toPositiveInt(item.count);
    if (count > 0) {
      totalArchiveCount += count;
      yearCountMap.set(year, (yearCountMap.get(year) || 0) + count);
    }

    const monthPath = `/archives/${year}/${month}`;
    pushEntry(monthPath, parseDate(item.updated_at || item.created_at), "weekly", 0.6);
    buildPaginationPaths(monthPath, count, pageSize).forEach(path => {
      pushEntry(path, parseDate(item.updated_at || item.created_at), "weekly", 0.5);
    });
  });

  Array.from(yearCountMap.entries())
    .sort((a, b) => b[0] - a[0])
    .forEach(([year, count]) => {
      const yearPath = `/archives/${year}`;
      pushEntry(yearPath, now, "weekly", 0.65);
      buildPaginationPaths(yearPath, count, pageSize).forEach(path => {
        pushEntry(path, now, "weekly", 0.55);
      });
    });

  buildPaginationPaths("/archives", totalArchiveCount || articlesData.total, pageSize).forEach(path => {
    pushEntry(path, now, "weekly", 0.6);
  });

  return entries;
}
