"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Icon } from "@iconify/react";
import { BannerCard } from "@/components/common/BannerCard";
import { Spinner } from "@/components/ui";
import { sanitizeCommentHtml } from "@/components/post/Comment/comment-utils";
import { getChangelogList } from "@/lib/api/changelog";
import type { Changelog } from "@/types/changelog";

const DEFAULT_BANNER_IMAGE =
  "https://upload-bbs.miyoushe.com/upload/2025/09/26/125766904/00961b9c22d3e633de8294555f3a3375_2015751252958610528.png?x-oss-process=image/format,avif";

function formatDate(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString || "—";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}年${m}月${d}日 ${h}:${min}`;
}

function formatReleaseNotes(body: string) {
  if (!body) return "";
  return body
    .replace(/### (.*)$/gim, "<h3>$1</h3>")
    .replace(/## (.*)$/gim, "<h2>$1</h2>")
    .replace(/# (.*)$/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/gim, "<em>$1</em>")
    .replace(/\n/gim, "<br>");
}

function renderChangelogContent(changelog: Changelog): string {
  const { parsedContent } = changelog;
  if (!parsedContent?.sections?.length) {
    return formatReleaseNotes(changelog.body);
  }
  const repoMatch = changelog.htmlUrl?.match(/github\.com\/([^/]+\/[^/]+)/);
  const repoPath = repoMatch ? repoMatch[1] : "";
  let html = "";
  parsedContent.sections
    .filter(section => {
      const title = section.title.toLowerCase();
      return (
        !title.includes("相关链接") &&
        !title.includes("links") &&
        section.count > 0
      );
    })
    .sort((a, b) => a.order - b.order)
    .forEach(section => {
      html += `<div class="changelog-section"><div class="section-header"><div class="section-title"><span class="section-icon">${section.icon}</span><span class="section-name">${section.title.replace(section.icon, "").trim()}</span></div></div><div class="section-content">`;
      section.items.forEach(item => {
        const shortHash = item.commitHash ? item.commitHash.substring(0, 7) : "";
        const authorMatch = item.description?.match(/\(@([^)]+)\)/);
        const author = authorMatch ? authorMatch[1] : "";
        const commitUrl =
          repoPath && item.commitHash
            ? `https://github.com/${repoPath}/commit/${item.commitHash}`
            : "";
        const authorUrl = author ? `https://github.com/${author}` : "";
        html += `<div class="change-item ${item.breaking ? "breaking" : ""}"><div class="change-dot"></div><div class="change-content"><div class="change-main">${shortHash ? `<a href="${commitUrl}" target="_blank" rel="noopener noreferrer" class="change-hash"><i class="ri-git-commit-line"></i>${shortHash}</a>` : ""}<span class="change-message">${item.scope ? `<span class="change-scope">${item.scope}</span>` : ""}${item.message}</span>${item.breaking ? ' <span class="breaking-badge">BREAKING</span>' : ""}</div><div class="change-meta">${author ? `<a href="${authorUrl}" target="_blank" rel="noopener noreferrer" class="change-author">@${author}</a>` : ""}</div></div></div>`;
      });
      html += `</div></div>`;
    });
  return html;
}

/** 对渲染后的更新日志 HTML 做安全过滤，防止 XSS */
function sanitizeChangelogHtml(html: string): string {
  if (!html) return "";
  return sanitizeCommentHtml(html);
}

export function UpdatePageClient() {
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [changelogs, setChangelogs] = useState<Changelog[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const loadMoreInProgressRef = useRef(false);

  const fetchList = useCallback(async (page: number, append: boolean) => {
    if (page === 1) setLoading(true);
    else setLoadingMore(true);
    setError("");
    try {
      const res = await getChangelogList({
        page,
        limit: 10,
        detail: true,
        prerelease: false,
        draft: false,
      });
      if (res.code === 200) {
        const list = res.data.list || [];
        const totalCount = res.data.total || 0;
        if (append) {
          setChangelogs(prev => [...prev, ...list]);
        } else {
          setChangelogs(list);
        }
        setCurrentPage(page);
        setTotal(totalCount);
        setHasMore(totalCount > page * 10);
      } else {
        throw new Error(res.message || "获取更新日志失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取更新日志失败");
      if (page === 1) setChangelogs([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchList(1, false);
    // 仅首屏加载一次，不随 fetchList 引用变化重新请求
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(() => {
    if (loadMoreInProgressRef.current || loadingMore || !hasMore || loading) return;
    const nextPage = currentPage + 1;
    loadMoreInProgressRef.current = true;
    fetchList(nextPage, true).finally(() => {
      loadMoreInProgressRef.current = false;
    });
  }, [currentPage, hasMore, loadingMore, loading, fetchList]);

  useEffect(() => {
    if (loadingMore || !hasMore) return;
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      if ((scrollTop + windowHeight) / docHeight >= 0.85) loadMore();
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadMore, hasMore, loadingMore]);

  return (
    <div className="w-full max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      <BannerCard
        tips="更新日志"
        title="更新日志"
        description="每一次更新，都是一次成长"
        backgroundImage={DEFAULT_BANNER_IMAGE}
        height={300}
      />

      <div className="space-y-6">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-border bg-card">
            <Spinner className="mb-4" />
            <p className="text-muted-foreground">正在获取更新日志...</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-border bg-card text-center">
            <Icon icon="ri:error-warning-line" className="text-4xl text-primary mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">获取更新日志失败</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <button
              type="button"
              onClick={() => fetchList(1, false)}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90"
            >
              重试
            </button>
          </div>
        )}

        {!loading && !error && changelogs.length > 0 && (
          <div className="relative pl-4 sm:pl-8 before:absolute before:left-[15px] sm:before:left-[23px] before:top-0 before:bottom-0 before:w-0.5 before:bg-primary/15 before:rounded">
            {changelogs.map((log, index) => (
              <div
                key={log.id}
                className="relative flex gap-4 sm:gap-8 mb-8 last:mb-0 last:[&_.node-line]:hidden"
              >
                <div className="absolute left-0 sm:-left-8 flex justify-center w-8 sm:w-12 shrink-0">
                  <div
                    className={`mt-6 w-4 h-4 rounded-full border-[3px] border-primary z-10 shrink-0 ${log.isLatest ? "bg-primary shadow-[0_0_0_4px_rgba(var(--primary),0.2)]" : "bg-card"}`}
                  />
                  {index < changelogs.length - 1 && (
                    <div className="absolute left-[7px] sm:left-[23px] top-10 bottom-0 w-0.5 bg-primary/15 -translate-x-1/2" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pl-6 sm:pl-4">
                  <div className="rounded-xl border border-border bg-card shadow-sm p-5">
                    <div className="pb-3 border-b border-border">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h2 className="text-xl font-bold text-foreground m-0">{log.tagName}</h2>
                        {log.isLatest && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-primary text-primary-foreground">
                            <Icon icon="ri:rocket-line" /> 最新
                          </span>
                        )}
                        {log.prerelease && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500 text-white">
                            <Icon icon="ri:test-tube-line" /> 预览版
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Icon icon="ri:calendar-line" />
                        {formatDate(log.publishedAt)}
                      </div>
                    </div>
                    <div className="mt-4 changelog-body">
                      {log.body || log.parsedContent ? (
                        <div
                          className="changelog-content prose prose-sm dark:prose-invert max-w-none text-foreground [&_.changelog-section]:mb-4 [&_.section-title]:font-semibold [&_.section-title]:text-foreground [&_.change-item]:flex [&_.change-item]:items-center [&_.change-item]:gap-2 [&_.change-item]:py-1 [&_.change-item]:w-full [&_.change-dot]:w-1.5 [&_.change-dot]:h-1.5 [&_.change-dot]:shrink-0 [&_.change-dot]:rounded-full [&_.change-dot]:bg-primary/30 [&_.change-content]:flex-1 [&_.change-content]:min-w-0 [&_.change-content]:grid [&_.change-content]:grid-cols-[1fr_auto] [&_.change-content]:items-center [&_.change-content]:gap-4 [&_.change-main]:flex [&_.change-main]:items-center [&_.change-main]:gap-2 [&_.change-main]:min-w-0 [&_.change-main]:overflow-hidden [&_.change-meta]:flex-none [&_.change-meta]:justify-self-end [&_.change-hash]:inline-flex [&_.change-hash]:items-center [&_.change-hash]:px-1.5 [&_.change-hash]:py-0.5 [&_.change-hash]:rounded [&_.change-hash]:bg-primary [&_.change-hash]:text-primary-foreground [&_.change-hash]:text-xs [&_.change-hash]:min-w-[60px] [&_.change-hash]:w-[60px] [&_.change-hash]:justify-center [&_.change-scope]:bg-muted [&_.change-scope]:text-muted-foreground [&_.change-scope]:px-1 [&_.change-scope]:rounded [&_.breaking-badge]:bg-red-500 [&_.breaking-badge]:text-white [&_.breaking-badge]:text-[10px] [&_.breaking-badge]:px-1 [&_.breaking-badge]:rounded [&_.change-author]:text-muted-foreground [&_.change-author]:text-xs [&_.change-author]:whitespace-nowrap [&_.change-author]:hover:text-primary [&_.change-author]:transition-colors"
                          dangerouslySetInnerHTML={{ __html: sanitizeChangelogHtml(renderChangelogContent(log)) }}
                        />
                      ) : (
                        <div className="py-8 text-center text-muted-foreground italic rounded-xl bg-muted/30">
                          暂无详细说明
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {loadingMore && (
          <div className="flex items-center justify-center gap-3 py-8">
            <Spinner />
            <span className="text-muted-foreground">正在加载更多...</span>
          </div>
        )}

        {!loading && !loadingMore && hasMore === false && changelogs.length > 0 && (
          <div className="flex items-center justify-center gap-2 py-8 rounded-xl border border-dashed border-green-500/30 bg-green-500/5 text-green-600 dark:text-green-400">
            <Icon icon="ri:check-line" />
            <span>已加载全部 {total} 个版本</span>
          </div>
        )}
      </div>
    </div>
  );
}
