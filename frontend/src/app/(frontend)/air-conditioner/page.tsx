import type { Metadata } from "next";
import { AirConditionerPageClient } from "./_components/AirConditionerPageClient";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "小空调",
    description: "便携小空调互动页面。",
    path: "/air-conditioner",
  });
}

export default function AirConditionerPage() {
  return <AirConditionerPageClient />;
}
