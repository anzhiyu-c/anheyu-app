"use client";

import { useMemo, type SyntheticEvent } from "react";
import { ThumbsUp, MessageSquare, MapPin, Monitor, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Comment } from "@/lib/api/comment";
import { CommentForm } from "./CommentForm";
import {
  buildGravatarUrl,
  buildReplyChains,
  formatRelativeTime,
  getAvatarUrl,
  normalizeWebsiteUrl,
  parseUserAgent,
  sanitizeCommentHtml,
  type CommentDisplayConfig,
} from "./comment-utils";
import { ReplyItem } from "@/components/post/Comment/ReplyItem";
import styles from "./CommentItem.module.css";

export interface ReplyTarget {
  parentId: string;
  replyToId: string;
  replyToNick?: string | null;
  replyToIsAnonymous?: boolean;
}

interface CommentItemProps {
  comment: Comment;
  config: CommentDisplayConfig;
  formConfig: {
    limitLength: number;
    loginRequired: boolean;
    anonymousEmail: string;
    allowImageUpload: boolean;
    emojiCdn?: string;
    placeholder?: string;
  };
  targetPath: string;
  targetTitle?: string;
  pageSize: number;
  rootId: string;
  activeReplyId: string | null;
  replyTarget: ReplyTarget | null;
  likedIds: Set<string>;
  loadedChildrenCount?: number;
  isLoadingChildren: boolean;
  onReply: (target: ReplyTarget) => void;
  onCancelReply: () => void;
  onSubmitted: () => void;
  onToggleLike: (commentId: string, isLiked: boolean) => void;
  onLoadMoreChildren: (comment: Comment) => void;
}

export function CommentItem({
  comment,
  config,
  formConfig,
  targetPath,
  targetTitle,
  pageSize,
  rootId,
  activeReplyId,
  replyTarget,
  likedIds,
  loadedChildrenCount,
  isLoadingChildren,
  onReply,
  onCancelReply,
  onSubmitted,
  onToggleLike,
  onLoadMoreChildren,
}: CommentItemProps) {
  const avatarUrl = getAvatarUrl(comment, config);
  const websiteUrl = normalizeWebsiteUrl(comment.website);
  const activeTarget = activeReplyId === comment.id ? replyTarget : null;
  const showReplyForm = Boolean(activeTarget);
  const loadedCount = loadedChildrenCount ?? (comment.children?.length || 0);
  const canReply = !comment.is_anonymous;
  const liked = likedIds.has(comment.id);
  const safeHtml = sanitizeCommentHtml(comment.content_html);
  const deviceInfo = useMemo(() => parseUserAgent(comment.user_agent), [comment.user_agent]);
  const sortedChildren = useMemo(
    () =>
      comment.children && comment.children.length > 0
        ? buildReplyChains(comment.id, comment.children, { preserveOrder: true })
        : [],
    [comment.children, comment.id]
  );

  const chainHeadCount = sortedChildren.length;
  const hasMoreChildren = chainHeadCount >= 3 && (comment.total_children || 0) > loadedCount;
  const remainingCount = Math.max((comment.total_children || 0) - loadedCount, 0);
  const childrenCountText = remainingCount <= 0 ? "已显示全部回复" : `展开 ${remainingCount} 条回复`;

  const handleReply = () => {
    if (!canReply) return;
    onReply({
      parentId: rootId,
      replyToId: comment.id,
      replyToNick: comment.nickname,
      replyToIsAnonymous: comment.is_anonymous,
    });
  };

  const handleContentClick = () => {
    if (!canReply) return;
    if (typeof window !== "undefined" && window.innerWidth > 768) return;
    handleReply();
  };

  const handleAvatarError = (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.src = buildGravatarUrl(comment.email_md5, config);
  };

  return (
    <div id={`comment-${comment.id}`} className={styles.commentItemContainer}>
      <div className={styles.commentItem}>
        {websiteUrl ? (
          <a href={websiteUrl} target="_blank" rel="noopener noreferrer nofollow">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt="avatar" className={styles.commentAvatar} onError={handleAvatarError} />
          </a>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="avatar" className={styles.commentAvatar} onError={handleAvatarError} />
        )}

        <div className={styles.commentMain}>
          <div className={styles.commentHeader}>
            <div className={styles.userInfo}>
              <span className={styles.nickname}>{comment.nickname}</span>
              {comment.is_admin_comment && <span className={styles.masterTag}>{config.masterTag}</span>}
              {comment.pinned_at && <span className={styles.pinnedTag}>置顶</span>}
              <span className={styles.timestamp}>{formatRelativeTime(comment.created_at)}</span>
            </div>
            <div className={styles.commentActions}>
              <button
                className={cn(styles.actionButton, liked && styles.actionButtonLiked)}
                onClick={() => onToggleLike(comment.id, liked)}
                aria-label={liked ? "取消点赞" : "点赞"}
                title={liked ? "取消点赞" : "点赞"}
              >
                <ThumbsUp size={14} />
                {comment.like_count > 0 && <span className={styles.likeCount}>{comment.like_count}</span>}
              </button>
              <button
                className={cn(styles.actionButton, !canReply && styles.actionButtonDisabled)}
                onClick={handleReply}
                disabled={!canReply}
                aria-disabled={!canReply}
                title={!canReply ? "匿名评论无法回复" : "回复"}
              >
                <MessageSquare size={14} />
              </button>
            </div>
          </div>

          {comment.reply_to_nick && (
            <div className={styles.replyToBlock}>
              回复 <span className={styles.replyToNick}>@{comment.reply_to_nick}</span>：
            </div>
          )}

          <div
            className={cn(styles.commentContent, canReply && styles.commentContentCanReply)}
            onClick={handleContentClick}
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />

          {(config.showRegion || config.showUA) && (
            <div className={styles.commentMeta}>
              {config.showRegion && comment.ip_location && (
                <span className={styles.metaItem}>
                  <MapPin size={14} />
                  {comment.ip_location}
                </span>
              )}
              {config.showUA && deviceInfo.os && (
                <span className={styles.metaItem}>
                  <Monitor size={14} />
                  {deviceInfo.os}
                </span>
              )}
              {config.showUA && deviceInfo.browser && (
                <span className={styles.metaItem}>
                  <Globe size={14} />
                  {deviceInfo.browser}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {showReplyForm && activeTarget && (
        <div className={styles.replyFormWrapper}>
          <CommentForm
            targetPath={targetPath}
            targetTitle={targetTitle}
            pageSize={pageSize}
            parentId={activeTarget.parentId}
            replyToId={activeTarget.replyToId}
            replyToNick={activeTarget.replyToNick ?? undefined}
            replyToIsAnonymous={activeTarget.replyToIsAnonymous}
            config={formConfig}
            showCancelButton
            onSubmitted={onSubmitted}
            onCancel={onCancelReply}
          />
        </div>
      )}

      {sortedChildren.length > 0 && (
        <div className={styles.commentChildren}>
          {sortedChildren.map(child => (
            <ReplyItem
              key={child.id}
              comment={child}
              config={config}
              formConfig={formConfig}
              targetPath={targetPath}
              targetTitle={targetTitle}
              pageSize={pageSize}
              rootId={rootId}
              activeReplyId={activeReplyId}
              replyTarget={replyTarget}
              likedIds={likedIds}
              onReply={onReply}
              onCancelReply={onCancelReply}
              onSubmitted={onSubmitted}
              onToggleLike={onToggleLike}
            />
          ))}
        </div>
      )}

      {hasMoreChildren && (
        <div className={styles.loadMoreChildrenWrapper}>
          <button
            className={cn(styles.loadMoreChildrenButton, isLoadingChildren && styles.loadMoreChildrenLoading)}
            onClick={() => onLoadMoreChildren(comment)}
            disabled={isLoadingChildren}
          >
            {isLoadingChildren ? "加载中..." : childrenCountText}
          </button>
        </div>
      )}
    </div>
  );
}
