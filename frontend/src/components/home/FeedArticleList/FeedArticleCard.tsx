"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useMemo, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { FaBagShopping, FaBook, FaFire, FaHashtag, FaThumbtack } from "react-icons/fa6";
import { useSiteConfigStore } from "@/store/site-config-store";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/utils/date";
import type { FeedItem } from "@/types/article";
import styles from "./FeedArticleCard.module.css";

interface FeedArticleCardProps {
  article: FeedItem;
  isDoubleColumn?: boolean;
  isNewest?: boolean;
  animationOrder?: number;
}

const READ_ARTICLES_KEY = "read_articles";

// 默认封面图（当配置中没有默认封面时使用）
// 注意：/static/ 路径被代理到后端，所以使用 /images/ 路径
const FALLBACK_COVER = "/images/default-cover.webp";

/**
 * 根据背景色计算合适的文字颜色
 */
function getContrastColor(hexColor: string): string {
  // 如果是 CSS 变量，返回白色
  if (hexColor.startsWith("var(")) return "#ffffff";
  // 移除 # 号
  const hex = hexColor.replace("#", "");
  if (hex.length !== 6) return "#ffffff";
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // 计算亮度 (0-255)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  // 阈值设为 180，只有非常浅的颜色才使用黑色文字
  return brightness > 180 ? "#333333" : "#ffffff";
}

/**
 * 检查文章是否已读（仅客户端）
 */
function checkIsRead(articleId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const readArticlesStr = localStorage.getItem(READ_ARTICLES_KEY);
    if (readArticlesStr) {
      const readArticles: string[] = JSON.parse(readArticlesStr);
      return readArticles.includes(articleId);
    }
  } catch {
    // 忽略 localStorage 错误
  }
  return false;
}

/**
 * 文章卡片组件
 * 使用 React.memo 优化性能，避免不必要的重渲染
 */
export const FeedArticleCard = memo(function FeedArticleCard({
  article,
  isDoubleColumn = false,
  isNewest = false,
  animationOrder = 0,
}: FeedArticleCardProps) {
  const router = useRouter();
  const siteConfig = useSiteConfigStore(state => state.siteConfig);
  // 初始化时检查已读状态
  const [isRead, setIsRead] = useState(() => checkIsRead(article.id));
  const [imageLoaded, setImageLoaded] = useState(false);
  const [useDefaultCover, setUseDefaultCover] = useState(false);

  // 是否启用主色调标签样式
  const enablePrimaryColorTag = useMemo(() => {
    const postConfig = siteConfig?.post?.default;
    const value = postConfig?.enable_primary_color_tag;
    return value === true || value === "true";
  }, [siteConfig]);

  // 是否为商品类型
  const isProduct = article.item_type === "product";

  // 计算封面 URL（优先级：文章封面 > 配置默认封面 > 系统默认封面）
  const coverUrl = useMemo(() => {
    if (useDefaultCover) {
      return FALLBACK_COVER;
    }
    return article.cover_url || siteConfig?.post?.default?.default_cover || FALLBACK_COVER;
  }, [article.cover_url, siteConfig, useDefaultCover]);

  // 图片加载错误时使用默认封面
  const handleImageError = useCallback(() => {
    if (!useDefaultCover) {
      setUseDefaultCover(true);
    }
    setImageLoaded(true);
  }, [useDefaultCover]);

  // 文章主色调
  const primaryColor = useMemo(() => {
    return article.primary_color || "var(--anzhiyu-main)";
  }, [article.primary_color]);

  // 分类标签文字颜色
  const categoryTextColor = useMemo(() => {
    return getContrastColor(primaryColor);
  }, [primaryColor]);

  // 价格显示（商品）
  const priceDisplay = useMemo(() => {
    if (!isProduct) return "";
    const { min_price, max_price } = article;
    if (!min_price) return "免费";
    const formatPrice = (price: number) => (price / 100).toFixed(2);
    if (!max_price || min_price === max_price) {
      return `¥${formatPrice(min_price)}`;
    }
    return `¥${formatPrice(min_price)} - ¥${formatPrice(max_price)}`;
  }, [isProduct, article]);

  // 点击跳转
  const handleClick = () => {
    const id = article.id;

    // 标记为已读
    if (typeof window !== "undefined") {
      const readArticlesStr = localStorage.getItem(READ_ARTICLES_KEY);
      let readArticles: string[] = [];
      if (readArticlesStr) {
        readArticles = JSON.parse(readArticlesStr);
      }
      if (!readArticles.includes(id)) {
        readArticles.push(id);
        localStorage.setItem(READ_ARTICLES_KEY, JSON.stringify(readArticles));
        setIsRead(true);
      }
    }

    // 根据类型跳转
    if (isProduct) {
      router.push(`/products/${id}`);
    } else if (article.is_doc) {
      router.push(`/doc/${id}`);
    } else {
      router.push(`/posts/${id}`);
    }
  };

  const goToCategoryPage = (e: React.MouseEvent, category: { name: string; slug?: string }) => {
    e.stopPropagation();
    router.push(`/categories/${category.slug || encodeURIComponent(category.name)}/`);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const goToTagPage = (e: React.MouseEvent, tag: { name: string; slug?: string }) => {
    e.stopPropagation();
    router.push(`/tags/${tag.slug || encodeURIComponent(tag.name)}/`);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  return (
    <div
      className={cn(styles.recentPostItem, isDoubleColumn && styles.doubleColumnItem, isProduct && styles.isProduct)}
      style={{ "--animation-order": animationOrder } as React.CSSProperties}
      onClick={handleClick}
    >
      {/* 封面 */}
      <div className={styles.postCover}>
        <div className={styles.coverWrapper} title={article.title}>
          <img
            className={cn(styles.postBg, styles.lazyLoading, imageLoaded && styles.lazyLoaded)}
            src={coverUrl}
            alt={article.title}
            onLoad={() => setImageLoaded(true)}
            onError={handleImageError}
          />
        </div>
      </div>

      {/* 内容 */}
      <div className={styles.recentPostInfo}>
        <div className={styles.recentPostInfoTop}>
          {/* 标签区域 */}
          {enablePrimaryColorTag ? (
            <div className={styles.recentPostInfoTopTips}>
              {/* 商品标签 */}
              {isProduct && (
                <span className={cn(styles.metaTag, styles.productTag)}>
                  <FaBagShopping className={styles.metaTagIcon} aria-hidden="true" />
                  <span>商品</span>
                </span>
              )}

              {/* 分类标签 */}
              {!isProduct &&
                article.post_categories?.map(category => (
                  <span
                    key={category.id}
                    className={cn(styles.metaTag, styles.categoryTag)}
                    style={{
                      backgroundColor: primaryColor,
                      color: categoryTextColor,
                    }}
                    onClick={e => goToCategoryPage(e, category)}
                  >
                    {category.name}
                  </span>
                ))}

              {/* 置顶标签 */}
              {!isProduct && article.pin_sort != null && article.pin_sort > 0 && (
                <span className={cn(styles.metaTag, styles.stickyTag)}>
                  <FaThumbtack className={styles.metaTagIcon} aria-hidden="true" />
                  <span>置顶</span>
                </span>
              )}

              {/* 多人互动标签 */}
              {!isProduct && article.comment_count != null && article.comment_count > 10 && (
                <span className={cn(styles.metaTag, styles.hotTag)}>
                  <FaFire className={styles.metaTagIcon} aria-hidden="true" />
                  <span>多人互动</span>
                </span>
              )}

              {/* 文档标签 */}
              {!isProduct && article.is_doc && (
                <span className={cn(styles.metaTag, styles.docTag)}>
                  <FaBook className={styles.metaTagIcon} aria-hidden="true" />
                  <span>文档</span>
                </span>
              )}

              {/* 最新标签 */}
              {isNewest && !isProduct && <span className={cn(styles.metaTag, styles.newestTag)}>最新</span>}

              {/* 未读标签 */}
              {!isRead && !isProduct && <span className={cn(styles.metaTag, styles.unreadTag)}>未读</span>}
            </div>
          ) : (
            <div className={cn(styles.recentPostInfoTopTips, styles.legacy)}>
              {/* 旧版标签样式 */}
              {isProduct && (
                <span className={styles.articleMeta}>
                  <FaBagShopping className={styles.metaTagIcon} aria-hidden="true" />
                  <span>商品</span>
                </span>
              )}

              {!isProduct && article.pin_sort != null && article.pin_sort > 0 && (
                <span className={cn(styles.articleMeta, styles.stickyWarp)}>
                  <FaThumbtack className={styles.metaTagIcon} aria-hidden="true" />
                  <span>置顶</span>
                </span>
              )}

              {!isProduct && article.comment_count != null && article.comment_count > 10 && (
                <span className={cn(styles.articleMeta, styles.hotInteractionWarp)}>
                  <FaFire className={styles.metaTagIcon} aria-hidden="true" />
                  <span>多人互动</span>
                </span>
              )}

              {!isProduct &&
                article.post_categories?.map(category => (
                  <span key={category.id} className={styles.categoryTip} onClick={e => goToCategoryPage(e, category)}>
                    {category.name}
                  </span>
                ))}

              {!isRead && !isProduct && <span className={styles.unvisitedPost}>未读</span>}
              {isNewest && !isProduct && <span className={styles.newPost}>最新</span>}
            </div>
          )}

          {/* 标题 */}
          <h2 className={styles.articleTitle} title={article.title}>
            {article.title}
          </h2>
        </div>

        {/* 底部信息 */}
        <div className={styles.articleMetaWrap}>
          {isProduct ? (
            <>
              <span className={styles.productPrice}>{priceDisplay}</span>
              {article.total_sales && <span className={styles.productSales}>已售 {article.total_sales}</span>}
            </>
          ) : (
            <>
              <span className={styles.tags}>
                {article.post_tags?.map(tag => (
                  <span key={tag.id} className={styles.articleMetaTags} onClick={e => goToTagPage(e, tag)}>
                    <FaHashtag className={styles.tagIcon} />
                    {tag.name}
                  </span>
                ))}
              </span>
              <span className={styles.postMetaDate}>
                <time dateTime={article.created_at}>{formatRelativeTime(article.created_at)}</time>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

// 显示名称用于 React DevTools
FeedArticleCard.displayName = "FeedArticleCard";
