"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CategoryBar, Sidebar } from "@/components/home";
import { FilteredArticleList } from "@/components/articles";
import { useSiteConfigStore } from "@/store/site-config-store";

interface CategoryDetailPageContentProps {
  categoryName: string;
  page?: number;
}

export function CategoryDetailPageContent({
  categoryName: initialCategoryName,
  page = 1,
}: CategoryDetailPageContentProps) {
  const router = useRouter();
  const [currentCategory, setCurrentCategory] = useState(initialCategoryName);
  const [currentPage, setCurrentPage] = useState(page);
  const siteTitle = useSiteConfigStore(state => state.siteConfig.APP_NAME || "AnHeYu");

  const buildCategoryPath = useCallback((categoryIdentifier: string, pageNumber: number) => {
    const encoded = encodeURIComponent(categoryIdentifier);
    if (pageNumber <= 1) {
      return `/categories/${encoded}/`;
    }
    return `/categories/${encoded}/page/${pageNumber}`;
  }, []);

  const handleCategoryChange = useCallback(
    (categoryName: string | null) => {
      if (categoryName === null) {
        // 点击首页，导航到首页
        router.push("/");
        return;
      }
      setCurrentCategory(categoryName);
      setCurrentPage(1);
      // 直接更新浏览器 URL，不触发 Next.js 路由系统（避免组件重新挂载和动画重播）
      window.history.replaceState(null, "", buildCategoryPath(categoryName, 1));
      // 滚动到顶部
      window.scrollTo({ top: 0 });
    },
    [buildCategoryPath, router]
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      setCurrentPage(nextPage);
      window.history.replaceState(null, "", buildCategoryPath(currentCategory, nextPage));
    },
    [buildCategoryPath, currentCategory]
  );

  useEffect(() => {
    document.title = `分类 - ${currentCategory} | ${siteTitle}`;
  }, [currentCategory, siteTitle]);

  useEffect(() => {
    const handlePopState = () => {
      const parts = window.location.pathname.split("/").filter(Boolean);
      if (parts[0] !== "categories" || !parts[1]) return;
      const nextCategory = decodeURIComponent(parts[1]);
      let nextPage = 1;
      if (parts[2] === "page" && parts[3]) {
        const parsed = Number(parts[3]);
        if (!Number.isNaN(parsed) && parsed > 0) {
          nextPage = parsed;
        }
      }
      setCurrentCategory(nextCategory);
      setCurrentPage(nextPage);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <div className="content-inner">
      <div className="main-content">
        <CategoryBar selectedCategory={currentCategory} onCategoryChange={handleCategoryChange} />
        <FilteredArticleList
          filterType="category"
          filterValue={currentCategory}
          page={currentPage}
          onPageChange={handlePageChange}
        />
      </div>
      <Sidebar />
    </div>
  );
}
