import type { Metadata } from "next";
import { TagPageContent } from "@/components/tags";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "标签",
    description: "按标签浏览博客内容。",
    path: "/tags",
  });
}

export default function TagsPage() {
  return <TagPageContent />;
}
