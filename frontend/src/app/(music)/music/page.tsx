import type { Metadata } from "next";
import { MusicPageClient } from "./_components/MusicPageClient";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "音乐馆",
    description: "沉浸式音乐体验页面，支持歌词、专辑封面与播放控制。",
    path: "/music",
  });
}

export default function MusicPage() {
  return <MusicPageClient />;
}
