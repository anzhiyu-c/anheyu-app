import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/providers";
import {
  buildWebSiteJsonLd,
  createRobotsMetadata,
  fetchSiteConfigForSeo,
  resolveMetadataBase,
  resolveSeoSiteInfo,
} from "@/lib/seo";

/**
 * 动态生成 Metadata
 * 从后端 API 获取站点配置，实现 SEO 动态化
 */
export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = await fetchSiteConfigForSeo();
  const site = resolveSeoSiteInfo(siteConfig);
  const fullTitle = site.description ? `${site.siteName} - ${site.description}` : site.siteName;

  return createMetadata({
    title: fullTitle,
    description: site.description,
    siteName: site.siteName,
    iconUrl: site.iconUrl,
    logoUrl: site.logoUrl,
    siteUrl: site.siteUrl,
  });
}

/**
 * 创建 Metadata 对象
 */
function createMetadata(config: {
  title: string;
  description: string;
  siteName: string;
  iconUrl?: string;
  logoUrl?: string;
  siteUrl?: string;
}): Metadata {
  const iconUrl = config.iconUrl || "/favicon.ico";
  const logoUrl = config.logoUrl || "/static/img/logo-192x192.png";

  const isSvg = iconUrl.endsWith(".svg");
  const isIco = iconUrl.endsWith(".ico");
  const iconType = isSvg ? "image/svg+xml" : isIco ? "image/x-icon" : "image/png";
  const metadataBase = resolveMetadataBase(config.siteUrl);

  return {
    metadataBase,
    title: {
      template: `%s | ${config.siteName}`,
      default: config.title,
    },
    description: config.description,
    keywords: ["博客", "Next.js", "HeroUI", "React", "TypeScript"],
    alternates: {
      canonical: "/",
    },
    robots: createRobotsMetadata(true),
    icons: {
      icon: [{ url: iconUrl, type: iconType }],
      shortcut: [{ url: iconUrl, type: iconType }],
      apple: logoUrl,
    },
    manifest: "/manifest.json",
    openGraph: {
      type: "website",
      locale: "zh_CN",
      siteName: config.siteName,
      title: config.title,
      description: config.description,
      url: "/",
      images: logoUrl ? [logoUrl] : undefined,
    },
    twitter: {
      card: logoUrl ? "summary_large_image" : "summary",
      title: config.title,
      description: config.description,
      images: logoUrl ? [logoUrl] : undefined,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteConfig = await fetchSiteConfigForSeo();
  const site = resolveSeoSiteInfo(siteConfig);
  const webSiteJsonLd =
    site.siteUrl && site.siteName
      ? buildWebSiteJsonLd(site.siteName, site.siteUrl, site.description)
      : null;

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {webSiteJsonLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }}
          />
        )}
      </head>
      <body className="antialiased min-h-screen flex flex-col">
        {/* 初始加载动画 - 纯 CSS + SVG，JS 加载前就显示，样式在 globals.css */}
        <div id="initial-loader" aria-label="加载中" role="status">
          <svg className="loader-spinner" viewBox="0 0 50 50" aria-hidden="true">
            <circle className="loader-bg" cx="25" cy="25" r="20" fill="none" strokeWidth="5" />
            <circle className="loader-inner" cx="25" cy="25" r="20" fill="none" strokeWidth="5" />
          </svg>
          <span className="sr-only">页面加载中</span>
        </div>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
