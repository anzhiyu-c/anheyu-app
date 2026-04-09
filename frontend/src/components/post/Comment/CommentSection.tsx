"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@iconify/react";
import { Fancybox } from "@fancyapps/ui";
import { addToast } from "@heroui/react";
import hljs from "highlight.js";
import { cn } from "@/lib/utils";
import { Spinner, Tooltip } from "@/components/ui";
import { useSiteConfigStore } from "@/store/site-config-store";
import { useAuthStore } from "@/store/auth-store";
import { useCommentsByPath, useLikeComment, useUnlikeComment, commentKeys } from "@/hooks/queries";
import { commentApi, type Comment, type CommentListResponse } from "@/lib/api/comment";
import { CommentForm, type CommentFormHandle } from "./CommentForm";
import { CommentItem, type ReplyTarget } from "./CommentItem";
import { type CommentDisplayConfig } from "./comment-utils";
import styles from "./CommentSection.module.css";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";

const LIKED_COMMENTS_KEY = "liked_comment_ids";

interface CommentSectionProps {
  targetTitle?: string;
  targetPath?: string;
  className?: string;
}

function updateCommentTree(list: Comment[], commentId: string, updater: (comment: Comment) => Comment): Comment[] {
  return list.map(item => {
    if (item.id === commentId) {
      return updater(item);
    }
    if (item.children && item.children.length > 0) {
      return {
        ...item,
        children: updateCommentTree(item.children, commentId, updater),
      };
    }
    return item;
  });
}

function mergeUniqueChildren(existing: Comment[], incoming: Comment[]) {
  const existingIds = new Set(existing.map(child => child.id));
  const merged = [...existing];
  incoming.forEach(child => {
    if (!existingIds.has(child.id)) {
      merged.push(child);
    }
  });
  return merged;
}

export function CommentSection({ targetTitle, targetPath, className }: CommentSectionProps) {
  const pathname = usePathname();
  const siteConfig = useSiteConfigStore(state => state.siteConfig);
  const listRef = useRef<HTMLDivElement | null>(null);
  const commentContainerRef = useRef<HTMLDivElement | null>(null);
  const commentFormRef = useRef<CommentFormHandle | null>(null);
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);

  const resolvedPath = targetPath || pathname || "";
  const commentConfig = siteConfig?.comment;
  const isCommentEnabled =
    commentConfig?.enable === undefined || commentConfig?.enable === true || commentConfig?.enable === "true";
  const pageSize = Number(commentConfig?.page_size ?? 10) || 10;

  const accessToken = useAuthStore(state => state.accessToken);
  const user = useAuthStore(state => state.user);
  const isLoggedIn = Boolean(accessToken && user);

  const displayConfig: CommentDisplayConfig = useMemo(
    () => ({
      gravatarUrl: siteConfig?.GRAVATAR_URL || "https://cravatar.cn/",
      defaultGravatarType: siteConfig?.DEFAULT_GRAVATAR_TYPE || "mp",
      masterTag: siteConfig?.comment?.master_tag || "博主",
      adminAvatarUrl: (siteConfig?.USER_AVATAR as string) || undefined,
      showRegion: commentConfig?.show_region === true || commentConfig?.show_region === "true",
      showUA: commentConfig?.show_ua === true || commentConfig?.show_ua === "true",
    }),
    [siteConfig, commentConfig]
  );

  const formConfig = useMemo(
    () => ({
      limitLength: Number(commentConfig?.limit_length ?? 500) || 500,
      loginRequired: commentConfig?.login_required === true || commentConfig?.login_required === "true",
      anonymousEmail: commentConfig?.anonymous_email || siteConfig?.frontDesk?.siteOwner?.email || "",
      allowImageUpload:
        commentConfig?.allow_image_upload === undefined ||
        commentConfig?.allow_image_upload === true ||
        commentConfig?.allow_image_upload === "true",
      emojiCdn: commentConfig?.emoji_cdn,
      placeholder: commentConfig?.placeholder,
    }),
    [siteConfig, commentConfig]
  );

  const { data, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useCommentsByPath(
    {
      target_path: resolvedPath,
      pageSize,
    },
    { enabled: isCommentEnabled && Boolean(resolvedPath) }
  );

  const rawComments = useMemo(() => data?.pages.flatMap(page => page.list) ?? [], [data]);
  const loadedChildrenCountMap = useMemo(() => {
    const map = new Map<string, number>();
    rawComments.forEach(comment => {
      map.set(comment.id, comment.children?.length || 0);
    });
    return map;
  }, [rawComments]);

  const comments = useMemo(() => rawComments, [rawComments]);
  const totalWithChildren = data?.pages?.[0]?.total_with_children ?? data?.pages?.[0]?.total ?? 0;

  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loadingChildrenIds, setLoadingChildrenIds] = useState<Set<string>>(new Set());
  const [isCommentListVisible, setIsCommentListVisible] = useState(false);
  const [isLoadingScroll, setIsLoadingScroll] = useState(false);
  const [isAnonymousMode, setIsAnonymousMode] = useState(false);

  const likeMutation = useLikeComment(resolvedPath, pageSize);
  const unlikeMutation = useUnlikeComment(resolvedPath, pageSize);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LIKED_COMMENTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        setLikedIds(new Set(parsed));
      }
    } catch {
      setLikedIds(new Set());
    }
  }, []);

  useEffect(() => {
    if (!listRef.current || !isCommentListVisible) return;
    const container = listRef.current;

    // 为外链补充 target 和 rel
    container.querySelectorAll('a[href^="http"]').forEach(link => {
      if (!link.getAttribute("target")) {
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
      }
    });

    // 代码高亮
    container.querySelectorAll("pre code").forEach(block => {
      if ((block as HTMLElement).dataset.highlighted === "yes") return;
      hljs.highlightElement(block as HTMLElement);
      (block as HTMLElement).dataset.highlighted = "yes";
    });

    // Fancybox 绑定（排除表情）
    Fancybox.bind(container, "img:not(a img):not(.anzhiyu-owo-emotion)", {
      groupAll: true,
    });

    return () => {
      Fancybox.unbind(container);
      Fancybox.close(true);
    };
  }, [comments, isCommentListVisible]);

  useEffect(() => {
    setIsCommentListVisible(false);
    intersectionObserverRef.current?.disconnect();
  }, [resolvedPath]);

  useEffect(() => {
    if (!commentContainerRef.current || isCommentListVisible || !isCommentEnabled) return;
    intersectionObserverRef.current?.disconnect();
    intersectionObserverRef.current = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsCommentListVisible(true);
            intersectionObserverRef.current?.disconnect();
          }
        });
      },
      { rootMargin: "200px" }
    );

    intersectionObserverRef.current.observe(commentContainerRef.current);
    return () => {
      intersectionObserverRef.current?.disconnect();
    };
  }, [isCommentListVisible, isCommentEnabled, resolvedPath]);

  const scrollToComment = useCallback((id: string) => {
    const commentElement = document.getElementById(id);
    if (commentElement) {
      commentElement.classList.add("comment--highlight");
      setTimeout(() => {
        commentElement.classList.remove("comment--highlight");
      }, 2000);
      const rect = commentElement.getBoundingClientRect();
      const absoluteTop = rect.top + window.scrollY;
      const top = absoluteTop - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    if (!isCommentEnabled) return;
    const handleHashChange = () => {
      if (typeof window === "undefined") return;
      const hash = window.location.hash;
      if (!hash) return;
      const id = decodeURIComponent(hash.slice(1));
      if (id === "post-comment") {
        setIsCommentListVisible(true);
        intersectionObserverRef.current?.disconnect();
        setTimeout(() => {
          const postCommentElement = document.getElementById("post-comment");
          if (postCommentElement) {
            const rect = postCommentElement.getBoundingClientRect();
            const absoluteTop = rect.top + window.scrollY;
            const top = absoluteTop - 120;
            window.scrollTo({ top, behavior: "smooth" });
          }
        }, 100);
        return;
      }
      if (id.startsWith("comment-")) {
        setIsCommentListVisible(true);
        intersectionObserverRef.current?.disconnect();
        setTimeout(() => {
          scrollToComment(id);
        }, 800);
      }
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [isCommentEnabled, scrollToComment, resolvedPath]);

  const handleScroll = useCallback(() => {
    if (isLoadingScroll || !hasNextPage || isFetchingNextPage) return;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    if (scrollTop + windowHeight >= documentHeight - 100) {
      setIsLoadingScroll(true);
      fetchNextPage().finally(() => setIsLoadingScroll(false));
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isLoadingScroll]);

  useEffect(() => {
    if (!isCommentEnabled) return;
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll, isCommentEnabled]);

  const handleReply = (target: ReplyTarget) => {
    if (target.replyToIsAnonymous) {
      addToast({ title: "匿名评论不允许被回复", color: "danger", timeout: 2000 });
      return;
    }
    setReplyTarget(target);
    setActiveReplyId(target.replyToId);
  };

  const handleCancelReply = () => {
    setReplyTarget(null);
    setActiveReplyId(null);
  };

  const handleSubmitted = () => {
    handleCancelReply();
  };

  const handleAnonymousClick = () => {
    const newState = commentFormRef.current?.showAnonymousDialog();
    if (typeof newState === "boolean") {
      setIsAnonymousMode(newState);
    }
  };

  const handleAnonymousStateChange = (state: boolean) => {
    setIsAnonymousMode(state);
  };

  const updateQueryCache = (commentId: string, updater: (comment: Comment) => Comment) => {
    const queryKey = commentKeys.byPath(resolvedPath, pageSize);
    queryClient.setQueryData<InfiniteData<CommentListResponse> | undefined>(queryKey, old => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map(page => ({
          ...page,
          list: updateCommentTree(page.list, commentId, updater),
        })),
      };
    });
  };

  const handleToggleLike = async (commentId: string, isLiked: boolean) => {
    try {
      const newCount = isLiked
        ? await unlikeMutation.mutateAsync(commentId)
        : await likeMutation.mutateAsync(commentId);

      setLikedIds(prev => {
        const next = new Set(prev);
        if (isLiked) {
          next.delete(commentId);
        } else {
          next.add(commentId);
        }
        localStorage.setItem(LIKED_COMMENTS_KEY, JSON.stringify(Array.from(next)));
        return next;
      });

      updateQueryCache(commentId, item => ({ ...item, like_count: newCount }));
    } catch {
      addToast({ title: "点赞操作失败，请稍后再试", color: "danger", timeout: 2000 });
    }
  };

  const handleLoadMoreChildren = async (comment: Comment) => {
    if (loadingChildrenIds.has(comment.id)) return;
    setLoadingChildrenIds(prev => new Set(prev).add(comment.id));

    const displayed = loadedChildrenCountMap.get(comment.id) ?? 0;
    let requestedSize = 10;
    let skipFirst = 0;

    if (displayed === 3) {
      requestedSize = 13;
      skipFirst = 3;
    } else if (displayed > 3) {
      requestedSize = displayed + 10;
      skipFirst = displayed;
    }

    try {
      const res = await commentApi.getCommentChildren(comment.id, { page: 1, pageSize: requestedSize });
      const incoming = res.list.slice(skipFirst);
      updateQueryCache(comment.id, item => ({
        ...item,
        children: mergeUniqueChildren(item.children || [], incoming),
      }));
    } catch {
      addToast({ title: "加载子评论失败，请稍后再试", color: "danger", timeout: 2000 });
    } finally {
      setLoadingChildrenIds(prev => {
        const next = new Set(prev);
        next.delete(comment.id);
        return next;
      });
    }
  };

  if (!isCommentEnabled) return null;

  return (
    <section id="post-comment" className={cn(styles.commentSection, className)}>
      <div className={styles.mainCommentFormContainer}>
        <div className={styles.commentHead}>
          <div className={styles.formTitle}>
            <Icon icon="ri:chat-1-fill" width="24" height="24" />
            评论
            {!isPending && totalWithChildren > 0 && (
              <span className={styles.commentCountNumber}>{totalWithChildren}</span>
            )}
          </div>
          <div className={styles.commentTools}>
            {!formConfig.loginRequired && !isLoggedIn && (
              <Tooltip
                content={isAnonymousMode ? "点击关闭匿名评论模式" : "点击开启匿名评论模式"}
                placement="top"
                showArrow={false}
              >
                <button
                  className={cn(styles.commentRandomInfo, isAnonymousMode && styles.commentRandomInfoActive)}
                  onClick={handleAnonymousClick}
                >
                  <span className={styles.commentRandomInfoText}>{isAnonymousMode ? "匿名中" : "匿名评论"}</span>
                </button>
              </Tooltip>
            )}
            <Tooltip content="查看评论信息的隐私政策" placement="top" showArrow={false}>
              <div className={styles.commentRandomInfo}>
                <Link href="/privacy">隐私政策</Link>
              </div>
            </Tooltip>
          </div>
        </div>

        <CommentForm
          ref={commentFormRef}
          targetPath={resolvedPath}
          targetTitle={targetTitle}
          pageSize={pageSize}
          config={formConfig}
          onSubmitted={handleSubmitted}
          onAnonymousStateChange={handleAnonymousStateChange}
        />
      </div>

      <div ref={commentContainerRef} className={styles.commentListContainer}>
        {!isCommentListVisible ? (
          <div className={styles.commentListPlaceholder}>
            <div className={styles.commentListPlaceholderContent}>
              <Icon icon="ri:chat-1-line" width="20" height="20" className={styles.placeholderIcon} />
              <span>滚动到此处加载评论...</span>
            </div>
          </div>
        ) : isError ? (
          <div className={styles.commentEmpty}>{error instanceof Error ? error.message : "评论加载失败"}</div>
        ) : isPending ? (
          <div className={styles.commentEmpty}>
            <Spinner />
          </div>
        ) : comments.length === 0 ? (
          <div className={styles.commentEmpty}>暂无评论，快来抢沙发吧！</div>
        ) : (
          <>
            <div ref={listRef} className={styles.commentsWrapper}>
              {comments.map(comment => (
                <div key={comment.id} className={styles.commentThreadItem}>
                  <hr className={styles.commentThreadDivider} />
                  <CommentItem
                    comment={comment}
                    config={displayConfig}
                    formConfig={formConfig}
                    targetPath={resolvedPath}
                    targetTitle={targetTitle}
                    pageSize={pageSize}
                    rootId={comment.id}
                    activeReplyId={activeReplyId}
                    replyTarget={replyTarget}
                    likedIds={likedIds}
                    loadedChildrenCount={loadedChildrenCountMap.get(comment.id)}
                    isLoadingChildren={loadingChildrenIds.has(comment.id)}
                    onReply={handleReply}
                    onCancelReply={handleCancelReply}
                    onSubmitted={handleSubmitted}
                    onToggleLike={handleToggleLike}
                    onLoadMoreChildren={handleLoadMoreChildren}
                  />
                </div>
              ))}
            </div>
            {isLoadingScroll && (
              <div className={styles.scrollLoadingContainer}>
                <div className={styles.scrollLoadingSpinner}>
                  <Icon icon="ri:refresh-line" width="16" height="16" />
                  <span>正在加载更多评论...</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
