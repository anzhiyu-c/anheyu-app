"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pagination } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { AlbumLayoutMode, AlbumStatType, PublicAlbumItem } from "@/types/album";
import { AlbumGridItem } from "./AlbumGridItem";
import { AlbumWaterfallItem } from "./AlbumWaterfallItem";
import { AlbumImagePreview, type AlbumImagePreviewHandle } from "./AlbumImagePreview";

interface AlbumListProps {
  layoutMode: AlbumLayoutMode;
  items: PublicAlbumItem[];
  totalItems: number;
  currentPage: number;
  pageSize: number;
  isLoading: boolean;
  enableComment: boolean;
  waterfallConfig: {
    gap: number;
    columnCount: {
      large: number;
      medium: number;
      small: number;
    };
  };
  siteName?: string;
  onPageChange: (page: number) => void;
  onUpdateStat: (item: PublicAlbumItem, type: AlbumStatType) => Promise<void>;
}

interface WaterfallEntry {
  item: PublicAlbumItem;
  index: number;
}

function getAspectRatioHeight(item: PublicAlbumItem): number {
  if (item.width && item.height && item.width > 0 && item.height > 0) {
    return item.height / item.width;
  }

  if (item.widthAndHeight) {
    const [width, height] = item.widthAndHeight.split(/[xX*]/).map(Number);
    if (width > 0 && height > 0) {
      return height / width;
    }
  }

  if (item.aspectRatio) {
    if (item.aspectRatio.includes(":")) {
      const [width, height] = item.aspectRatio.split(":").map(Number);
      if (width > 0 && height > 0) {
        return height / width;
      }
    }

    const numericRatio = Number(item.aspectRatio);
    if (Number.isFinite(numericRatio) && numericRatio > 0) {
      const heightRatio = 1 / numericRatio;
      if (heightRatio > 0.1 && heightRatio < 10) {
        return heightRatio;
      }
      if (numericRatio > 0.1 && numericRatio < 10) {
        return numericRatio;
      }
    }
  }

  return 0.75;
}

function estimateWaterfallScore(item: PublicAlbumItem): number {
  return getAspectRatioHeight(item) + 0.42;
}

export function AlbumList({
  layoutMode,
  items,
  totalItems,
  currentPage,
  pageSize,
  isLoading,
  enableComment,
  waterfallConfig,
  siteName,
  onPageChange,
  onUpdateStat,
}: AlbumListProps) {
  const previewRef = useRef<AlbumImagePreviewHandle>(null);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === "undefined" ? 1400 : window.innerWidth));

  const totalPages = useMemo(() => {
    if (totalItems <= 0) return 1;
    return Math.max(1, Math.ceil(totalItems / pageSize));
  }, [pageSize, totalItems]);

  const handlePreview = useCallback(
    (index: number) => {
      previewRef.current?.open(items, index);
    },
    [items]
  );

  const handleComment = useCallback(() => {
    const commentSection = document.querySelector(".album-comment-section");
    if (!commentSection) {
      return;
    }

    commentSection.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      const input = commentSection.querySelector("textarea, input");
      if (input) {
        (input as HTMLElement).focus();
      }
    }, 500);
  }, []);

  const handlePageChange = useCallback(
    (page: number) => {
      onPageChange(page);
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    },
    [onPageChange]
  );

  useEffect(() => {
    if (layoutMode !== "waterfall") {
      return;
    }

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [layoutMode]);

  const waterfallColumnCount = useMemo(() => {
    if (viewportWidth <= 500) {
      return Math.max(1, waterfallConfig.columnCount.small);
    }
    if (viewportWidth <= 1200) {
      return Math.max(1, waterfallConfig.columnCount.medium);
    }
    return Math.max(1, waterfallConfig.columnCount.large);
  }, [
    viewportWidth,
    waterfallConfig.columnCount.large,
    waterfallConfig.columnCount.medium,
    waterfallConfig.columnCount.small,
  ]);

  const waterfallColumns = useMemo(() => {
    const safeColumnCount = Math.max(1, waterfallColumnCount);
    const columns: WaterfallEntry[][] = Array.from({ length: safeColumnCount }, () => []);
    const heights = Array.from({ length: safeColumnCount }, () => 0);

    items.forEach((item, index) => {
      let targetColumn = 0;
      for (let i = 1; i < heights.length; i += 1) {
        if (heights[i] < heights[targetColumn]) {
          targetColumn = i;
        }
      }

      columns[targetColumn].push({ item, index });
      heights[targetColumn] += estimateWaterfallScore(item);
    });

    return columns;
  }, [items, waterfallColumnCount]);

  return (
    <div id="album-wrapper">
      <div id="album-main" className={layoutMode === "waterfall" ? "waterfall-mode" : ""}>
        {isLoading && items.length === 0 ? (
          <div className="global-loading">
            <div className="loading-spinner">
              <Icon icon="fa6-solid:spinner" className="loading-icon" width={48} height={48} />
              <span>加载中...</span>
            </div>
          </div>
        ) : null}

        {layoutMode === "grid"
          ? items.map((item, index) => (
              <AlbumGridItem key={item.id} item={item} index={index} onPreview={handlePreview} />
            ))
          : null}

        {layoutMode === "waterfall" ? (
          <div
            className="waterfall-container"
            style={{
              ["--waterfall-gap" as string]: `${waterfallConfig.gap}px`,
            }}
          >
            {waterfallColumns.map((column, columnIndex) => (
              <div key={`waterfall-column-${columnIndex}`} className="waterfall-column">
                {column.map(({ item, index }) => (
                  <div key={item.id} className="waterfall-column-item" style={{ ["--item-index" as string]: index }}>
                    <AlbumWaterfallItem
                      item={item}
                      index={index}
                      enableComment={enableComment}
                      onPreview={handlePreview}
                      onComment={handleComment}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : null}

        {!isLoading && items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-text">暂无图片</div>
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="an-pagination">
            <Pagination
              page={currentPage}
              total={totalPages}
              onChange={handlePageChange}
              showControls
              showShadow
              color="primary"
              variant="light"
            />
            <span className="pagination-total">共 {totalItems} 项</span>
          </div>
        ) : null}

        <AlbumImagePreview ref={previewRef} siteName={siteName} onUpdateStat={onUpdateStat} />
      </div>
    </div>
  );
}
