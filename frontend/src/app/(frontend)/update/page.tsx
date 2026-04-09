import type { Metadata } from "next";
import { UpdatePageClient } from "./_components/UpdatePageClient";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "更新日志",
    description: "每一次更新，都是一次成长。查看站点版本更新记录。",
    path: "/update",
  });
}

export default function UpdatePage() {
  return <UpdatePageClient />;
}
