"use client";

import { use } from "react";
import { ArticleEditorPage } from "@/components/admin/article-editor/ArticleEditorPage";

/**
 * 编辑文章页面（全屏编辑器，覆盖 admin 侧边栏）
 * 路由: /admin/post-management/[id]/edit
 */
export default function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="fixed inset-0 z-[60] bg-background">
      <ArticleEditorPage articleId={id} />
    </div>
  );
}
