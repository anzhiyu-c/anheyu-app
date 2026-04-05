/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-02-03 16:07:45
 * @LastEditTime: 2026-02-03 16:33:28
 * @LastEditors: 安知鱼
 */
"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLatestComments } from "@/hooks/queries";
import { useSiteConfigStore } from "@/store/site-config-store";
import { Spinner } from "@/components/ui";
import { BannerCard } from "@/components/common/BannerCard";
import {
  formatRelativeTime,
  getAvatarUrl,
  sanitizeCommentHtml,
  type CommentDisplayConfig,
} from "@/components/post/Comment/comment-utils";

export function RecentCommentsPageClient() {
  const siteConfig = useSiteConfigStore(state => state.siteConfig);
  const { data, isPending, isError } = useLatestComments({ page: 1, pageSize: 20 });
  const comments = data?.list || [];

  const bannerConfig = siteConfig?.recent_comments?.banner;

  const displayConfig: CommentDisplayConfig = useMemo(
    () => ({
      gravatarUrl: siteConfig?.GRAVATAR_URL || "https://cravatar.cn/",
      defaultGravatarType: siteConfig?.DEFAULT_GRAVATAR_TYPE || "mp",
      masterTag: siteConfig?.comment?.master_tag || "博主",
      adminAvatarUrl: (siteConfig?.USER_AVATAR as string) || undefined,
    }),
    [siteConfig]
  );

  return (
    <div className="w-full max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      <BannerCard
        tips={bannerConfig?.title || "最近评论"}
        title={bannerConfig?.description || "Recent Comments"}
        description={bannerConfig?.tip}
        backgroundImage={bannerConfig?.background}
        height={300}
      />

      {isPending && (
        <div className="flex items-center justify-center py-10">
          <Spinner />
        </div>
      )}

      {isError && <div className="text-muted-foreground">评论加载失败，请稍后再试。</div>}

      {!isPending && comments.length === 0 && <div className="text-muted-foreground">暂无评论</div>}

      <div className="space-y-4">
        {comments.map(comment => {
          const avatarUrl = getAvatarUrl(comment, displayConfig);
          const link = `${comment.target_path}#comment-${comment.id}`;
          return (
            <div key={comment.id} className="flex gap-4 p-4 rounded-xl border border-border bg-card shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt={`${comment.nickname}头像`}
                className="w-12 h-12 rounded-full border border-border"
              />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-foreground">{comment.nickname}</span>
                  {comment.is_admin_comment && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {displayConfig.masterTag}
                    </span>
                  )}
                  <span className="text-muted-foreground">{formatRelativeTime(comment.created_at)}</span>
                </div>
                <div
                  className="text-sm text-foreground"
                  dangerouslySetInnerHTML={{ __html: sanitizeCommentHtml(comment.content_html) }}
                />
                <Link
                  href={link}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition"
                >
                  {comment.target_title || comment.target_path}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
