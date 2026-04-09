/**
 * 文章详情页侧边栏组件
 * 包含：作者信息卡片、微信卡片、目录、系列文章、最近文章
 */
"use client";

import { useMemo } from "react";
import { AuthorInfoCard } from "@/components/home/Sidebar/AuthorInfoCard";
import { CardWechat } from "@/components/home/Sidebar/CardWechat";
import { CardClock } from "@/components/home/Sidebar/CardClock";
import { CustomSidebarBlocks } from "@/components/home/Sidebar/CustomSidebarBlocks";
import { CardToc } from "./CardToc";
import { CardSeriesPost } from "./CardSeriesPost";
import { CardRecentPost } from "./CardRecentPost";
import { useSiteConfigStore } from "@/store/site-config-store";
import type { Article, RecentArticle } from "@/types/article";
import styles from "./PostSidebar.module.css";

interface PostSidebarProps {
  article: Article;
  recentArticles?: RecentArticle[];
}

export function PostSidebar({ article, recentArticles = [] }: PostSidebarProps) {
  const siteConfig = useSiteConfigStore(state => state.siteConfig);

  // 提取系列分类
  const seriesCategory = useMemo(() => {
    if (!article.post_categories) return null;
    const found = article.post_categories.find(cat => cat.is_series);
    if (!found) return null;
    return {
      id: found.id,
      name: found.name,
      is_series: found.is_series || false,
    };
  }, [article.post_categories]);

  // 提取系列文章（从相关文章中筛选同系列的）
  const seriesArticles = useMemo(() => {
    if (!seriesCategory || !article.related_articles) return [];
    return article.related_articles.map(art => ({
      id: art.id,
      title: art.title,
      abbrlink: art.abbrlink || "",
      cover_url: art.cover_url,
      created_at: art.created_at,
    }));
  }, [seriesCategory, article.related_articles]);

  // 作者信息配置 - 从 sidebar.author 获取
  const authorInfoConfig = useMemo(() => {
    const author = siteConfig?.sidebar?.author;
    if (!author?.enable) return null;
    const owner = siteConfig?.frontDesk?.siteOwner;
    return {
      ownerName: owner?.name || "安知鱼",
      subTitle: siteConfig?.SUB_TITLE || "",
      description: author.description || "",
      userAvatar: siteConfig?.USER_AVATAR || "",
      statusImg: author.statusImg || "",
      skills: author.skills || [],
      social: author.social || {},
    };
  }, [siteConfig]);

  // 微信配置 - 从 sidebar.wechat 获取
  const wechatConfig = useMemo(() => {
    const wechat = siteConfig?.sidebar?.wechat;
    if (!wechat?.enable) return null;
    return {
      face: wechat.face || "",
      backFace: wechat.backFace || "",
      blurBackground: wechat.blurBackground || "",
      link: wechat.link,
    };
  }, [siteConfig]);

  // 天气时钟配置 - enable_page 为 "all" 或 "post" 时在文章页显示
  const clockConfig = useMemo(() => {
    const w = siteConfig?.sidebar?.weather;
    if (!w?.enable || !w.qweather_key) return null;
    const page = w.enable_page || "all";
    if (page !== "all" && page !== "post") return null;
    return {
      qweatherKey: w.qweather_key,
      qweatherAPIHost: w.qweather_api_host || "devapi.qweather.com",
      ipAPIKey: w.ip_api_key || "",
      loading: w.loading || "",
      defaultRectangle: w.default_rectangle === true || (w.default_rectangle as unknown) === "true",
      rectangle: w.rectangle || "112.6534116,27.96920845",
    };
  }, [siteConfig]);

  // 默认封面
  const defaultCover = siteConfig?.post?.default?.default_cover || "/images/default-cover.webp";

  const currentArticleId = article.id;

  const recentPostCount = useMemo(() => {
    const raw = siteConfig?.sidebar?.recentPost?.count;
    const parsed = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(parsed)) return 5;
    return Math.min(20, Math.max(1, Math.trunc(parsed)));
  }, [siteConfig]);

  return (
    <aside className={styles.postSidebar}>
      {/* 作者信息卡片 */}
      {authorInfoConfig && <AuthorInfoCard config={authorInfoConfig} />}

      {/* 微信卡片 */}
      {wechatConfig && <CardWechat config={wechatConfig} />}

      {/* 自定义侧边栏块 */}
      <CustomSidebarBlocks isPostPage />

      {/* 天气时钟 */}
      {clockConfig && <CardClock config={clockConfig} />}

      {/* 粘性区域 */}
      <div className={styles.stickyContainer}>
        {/* 系列文章 */}
        {seriesCategory && seriesArticles.length > 0 && (
          <CardSeriesPost
            seriesArticles={seriesArticles}
            seriesCategory={seriesCategory}
            currentArticleId={currentArticleId}
            defaultCover={defaultCover}
          />
        )}

        {/* 文章目录 */}
        {article.content_html && <CardToc contentHtml={article.content_html} />}

        {/* 最近发布 */}
        {siteConfig?.sidebar?.recentPost?.enable !== false &&
          siteConfig?.sidebar?.recentPost?.enable !== "false" &&
          recentArticles.length > 0 && (
            <CardRecentPost
              articles={recentArticles}
              currentArticleId={currentArticleId}
              defaultCover={defaultCover}
              maxCount={recentPostCount}
            />
          )}
      </div>
    </aside>
  );
}

// 导出子组件
export { CardToc } from "./CardToc";
export { CardSeriesPost } from "./CardSeriesPost";
export { CardRecentPost } from "./CardRecentPost";

export default PostSidebar;
