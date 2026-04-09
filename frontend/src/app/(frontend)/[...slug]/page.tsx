import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildPageMetadata, getSeoBackendUrl } from "@/lib/seo";
import { CustomPageContent } from "@/components/custom-page/CustomPageContent";

interface CustomPageProps {
  params: Promise<{ slug: string[] }>;
}

async function fetchCustomPage(path: string) {
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  try {
    const response = await fetch(`${getSeoBackendUrl()}/api/public/pages/${cleanPath}`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) return null;

    const result = await response.json();
    return result?.data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: CustomPageProps): Promise<Metadata> {
  const { slug } = await params;
  const path = `/${slug.join("/")}`;
  const page = await fetchCustomPage(path);

  if (!page) {
    return { title: "页面未找到" };
  }

  return buildPageMetadata({
    title: page.title,
    description: page.description || undefined,
    path,
    type: "website",
  });
}

export default async function CustomPageRoute({ params }: CustomPageProps) {
  const { slug } = await params;
  const path = `/${slug.join("/")}`;
  const page = await fetchCustomPage(path);

  if (!page) {
    notFound();
  }

  return <CustomPageContent page={page} />;
}
