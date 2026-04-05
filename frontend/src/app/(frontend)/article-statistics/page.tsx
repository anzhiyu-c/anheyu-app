import type { Metadata } from "next";
import { ArticleStatisticsContent } from "./_components/ArticleStatisticsContent";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "文章统计",
    description: "博客文章数据统计概览，包含文章总数、字数、趋势与热门数据。",
    path: "/article-statistics",
  });
}

export default function ArticleStatisticsPage() {
  return <ArticleStatisticsContent />;
}
