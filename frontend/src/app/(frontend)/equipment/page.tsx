import type { Metadata } from "next";
import { EquipmentPageContent } from "./_components/EquipmentPageContent";
import { buildPageMetadata, fetchSiteConfigForSeo } from "@/lib/seo";

async function getEquipmentConfig() {
  try {
    const config = await fetchSiteConfigForSeo();
    if (!config) return null;
    return {
      title: config?.equipment?.banner?.title,
      description: config?.equipment?.banner?.description,
      background: config?.equipment?.banner?.background,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const data = await getEquipmentConfig();

  return buildPageMetadata({
    title: data?.title || "我的装备",
    description: data?.description || "分享我使用的设备和工具",
    path: "/equipment",
    image: data?.background,
  });
}

export default function EquipmentPage() {
  return <EquipmentPageContent />;
}
