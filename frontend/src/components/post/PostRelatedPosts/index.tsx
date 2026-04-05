/**
 * 文章详情相关推荐组件
 * 显示“喜欢这篇文章的人也看了”推荐列表
 */
"use client";

import Link from "next/link";
import Image from "next/image";
import { FaStar } from "react-icons/fa6";
import type { ArticleLink } from "@/types/article";
import styles from "./PostRelatedPosts.module.css";

interface PostRelatedPostsProps {
  articles?: ArticleLink[] | null;
  currentArticleId?: string | number;
  defaultCover?: string;
}

function getArticleHref(link: ArticleLink): string {
  if (link.is_doc) {
    return `/doc/${link.id}`;
  }
  return `/posts/${link.abbrlink || link.id}`;
}

function getCoverUrl(link: ArticleLink, defaultCover: string): string {
  if (link.cover_url && link.cover_url.trim() !== "") {
    return link.cover_url;
  }
  return defaultCover;
}

export function PostRelatedPosts({
  articles,
  currentArticleId,
  defaultCover = "/images/default-cover.webp",
}: PostRelatedPostsProps) {
  if (!articles || articles.length === 0) {
    return null;
  }

  const relatedPosts = articles.filter(article => String(article.id) !== String(currentArticleId));
  if (relatedPosts.length === 0) {
    return null;
  }

  return (
    <section className={styles.relatedPosts} aria-label="喜欢这篇文章的人也看了">
      <div className={styles.headline}>
        <div className={styles.headlineLeft}>
          <FaStar className={styles.headlineIcon} />
          <h3 className={styles.headlineTitle}>喜欢这篇文章的人也看了</h3>
        </div>
        <Link href="/random-post" className={styles.randomLink}>
          随便逛逛
        </Link>
      </div>

      <div className={styles.list}>
        {relatedPosts.map(post => (
          <article key={post.id} className={styles.item}>
            <Link href={getArticleHref(post)} className={styles.itemLink} title={post.title}>
              <div className={styles.coverWrap}>
                <Image
                  src={getCoverUrl(post, defaultCover)}
                  alt={post.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 45vw"
                  className={styles.cover}
                />
              </div>
              <div className={styles.content}>
                <h4 className={styles.title}>{post.title}</h4>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

export default PostRelatedPosts;
