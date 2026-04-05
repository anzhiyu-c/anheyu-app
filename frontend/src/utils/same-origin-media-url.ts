/**
 * 将后端返回的「本站托管媒体」绝对 URL 转为相对路径（pathname + search）。
 *
 * 典型场景：本地访问 localhost，而后端按生产站点配置返回 https://blog.anheyu.com/api/f/... 。
 * 若 <img> 直接使用该绝对地址，请求会发往生产域，不会带本地登录态，易出现 401/403 导致图片裂图。
 * 转为 /api/f/... 后由当前页面域名 + Next rewrites 代理到本地/当前环境后端。
 *
 * Gravatar、QQ、第三方 OSS 等非本站路径保持原样。
 */
export function toSameOriginMediaUrl(url: string): string {
  if (!url || typeof url !== "string") return url;
  const trimmed = url.trim();
  if (trimmed.startsWith("/")) return trimmed;

  try {
    const u = new URL(trimmed);
    const path = u.pathname + u.search;
    if (
      path.startsWith("/api/f/") ||
      path.startsWith("/static/") ||
      path.startsWith("/needcache/")
    ) {
      return path;
    }
  } catch {
    // 非绝对 URL（或畸形），按原样返回
    return trimmed;
  }

  return trimmed;
}
