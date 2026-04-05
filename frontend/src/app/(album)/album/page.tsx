import type { Metadata } from "next";
import type { SiteConfigData } from "@/types/site-config";
import { AlbumPageClient } from "./_components/AlbumPageClient";
import { buildPageMetadata, fetchSiteConfigForSeo, resolveSeoSiteInfo } from "@/lib/seo";

function extractAlbumBanner(config: SiteConfigData | null, key: string): string {
  if (!config) return "";
  const record = config as Record<string, unknown>;
  const flatValue = record[`album.banner.${key}`];
  if (typeof flatValue === "string" && flatValue.trim()) return flatValue.trim();
  const album = record.album;
  if (album && typeof album === "object") {
    const banner = (album as Record<string, unknown>).banner;
    if (banner && typeof banner === "object") {
      const value = (banner as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return "";
}

export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = await fetchSiteConfigForSeo();
  const site = resolveSeoSiteInfo(siteConfig);

  const bannerTitle = extractAlbumBanner(siteConfig, "title");
  const bannerDesc = extractAlbumBanner(siteConfig, "description");

  return buildPageMetadata({
    title: bannerTitle || "相册",
    description: bannerDesc || `${site.siteName}相册页面，浏览公开图片与摄影记录。`,
    path: "/album",
    siteConfig,
  });
}

export default function AlbumPage() {
  return <AlbumPageClient />;
}
