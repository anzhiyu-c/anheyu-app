import { proxyToBackend } from "@/lib/proxy-backend";

export const dynamic = "force-dynamic";

export async function GET() {
  return proxyToBackend("/rss.xml", "application/xml; charset=utf-8");
}
