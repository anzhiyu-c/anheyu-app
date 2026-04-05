import type { Metadata } from "next";
import { CategoryDetailPageContent } from "@/components/categories";
import { buildPageMetadata } from "@/lib/seo";

interface CategoryPageParams {
  name: string;
}

export async function generateMetadata({ params }: { params: Promise<CategoryPageParams> }): Promise<Metadata> {
  const resolvedParams = await params;
  const name = decodeURIComponent(resolvedParams.name);
  return buildPageMetadata({
    title: `分类 - ${name}`,
    description: `浏览分类「${name}」下的全部文章。`,
    path: `/categories/${encodeURIComponent(name)}`,
  });
}

export default async function CategoryDetailPage({ params }: { params: Promise<CategoryPageParams> }) {
  const resolvedParams = await params;
  const name = decodeURIComponent(resolvedParams.name);
  return <CategoryDetailPageContent categoryName={name} />;
}
