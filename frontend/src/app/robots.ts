import type { MetadataRoute } from "next";
import { fetchSiteConfigForSeo, normalizeSiteUrl, resolveSeoSiteInfo } from "@/lib/seo";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const siteConfig = await fetchSiteConfigForSeo();
  const site = resolveSeoSiteInfo(siteConfig);
  const siteUrl =
    site.siteUrl ||
    normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL) ||
    "http://localhost:3000";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/", "/login", "/callback/", "/external-link-warning"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
