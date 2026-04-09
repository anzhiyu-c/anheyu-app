"use client";

import { useState, useMemo, useCallback, Suspense, lazy } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/react";
import { cn } from "@/lib/utils";
import { useSiteConfigStore } from "@/store/site-config-store";
import { articleApi } from "@/lib/api/article";

import styles from "./HomeTop.module.css";

// 按需加载 Lottie 组件 - 仅当 banner.image 为空时才加载
const HelloLottie = lazy(() => import("./HelloLottie").then(mod => ({ default: mod.HelloLottie })));

interface RecommendedArticle {
  id: number;
  title: string;
  cover_url?: string;
  is_doc?: boolean;
  doc_series_id?: number;
}

export function HomeTop() {
  const router = useRouter();
  const siteConfig = useSiteConfigStore(state => state.siteConfig);

  const homeTopConfig = useMemo(() => siteConfig?.HOME_TOP, [siteConfig]);
  const creativityConfig = useMemo(() => siteConfig?.CREATIVITY, [siteConfig]);

  const [isTopGroupExpanded, setIsTopGroupExpanded] = useState(false);
  const [isRandomLoading, setIsRandomLoading] = useState(false);

  // 推荐文章当前未配置独立接口，先保持为空并自动隐藏右侧推荐卡片区域
  const recommendedArticles: RecommendedArticle[] = [];

  // 创意图标列表（重复一次用于无限滚动）
  const creativityList = useMemo(() => {
    if (!creativityConfig?.creativity_list) return [];
    const list = creativityConfig.creativity_list;
    return [...list, ...list];
  }, [creativityConfig]);

  // 创意图标配对
  const creativityPairs = useMemo(() => {
    const pairs: Array<[(typeof creativityList)[0], (typeof creativityList)[0]]> = [];
    for (let i = 0; i < creativityList.length; i += 2) {
      if (creativityList[i + 1]) {
        pairs.push([creativityList[i], creativityList[i + 1]]);
      }
    }
    return pairs;
  }, [creativityList]);

  const hasRecommendedArticles = recommendedArticles && recommendedArticles.length > 0;
  const hasBanner = homeTopConfig?.banner && homeTopConfig.banner.title;
  const showRightSection = hasRecommendedArticles || hasBanner;

  // 判断是否需要加载 Lottie 组件（仅当 banner.image 为空时）
  const shouldLoadLottie = useMemo(() => {
    const banner = homeTopConfig?.banner;
    if (!banner) return false;

    const imageUrl = banner.image;
    // 判断图片 URL 是否为空（处理 undefined、null、空字符串、只有空格的情况）
    const hasImage = imageUrl && imageUrl.trim().length > 0;

    return !hasImage; // 没有图片时显示 Lottie
  }, [homeTopConfig]);

  // 随便逛逛
  const handleRandomClick = useCallback(async () => {
    if (isRandomLoading) return;
    setIsRandomLoading(true);
    try {
      // 当前使用文章列表页作为“随便逛逛”的兜底入口
      const article = await articleApi.getRandomArticle();
      if (article.is_doc) {
        router.push(`/doc/${article.id}`);
      } else {
        router.push(`/posts/${article.id}`);
      }
    } catch {
      addToast({ title: "暂时没有可供浏览的文章", color: "warning", timeout: 2000 });
    } finally {
      setIsRandomLoading(false);
    }
  }, [isRandomLoading, router]);

  // 展开/收起推荐卡片
  const handleMoreClick = useCallback(
    (e: React.MouseEvent) => {
      if (hasRecommendedArticles) {
        e.preventDefault();
        e.stopPropagation();
        setIsTopGroupExpanded(true);
      }
    },
    [hasRecommendedArticles]
  );

  const collapseTopGroup = useCallback(() => {
    setIsTopGroupExpanded(false);
  }, []);

  if (!homeTopConfig || !creativityConfig) return null;

  return (
    <div className={cn(styles.homeTopContainer, !showRightSection && styles.leftOnly)}>
      {/* 左侧区域 */}
      <div className={cn(styles.leftSection, !showRightSection && styles.fullWidth)}>
        <div className={styles.randomBanner}>
          {/* 标题 */}
          <div className={styles.bannersTitle}>
            <div className={styles.bannersTitleBig}>{homeTopConfig.title}</div>
            <div className={styles.bannersTitleBig}>{homeTopConfig.subTitle}</div>
            <div className={styles.bannersTitleSmall}>{homeTopConfig.siteText}</div>
          </div>

          {/* 创意图标 */}
          <div className={styles.skillsTagsGroupAll}>
            <div className={styles.tagsGroupWrapper}>
              {creativityPairs.map((pair, index) => (
                <div key={index} className={styles.tagsGroupIconPair}>
                  <div className={styles.tagsGroupIcon} style={{ background: pair[0].color }}>
                    <Image
                      src={pair[0].icon}
                      alt={pair[0].name}
                      title={pair[0].name}
                      width={60}
                      height={60}
                      unoptimized
                    />
                  </div>
                  <div className={styles.tagsGroupIcon} style={{ background: pair[1].color }}>
                    <Image
                      src={pair[1].icon}
                      alt={pair[1].name}
                      title={pair[1].name}
                      width={60}
                      height={60}
                      unoptimized
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 随便逛逛 */}
          <a className={cn(styles.randomHover, isRandomLoading && styles.isLoading)} onClick={handleRandomClick}>
            <Icon icon="fa6-solid:paper-plane" width="4.5rem" height="4.5rem" />
            <div className={styles.bannerText}>
              随便逛逛
              <Icon icon="fa6-solid:arrow-right" width="4.5rem" height="4.5rem" />
            </div>
          </a>
        </div>

        {/* 分类按钮 */}
        <div className={styles.categoryGroup}>
          {homeTopConfig.category?.map(item => (
            <div key={item.name} className={styles.categoryItem}>
              {item.isExternal || /^https?:\/\//.test(item.path) ? (
                <a
                  className={styles.categoryButton}
                  href={item.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: item.background }}
                >
                  <span className={styles.categoryButtonText}>{item.name}</span>
                  {item.icon &&
                    (item.icon.startsWith("http") ? (
                      <Image
                        src={item.icon}
                        alt={item.name}
                        width={80}
                        height={80}
                        className={cn(styles.categoryIcon, styles.categoryIconImg)}
                        unoptimized
                      />
                    ) : (
                      <Icon icon={item.icon} className={styles.categoryIcon} />
                    ))}
                </a>
              ) : (
                <Link className={styles.categoryButton} href={item.path} prefetch={false} style={{ background: item.background }}>
                  <span className={styles.categoryButtonText}>{item.name}</span>
                  {item.icon &&
                    (item.icon.startsWith("http") ? (
                      <Image
                        src={item.icon}
                        alt={item.name}
                        width={80}
                        height={80}
                        className={cn(styles.categoryIcon, styles.categoryIconImg)}
                        unoptimized
                      />
                    ) : (
                      <Icon icon={item.icon} className={styles.categoryIcon} />
                    ))}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 右侧区域 - 只有有内容时才显示 */}
      {showRightSection && (
        <div className={styles.rightSection}>
          <div className={styles.topGroup} onMouseLeave={hasRecommendedArticles ? collapseTopGroup : undefined}>
            {/* 推荐文章卡片 */}
            {recommendedArticles.map(article => (
              <Link
                key={article.id}
                className={styles.recentPostItem}
                href={article.is_doc ? `/doc/${article.id}` : `/posts/${article.id}`}
                prefetch={false}
                title={article.title}
              >
                <div className={styles.postCover}>
                  <span className={styles.recentPostTopText}>荐</span>
                  <Image
                    className={styles.postBg}
                    src={article.cover_url || "/images/default-cover.webp"}
                    alt={article.title}
                    fill
                    sizes="(max-width: 768px) 200px, 33vw"
                    unoptimized
                  />
                </div>
                <div className={styles.recentPostInfo}>
                  <div className={styles.articleTitle}>{article.title}</div>
                </div>
              </Link>
            ))}

            {/* Today Card */}
            {hasBanner && (
              <a
                className={cn(
                  styles.todayCard,
                  isTopGroupExpanded && styles.hide,
                  shouldLoadLottie && styles.hasLottie
                )}
                href={homeTopConfig.banner?.link}
                target="_blank"
                rel="noopener external nofollow noreferrer"
              >
                <div className={styles.todayCardInfo}>
                  <div className={styles.todayCardTips}>{homeTopConfig.banner?.tips}</div>
                  <div className={styles.todayCardTitle}>{homeTopConfig.banner?.title}</div>
                </div>
                {homeTopConfig.banner?.image && homeTopConfig.banner.image.trim() ? (
                  <Image
                    className={styles.todayCardCover}
                    src={homeTopConfig.banner.image}
                    alt="封面"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    unoptimized
                  />
                ) : shouldLoadLottie ? (
                  <Suspense fallback={<div className={styles.todayCardCoverPlaceholder} />}>
                    <HelloLottie />
                  </Suspense>
                ) : null}
                <div className={styles.bannerButtonGroup}>
                  <div className={styles.bannerButton} onClick={handleMoreClick}>
                    <Icon icon="tabler:circle-arrow-up-right-filled" width={22} height={22} />
                    <span className={styles.bannerButtonText}>更多推荐</span>
                  </div>
                </div>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
