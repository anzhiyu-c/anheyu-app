import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TagDetailPageContent } from "@/components/tags";
import { buildPageMetadata } from "@/lib/seo";

interface TagPageParams {
  name: string;
  page: string;
}

function parsePage(value: string) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.floor(num);
}

export async function generateMetadata({ params }: { params: Promise<TagPageParams> }): Promise<Metadata> {
  const resolvedParams = await params;
  const name = decodeURIComponent(resolvedParams.name);
  const page = parsePage(resolvedParams.page) || 1;
  return buildPageMetadata({
    title: `标签 - ${name}（第 ${page} 页）`,
    description: `浏览标签「${name}」的第 ${page} 页文章列表。`,
    path: `/tags/${encodeURIComponent(name)}/page/${page}`,
  });
}

export default async function TagDetailPageWithPagination({ params }: { params: Promise<TagPageParams> }) {
  const resolvedParams = await params;
  const name = decodeURIComponent(resolvedParams.name);
  const page = parsePage(resolvedParams.page);
  if (!page) {
    notFound();
  }
  return <TagDetailPageContent tagName={name} page={page} />;
}
