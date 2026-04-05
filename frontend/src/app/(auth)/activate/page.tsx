import type { Metadata } from "next";
import { ActivatePageClient } from "./_components/ActivatePageClient";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "激活账号",
    description: "通过邮件链接激活您的账号。",
    path: "/activate",
    noindex: true,
  });
}

export default function ActivatePage() {
  return <ActivatePageClient />;
}
