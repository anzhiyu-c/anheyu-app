"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { addToast } from "@heroui/react";
import { Header, Footer } from "@/components/layout";
import { BannerCard } from "@/components/common/BannerCard";
import { CommentSection } from "@/components/post/Comment";
import { albumPublicApi } from "@/lib/api/album-public";
import { useSiteConfigStore } from "@/store/site-config-store";
import type { AlbumSortOrder, AlbumStatType, PublicAlbumCategory, PublicAlbumItem } from "@/types/album";
import { parseAlbumConfig } from "../_utils/album-config";
import { buildAlbumFilterQuery, parseAlbumFilterQuery } from "../_utils/album-filter-query";
import { AlbumHeader } from "./AlbumHeader";
import { AlbumList } from "./AlbumList";
import "../_styles/album.scss";

export function AlbumPageClient() {
  const { theme, setTheme } = useTheme();
  const siteConfig = useSiteConfigStore(state => state.siteConfig);

  const [sortOrder, setSortOrder] = useState<AlbumSortOrder>("display_order_asc");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<PublicAlbumItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [categories, setCategories] = useState<PublicAlbumCategory[]>([]);
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [categoryFetchSuccess, setCategoryFetchSuccess] = useState(false);

  const albumConfig = useMemo(() => parseAlbumConfig(siteConfig), [siteConfig]);
  const isGridLayout = albumConfig.layoutMode === "grid";

  const previousBodyBgRef = useRef("");
  const previousHtmlBgRef = useRef("");
  const previousThemeRef = useRef<string | undefined>(undefined);

  // 网格模式下强制暗色模式，离开时恢复
  useEffect(() => {
    if (!isGridLayout) return;
    previousThemeRef.current = theme;
    if (theme !== "dark") {
      setTheme("dark");
    }
    return () => {
      if (previousThemeRef.current && previousThemeRef.current !== "dark") {
        setTheme(previousThemeRef.current);
      }
    };
  }, [isGridLayout]); // eslint-disable-line react-hooks/exhaustive-deps

  const siteName = siteConfig?.APP_NAME || "安和鱼";
  const siteLogo = siteConfig?.USER_AVATAR || "https://npm.elemecdn.com/anzhiyu-blog-static@1.0.4/img/avatar.jpg";
  const aboutLink = siteConfig?.["album.about_link"] || siteConfig?.ABOUT_LINK || "#";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!isGridLayout) {
      setFiltersInitialized(true);
      return;
    }

    const parsed = parseAlbumFilterQuery(window.location.search);
    setSortOrder(parsed.sort);
    setCategoryId(parsed.categoryId);
    setCurrentPage(1);
    setFiltersInitialized(true);
  }, [isGridLayout]);

  const fetchAlbums = useCallback(async () => {
    setIsLoading(true);

    try {
      const data = await albumPublicApi.getPublicAlbums({
        page: currentPage,
        pageSize: albumConfig.pageSize,
        sort: sortOrder,
        categoryId,
      });

      setItems(data.list || []);
      setTotalItems(data.total || 0);
    } catch (error) {
      setItems([]);
      setTotalItems(0);
      addToast({
        title: "加载失败",
        description: error instanceof Error ? error.message : "相册列表加载失败",
        color: "danger",
      });
    } finally {
      setIsLoading(false);
    }
  }, [albumConfig.pageSize, categoryId, currentPage, sortOrder]);

  const fetchCategories = useCallback(async () => {
    if (!isGridLayout) {
      setCategories([]);
      setCategoryFetchSuccess(false);
      return;
    }

    try {
      const data = await albumPublicApi.getPublicAlbumCategories();
      setCategories(data || []);
      setCategoryFetchSuccess(true);
    } catch {
      setCategories([]);
      setCategoryFetchSuccess(false);
    }
  }, [isGridLayout]);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (isGridLayout && !filtersInitialized) {
      return;
    }

    void fetchAlbums();
  }, [fetchAlbums, filtersInitialized, isGridLayout]);

  useEffect(() => {
    if (!isGridLayout || !filtersInitialized || typeof window === "undefined") {
      return;
    }

    const nextQuery = buildAlbumFilterQuery(window.location.search, {
      categoryId,
      sort: sortOrder,
    });
    const nextUrl = `${window.location.pathname}${nextQuery}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [categoryId, filtersInitialized, isGridLayout, sortOrder]);

  useEffect(() => {
    if (!isGridLayout || !filtersInitialized || typeof window === "undefined") {
      return;
    }

    const handlePopState = () => {
      const parsed = parseAlbumFilterQuery(window.location.search);
      setSortOrder(parsed.sort);
      setCategoryId(parsed.categoryId);
      setCurrentPage(1);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [filtersInitialized, isGridLayout]);

  useEffect(() => {
    if (!isGridLayout || !categoryFetchSuccess || categoryId === null) {
      return;
    }

    const categoryExists = categories.some(category => category.id === categoryId);
    if (categoryExists) {
      return;
    }

    setCategoryId(null);
    setCurrentPage(1);
  }, [categories, categoryFetchSuccess, categoryId, isGridLayout]);

  useEffect(() => {
    if (albumConfig.layoutMode !== "waterfall") {
      return;
    }

    previousBodyBgRef.current = document.body.style.backgroundColor;
    previousHtmlBgRef.current = document.documentElement.style.backgroundColor;

    document.body.style.backgroundColor = "var(--anzhiyu-background)";
    document.documentElement.style.backgroundColor = "var(--anzhiyu-background)";

    return () => {
      document.body.style.backgroundColor = previousBodyBgRef.current;
      document.documentElement.style.backgroundColor = previousHtmlBgRef.current;
    };
  }, [albumConfig.layoutMode]);

  const handleSortChange = useCallback((nextSort: AlbumSortOrder) => {
    setSortOrder(nextSort);
    setCurrentPage(1);
  }, []);

  const handleCategoryChange = useCallback((nextCategoryId: number | null) => {
    setCategoryId(nextCategoryId);
    setCurrentPage(1);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleUpdateStat = useCallback(async (item: PublicAlbumItem, type: AlbumStatType) => {
    if (!item.id) {
      return;
    }

    await albumPublicApi.updatePublicAlbumStat(item.id, type);

    setItems(prev =>
      prev.map(current => {
        if (current.id !== item.id) {
          return current;
        }

        if (type === "view") {
          return {
            ...current,
            viewCount: (current.viewCount ?? 0) + 1,
          };
        }

        return {
          ...current,
          downloadCount: (current.downloadCount ?? 0) + 1,
        };
      })
    );
  }, []);

  if (albumConfig.layoutMode === "waterfall") {
    return (
      <div className="album-waterfall-layout">
        <Header />

        <main className="album-main">
          <div className="album-content">
            {albumConfig.banner.title || albumConfig.banner.background ? (
              <div className="album-banner">
                <BannerCard
                  tips={albumConfig.banner.tip}
                  title={albumConfig.banner.title}
                  description={albumConfig.banner.description}
                  backgroundImage={albumConfig.banner.background}
                  height={300}
                />
              </div>
            ) : null}

            <AlbumList
              layoutMode={albumConfig.layoutMode}
              items={items}
              totalItems={totalItems}
              currentPage={currentPage}
              pageSize={albumConfig.pageSize}
              isLoading={isLoading}
              enableComment={albumConfig.enableComment}
              waterfallConfig={albumConfig.waterfall}
              siteName={siteName}
              onPageChange={handlePageChange}
              onUpdateStat={handleUpdateStat}
            />
          </div>

          {albumConfig.enableComment ? (
            <div className="album-comment-section">
              <CommentSection targetTitle="相册" targetPath="/album" />
            </div>
          ) : null}
        </main>

        <Footer />
      </div>
    );
  }

  return (
    <div className="album-grid-layout">
      <AlbumHeader
        siteName={siteName}
        siteLogo={siteLogo}
        aboutLink={aboutLink}
        icpNumber={siteConfig?.ICP_NUMBER}
        policeRecordNumber={siteConfig?.POLICE_RECORD_NUMBER}
        policeRecordIcon={siteConfig?.POLICE_RECORD_ICON}
        categories={categories}
        sortOrder={sortOrder}
        categoryId={categoryId}
        onSortChange={handleSortChange}
        onCategoryChange={handleCategoryChange}
      />

      <AlbumList
        layoutMode={albumConfig.layoutMode}
        items={items}
        totalItems={totalItems}
        currentPage={currentPage}
        pageSize={albumConfig.pageSize}
        isLoading={isLoading}
        enableComment={albumConfig.enableComment}
        waterfallConfig={albumConfig.waterfall}
        siteName={siteName}
        onPageChange={handlePageChange}
        onUpdateStat={handleUpdateStat}
      />

      {albumConfig.enableComment ? (
        <div className="album-comment-section">
          <CommentSection targetTitle="相册" targetPath="/album" />
        </div>
      ) : null}
    </div>
  );
}
