import { NextResponse } from "next/server";
import { getSeoBackendUrl } from "@/lib/seo";

/**
 * 将请求代理到 Go 后端并返回响应
 * 用于 RSS Feed 等需要从后端动态获取的文件
 * 在运行时读取环境变量，不受构建时固化的影响
 */
export async function proxyToBackend(path: string, contentType: string): Promise<NextResponse> {
  const backendUrl = getSeoBackendUrl();

  try {
    const res = await fetch(`${backendUrl}${path}`, {
      headers: { Accept: contentType },
      cache: "no-store",
    });

    if (!res.ok) {
      return new NextResponse("Not Found", { status: res.status });
    }

    const body = await res.text();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error(`[Proxy] Failed to fetch ${path} from ${backendUrl}:`, error);
    return new NextResponse("Service Unavailable", { status: 503 });
  }
}
