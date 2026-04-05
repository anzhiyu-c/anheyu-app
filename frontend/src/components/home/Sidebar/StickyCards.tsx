"use client";

import { useMemo, useRef, useState, useEffect, useCallback, memo, useSyncExternalStore } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { useSiteConfigStore } from "@/store/site-config-store";
import { useTags, useArchives } from "@/hooks/queries";
import { useTagFilter } from "@/hooks/use-tag-filter";
import styles from "./StickyCards.module.css";

interface TagsCardProps {
  highlightIds?: string[];
}

/**
 * 标签云组件
 * 使用 memo 优化性能
 * 在标签详情页时支持状态驱动切换，其他页面使用路由导航
 */
const TagsCard = memo(function TagsCard({ highlightIds = [] }: TagsCardProps) {
  const { data: tags = [], isLoading } = useTags();
  const tagCloudRef = useRef<HTMLDivElement>(null);
  const [isOverflow, setIsOverflow] = useState(false);
  const tagFilter = useTagFilter(); // 在标签详情页时有值，其他页面为 null

  const checkOverflow = useCallback(() => {
    if (tagCloudRef.current) {
      setIsOverflow(tagCloudRef.current.scrollHeight > tagCloudRef.current.clientHeight);
    }
  }, []);

  useEffect(() => {
    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [checkOverflow, tags]);

  const handleTagClick = useCallback(
    (e: React.MouseEvent, tagName: string) => {
      // 只有在标签详情页时才阻止默认导航，使用状态切换
      if (tagFilter) {
        e.preventDefault();
        tagFilter.onTagChange(tagName);
      }
    },
    [tagFilter]
  );

  if (isLoading) {
    return <div className={styles.loadingTip}>标签云加载中...</div>;
  }

  if (tags.length === 0) {
    return <div className={styles.emptyTip}>暂无标签</div>;
  }

  return (
    <div className={styles.cardTags}>
      <div className={styles.cardContent}>
        <div ref={tagCloudRef} className={`${styles.cardTagCloud} ${isOverflow ? styles.isOverflow : ""}`}>
          {tags.map(tag => {
            const isHighlight = highlightIds.includes(tag.id);
            const isSelected = tagFilter?.selectedTag === tag.name;
            return (
              <Link
                key={tag.id}
                href={`/tags/${encodeURIComponent(tag.name)}/`}
                prefetch={false}
                onClick={e => handleTagClick(e, tag.name)}
                className={`${styles.tagLink} ${isHighlight ? styles.isHighlight : ""} ${
                  isSelected ? styles.isSelected : ""
                }`}
              >
                {tag.name}
                <sup>{tag.count}</sup>
              </Link>
            );
          })}
        </div>
      </div>
      {isOverflow && (
        <div className={styles.cardFooter}>
          <Link href="/tags" prefetch={false} className={styles.viewAllButton}>
            查看全部
          </Link>
        </div>
      )}
    </div>
  );
});

TagsCard.displayName = "TagsCard";

/**
 * 归档列表组件
 * 使用 memo 优化性能
 */
const ArchivesCard = memo(function ArchivesCard() {
  // 使用 useSyncExternalStore 检测客户端挂载状态（React 19 推荐方式）
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const { data: archives = [] } = useArchives();

  const monthMap = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];

  const getMonthName = (month: number) => monthMap[month - 1] || "";

  // 服务端渲染或客户端未挂载或数据为空时，返回 null
  if (!mounted || archives.length === 0) {
    return null;
  }

  return (
    <>
      <div className={styles.cardArchives}>
        <ul className={styles.archiveList}>
          {archives.map(archive => (
            <li key={`${archive.year}-${archive.month}`} className={styles.archiveItem}>
              <Link href={`/archives/${archive.year}/${archive.month}/`} prefetch={false} className={styles.archiveLink}>
                <span className={styles.archiveDate}>
                  {getMonthName(archive.month)} {archive.year}
                </span>
                <div className={styles.archiveCountGroup}>
                  <span className={styles.archiveCount}>{archive.count}</span>
                  <span>篇</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <hr className={styles.divider} />
    </>
  );
});

ArchivesCard.displayName = "ArchivesCard";

/**
 * 网站信息组件
 * 使用 memo 优化性能
 * 文章总数和全站字数从统计 API 获取真实数据，设置值仅控制是否显示
 */
const WebInfoCard = memo(function WebInfoCard() {
  const siteConfig = useSiteConfigStore(state => state.siteConfig);
  const [stats, setStats] = useState<{ total_posts: number; total_words: number } | null>(null);

  const webInfoConfig = useMemo(() => {
    const siteinfo = siteConfig?.sidebar?.siteinfo;
    const launchTime = siteConfig?.footer?.runtime?.launch_time;
    const rawPostCount = siteinfo?.totalPostCount;
    const rawWordCount = siteinfo?.totalWordCount;

    return {
      showPostCount: rawPostCount != null && Number(rawPostCount) !== -1,
      showWordCount: rawWordCount != null && Number(rawWordCount) !== -1,
      runtimeEnable: siteinfo?.runtimeEnable ?? false,
      launchTime,
    };
  }, [siteConfig]);

  useEffect(() => {
    if (!webInfoConfig.showPostCount && !webInfoConfig.showWordCount) return;

    let cancelled = false;
    const fetchStats = async () => {
      try {
        const { articleApi } = await import("@/lib/api/article");
        const data = await articleApi.getStatistics();
        if (!cancelled) setStats(data);
      } catch {
        // 静默失败，保持不显示
      }
    };
    fetchStats();
    return () => {
      cancelled = true;
    };
  }, [webInfoConfig.showPostCount, webInfoConfig.showWordCount]);

  const runningDays = useMemo(() => {
    if (!webInfoConfig.launchTime) return 0;
    try {
      const launchDate = new Date(webInfoConfig.launchTime);
      const currentDate = new Date();
      const differenceInTime = currentDate.getTime() - launchDate.getTime();
      return Math.floor(differenceInTime / (1000 * 3600 * 24));
    } catch {
      return 0;
    }
  }, [webInfoConfig.launchTime]);

  const formattedWordCount = useMemo(() => {
    const count = stats?.total_words ?? 0;
    if (count === 0) return "0";
    if (count < 1000) return count.toString();
    return (count / 1000).toFixed(1) + "k";
  }, [stats?.total_words]);

  const hasContent = webInfoConfig.showPostCount || webInfoConfig.runtimeEnable || webInfoConfig.showWordCount;

  if (!hasContent) return null;

  return (
    <div className={styles.cardWebinfo}>
      <div className={styles.webinfo}>
        {webInfoConfig.showPostCount && (
          <div className={styles.webinfoItem}>
            <div className={styles.webinfoItemTitle}>
              <Icon icon="fa6-solid:file-lines" />
              <div className={styles.itemName}>文章总数 :</div>
            </div>
            <div className={styles.itemCount}>{stats?.total_posts ?? 0}</div>
          </div>
        )}

        {webInfoConfig.runtimeEnable && (
          <div className={styles.webinfoItem}>
            <div className={styles.webinfoItemTitle}>
              <Icon icon="fa6-solid:stopwatch" />
              <div className={styles.itemName}>建站天数 :</div>
            </div>
            <div className={styles.itemCount}>{runningDays} 天</div>
          </div>
        )}

        {webInfoConfig.showWordCount && (
          <div className={styles.webinfoItem}>
            <div className={styles.webinfoItemTitle}>
              <Icon icon="fa6-solid:font" />
              <div className={styles.itemName}>全站字数 :</div>
            </div>
            <div className={styles.itemCount}>{formattedWordCount}</div>
          </div>
        )}
      </div>
    </div>
  );
});

WebInfoCard.displayName = "WebInfoCard";

/**
 * Sticky 卡片区域 - 包含标签、归档、网站信息
 * 使用 memo 优化性能
 */
export const StickyCards = memo(function StickyCards() {
  const siteConfig = useSiteConfigStore(state => state.siteConfig);

  const tagsConfig = useMemo(() => {
    if (!siteConfig?.sidebar?.tags?.enable) return null;

    // 解析高亮标签 ID 列表（转为字符串数组以匹配 PostTag.id 类型）
    let highlightIds: string[] = [];
    const rawHighlight = siteConfig.sidebar.tags.highlight;
    if (rawHighlight) {
      if (Array.isArray(rawHighlight)) {
        highlightIds = rawHighlight.map(id => String(id));
      } else if (typeof rawHighlight === "string") {
        try {
          const parsed = JSON.parse(rawHighlight);
          if (Array.isArray(parsed)) {
            highlightIds = parsed.map((id: string | number) => String(id));
          }
        } catch {
          // 解析失败，忽略
        }
      }
    }

    return { highlightIds };
  }, [siteConfig]);

  return (
    <div className={styles.stickyContainer}>
      <div className={styles.cardWidget}>
        {/* 标签区 */}
        {tagsConfig && (
          <>
            <TagsCard highlightIds={tagsConfig.highlightIds} />
            <hr className={styles.divider} />
          </>
        )}

        {/* 归档 */}
        <ArchivesCard />

        {/* 网站信息 */}
        <WebInfoCard />
      </div>
    </div>
  );
});

StickyCards.displayName = "StickyCards";
