import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryDetailPageContent } from "@/components/categories";
import { buildPageMetadata } from "@/lib/seo";

interface CategoryPageParams {
  name: string;
  page: string;
}

function parsePage(value: string) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.floor(num);
}

export async function generateMetadata({ params }: { params: Promise<CategoryPageParams> }): Promise<Metadata> {
  const resolvedParams = await params;
  const name = decodeURIComponent(resolvedParams.name);
  const page = parsePage(resolvedParams.page) || 1;
  return buildPageMetadata({
    title: `分类 - ${name}（第 ${page} 页）`,
    description: `浏览分类「${name}」的第 ${page} 页文章列表。`,
    path: `/categories/${encodeURIComponent(name)}/page/${page}`,
  });
}

export default async function CategoryDetailPageWithPagination({ params }: { params: Promise<CategoryPageParams> }) {
  const resolvedParams = await params;
  const name = decodeURIComponent(resolvedParams.name);
  const page = parsePage(resolvedParams.page);
  if (!page) {
    notFound();
  }
  return <CategoryDetailPageContent categoryName={name} page={page} />;
}
