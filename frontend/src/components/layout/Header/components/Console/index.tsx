"use client";

import { useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Icon } from "@iconify/react";
import { Tooltip } from "@/components/ui";
import { cn } from "@/lib/utils";
import { addToast } from "@heroui/react";
import { useSiteConfigStore } from "@/store/site-config-store";
import { useUiStore } from "@/store/ui-store";
import { useTags, useArchives, useLatestComments } from "@/hooks/queries";
import { sanitizeCommentHtml } from "@/components/post/Comment/comment-utils";
import { useTheme } from "@/hooks/use-theme";
import type { Comment } from "@/lib/api/comment";

import styles from "./styles.module.css";

interface ConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Console({ isOpen, onClose }: ConsoleProps) {
  const router = useRouter();
  const { isDark, toggleTheme, mounted } = useTheme();
  const siteConfig = useSiteConfigStore(state => state.siteConfig);
  const isShortcutsEnabled = useUiStore(state => state.isShortcutsEnabled);
  const toggleShortcuts = useUiStore(state => state.toggleShortcuts);
  const isCommentBarrageVisible = useUiStore(state => state.isCommentBarrageVisible);
  const toggleCommentBarrage = useUiStore(state => state.toggleCommentBarrage);

  const isDarkMode = mounted && isDark;

  // 获取标签数据
  const { data: tags = [] } = useTags();

  // 获取归档数据
  const { data: archives = [] } = useArchives();

  // 获取最近评论（只在控制台打开时请求）
  const { data: commentsData } = useLatestComments({ page: 1, pageSize: 6 }, { enabled: isOpen });

  const latestComments = commentsData?.list || [];

  // 评论配置
  const commentInfoConfig = useMemo(() => {
    return {
      gravatar_url: siteConfig?.GRAVATAR_URL || "https://cravatar.cn/",
      default_gravatar_type: siteConfig?.DEFAULT_GRAVATAR_TYPE || "mp",
    };
  }, [siteConfig]);

  // 切换主题
  const handleThemeToggle = useCallback(() => {
    if (!mounted) return;
    toggleTheme();
  }, [mounted, toggleTheme]);

  // 跳转到归档
  const goToArchive = useCallback(
    (year: string) => {
      const path = year === "全部文章" ? "/archives" : `/archives/${year}/`;
      router.push(path);
      onClose();
    },
    [router, onClose]
  );

  // 跳转到文章
  const goToArticle = useCallback(
    (comment: Comment) => {
      if (!comment?.target_path) return;
      router.push(`${comment.target_path}#comment-${comment.id}`);
      onClose();
    },
    [router, onClose]
  );

  // 格式化评论日期
  const formatCommentDate = useCallback((dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }, []);

  // 获取头像 URL
  const getAvatarUrl = useCallback(
    (emailMd5: string) => {
      const baseUrl = commentInfoConfig.gravatar_url.replace(/\/$/, "");
      return `${baseUrl}/avatar/${emailMd5}?s=140&d=${commentInfoConfig.default_gravatar_type}`;
    },
    [commentInfoConfig]
  );

  // 按年份聚合归档数据
  const archivesByYear = useMemo(() => {
    if (!archives || archives.length === 0) return [];

    const yearMap = new Map<number, number>();
    archives.forEach(item => {
      const year = item.year;
      const currentCount = yearMap.get(year) || 0;
      yearMap.set(year, currentCount + item.count);
    });

    return Array.from(yearMap, ([year, count]) => ({
      year: String(year),
      count,
    }));
  }, [archives]);

  // 显示的归档数据
  const displayArchives = useMemo(() => {
    const totalPostCount = siteConfig?.sidebar?.siteinfo?.totalPostCount || 0;
    const yearArchives = archivesByYear.slice(0, 7);
    if (totalPostCount > 0) {
      yearArchives.push({
        year: "全部文章",
        count: totalPostCount,
      });
    }
    return yearArchives;
  }, [archivesByYear, siteConfig]);

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // 处理空白区域点击关闭（用于所有可能有空白区域的容器）
  const handleBlankClick = useCallback(
    (e: React.MouseEvent) => {
      // 只有点击元素本身（空白区域）时才关闭，点击子元素不触发
      if (e.target === e.currentTarget && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  return (
    <div className={cn(styles.console, isOpen && styles.show)}>
      {/* 背景遮罩 - 点击关闭控制台 */}
      <div className={styles.consoleMask} onClick={handleBlankClick} />
      <div className={styles.consoleContent} onClick={handleBlankClick}>
        <div className={styles.consoleCardGroup} onClick={handleBlankClick}>
          {/* 左侧：最近评论 */}
          <div className={styles.consoleCardGroupLeft} onClick={handleBlankClick}>
            <div className={cn(styles.consoleCard, styles.cardNewestComments)} onClick={handleBlankClick}>
              <div className={styles.cardContent} onClick={handleBlankClick}>
                <div className={styles.authorContentItemTips}>互动</div>
                <div className={styles.cardHorContent}>
                  <span className={styles.authorContentItemTitle}>最近评论</span>
                  <Link href="/recentcomments" prefetch={false} className={styles.goToRecentComments} onClick={onClose} title="最近评论">
                    <ChevronRight size={22} />
                  </Link>
                </div>
              </div>
              <div className={styles.consoleRecentComments} onClick={handleBlankClick}>
                {latestComments.length > 0 ? (
                  latestComments.map(comment => {
                    const commentTitle = comment.target_title || comment.target_path || "评论";
                    return (
                      <div key={comment.id} className={styles.commentCard} onClick={() => goToArticle(comment)}>
                        <div className={styles.commentInfo}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={getAvatarUrl(comment.email_md5)} alt="最近评论头像" />
                          <div>
                            <span className={styles.commentUser}>{comment.nickname}</span>
                          </div>
                          <span className={styles.commentTime}>{formatCommentDate(comment.created_at)}</span>
                        </div>
                        <div
                          className={styles.commentContent}
                          dangerouslySetInnerHTML={{ __html: sanitizeCommentHtml(comment.content_html) }}
                        />
                        <div className={styles.commentTitle} title={commentTitle}>
                          <Icon icon="ri:chat-1-fill" width={12} height={12} />
                          {commentTitle}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.noComments}>暂无评论</div>
                )}
              </div>
            </div>
          </div>

          {/* 右侧：标签和归档 */}
          <div className={styles.consoleCardGroupRight} onClick={handleBlankClick}>
            {/* 标签卡片 */}
            <div className={cn(styles.consoleCard, styles.tags)} onClick={handleBlankClick}>
              <div className={styles.cardContent} onClick={handleBlankClick}>
                <div className={styles.authorContentItemTips}>标签</div>
                <div className={styles.authorContentItemTitle}>寻找感兴趣的领域</div>
              </div>
              <div className={styles.cardTagCloud} onClick={handleBlankClick}>
                {tags.length > 0 ? (
                  tags.map(tag => (
                    <Link key={tag.id} href={`/tags/${tag.name}/`} prefetch={false} className={styles.tagItem} onClick={onClose}>
                      {tag.name}
                      <sup>{tag.count}</sup>
                    </Link>
                  ))
                ) : (
                  <div className={styles.noTags}>暂无标签</div>
                )}
              </div>
            </div>

            {/* 归档卡片 */}
            <div className={cn(styles.consoleCard, styles.history)} onClick={handleBlankClick}>
              <ul className={styles.cardArchiveList} onClick={handleBlankClick}>
                {displayArchives.map(archive => (
                  <li
                    key={archive.year}
                    className={styles.cardArchiveListItem}
                    onClick={() => goToArchive(archive.year)}
                  >
                    <div className={styles.cardArchiveListLink}>
                      <div className={styles.cardArchiveListDate}>{archive.year}</div>
                      <div className={styles.cardArchiveListCountGroup}>
                        <div className={styles.cardArchiveListCount}>{archive.count}</div>
                        <div className={styles.cardArchiveListCountUnit}>篇</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* 按钮组 */}
        <div className={styles.buttonGroup}>
          <Tooltip
            content="显示模式切换"
            placement="top"
            delay={300}
            closeDelay={0}
            classNames={{ content: "custom-tooltip-content" }}
          >
            <div className={cn(styles.consoleBtnItem, isDarkMode && styles.on)}>
              <button className={styles.darkmodeSwitch} aria-label="显示模式切换" onClick={handleThemeToggle}>
                <span className={cn(styles.themeIcon, styles.sunIcon, !isDarkMode && styles.active)}>
                  <Icon icon="solar:sun-bold" width={24} height={24} />
                </span>
                <span className={cn(styles.themeIcon, styles.moonIcon, isDarkMode && styles.active)}>
                  <Icon icon="solar:moon-bold" width={24} height={24} />
                </span>
              </button>
            </div>
          </Tooltip>

          <Tooltip
            content={isCommentBarrageVisible ? "关闭热评" : "显示热评"}
            placement="top"
            delay={300}
            closeDelay={0}
            classNames={{ content: "custom-tooltip-content" }}
          >
            <div className={cn(styles.consoleBtnItem, isCommentBarrageVisible && styles.on)}>
              <button
                type="button"
                className={styles.commentBarrage}
                aria-label="热评开关"
                aria-pressed={isCommentBarrageVisible}
                onClick={() => {
                  toggleCommentBarrage();
                  addToast({
                    title: isCommentBarrageVisible ? "热评弹幕已关闭" : "热评弹幕已开启",
                    color: isCommentBarrageVisible ? "default" : "success",
                    timeout: 2000,
                  });
                }}
              >
                <Icon icon="ri:chat-1-fill" width={24} height={24} />
              </button>
            </div>
          </Tooltip>

          <Tooltip
            content={isShortcutsEnabled ? "关闭快捷键" : "开启快捷键"}
            placement="top"
            delay={300}
            closeDelay={0}
            classNames={{ content: "custom-tooltip-content" }}
          >
            <div className={cn(styles.consoleBtnItem, isShortcutsEnabled && styles.on)}>
              <button
                className={styles.keyboardSwitch}
                aria-label="快捷键开关"
                onClick={() => {
                  const wasEnabled = isShortcutsEnabled;
                  toggleShortcuts();
                  addToast({
                    title: `快捷键功能已${wasEnabled ? "关闭" : "开启"}`,
                    color: wasEnabled ? "default" : "success",
                    timeout: 2000,
                  });
                }}
              >
                <Icon icon="solar:keyboard-bold" width={24} height={24} />
              </button>
            </div>
          </Tooltip>

          <Tooltip
            content="音乐胶囊开关"
            placement="top"
            delay={300}
            closeDelay={0}
            classNames={{ content: "custom-tooltip-content" }}
          >
            <div className={styles.consoleBtnItem}>
              <button
                className={styles.musicSwitch}
                aria-label="音乐胶囊开关"
                onClick={() => {
                  const store = useUiStore.getState();
                  store.toggleMusicPlayer();
                  addToast({
                    title: store.isMusicPlayerVisible ? "音乐胶囊已开启" : "音乐胶囊已关闭",
                    color: store.isMusicPlayerVisible ? "success" : "default",
                  });
                }}
              >
                <Icon icon="solar:music-note-3-bold" width={24} height={24} />
              </button>
            </div>
          </Tooltip>

          <Tooltip
            content="侧边栏开关"
            placement="top"
            delay={300}
            closeDelay={0}
            classNames={{ content: "custom-tooltip-content" }}
          >
            <div className={styles.consoleBtnItem}>
              <button className={styles.sidebarSwitch} aria-label="侧边栏开关">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="28" viewBox="0 0 24 24">
                  <g fill="currentColor">
                    <path d="M17 22h2a4 4 0 0 0 4-4V6a4 4 0 0 0-4-4h-2z" />
                    <path
                      fillRule="evenodd"
                      d="M15 2H5a4 4 0 0 0-4 4v12a4 4 0 0 0 4 4h10zm-6.707 8.707a1 1 0 0 1 1.414-1.414l2 2a1 1 0 0 1 0 1.414l-2 2a1 1 0 0 1-1.414-1.414L9.586 12z"
                      clipRule="evenodd"
                    />
                  </g>
                </svg>
              </button>
            </div>
          </Tooltip>
        </div>
      </div>

      {/* 遮罩 */}
      <div className={styles.consoleMask} onClick={onClose} />
    </div>
  );
}
