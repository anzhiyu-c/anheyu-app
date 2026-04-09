import type { Metadata } from "next";
import { ExternalLinkWarningPageClient } from "./_components/ExternalLinkWarningPageClient";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "外部链接提示",
    description: "跳转外部站点前的安全提示页。",
    path: "/external-link-warning",
    noindex: true,
  });
}

export default function ExternalLinkWarningPage() {
  return <ExternalLinkWarningPageClient />;
}
