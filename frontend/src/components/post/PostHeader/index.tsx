/**
 * 文章头部组件
 * 包含封面图片、文章信息、波浪动画
 */
"use client";

import { useRef, useEffect, useState, useMemo, useSyncExternalStore, useCallback } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, useMotionTemplate } from "framer-motion";
import { Tooltip } from "@heroui/react";
import { FaHashtag, FaFileLines, FaClock, FaCalendarDays, FaFire, FaLocationDot } from "react-icons/fa6";
import { RiChat1Fill } from "react-icons/ri";
import { cn } from "@/lib/utils";
import { formatDate } from "@/utils/date";
import type { Article } from "@/types/article";
import styles from "./PostHeader.module.css";

interface PostHeaderProps {
  article: Article;
}

/**
 * 条件 Tooltip 包装器 - 只在客户端渲染 Tooltip
 */
function MetaTooltip({ content, children, mounted }: { content: string; children: React.ReactNode; mounted: boolean }) {
  if (!mounted) {
    return <>{children}</>;
  }
  return (
    <Tooltip content={content} placement="top" showArrow={false} delay={100} closeDelay={0}>
      {children}
    </Tooltip>
  );
}

/**
 * 波浪动画组件
 */
function WavesArea() {
  return (
    <section className={styles.wavesArea}>
      <svg
        className={styles.wavesSvg}
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        viewBox="0 24 150 28"
        preserveAspectRatio="none"
        shapeRendering="auto"
      >
        <defs>
          <path id="gentle-wave" d="M-160 44c30 0 58-18 88-18s58 18 88 18 58-18 88-18 58 18 88 18v44h-352Z" />
        </defs>
        <g className={styles.parallax}>
          <use href="#gentle-wave" x="48" y="0" />
          <use href="#gentle-wave" x="48" y="3" />
          <use href="#gentle-wave" x="48" y="5" />
          <use href="#gentle-wave" x="48" y="7" />
        </g>
      </svg>
    </section>
  );
}

export function PostHeader({ article }: PostHeaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>("");

  // 客户端挂载检测 - 使用 useSyncExternalStore 避免 hydration 问题
  const subscribeNoop = useCallback(() => () => {}, []);
  const getClientSnapshot = useCallback(() => true, []);
  const getServerSnapshot = useCallback(() => false, []);
  const mounted = useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot);

  // 滚动动画
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  // 桌面端缩放动画
  const infoScale = useTransform(scrollYProgress, [0, 1], [1, 0.8]);
  // 封面图的动画缩放值 (从 2 缩小到 0.5，与 anheyu-app 一致)
  const coverAnimScale = useTransform(scrollYProgress, [0, 1], [2, 0.5]);
  // 使用 useMotionTemplate 创建完整的 transform 字符串
  const coverTransform = useMotionTemplate`rotate(10deg) translateY(30%) scale(${coverAnimScale}) translateZ(0)`;

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // 文章类型
  const articleType = useMemo(() => {
    return article.is_reprint ? "转载" : "原创";
  }, [article.is_reprint]);

  // 封面图片 URL - 优先使用 top_img_url，其次 cover_url，最后使用默认封面
  const topCoverUrl = useMemo(() => {
    const url = article.top_img_url || article.cover_url;
    // 确保返回有效的 URL
    if (!url || url.trim() === "") {
      return "/images/default-cover.webp";
    }
    return url;
  }, [article.top_img_url, article.cover_url]);

  // 初始化图片源（用于 SSR）
  const currentImageSrc = imageSrc || topCoverUrl;

  // 当 topCoverUrl 变化时，重置图片加载状态
  useEffect(() => {
    if (topCoverUrl !== imageSrc) {
      setImageSrc(topCoverUrl);
      setIsImageLoaded(false);
    }
  }, [topCoverUrl, imageSrc]);

  // 检查图片是否已经加载完成（处理浏览器缓存的情况）
  useEffect(() => {
    const img = imageRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setIsImageLoaded(true);
    }
  }, [currentImageSrc]);

  // 图片加载错误时使用默认封面
  const handleImageError = () => {
    if (currentImageSrc !== "/images/default-cover.webp") {
      setImageSrc("/images/default-cover.webp");
    } else {
      // 默认封面也加载失败，直接显示背景色
      setIsImageLoaded(true);
    }
  };

  // 动态主题色 + 确保 position 非静态（Framer Motion useScroll 需要）
  const dynamicStyles = useMemo(() => {
    return {
      "--primary-color": article.primary_color || "var(--primary)",
      position: "relative" as const,
    } as React.CSSProperties;
  }, [article.primary_color]);

  // 滚动到评论区
  const scrollToComment = () => {
    const commentSection = document.getElementById("post-comment");
    if (commentSection) {
      const headerHeight = 80;
      const top = commentSection.getBoundingClientRect().top + window.pageYOffset - headerHeight;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <div ref={containerRef} className={styles.postHeaderContainer} style={dynamicStyles}>
      {/* 文章信息区域 - 外层处理滚动缩放，内层处理入场动画 */}
      <motion.div className={styles.postInfoWrapper} style={{ scale: isMobile ? 1 : infoScale }}>
        <motion.div
          className={styles.postInfo}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* 类型、分类、标签 */}
          <div className={styles.postFirstinfo}>
            <div className={styles.metaFirstlineTop}>
              {/* 文章类型 */}
              <span className={styles.postMetaOriginal}>{articleType}</span>

              {/* 分类 */}
              {article.post_categories.length > 0 && (
                <Link
                  href={`/categories/${
                    article.post_categories[0].slug || encodeURIComponent(article.post_categories[0].name)
                  }`}
                  className={styles.postMetaCategory}
                >
                  {article.post_categories[0].name}
                </Link>
              )}

              {/* 标签 */}
              {article.post_tags.length > 0 && (
                <div className={styles.tagShare}>
                  <div className={styles.postMetaTagList}>
                    {article.post_tags.map(tag => (
                      <Link
                        key={tag.id}
                        href={`/tags/${tag.slug || encodeURIComponent(tag.name)}`}
                        className={styles.postMetaTag}
                      >
                        <FaHashtag size={14} className={styles.tagIcon} />
                        <span className={styles.tagName}>{tag.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 标题 */}
          <h1 className={styles.postTitle}>{article.title}</h1>

          {/* 元信息 */}
          <div className={styles.postMeta}>
            <div className={styles.metaSecondline}>
              {/* 字数 */}
              <MetaTooltip content="字数总计" mounted={mounted}>
                <span className={styles.metaItem}>
                  <FaFileLines size={14} className={styles.metaIcon} />
                  <span>{article.word_count}</span>
                </span>
              </MetaTooltip>

              <span className={styles.metaSeparator} />

              {/* 阅读时长 */}
              <MetaTooltip content={`预计阅读时长${article.reading_time}分钟`} mounted={mounted}>
                <span className={styles.metaItem}>
                  <FaClock size={14} className={styles.metaIcon} />
                  <span>{article.reading_time}分钟</span>
                </span>
              </MetaTooltip>

              <span className={styles.metaSeparator} />

              {/* 发布日期 */}
              <MetaTooltip content="文章发布日期" mounted={mounted}>
                <span className={styles.metaItem}>
                  <FaCalendarDays size={14} className={styles.metaIcon} />
                  <time dateTime={article.created_at}>{formatDate(article.created_at)}</time>
                </span>
              </MetaTooltip>

              <span className={styles.metaSeparator} />

              {/* 浏览量/热度 */}
              <MetaTooltip content="热度" mounted={mounted}>
                <span className={styles.metaItem}>
                  <FaFire size={14} className={styles.metaIcon} />
                  <span>{article.view_count}</span>
                </span>
              </MetaTooltip>

              {/* IP 属地 */}
              {article.ip_location && (
                <>
                  <span className={styles.metaSeparator} />
                  <MetaTooltip content="作者IP属地" mounted={mounted}>
                    <span className={styles.metaItem}>
                      <FaLocationDot size={14} className={styles.metaIcon} />
                      <span>{article.ip_location}</span>
                    </span>
                  </MetaTooltip>
                </>
              )}

              {/* 评论数 */}
              {article.comment_count !== undefined && (
                <>
                  <span className={styles.metaSeparator} />
                  <MetaTooltip content="评论数" mounted={mounted}>
                    <span className={cn(styles.metaItem, styles.metaClickable)} onClick={scrollToComment}>
                      <RiChat1Fill size={18} className={styles.metaIcon} />
                      <span>{article.comment_count}</span>
                    </span>
                  </MetaTooltip>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* 封面图片 */}
      <motion.div className={styles.postTopCover} style={isMobile ? undefined : { transform: coverTransform }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src={currentImageSrc}
          alt={article.title}
          className={cn(styles.postTopBg, isImageLoaded && styles.isLoaded)}
          onLoad={() => setIsImageLoaded(true)}
          onError={handleImageError}
        />
      </motion.div>

      {/* 波浪动画 - 仅桌面端显示 */}
      {!isMobile && <WavesArea />}
    </div>
  );
}

export default PostHeader;
