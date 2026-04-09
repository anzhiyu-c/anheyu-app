"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/utils/date";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, "")
    .trim();
}

type CommentStatus = "pending" | "approved" | "spam";

interface RecentComment {
  id: string | number;
  author: string;
  avatar?: string;
  content: string;
  article_title: string;
  article_id: string | number;
  created_at: string;
  status: CommentStatus;
}

interface RecentCommentsProps {
  comments: RecentComment[];
  onApprove?: (id: string | number) => void;
  onReject?: (id: string | number) => void;
  className?: string;
  isLoading?: boolean;
}

const statusConfig: Record<CommentStatus, { label: string; className: string }> = {
  pending: { label: "待审核", className: "bg-yellow-500/10 text-yellow-600" },
  approved: { label: "已通过", className: "bg-green-500/10 text-green-600" },
  spam: { label: "垃圾", className: "bg-red-500/10 text-red-500" },
};

export function RecentComments({ comments, onApprove, onReject, className, isLoading }: RecentCommentsProps) {
  if (isLoading) {
    return (
      <div className={cn("bg-card border border-border rounded-xl animate-pulse", className)}>
        <div className="flex items-center justify-between p-5 pb-0">
          <div>
            <div className="h-5 w-24 bg-muted rounded mb-2" />
            <div className="h-4 w-32 bg-muted rounded" />
          </div>
          <div className="h-4 w-16 bg-muted rounded" />
        </div>
        <div className="p-5 pt-4 space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex gap-3">
              <div className="w-9 h-9 bg-muted rounded-full shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-4 w-16 bg-muted rounded" />
                  <div className="h-4 w-12 bg-muted rounded" />
                </div>
                <div className="h-4 w-full bg-muted rounded mb-2" />
                <div className="h-3 w-32 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-card border border-border rounded-xl", className)}>
      {/* 头部 */}
      <div className="flex items-center justify-between p-5 pb-0">
        <div>
          <h3 className="text-base font-semibold">最近评论</h3>
          <p className="text-sm text-muted-foreground mt-0.5">最新的用户评论</p>
        </div>
        <Link
          href="/admin/comments"
          className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
        >
          查看全部
          <Icon icon="ri:arrow-right-s-line" className="w-4 h-4" />
        </Link>
      </div>

      {/* 列表 */}
      <div className="p-5 pt-4">
        {comments.length > 0 ? (
          <div className="space-y-4">
            {comments.map(comment => (
              <div key={comment.id} className="group">
                <div className="flex gap-3">
                  {/* 头像 */}
                  <div className="shrink-0 w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {comment.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={comment.avatar} alt={comment.author} className="w-full h-full object-cover" />
                    ) : (
                      <Icon icon="ri:user-line" className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{comment.author}</span>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded", statusConfig[comment.status].className)}>
                        {statusConfig[comment.status].label}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatRelativeTime(comment.created_at)}
                      </span>
                    </div>

                    {/* 评论内容 */}
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-1.5">{stripHtml(comment.content)}</p>

                    {/* 来源文章 */}
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/admin/post-management/${comment.article_id}`}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 truncate max-w-[200px]"
                      >
                        <Icon icon="ri:article-line" className="w-3 h-3 shrink-0" />
                        <span className="truncate">{comment.article_title}</span>
                      </Link>

                      {/* 快速操作 */}
                      {comment.status === "pending" && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => onApprove?.(comment.id)}
                            className="p-1.5 rounded-md hover:bg-green-500/10 text-muted-foreground hover:text-green-600 transition-colors"
                            title="通过"
                          >
                            <Icon icon="ri:check-line" className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onReject?.(comment.id)}
                            className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                            title="拒绝"
                          >
                            <Icon icon="ri:close-line" className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground text-sm">暂无评论</div>
        )}
      </div>
    </div>
  );
}
