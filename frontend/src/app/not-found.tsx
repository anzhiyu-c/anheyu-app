/*
 * @Description: 404 页面 - 复刻 anheyu-app 设计
 * @Author: 安知鱼
 * @Date: 2026-02-03
 */
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Home } from "lucide-react";
import { useSiteConfigStore } from "@/store/site-config-store";
import { articleApi } from "@/lib/api/article";
import { formatRelativeTime } from "@/utils/date";
import type { FeedItem } from "@/types/article";
import styles from "./not-found.module.css";

// 默认封面图
const FALLBACK_COVER = "/images/default-cover.webp";

// 默认 404 页面图片
const DEFAULT_404_IMAGE = "/static/img/background-effect.gif";

export default function NotFound() {
  const router = useRouter();
  const siteConfig = useSiteConfigStore(state => state.siteConfig);
  const [randomArticles, setRandomArticles] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 从配置中获取默认封面
  const defaultCover = useMemo(() => {
    return siteConfig?.post?.default?.default_cover || FALLBACK_COVER;
  }, [siteConfig]);

  // 从配置中获取 404 页面图片
  const error404Image = useMemo(() => {
    return siteConfig?.post?.page404?.default_image || DEFAULT_404_IMAGE;
  }, [siteConfig]);

  // 获取随机文章列表
  const fetchRandomArticles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await articleApi.getFeedList({
        page: 1,
        pageSize: 6,
      });
      if (response.list) {
        setRandomArticles(response.list);
      }
    } catch (error) {
      console.error("获取文章列表失败:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRandomArticles();
  }, [fetchRandomArticles]);

  // 跳转到文章
  const goToArticle = useCallback(
    (article: FeedItem) => {
      // 如果是文档类型，跳转到文档详情页
      if (article.is_doc) {
        router.push(`/doc/${article.id}`);
      } else {
        router.push(`/posts/${article.id}`);
      }
    },
    [router]
  );

  return (
    <div className={styles.errorPage}>
      <div className={styles.errorBox}>
        <div className={styles.errorWrap}>
          <div className={styles.errorContent}>
            {/* 错误图片 */}
            <div
              className={styles.errorImg}
              style={{
                backgroundImage: `url(${error404Image})`,
              }}
            />

            {/* 错误信息 */}
            <div className={styles.errorInfo}>
              <h1 className={styles.errorTitle}>404</h1>
              <div className={styles.errorSubtitle}>请尝试站内搜索寻找文章</div>
              <Link href="/" className={styles.buttonAnimated}>
                <Home size={18} />
                回到主页
              </Link>
            </div>
          </div>
        </div>

        {/* 随机文章列表 */}
        <div className={styles.asideList}>
          <div className={styles.asideListGroup}>
            {loading ? (
              <div className={styles.loadingContainer}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className={styles.loadingItem}>
                    <div className={styles.loadingThumbnail} />
                    <div className={styles.loadingContent}>
                      <div className={styles.loadingTitle} />
                      <div className={styles.loadingDate} />
                    </div>
                  </div>
                ))}
              </div>
            ) : randomArticles.length > 0 ? (
              randomArticles.map(article => (
                <div key={article.id} className={styles.asideListItem} onClick={() => goToArticle(article)}>
                  <div className={styles.thumbnail}>
                    <Image
                      src={article.cover_url || defaultCover}
                      alt={article.title}
                      width={100}
                      height={100}
                      style={{ objectFit: "cover" }}
                      onError={e => {
                        const target = e.target as HTMLImageElement;
                        target.src = defaultCover;
                      }}
                    />
                  </div>
                  <div className={styles.content}>
                    <div className={styles.title} title={article.title}>
                      {article.title}
                    </div>
                    {article.created_at && (
                      <time
                        className={styles.time}
                        dateTime={article.created_at}
                        title={`发表于 ${formatRelativeTime(article.created_at)}`}
                      >
                        {formatRelativeTime(article.created_at)}
                      </time>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.noData}>暂无文章</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
