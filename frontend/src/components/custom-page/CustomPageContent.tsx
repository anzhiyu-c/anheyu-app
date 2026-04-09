/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-02-27 18:25:19
 * @LastEditTime: 2026-02-28 11:18:29
 * @LastEditors: 安知鱼
 */
"use client";

import { useEffect, useRef } from "react";
import { PostContent } from "@/components/post/PostContent";
import { CommentSection } from "@/components/post/Comment/CommentSection";
import type { CustomPage } from "@/types/page-management";

interface CustomPageContentProps {
  page: CustomPage;
}

export function CustomPageContent({ page }: CustomPageContentProps) {
  const customCSS = page.custom_css?.trim();
  const customJS = page.custom_js?.trim();
  const articleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!customJS || !articleRef.current) return;

    const exec = () => {
      try {
        new Function(customJS)();
      } catch (e) {
        console.error("[CustomPage] custom_js execution error:", e);
      }
    };

    exec();

    const postContentEl = articleRef.current.querySelector("[data-post-content]");
    if (!postContentEl) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        observer.disconnect();
        exec();
        reconnectTimer = setTimeout(() => {
          observer.observe(postContentEl, { childList: true, subtree: true });
        }, 300);
      }, 50);
    });

    const startTimer = setTimeout(() => {
      observer.observe(postContentEl, { childList: true, subtree: true });
    }, 500);

    return () => {
      observer.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearTimeout(startTimer);
    };
  }, [customJS]);

  return (
    <div className="w-full max-w-[1400px] mx-auto px-6 py-8">
      {customCSS ? <style data-custom-page-style={page.path} dangerouslySetInnerHTML={{ __html: customCSS }} /> : null}

      {/* 仅明确为草稿时展示标题区（预览）；已发布或缺省 is_published 时不展示，避免接口异常时重复标题 */}
      {page.is_published === false ? (
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">{page.title}</h1>
          {page.description ? <p className="mt-2 text-muted-foreground">{page.description}</p> : null}
        </header>
      ) : null}

      <article ref={articleRef} className="min-h-[200px]">
        <PostContent content={page.content} enableScripts />
      </article>

      {page.show_comment && (
        <div className="mt-12 border-t border-border/40 pt-8">
          <CommentSection targetTitle={page.title} targetPath={page.path} />
        </div>
      )}
    </div>
  );
}
