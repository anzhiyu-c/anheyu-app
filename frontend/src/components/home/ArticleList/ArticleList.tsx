"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ArticleCard } from "./ArticleCard";
import { FadeInView, GlowingOrb } from "@/components/effects";
import { Button } from "@/components/ui";
import type { Article } from "@/types";

interface ArticleListProps {
  articles: Article[];
}

// 模拟文章数据
const mockArticles: Article[] = [
  {
    id: "1",
    title: "Next.js 16 新特性详解",
    slug: "nextjs-16-features",
    content: "",
    excerpt: "探索 Next.js 16 带来的新特性，包括异步路由参数、Cache Components 等。",
    cover: "https://picsum.photos/seed/1/800/450",
    author: {
      id: "1",
      email: "",
      username: "anzhiyu",
      nickname: "安知鱼",
      avatar: "",
      role: "admin",
      created_at: "",
      updated_at: "",
    },
    category: { id: "1", name: "技术", slug: "tech", description: "", cover: "", count: 10 },
    tags: [],
    views: 1234,
    likes: 56,
    comments_count: 12,
    is_published: true,
    is_top: false,
    created_at: "2026-01-20",
    updated_at: "2026-01-20",
    published_at: "2026-01-20",
  },
  {
    id: "2",
    title: "HeroUI 组件库使用指南",
    slug: "heroui-guide",
    content: "",
    excerpt: "学习如何使用 HeroUI 构建现代化的 React 应用界面。",
    cover: "https://picsum.photos/seed/2/800/450",
    author: {
      id: "1",
      email: "",
      username: "anzhiyu",
      nickname: "安知鱼",
      avatar: "",
      role: "admin",
      created_at: "",
      updated_at: "",
    },
    category: { id: "2", name: "教程", slug: "tutorial", description: "", cover: "", count: 8 },
    tags: [],
    views: 876,
    likes: 34,
    comments_count: 8,
    is_published: true,
    is_top: false,
    created_at: "2026-01-18",
    updated_at: "2026-01-18",
    published_at: "2026-01-18",
  },
  {
    id: "3",
    title: "Tailwind CSS v4 迁移指南",
    slug: "tailwind-v4-migration",
    content: "",
    excerpt: "从 Tailwind CSS v3 迁移到 v4 的完整指南，包括配置变化和新特性。",
    cover: "https://picsum.photos/seed/3/800/450",
    author: {
      id: "1",
      email: "",
      username: "anzhiyu",
      nickname: "安知鱼",
      avatar: "",
      role: "admin",
      created_at: "",
      updated_at: "",
    },
    category: { id: "1", name: "技术", slug: "tech", description: "", cover: "", count: 10 },
    tags: [],
    views: 654,
    likes: 28,
    comments_count: 5,
    is_published: true,
    is_top: false,
    created_at: "2026-01-15",
    updated_at: "2026-01-15",
    published_at: "2026-01-15",
  },
];

export function ArticleList({ articles }: ArticleListProps) {
  const displayArticles = articles.length > 0 ? articles : mockArticles;

  return (
    <section className="py-20 sm:py-28 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 bg-muted/30" />
      <div className="absolute inset-0 grid-pattern opacity-30" />

      {/* 发光效果 */}
      <GlowingOrb size={600} color="primary" className="absolute -top-1/4 -right-1/4 opacity-50" animate={false} />
      <GlowingOrb size={400} color="purple" className="absolute -bottom-1/4 -left-1/4 opacity-50" animate={false} />

      <div className="max-w-6xl mx-auto px-4 relative z-10">
        {/* 标题区域 */}
        <FadeInView className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12 sm:mb-16">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">最新文章</h2>
            <p className="text-muted-foreground text-lg">探索最新的技术文章和教程</p>
          </div>
          <Link href="/archives">
            <Button variant="ghost" className="group">
              查看全部
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </FadeInView>

        {/* 文章网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {displayArticles.map((article, index) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: index * 0.15,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              viewport={{ once: true, margin: "-50px" }}
            >
              <ArticleCard article={article} />
            </motion.div>
          ))}
        </div>

        {/* 底部装饰 */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          viewport={{ once: true }}
          className="mt-16 sm:mt-20 text-center"
        >
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-card border border-border">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-muted-foreground">持续更新中...</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
