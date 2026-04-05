/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-02-08 10:35:50
 * @LastEditTime: 2026-02-08 10:46:30
 * @LastEditors: 安知鱼
 */
"use client";

import { use } from "react";
import { ArticleHistoryPage } from "@/components/admin/article-editor/ArticleHistoryPage";

/**
 * 文章历史版本页面（全屏，覆盖 admin 侧边栏）
 * 路由: /admin/post-management/[id]/history
 */
export default function ArticleHistoryRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="fixed inset-0 z-100 bg-background">
      <ArticleHistoryPage articleId={id} />
    </div>
  );
}
