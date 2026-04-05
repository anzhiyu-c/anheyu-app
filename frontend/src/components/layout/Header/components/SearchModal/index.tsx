"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { useSiteConfigStore } from "@/store/site-config-store";

import styles from "./styles.module.css";

let gsapInstance: typeof import("gsap").gsap | null = null;

const loadGsap = async () => {
  if (!gsapInstance) {
    const { gsap } = await import("gsap");
    gsapInstance = gsap;
  }
  return gsapInstance;
};

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  author: string;
  category: string;
  tags: string[];
  publish_date: string;
  cover_url?: string;
  abbrlink?: string;
  is_doc?: boolean;
  doc_series_id?: string;
}

interface SearchResponse {
  code: number;
  message: string;
  data: {
    pagination: {
      total: number;
      page: number;
      size: number;
      totalPages: number;
    };
    hits: SearchResult[];
  };
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialKeyword?: string;
}

export function SearchModal({ isOpen, onClose, initialKeyword = "" }: SearchModalProps) {
  const router = useRouter();
  const siteConfig = useSiteConfigStore(state => state.siteConfig);

  const maskRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timelineRef = useRef<{ kill: () => void } | null>(null);

  const [shouldRender, setShouldRender] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [tipsVisible] = useState(true);

  const pageSize = 10;
  const fallbackCover = "/images/default-cover.webp";
  const configuredDefaultCover = siteConfig?.post?.default?.default_cover || fallbackCover;

  const clearSearchResultState = useCallback(() => {
    setSearchResults([]);
    setTotal(0);
    setTotalPages(0);
  }, []);

  const performSearch = useCallback(
    async (page: number = 1, customKeyword?: string) => {
      const searchKeyword = (customKeyword ?? keyword).trim();

      if (!searchKeyword) {
        clearSearchResultState();
        return;
      }

      setLoading(true);
      setCurrentPage(page);

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(searchKeyword)}&page=${page}&size=${pageSize}`
        );
        if (!response.ok) {
          throw new Error(`搜索请求失败: ${response.status}`);
        }

        const data: SearchResponse = await response.json();

        if (data.code === 200 && data.data) {
          const regex = new RegExp(searchKeyword, "gi");
          const hits = data.data.hits ?? [];
          setSearchResults(
            hits.map(hit => ({
              ...hit,
              title: hit.title.replace(regex, match => `<em>${match}</em>`),
              snippet: hit.snippet.replace(regex, match => `<em>${match}</em>`),
            }))
          );
          setTotal(data.data.pagination?.total ?? 0);
          setTotalPages(data.data.pagination?.totalPages ?? 0);
        } else {
          throw new Error(data.message || "搜索失败");
        }
      } catch (error) {
        console.error("搜索错误:", error);
        clearSearchResultState();
      } finally {
        setLoading(false);
      }
    },
    [keyword, clearSearchResultState]
  );

  const resetModalState = useCallback(() => {
    setKeyword("");
    clearSearchResultState();
    setCurrentPage(1);
    setLoading(false);
  }, [clearSearchResultState]);

  const runOpenAnimation = useCallback(async () => {
    const mask = maskRef.current;
    const dialog = dialogRef.current;
    if (!mask || !dialog) return;

    const gsap = await loadGsap();
    timelineRef.current?.kill();

    gsap.set(mask, { display: "block", opacity: 0, pointerEvents: "auto" });
    gsap.set(dialog, { display: "flex", opacity: 0, y: 24, scale: 0.98 });

    const tl = gsap.timeline();
    timelineRef.current = tl;

    tl.to(mask, {
      duration: 0.3,
      opacity: 1,
      ease: "power2.out",
      force3D: true,
    })
      .fromTo(
        dialog,
        { opacity: 0, y: 24, scale: 0.98 },
        {
          duration: 0.35,
          opacity: 1,
          y: 0,
          scale: 1,
          ease: "power3.out",
          force3D: true,
        },
        "<"
      )
      .add(() => {
        inputRef.current?.focus();
      });
  }, []);

  const runCloseAnimation = useCallback(async () => {
    const mask = maskRef.current;
    const dialog = dialogRef.current;

    if (!mask || !dialog) {
      setShouldRender(false);
      resetModalState();
      return;
    }

    const gsap = await loadGsap();
    timelineRef.current?.kill();

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(dialog, { display: "none" });
        gsap.set(mask, { display: "none", pointerEvents: "none" });
        setShouldRender(false);
        resetModalState();
      },
    });

    timelineRef.current = tl;

    tl.to(dialog, {
      duration: 0.25,
      opacity: 0,
      y: 16,
      scale: 0.98,
      ease: "power2.inOut",
      force3D: true,
    }).to(
      mask,
      {
        duration: 0.3,
        opacity: 0,
        ease: "power2.inOut",
        force3D: true,
      },
      "<"
    );
  }, [resetModalState]);

  const handleInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextKeyword = event.target.value;
      setKeyword(nextKeyword);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        if (nextKeyword.trim()) {
          void performSearch(1, nextKeyword);
        } else {
          clearSearchResultState();
        }
      }, 300);
    },
    [performSearch, clearSearchResultState]
  );

  const handleEnter = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (keyword.trim()) {
        void performSearch(1);
      }
    },
    [keyword, performSearch]
  );

  const changePage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) {
        void performSearch(page);
      }
    },
    [performSearch, totalPages]
  );

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      if (result.is_doc) {
        router.push(`/doc/${result.id}`);
      } else {
        const targetId = result.abbrlink || result.id;
        router.push(`/posts/${targetId}`);
      }
      onClose();
    },
    [router, onClose]
  );

  const formatDate = useCallback((dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  }, []);

  const stripHtmlTag = useCallback((content: string): string => {
    return content.replace(/<[^>]*>/g, "").trim();
  }, []);

  const handleCoverImageError = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const img = event.currentTarget;
      const fallbackState = img.dataset.fallbackState;

      if (fallbackState === "final") return;

      if (fallbackState === "configured") {
        img.dataset.fallbackState = "final";
        if (img.src !== fallbackCover) {
          img.src = fallbackCover;
        }
        return;
      }

      img.dataset.fallbackState = "configured";
      if (img.src !== configuredDefaultCover) {
        img.src = configuredDefaultCover;
      }
    },
    [configuredDefaultCover, fallbackCover]
  );

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      return;
    }

    if (shouldRender) {
      void runCloseAnimation();
    }
  }, [isOpen, shouldRender, runCloseAnimation]);

  useEffect(() => {
    if (shouldRender && isOpen) {
      void runOpenAnimation();
    }
  }, [shouldRender, isOpen, runOpenAnimation]);

  useEffect(() => {
    if (!isOpen) return;

    const kw = initialKeyword.trim();
    if (kw) {
      setKeyword(kw);
      void performSearch(1, kw);
    }
  }, [isOpen, initialKeyword, performSearch]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        onClose();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!isOpen) {
          window.dispatchEvent(new CustomEvent("frontend-open-search"));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      timelineRef.current?.kill();
    };
  }, []);

  if (!shouldRender) return null;

  return (
    <div className={styles.searchModal}>
      <div ref={dialogRef} className={styles.searchDialog}>
        <div className={styles.searchNav}>
          <div className={styles.searchDialogTitle}>搜索</div>
          <button className={styles.searchCloseButton} aria-label="关闭搜索框" onClick={onClose}>
            <Icon icon="ri:close-line" width="1.1rem" height="1.1rem" />
          </button>
        </div>

        <div className={styles.searchWrap}>
          <div className={styles.searchInputContainer}>
            <Icon icon="ri:search-line" className={styles.searchIcon} />
            <input
              ref={inputRef}
              value={keyword}
              className={styles.searchInput}
              type="text"
              placeholder="输入关键字，按 Enter 搜索"
              onChange={handleInput}
              onKeyDown={handleEnter}
            />
          </div>

          {tipsVisible && !keyword.trim() && (
            <div className={styles.searchTips}>
              <span>按 Esc 关闭</span>
              <span>·</span>
              <span>按 Ctrl/⌘ + K 打开</span>
            </div>
          )}

          {keyword.trim() && !loading && (
            <div className={styles.searchResults}>
              {searchResults.length > 0 && (
                <div className={styles.resultsHeader}>
                  <span className={styles.resultsCount}>找到 {total} 条结果</span>
                </div>
              )}

              <div className={styles.resultsList}>
                {searchResults.map(result => (
                  <div key={result.id} className={styles.resultItem} onClick={() => handleResultClick(result)}>
                    <div className={styles.resultThumbnail}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={result.cover_url || configuredDefaultCover}
                        alt={stripHtmlTag(result.title) || "文章封面"}
                        onError={handleCoverImageError}
                      />
                    </div>
                    <div className={styles.resultDetails}>
                      <div className={styles.resultContent}>
                        <div className={styles.resultTitleWrapper}>
                          <div className={styles.resultTitle} dangerouslySetInnerHTML={{ __html: result.title }} />
                          {result.is_doc && (
                            <span className={styles.resultDocBadge}>
                              <Icon icon="ri:book-line" width="0.7rem" height="0.7rem" />
                              文档
                            </span>
                          )}
                        </div>
                        <div className={styles.resultSnippet} dangerouslySetInnerHTML={{ __html: result.snippet }} />
                      </div>

                      <div className={styles.resultFooter}>
                        <div className={styles.resultMeta}>
                          <span className={styles.resultAuthor}>{result.author}</span>
                          <span className={styles.resultDate}>{formatDate(result.publish_date)}</span>
                          {result.tags && result.tags.length > 0 && (
                            <span className={styles.resultTags}>
                              {result.tags.slice(0, 3).map(tag => (
                                <span key={tag} className={styles.tag}>
                                  {tag}
                                </span>
                              ))}
                            </span>
                          )}
                        </div>
                        <div className={styles.resultArrow}>
                          <Icon icon="ri:arrow-right-s-line" width="1.25rem" height="1.25rem" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    disabled={currentPage <= 1}
                    onClick={() => changePage(currentPage - 1)}
                  >
                    上一页
                  </button>
                  <span className={styles.pageInfo}>
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    className={styles.pageBtn}
                    disabled={currentPage >= totalPages}
                    onClick={() => changePage(currentPage + 1)}
                  >
                    下一页
                  </button>
                </div>
              )}
            </div>
          )}

          {keyword.trim() && !loading && searchResults.length === 0 && (
            <div className={styles.noResults}>
              <div className={styles.noResultsText}>未找到相关结果</div>
              <div className={styles.noResultsTip}>尝试使用其他关键词或检查拼写</div>
            </div>
          )}

          {loading && (
            <div className={styles.loading}>
              <div className={styles.loadingSpinner} />
              <div className={styles.loadingText}>搜索中...</div>
            </div>
          )}
        </div>
      </div>

      <div ref={maskRef} className={styles.searchMask} onClick={onClose} />
    </div>
  );
}
