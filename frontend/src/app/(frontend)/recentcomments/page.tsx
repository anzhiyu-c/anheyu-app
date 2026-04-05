import type { Metadata } from "next";
import { RecentCommentsPageClient } from "./_components/RecentCommentsPageClient";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "最近评论",
    description: "最近评论时间线，快速查看站点最新评论互动。",
    path: "/recentcomments",
  });
}

export default function RecentCommentsPage() {
  return <RecentCommentsPageClient />;
}
