"use client";

import { PageEditorPage } from "@/components/admin/page-editor/PageEditorPage";

export default function NewPagePage() {
  return (
    <div className="fixed inset-0 z-60 bg-background">
      <PageEditorPage />
    </div>
  );
}
