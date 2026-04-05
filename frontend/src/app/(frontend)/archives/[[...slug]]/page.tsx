import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArchivePageContent } from "@/components/archives";
import { buildPageMetadata } from "@/lib/seo";

interface ArchiveRouteParams {
  slug?: string[];
}

function isYear(value: string) {
  return /^\d{4}$/.test(value);
}

function isMonth(value: string) {
  if (!/^\d{1,2}$/.test(value)) return false;
  const monthValue = Number(value);
  return monthValue >= 1 && monthValue <= 12;
}

function isPage(value: string) {
  if (!/^\d+$/.test(value)) return false;
  return Number(value) > 0;
}

function parseArchiveParams(slug?: string[]) {
  const parts = (slug ?? []).filter(Boolean);
  const base = { page: 1 } as { year?: number; month?: number; page: number };

  if (parts.length === 0) {
    return { ...base, isValid: true };
  }

  if (parts.length === 1) {
    if (isYear(parts[0])) {
      return { ...base, year: Number(parts[0]), isValid: true };
    }
    return { ...base, isValid: false };
  }

  if (parts.length === 2) {
    if (parts[0] === "page" && isPage(parts[1])) {
      return { ...base, page: Number(parts[1]), isValid: true };
    }
    if (isYear(parts[0]) && isMonth(parts[1])) {
      return { ...base, year: Number(parts[0]), month: Number(parts[1]), isValid: true };
    }
    return { ...base, isValid: false };
  }

  if (parts.length === 3) {
    if (isYear(parts[0]) && parts[1] === "page" && isPage(parts[2])) {
      return { ...base, year: Number(parts[0]), page: Number(parts[2]), isValid: true };
    }
    return { ...base, isValid: false };
  }

  if (parts.length === 4) {
    if (isYear(parts[0]) && isMonth(parts[1]) && parts[2] === "page" && isPage(parts[3])) {
      return {
        ...base,
        year: Number(parts[0]),
        month: Number(parts[1]),
        page: Number(parts[3]),
        isValid: true,
      };
    }
    return { ...base, isValid: false };
  }

  return { ...base, isValid: false };
}

export async function generateMetadata({ params }: { params: Promise<ArchiveRouteParams> }): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseArchiveParams(slug);

  if (!parsed.isValid) {
    return buildPageMetadata({
      title: "归档",
      description: "按时间轴浏览文章归档。",
      path: "/archives",
      noindex: true,
    });
  }

  if (parsed.year && parsed.month) {
    const path =
      parsed.page > 1
        ? `/archives/${parsed.year}/${parsed.month}/page/${parsed.page}`
        : `/archives/${parsed.year}/${parsed.month}`;
    return buildPageMetadata({
      title: `${parsed.year} 年 ${parsed.month} 月归档`,
      description: `查看 ${parsed.year} 年 ${parsed.month} 月发布的文章归档。`,
      path,
    });
  }

  if (parsed.year) {
    const path = parsed.page > 1 ? `/archives/${parsed.year}/page/${parsed.page}` : `/archives/${parsed.year}`;
    return buildPageMetadata({
      title: `${parsed.year} 年归档`,
      description: `查看 ${parsed.year} 年发布的文章归档。`,
      path,
    });
  }

  const path = parsed.page > 1 ? `/archives/page/${parsed.page}` : "/archives";
  return buildPageMetadata({
    title: "归档",
    description: "按时间轴浏览文章归档。",
    path,
  });
}

export default async function ArchivePage({ params }: { params: Promise<ArchiveRouteParams> }) {
  const { slug } = await params;
  const parsed = parseArchiveParams(slug);

  if (!parsed.isValid) {
    notFound();
  }

  return <ArchivePageContent year={parsed.year} month={parsed.month} page={parsed.page} />;
}
