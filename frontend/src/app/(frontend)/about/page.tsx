import type { Metadata } from "next";
import { AboutPageContent } from "./_components/AboutPageContent";
import { buildPageMetadata, fetchSiteConfigForSeo } from "@/lib/seo";

/**
 * 从后端获取关于页面配置（用于 SEO）
 */
async function getAboutConfig() {
  try {
    const config = await fetchSiteConfigForSeo();
    if (!config) return null;
    const about = config?.about?.page;
    return { about };
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const data = await getAboutConfig();
  const name = data?.about?.name || "";
  const description = data?.about?.description || "关于本站";
  const aboutDescription = name ? `关于 ${name} - ${description}` : description;

  return buildPageMetadata({
    title: "关于",
    description: aboutDescription,
    path: "/about",
    type: "profile",
    image: data?.about?.avatar_img,
  });
}

export default function AboutPage() {
  return <AboutPageContent />;
}
