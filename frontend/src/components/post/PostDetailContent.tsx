/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-02-01 18:48:54
 * @LastEditTime: 2026-02-02 19:31:13
 * @LastEditors: 安知鱼
 */
/**
 * 文章详情内容组件
 * 客户端组件，负责渲染文章详情的完整内容
 */
"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { FaHashtag } from "react-icons/fa6";
import { PostHeader } from "./PostHeader";
import { ArticleLeadSummary } from "./ArticleLeadSummary";
import { PostContent } from "./PostContent";
import { PostCopyright } from "./PostCopyright";
import { PostRelatedPosts } from "./PostRelatedPosts";
import { PostPagination } from "./PostPagination";
import { PostPaginationFloat } from "./PostPaginationFloat";
import { CommentSection } from "./Comment";
import { CommentBarrage } from "./CommentBarrage";
import { PostSidebar } from "./Sidebar";
import { useShallow } from "zustand/shallow";
import { useSiteConfigStore } from "@/store/site-config-store";
import { useUiStore } from "@/store/ui-store";
import { usePageStore } from "@/store/page-store";
import { setArticleMetaThemeColor, restoreMetaThemeColor } from "@/utils/theme-manager";
import type { Article, RecentArticle } from "@/types/article";
import styles from "./PostDetail.module.css";

interface PostDetailContentProps {
  article: Article;
  recentArticles?: RecentArticle[];
}

function buildArticleContentWithCustomJS(contentHTML: string, customJS?: string): string {
  if (!customJS || customJS.trim() === "") {
    return contentHTML;
  }
  const escapedCustomJS = customJS.replace(/<\/script/gi, "<\\/script");
  return `${contentHTML}\n<script data-article-custom-js="true">\n${escapedCustomJS}\n</script>`;
}

export function PostDetailContent({ article, recentArticles = [] }: PostDetailContentProps) {
  const commentConfig = useSiteConfigStore(useShallow(state => state.siteConfig?.comment));
  const appName = useSiteConfigStore(state => state.siteConfig?.APP_NAME);
  const siteOwnerName = useSiteConfigStore(state => state.siteConfig?.frontDesk?.siteOwner?.name);
  const postDefaultCover = useSiteConfigStore(state => state.siteConfig?.post?.default?.default_cover);
  const articleShowRelated = useSiteConfigStore(state => state.siteConfig?.article?.showRelated);
  const gravatarUrl = useSiteConfigStore(state => state.siteConfig?.GRAVATAR_URL);
  const defaultGravatarType = useSiteConfigStore(state => state.siteConfig?.DEFAULT_GRAVATAR_TYPE);
  const setPageTitle = usePageStore(state => state.setPageTitle);
  const isCommentBarrageVisible = useUiStore(state => state.isCommentBarrageVisible);
  const isCommentEnabled =
    commentConfig?.enable === undefined || commentConfig?.enable === true || commentConfig?.enable === "true";
  const isCommentBarrageEnabledBySite =
    commentConfig?.barrage_enable === undefined ||
    commentConfig?.barrage_enable === true ||
    commentConfig?.barrage_enable === "true";
  const clearPageTitle = usePageStore(state => state.clearPageTitle);

  // 进入文章页面时立即跳到顶部（不带缓动）
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [article.id]);

  // 设置文章标题到 Header
  useEffect(() => {
    setPageTitle(article.title);
    return () => {
      clearPageTitle();
    };
  }, [article.title, setPageTitle, clearPageTitle]);

  // 保存原始主题色
  const originalPrimaryRef = useRef<string>("");

  // 设置文章主题色（如果有）- 全局设置 --primary 并更新 meta theme-color
  useEffect(() => {
    if (article.primary_color) {
      // 保存原始主题色
      originalPrimaryRef.current = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();

      // 设置全局主题色
      document.documentElement.style.setProperty("--primary", article.primary_color);
      document.documentElement.style.setProperty("--article-primary-color", article.primary_color);

      // 简单判断是否为 HEX 颜色以添加透明度变体
      if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(article.primary_color)) {
        document.documentElement.style.setProperty("--primary-op", `${article.primary_color}23`);
        document.documentElement.style.setProperty("--primary-op-deep", `${article.primary_color}dd`);
        document.documentElement.style.setProperty("--primary-op-light", `${article.primary_color}0d`);
      }

      // 更新浏览器 meta theme-color
      setArticleMetaThemeColor(article.primary_color);
    }

    return () => {
      // 恢复原始主题色
      if (originalPrimaryRef.current) {
        document.documentElement.style.setProperty("--primary", originalPrimaryRef.current);
      } else {
        document.documentElement.style.removeProperty("--primary");
      }
      document.documentElement.style.removeProperty("--article-primary-color");
      document.documentElement.style.removeProperty("--primary-op");
      document.documentElement.style.removeProperty("--primary-op-deep");
      document.documentElement.style.removeProperty("--primary-op-light");

      // 恢复默认 meta theme-color
      restoreMetaThemeColor();
    };
  }, [article.primary_color]);

  const siteName = appName || "安知鱼";
  const ownerName = siteOwnerName || "安知鱼";
  const defaultCover = postDefaultCover || "/images/default-cover.webp";
  const customJS = article.extra_config?.custom_js;
  const hasCustomJS = !!customJS && customJS.trim() !== "";
  const isRelatedEnabled = articleShowRelated !== false && articleShowRelated !== "false";
  const contentWithCustomJS = useMemo(
    () => buildArticleContentWithCustomJS(article.content_html, customJS),
    [article.content_html, customJS]
  );

  return (
    <div className={styles.postDetailContainer}>
      {/* 文章头部 */}
      <PostHeader article={article} />

      {/* 主内容区域 */}
      <div className={styles.layout}>
        <main className={styles.postContentInner}>
          <div className={styles.postDetailContent}>
            {/* 文章摘要 */}
            <ArticleLeadSummary article={article} />

            {/* 文章内容 */}
            <PostContent
              content={contentWithCustomJS}
              enableScripts={hasCustomJS}
              articleInfo={{
                isReprint: article.is_reprint,
                copyrightAuthor: article.copyright_author,
                copyrightUrl: article.copyright_url,
              }}
            />

            {/* 版权信息 */}
            <PostCopyright article={article} />

            {/* 版权下方标签（仅左侧标签集合，无右侧入口） */}
            {article.post_tags.length > 0 && (
              <div className={styles.postTagBar} aria-label="文章标签">
                {article.post_tags.map(tag => (
                  <Link
                    key={tag.id}
                    href={`/tags/${tag.slug || encodeURIComponent(tag.name)}`}
                    className={styles.postTagItem}
                  >
                    <FaHashtag className={styles.postTagIcon} aria-hidden="true" />
                    <span className={styles.postTagName}>{tag.name}</span>
                    <span className={styles.postTagCount}>{tag.count}</span>
                  </Link>
                ))}
              </div>
            )}

            {/* 喜欢这篇文章的人也看了（版权后、评论前） */}
            {isRelatedEnabled && (
              <PostRelatedPosts
                articles={article.related_articles}
                currentArticleId={article.id}
                defaultCover={defaultCover}
              />
            )}

            {/* 上一篇/下一篇（屏宽 < 1400px 时在版权下方显示） */}
            <div className={styles.paginationInlineWrap}>
              <PostPagination prevArticle={article.prev_article} nextArticle={article.next_article} />
            </div>

            {/* 评论区 */}
            <CommentSection targetTitle={article.title} className={styles.commentSection} />
          </div>
        </main>

        {/* 文章详情侧边栏 */}
        <PostSidebar article={article} recentArticles={recentArticles} />
      </div>

      {/* 底部栏 */}
      <div className={styles.footerBar}>
        <div className={styles.footerLogo}>{siteName}</div>
        <div className={styles.footerDescription}>来自 {ownerName} 最新设计与科技的文章</div>
        <Link href="/archives" className={styles.footerLink}>
          查看全部
        </Link>
      </div>

      {/* 右下角：上一篇/下一篇浮动卡片 + 热评弹幕（受系统设置与用户开关双重控制） */}
      <PostPaginationFloat
        prevArticle={article.prev_article}
        nextArticle={article.next_article}
        commentBarrageEnabled={
          isCommentEnabled && isCommentBarrageEnabledBySite && isCommentBarrageVisible
        }
      />
      {isCommentEnabled && isCommentBarrageEnabledBySite && isCommentBarrageVisible && (
        <CommentBarrage
          gravatarUrl={gravatarUrl || "https://cravatar.cn/"}
          defaultGravatarType={defaultGravatarType || "mp"}
          masterTag={commentConfig?.master_tag || "博主"}
        />
      )}
    </div>
  );
}

export default PostDetailContent;
