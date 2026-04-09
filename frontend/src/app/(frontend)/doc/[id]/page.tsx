/**
 * 文档详情页面
 * 复用文章 API 获取内容，渲染三栏文档布局
 */
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { DocDetailContent } from "@/components/doc/DocDetailContent";
import { buildPageMetadata } from "@/lib/seo";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9fe" },
    { media: "(prefers-color-scheme: dark)", color: "#18171d" },
  ],
};

const API_BASE_URL = process.env.BACKEND_URL || "http://localhost:8091";

async function getArticle(id: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/public/articles/${id}`, {
      next: { revalidate: 60 },
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      console.error(`Failed to fetch doc article: ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (data.code === 200 && data.data) {
      return data.data;
    }
    return null;
  } catch (error) {
    console.error("Error fetching doc article:", error);
    return null;
  }
}

async function getDocSeriesName(seriesId: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/public/doc-series/${seriesId}/articles`, {
      next: { revalidate: 300 },
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.code === 200 && data.data?.name ? data.data.name : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticle(id);

  if (!article) {
    return buildPageMetadata({
      title: "文档未找到",
      description: "该文档不存在或已被删除。",
      path: `/doc/${encodeURIComponent(id)}`,
      noindex: true,
    });
  }

  const seriesName = article.doc_series_id ? await getDocSeriesName(String(article.doc_series_id)) : null;
  const pageTitle = seriesName ? `${article.title} - ${seriesName}` : article.title;

  return buildPageMetadata({
    title: pageTitle,
    absoluteTitle: true,
    description: article.summaries?.[0] || article.title,
    keywords: article.keywords || article.post_tags?.map((tag: { name: string }) => tag.name),
    path: `/doc/${encodeURIComponent(id)}`,
    type: "article",
    image: article.cover_url,
    publishedTime: article.created_at,
    modifiedTime: article.updated_at,
    authors: [article.copyright_author || "安知鱼"],
  });
}

export default async function DocDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getArticle(id);

  if (!article) {
    notFound();
  }

  return <DocDetailContent article={article} />;
}
