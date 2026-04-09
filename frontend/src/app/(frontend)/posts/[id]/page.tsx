/**
 * 文章详情页面
 * 对接 anheyu-app 后端 API
 */
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { PostDetailContent } from "@/components/post";
import { buildArticleJsonLd, buildPageMetadata, fetchSiteConfigForSeo, resolveSeoSiteInfo } from "@/lib/seo";

/**
 * 文章详情页面的 viewport 配置
 * 设置 themeColor 与页面背景色一致，防止浏览器自动采样导致状态栏颜色闪烁
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9fe" }, // 亮色模式背景
    { media: "(prefers-color-scheme: dark)", color: "#18171d" }, // 暗色模式背景
  ],
};

// API 基础配置 - 服务端直接调用后端
const API_BASE_URL = process.env.BACKEND_URL || "http://localhost:8091";

/**
 * 获取文章详情
 * API: GET /api/public/articles/{id}
 * @param id 文章 ID 或 abbrlink
 */
async function getArticle(id: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/public/articles/${id}`, {
      next: { revalidate: 60 },
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        return null;
      }
      console.error(`Failed to fetch article: ${res.status}`);
      return null;
    }

    const data = await res.json();
    // anheyu-app API 返回格式: { code: 200, data: {...}, msg: "success" }
    if (data.code === 200 && data.data) {
      return data.data;
    }
    return null;
  } catch (error) {
    console.error("Error fetching article:", error);
    return null;
  }
}

/**
 * 获取最近文章列表
 * API: GET /api/public/articles
 */
async function getRecentArticles() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/public/articles?page=1&pageSize=20`, {
      next: { revalidate: 60 },
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    if (data.code === 200 && data.data?.list) {
      return data.data.list.map(
        (article: { id: number; title: string; abbrlink?: string; cover_url?: string; created_at: string }) => ({
          id: article.id,
          title: article.title,
          abbrlink: article.abbrlink,
          cover_url: article.cover_url,
          created_at: article.created_at,
        })
      );
    }
    return [];
  } catch (error) {
    console.error("Error fetching recent articles:", error);
    return [];
  }
}

// 动态生成 Metadata
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticle(id);

  if (!article) {
    return buildPageMetadata({
      title: "文章未找到",
      description: "该文章不存在或已被删除。",
      path: `/posts/${encodeURIComponent(id)}`,
      noindex: true,
    });
  }

  const articlePath = `/posts/${encodeURIComponent(String(article.abbrlink || id))}`;
  return buildPageMetadata({
    title: article.title,
    absoluteTitle: true,
    description: article.summaries?.[0] || article.title,
    keywords: article.keywords || article.post_tags?.map((tag: { name: string }) => tag.name),
    path: articlePath,
    type: "article",
    image: article.cover_url,
    publishedTime: article.created_at,
    modifiedTime: article.updated_at,
    authors: [article.copyright_author || "安知鱼"],
  });
}

// 页面组件
export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 并行获取文章、最近文章与站点配置（用于 JSON-LD）
  const [article, recentArticles, siteConfig] = await Promise.all([
    getArticle(id),
    getRecentArticles(),
    fetchSiteConfigForSeo(),
  ]);

  if (!article) {
    notFound();
  }

  const site = resolveSeoSiteInfo(siteConfig);
  const articlePath = `/posts/${encodeURIComponent(String(article.abbrlink || id))}`;
  const siteUrl = site.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "";
  const jsonLd = buildArticleJsonLd(
    {
      title: article.title,
      summaries: article.summaries,
      cover_url: article.cover_url,
      created_at: article.created_at,
      updated_at: article.updated_at,
      copyright_author: article.copyright_author,
    },
    siteUrl,
    articlePath,
    site.siteName
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PostDetailContent article={article} recentArticles={recentArticles} />
    </>
  );
}
