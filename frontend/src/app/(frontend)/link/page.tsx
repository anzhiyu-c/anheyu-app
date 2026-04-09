import type { Metadata } from "next";
import { FriendLinkPageClient } from "./_components/FriendLinkPageClient";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "友链",
    description: "友情链接展示与申请页面。",
    path: "/link",
  });
}

export default function FriendLinkPage() {
  return <FriendLinkPageClient />;
}
