/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-02-27 18:23:29
 * @LastEditTime: 2026-02-27 18:27:39
 * @LastEditors: 安知鱼
 */
"use client";

import { use } from "react";
import { PageEditorPage } from "@/components/admin/page-editor/PageEditorPage";

export default function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="fixed inset-0 z-60 bg-background">
      <PageEditorPage pageId={Number(id)} />
    </div>
  );
}
