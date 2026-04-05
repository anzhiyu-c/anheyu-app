"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AlbumSortOrder, PublicAlbumCategory } from "@/types/album";

interface AlbumHeaderProps {
  siteName: string;
  siteLogo: string;
  aboutLink: string;
  icpNumber?: string;
  policeRecordNumber?: string;
  policeRecordIcon?: string;
  categories: PublicAlbumCategory[];
  sortOrder: AlbumSortOrder;
  categoryId: number | null;
  onSortChange: (sort: AlbumSortOrder) => void;
  onCategoryChange: (categoryId: number | null) => void;
}

export function AlbumHeader({
  siteName,
  siteLogo,
  aboutLink,
  icpNumber,
  policeRecordNumber,
  policeRecordIcon,
  categories,
  sortOrder,
  categoryId,
  onSortChange,
  onCategoryChange,
}: AlbumHeaderProps) {
  const [activeDropdown, setActiveDropdown] = useState<"category" | "sort" | null>(null);
  const currentCategoryName =
    categoryId === null ? "全部" : (categories.find(category => category.id === categoryId)?.name ?? "全部");
  const currentSortLabel =
    sortOrder === "created_at_desc" ? "最新发布" : sortOrder === "view_count_desc" ? "热度排序" : "默认排序";

  const closeDropdowns = useCallback(() => {
    setActiveDropdown(null);
  }, []);

  const toggleDropdown = useCallback((event: React.MouseEvent, name: "category" | "sort") => {
    event.stopPropagation();
    setActiveDropdown(prev => (prev === name ? null : name));
  }, []);

  useEffect(() => {
    const handleClickOutside = () => {
      closeDropdowns();
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [closeDropdowns]);

  return (
    <header id="album-header">
      <div className="header-left">
        <Link className="home-link" href="/" onClick={closeDropdowns}>
          <img className="site-logo" src={siteLogo} alt="网站Logo" />
        </Link>
        <h1>
          <Link className="home-link" href="/" onClick={closeDropdowns}>
            <strong className="site-name">{siteName}</strong>
          </Link>
        </h1>
      </div>

      <nav>
        <ul className="nav_links">
          {categories.length > 0 ? (
            <li
              className={`nav-item nav-dropdown ${activeDropdown === "category" ? "is-open" : ""}`}
              onClick={event => event.stopPropagation()}
            >
              <button
                type="button"
                className="dropdown-trigger nav-action"
                onClick={event => toggleDropdown(event, "category")}
              >
                分类: {currentCategoryName}
              </button>
              <div className="nav-item-child" onClick={event => event.stopPropagation()}>
                <ul>
                  <li className="mb-1 category-parent category-level-0">
                    <button
                      type="button"
                      className={`nav-action ${categoryId === null ? "active" : ""}`}
                      onClick={() => {
                        onCategoryChange(null);
                        closeDropdowns();
                      }}
                    >
                      全部
                    </button>
                  </li>
                  {categories.map(category => (
                    <li key={category.id} className="mb-1 category-parent category-level-0">
                      <button
                        type="button"
                        className={`nav-action ${categoryId === category.id ? "active" : ""}`}
                        onClick={() => {
                          onCategoryChange(category.id);
                          closeDropdowns();
                        }}
                      >
                        {category.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ) : null}

          <li
            className={`nav-item nav-dropdown ${activeDropdown === "sort" ? "is-open" : ""}`}
            onClick={event => event.stopPropagation()}
          >
            <button
              type="button"
              className="dropdown-trigger nav-action"
              onClick={event => toggleDropdown(event, "sort")}
            >
              排序: {currentSortLabel}
            </button>
            <div className="nav-item-child" onClick={event => event.stopPropagation()}>
              <ul>
                <li className="mb-1 category-parent category-level-0">
                  <button
                    type="button"
                    className={`nav-action ${sortOrder === "display_order_asc" ? "active" : ""}`}
                    onClick={() => {
                      onSortChange("display_order_asc");
                      closeDropdowns();
                    }}
                  >
                    默认排序
                  </button>
                </li>
                <li className="category-parent category-level-0">
                  <button
                    type="button"
                    className={`nav-action ${sortOrder === "created_at_desc" ? "active" : ""}`}
                    onClick={() => {
                      onSortChange("created_at_desc");
                      closeDropdowns();
                    }}
                  >
                    最新发布
                  </button>
                </li>
                <li className="category-parent category-level-0">
                  <button
                    type="button"
                    className={`nav-action ${sortOrder === "view_count_desc" ? "active" : ""}`}
                    onClick={() => {
                      onSortChange("view_count_desc");
                      closeDropdowns();
                    }}
                  >
                    热度排序
                  </button>
                </li>
              </ul>
            </div>
          </li>

          <li className="nav-item nav-about">
            <a href={aboutLink || "#"} target="_blank" rel="noopener noreferrer">
              关于
            </a>
          </li>

          {icpNumber ? (
            <li className="nav-item nav-icp">
              <a
                className="footer-bar-link"
                target="_blank"
                rel="noopener external nofollow noreferrer"
                href="https://beian.miit.gov.cn/"
                title={icpNumber}
              >
                {icpNumber}
              </a>
            </li>
          ) : null}

          {policeRecordNumber ? (
            <li className="nav-item nav-police">
              <a
                className="footer-bar-link police-record-link"
                target="_blank"
                rel="noopener external nofollow noreferrer"
                href="http://www.beian.gov.cn/portal/registerSystemInfo"
                title={policeRecordNumber}
              >
                {policeRecordIcon ? <img src={policeRecordIcon} alt="公安备案" className="police-record-icon" /> : null}
                {policeRecordNumber}
              </a>
            </li>
          ) : null}
        </ul>
      </nav>
    </header>
  );
}
