import type { Metadata } from "next";
import { TagDetailPageContent } from "@/components/tags";
import { buildPageMetadata } from "@/lib/seo";

interface TagPageParams {
  name: string;
}

export async function generateMetadata({ params }: { params: Promise<TagPageParams> }): Promise<Metadata> {
  const resolvedParams = await params;
  const name = decodeURIComponent(resolvedParams.name);
  return buildPageMetadata({
    title: `标签 - ${name}`,
    description: `浏览标签「${name}」下的全部文章。`,
    path: `/tags/${encodeURIComponent(name)}`,
  });
}

export default async function TagDetailPage({ params }: { params: Promise<TagPageParams> }) {
  const resolvedParams = await params;
  const name = decodeURIComponent(resolvedParams.name);
  return <TagDetailPageContent tagName={name} />;
}
