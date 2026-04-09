"use client";

import { ArticleEditorPage } from "@/components/admin/article-editor/ArticleEditorPage";

/**
 * 新增文章页面（全屏编辑器，覆盖 admin 侧边栏）
 * 路由: /admin/post-management/new
 */
export default function NewArticlePage() {
  return (
    <div className="fixed inset-0 z-[60] bg-background">
      <ArticleEditorPage />
    </div>
  );
}
