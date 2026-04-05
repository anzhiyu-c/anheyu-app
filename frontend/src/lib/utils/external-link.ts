/**
 * 外链检测和处理工具
 * 参考 anheyu-app utils/externalLink.ts 实现
 */

/**
 * 检查URL是否为外部链接
 */
export function isExternalLink(url: string): boolean {
  if (!url) return false;

  // 相对路径
  if (url.startsWith("/") || url.startsWith("#") || url.startsWith("?")) {
    return false;
  }

  // 特殊协议
  if (url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("sms:")) {
    return false;
  }

  try {
    const urlObj = new URL(url, window.location.origin);

    // 非 http(s) 协议
    if (urlObj.protocol === "javascript:" || urlObj.protocol === "data:" || urlObj.protocol === "blob:") {
      return false;
    }

    return urlObj.host !== window.location.host;
  } catch {
    return false;
  }
}

/**
 * 初始化外链拦截监听器
 * 在应用启动时调用，自动拦截所有外链点击并跳转到警告页面
 */
export function initExternalLinkInterceptor(): () => void {
  const handler = (event: MouseEvent) => {
    // 向上查找最近的 <a> 标签
    let target = event.target as HTMLElement;
    while (target && target.tagName !== "A") {
      target = target.parentElement as HTMLElement;
      if (!target || target === document.body) return;
    }

    const link = target as HTMLAnchorElement;
    if (!link?.href) return;

    // 不拦截：新窗口打开、下载链接、修饰键（与 anheyu-app 对齐）
    if (link.target === "_blank" || link.download) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;

    // 检查是否为外链
    if (!isExternalLink(link.href)) return;

    // 检查会话中是否已选择跳过
    if (sessionStorage.getItem("skip-external-link-warning") === "true") return;

    // 阻止默认行为，跳转到警告页面
    event.preventDefault();
    event.stopPropagation();

    const encodedUrl = encodeURIComponent(link.href);
    window.location.href = `/external-link-warning?url=${encodedUrl}`;
  };

  // 捕获阶段监听，确保拦截到所有链接点击
  document.addEventListener("click", handler, true);

  // 返回清理函数
  return () => document.removeEventListener("click", handler, true);
}
