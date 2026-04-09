"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { PanelLeftClose, Search, List, X } from "lucide-react";
import { setArticleMetaThemeColor, restoreMetaThemeColor } from "@/utils/theme-manager";
import { docSeriesApi } from "@/lib/api/doc-series";
import { usePageStore } from "@/store/page-store";
import { cn } from "@/lib/utils";
import type { Article } from "@/types/article";
import type { DocSeriesWithArticles, DocArticleItem } from "@/types/doc-series";
import { DocSidebar } from "./DocSidebar";
import { DocContent } from "./DocContent";
import { DocToc } from "./DocToc";
import styles from "./doc.module.css";

interface DocDetailContentProps {
  article: Article;
}

export function DocDetailContent({ article }: DocDetailContentProps) {
  const router = useRouter();
  const setPageTitle = usePageStore(state => state.setPageTitle);
  const clearPageTitle = usePageStore(state => state.clearPageTitle);

  const [docSeries, setDocSeries] = useState<DocSeriesWithArticles | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const originalPrimaryRef = useRef<string>("");

  const currentDocId = article.id;

  const activeDocSeries =
    docSeries && article.doc_series_id && String(docSeries.id) === String(article.doc_series_id) ? docSeries : null;

  useEffect(() => {
    const title = activeDocSeries?.name ? `${article.title} - ${activeDocSeries.name}` : article.title;
    setPageTitle(title);
    return () => {
      clearPageTitle();
    };
  }, [article.title, activeDocSeries?.name, setPageTitle, clearPageTitle]);

  useEffect(() => {
    if (article.primary_color) {
      originalPrimaryRef.current = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
      document.documentElement.style.setProperty("--primary", article.primary_color);
      document.documentElement.style.setProperty("--article-primary-color", article.primary_color);
      if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(article.primary_color)) {
        document.documentElement.style.setProperty("--primary-op", `${article.primary_color}23`);
        document.documentElement.style.setProperty("--primary-op-deep", `${article.primary_color}dd`);
        document.documentElement.style.setProperty("--primary-op-light", `${article.primary_color}0d`);
      }
      setArticleMetaThemeColor(article.primary_color);
    }
    return () => {
      if (originalPrimaryRef.current) {
        document.documentElement.style.setProperty("--primary", originalPrimaryRef.current);
      } else {
        document.documentElement.style.removeProperty("--primary");
      }
      document.documentElement.style.removeProperty("--article-primary-color");
      document.documentElement.style.removeProperty("--primary-op");
      document.documentElement.style.removeProperty("--primary-op-deep");
      document.documentElement.style.removeProperty("--primary-op-light");
      restoreMetaThemeColor();
    };
  }, [article.primary_color]);

  // 加载文档系列
  useEffect(() => {
    if (!article.doc_series_id) return;

    let cancelled = false;
    const fetchSeries = async () => {
      try {
        const data = await docSeriesApi.getPublicSeriesWithArticles(String(article.doc_series_id));
        if (!cancelled) setDocSeries(data);
      } catch (error) {
        console.error("获取文档系列失败:", error);
      }
    };
    fetchSeries();
    return () => {
      cancelled = true;
    };
  }, [article.doc_series_id]);

  // 上一篇/下一篇
  const prevDoc = useMemo<DocArticleItem | null>(() => {
    if (!activeDocSeries?.articles?.length) return null;
    const idx = activeDocSeries.articles.findIndex(doc => doc.id === currentDocId);
    return idx > 0 ? activeDocSeries.articles[idx - 1] : null;
  }, [activeDocSeries, currentDocId]);

  const nextDoc = useMemo<DocArticleItem | null>(() => {
    if (!activeDocSeries?.articles?.length) return null;
    const idx = activeDocSeries.articles.findIndex(doc => doc.id === currentDocId);
    return idx >= 0 && idx < activeDocSeries.articles.length - 1 ? activeDocSeries.articles[idx + 1] : null;
  }, [activeDocSeries, currentDocId]);

  const handleNavigateDoc = useCallback(
    (docId: string) => {
      setIsSidebarOpen(false);
      router.push(`/doc/${docId}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [router]
  );

  const openSearch = useCallback(() => {
    window.dispatchEvent(new CustomEvent("frontend-open-search"));
  }, []);

  return (
    <div className={styles.docPage}>
      <div className={styles.docTopFade} />

      {/* 移动端遮罩 */}
      <div
        className={cn(styles.mobileOverlay, isSidebarOpen && styles.isOpen)}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* PC 端折叠悬浮块 */}
      {isSidebarCollapsed && activeDocSeries && (
        <div className={styles.collapsedFloat}>
          <button className={styles.floatBtn} title="展开侧边栏" onClick={() => setIsSidebarCollapsed(false)}>
            <PanelLeftClose className="w-[18px] h-[18px]" />
          </button>
          <button className={styles.floatBtn} title="搜索" onClick={openSearch}>
            <Search className="w-[18px] h-[18px]" />
          </button>
        </div>
      )}

      <div className={cn(styles.docContainer, isSidebarCollapsed && styles.sidebarCollapsed)}>
        {/* 左侧导航栏 */}
        <aside
          className={cn(styles.sidebarLeft, isSidebarOpen && styles.isOpen, isSidebarCollapsed && styles.isCollapsed)}
        >
          <DocSidebar
            series={activeDocSeries}
            currentDocId={currentDocId}
            onNavigate={id => {
              handleNavigateDoc(id);
              setIsSidebarOpen(false);
            }}
            onCollapse={() => setIsSidebarCollapsed(true)}
          />
        </aside>

        {/* 中间内容区 */}
        <main className={styles.docMain}>
          <DocContent article={article} prevDoc={prevDoc} nextDoc={nextDoc} onNavigate={handleNavigateDoc} />
        </main>

        {/* 右侧目录 */}
        <aside className={styles.sidebarRight}>
          <DocToc contentHtml={article.content_html || ""} />
        </aside>
      </div>

      {/* 移动端侧边栏按钮 */}
      {activeDocSeries && (
        <button className={styles.mobileSidebarToggle} onClick={() => setIsSidebarOpen(prev => !prev)}>
          {isSidebarOpen ? <X className="w-5 h-5" /> : <List className="w-5 h-5" />}
        </button>
      )}
    </div>
  );
}
