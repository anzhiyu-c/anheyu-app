"use client";

import { useMemo, useState, type SyntheticEvent } from "react";
import { ThumbsUp, MessageSquare, MapPin, Monitor, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommentForm } from "./CommentForm";
import {
  buildGravatarUrl,
  formatRelativeTime,
  getAvatarUrl,
  normalizeWebsiteUrl,
  parseUserAgent,
  sanitizeCommentHtml,
  type CommentDisplayConfig,
  type CommentWithReplies,
} from "./comment-utils";
import type { ReplyTarget } from "./CommentItem";
import commentStyles from "./CommentItem.module.css";
import styles from "./ReplyItem.module.css";

interface ReplyItemProps {
  comment: CommentWithReplies;
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
  onReply: (target: ReplyTarget) => void;
  onCancelReply: () => void;
  onSubmitted: () => void;
  onToggleLike: (commentId: string, isLiked: boolean) => void;
}

export function ReplyItem({
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
  onReply,
  onCancelReply,
  onSubmitted,
  onToggleLike,
}: ReplyItemProps) {
  const avatarUrl = getAvatarUrl(comment, config);
  const websiteUrl = normalizeWebsiteUrl(comment.website);
  const activeTarget = activeReplyId === comment.id ? replyTarget : null;
  const showReplyForm = Boolean(activeTarget);
  const canReply = !comment.is_anonymous;
  const liked = likedIds.has(comment.id);
  const safeHtml = sanitizeCommentHtml(comment.content_html);
  const deviceInfo = useMemo(() => parseUserAgent(comment.user_agent), [comment.user_agent]);

  const hasReplies = Boolean(comment._hasReplies);
  const repliesCount = comment._repliesCount || 0;
  const [isRepliesExpanded, setIsRepliesExpanded] = useState(false);
  const [displayedRepliesCount, setDisplayedRepliesCount] = useState(5);

  const displayedReplies = comment._replies ? comment._replies.slice(0, displayedRepliesCount) : [];
  const hasMoreReplies = displayedRepliesCount < repliesCount;

  const handleReply = () => {
    if (!canReply) return;
    if (hasReplies && !isRepliesExpanded) {
      setIsRepliesExpanded(true);
    }
    onReply({
      parentId: comment.parent_id || rootId,
      replyToId: comment.id,
      replyToNick: comment.nickname,
      replyToIsAnonymous: comment.is_anonymous,
    });
  };

  const handleReplySubmitted = () => {
    if (hasReplies && !isRepliesExpanded) {
      setIsRepliesExpanded(true);
    }
    onSubmitted();
  };

  const handleContentClick = () => {
    if (!canReply) return;
    if (typeof window !== "undefined" && window.innerWidth > 768) return;
    handleReply();
  };

  const handleAvatarError = (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.src = buildGravatarUrl(comment.email_md5, config);
  };

  const scrollToParent = () => {
    const parentId = comment.parent_id || rootId;
    const parentElement = document.getElementById(`comment-${parentId}`);
    if (parentElement) {
      parentElement.scrollIntoView({ behavior: "smooth", block: "center" });
      parentElement.classList.add("comment--highlight");
      setTimeout(() => {
        parentElement.classList.remove("comment--highlight");
      }, 2000);
    }
  };

  // 主评论内容
  const mainContent = (
    <div id={`comment-${comment.id}`} className={styles.replyItemContainer}>
      <div className={commentStyles.commentItem}>
        {websiteUrl ? (
          <a href={websiteUrl} target="_blank" rel="noopener noreferrer nofollow">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt="avatar" className={styles.replyAvatar} onError={handleAvatarError} />
          </a>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="avatar" className={styles.replyAvatar} onError={handleAvatarError} />
        )}

        <div className={commentStyles.commentMain}>
          <div className={commentStyles.commentHeader}>
            <div className={commentStyles.userInfo}>
              <button className={styles.replyNickname} onClick={scrollToParent} type="button">
                {comment.nickname}
              </button>
              {comment.is_admin_comment && <span className={commentStyles.masterTag}>{config.masterTag}</span>}
              <span className={commentStyles.timestamp}>{formatRelativeTime(comment.created_at)}</span>
            </div>
            <div className={commentStyles.commentActions}>
              <button
                className={cn(commentStyles.actionButton, liked && commentStyles.actionButtonLiked)}
                onClick={() => onToggleLike(comment.id, liked)}
                aria-label={liked ? "取消点赞" : "点赞"}
                title={liked ? "取消点赞" : "点赞"}
              >
                <ThumbsUp size={14} />
                {comment.like_count > 0 && <span className={commentStyles.likeCount}>{comment.like_count}</span>}
              </button>
              <button
                className={cn(commentStyles.actionButton, !canReply && commentStyles.actionButtonDisabled)}
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
            <div className={commentStyles.replyToBlock}>
              回复{" "}
              <button className={commentStyles.replyToNick} onClick={scrollToParent} type="button">
                @{comment.reply_to_nick}
              </button>
              ：
            </div>
          )}

          <div
            className={cn(commentStyles.commentContent, canReply && commentStyles.commentContentCanReply)}
            onClick={handleContentClick}
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />

          {(config.showRegion || config.showUA) && (
            <div className={commentStyles.commentMeta}>
              {config.showRegion && comment.ip_location && (
                <span className={commentStyles.metaItem}>
                  <MapPin size={14} />
                  {comment.ip_location}
                </span>
              )}
              {config.showUA && deviceInfo.os && (
                <span className={commentStyles.metaItem}>
                  <Monitor size={14} />
                  {deviceInfo.os}
                </span>
              )}
              {config.showUA && deviceInfo.browser && (
                <span className={commentStyles.metaItem}>
                  <Globe size={14} />
                  {deviceInfo.browser}
                </span>
              )}
            </div>
          )}

          {hasReplies && !isRepliesExpanded && (
            <div className={styles.expandRepliesWrapper}>
              <button className={styles.expandRepliesButton} onClick={() => setIsRepliesExpanded(true)}>
                展开 {repliesCount} 条回复 ▼
              </button>
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
            parentId={comment.parent_id || rootId}
            replyToId={comment.id}
            replyToNick={comment.nickname}
            replyToIsAnonymous={comment.is_anonymous}
            config={formConfig}
            showCancelButton
            onSubmitted={handleReplySubmitted}
            onCancel={onCancelReply}
          />
        </div>
      )}
    </div>
  );

  // 展开的回复列表（平级显示，不缩进，与 anheyu-app 保持一致）
  const expandedReplies =
    hasReplies && isRepliesExpanded ? (
      <>
        {displayedReplies.map(reply => (
          <ReplyItem
            key={reply.id}
            comment={reply as CommentWithReplies}
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

        {hasMoreReplies && (
          <div className={styles.loadMoreReplies}>
            <button
              className={styles.loadMoreRepliesButton}
              onClick={() => setDisplayedRepliesCount(prev => prev + 10)}
            >
              加载更多回复 (还有 {repliesCount - displayedRepliesCount} 条)
            </button>
          </div>
        )}
      </>
    ) : null;

  return (
    <>
      {mainContent}
      {expandedReplies}
    </>
  );
}
