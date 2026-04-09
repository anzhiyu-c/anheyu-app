import { buildPageMetadata } from "@/lib/seo";
import { RandomPostContent } from "./RandomPostContent";

export async function generateMetadata() {
  return buildPageMetadata({
    title: "随机文章",
    description: "随机跳转到一篇文章",
    path: "/random-post",
    noindex: true,
  });
}

export default function RandomPostPage() {
  return <RandomPostContent />;
}
