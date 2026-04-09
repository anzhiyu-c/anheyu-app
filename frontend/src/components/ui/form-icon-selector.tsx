"use client";

import * as React from "react";
import { Input, Button, Popover, PopoverTrigger, PopoverContent, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { Search, Link2, Image as ImageIcon, Grid3X3, Check, X } from "lucide-react";

// ─── 常量 ─────────────────────────────────────────────────────────

const ICONS_PER_PAGE = 100;
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_LIMIT = 100;
const CACHE_KEY = "iconify-ri-icons";
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const DEFAULT_REMIX_ICONS = [
  "ri:home-fill",
  "ri:home-line",
  "ri:user-fill",
  "ri:user-line",
  "ri:heart-fill",
  "ri:heart-line",
  "ri:star-fill",
  "ri:star-line",
  "ri:bookmark-fill",
  "ri:bookmark-line",
  "ri:settings-fill",
  "ri:settings-line",
  "ri:search-fill",
  "ri:search-line",
  "ri:menu-fill",
  "ri:menu-line",
  "ri:close-fill",
  "ri:close-line",
  "ri:add-fill",
  "ri:add-line",
  "ri:edit-fill",
  "ri:edit-line",
  "ri:delete-bin-fill",
  "ri:delete-bin-line",
  "ri:share-fill",
  "ri:share-line",
  "ri:download-fill",
  "ri:download-line",
  "ri:upload-fill",
  "ri:upload-line",
  "ri:image-fill",
  "ri:image-line",
  "ri:video-fill",
  "ri:video-line",
  "ri:music-fill",
  "ri:music-line",
  "ri:file-fill",
  "ri:file-line",
  "ri:folder-fill",
  "ri:folder-line",
  "ri:links-fill",
  "ri:links-line",
  "ri:global-fill",
  "ri:global-line",
  "ri:cloud-fill",
  "ri:cloud-line",
  "ri:code-fill",
  "ri:code-line",
  "ri:terminal-fill",
  "ri:terminal-line",
  "ri:github-fill",
  "ri:github-line",
  "ri:twitter-x-fill",
  "ri:twitter-x-line",
  "ri:wechat-fill",
  "ri:wechat-line",
  "ri:qq-fill",
  "ri:qq-line",
  "ri:weibo-fill",
  "ri:weibo-line",
  "ri:facebook-fill",
  "ri:facebook-line",
  "ri:instagram-fill",
  "ri:instagram-line",
  "ri:youtube-fill",
  "ri:youtube-line",
  "ri:bilibili-fill",
  "ri:bilibili-line",
  "ri:telegram-fill",
  "ri:telegram-line",
  "ri:discord-fill",
  "ri:discord-line",
  "ri:mail-fill",
  "ri:mail-line",
  "ri:rss-fill",
  "ri:rss-line",
  "ri:book-fill",
  "ri:book-line",
  "ri:calendar-fill",
  "ri:calendar-line",
  "ri:map-pin-fill",
  "ri:map-pin-line",
  "ri:fire-fill",
  "ri:fire-line",
  "ri:flashlight-fill",
  "ri:flashlight-line",
  "ri:trophy-fill",
  "ri:trophy-line",
  "ri:shield-check-fill",
  "ri:shield-check-line",
  "ri:rocket-fill",
  "ri:rocket-line",
];

// ─── 工具函数 ───────────────────────────────────────────────────────

function isImageUrl(value?: string): boolean {
  return !!value && (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/"));
}

function isIconifyIcon(value?: string): boolean {
  return !!value && value.includes(":") && !isImageUrl(value);
}

/** 提取图标短名（去掉前缀），如 "ri:home-fill" → "home-fill" */
function shortName(icon: string): string {
  const idx = icon.indexOf(":");
  return idx >= 0 ? icon.slice(idx + 1) : icon;
}

function getCachedIcons(): string[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { icons, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return icons;
  } catch {
    return null;
  }
}

function setCachedIcons(icons: string[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ icons, timestamp: Date.now() }));
  } catch {
    /* ignore */
  }
}

// ─── Props ────────────────────────────────────────────────────────

export interface FormIconSelectorProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  size?: "sm" | "md";
}

// ─── 主组件 ─────────────────────────────────────────────────────────

export function FormIconSelector({
  value = "",
  onValueChange,
  placeholder = "选择图标或输入 URL",
  className,
  size = "sm",
}: FormIconSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"iconify" | "url">("iconify");
  const [searchText, setSearchText] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState("");

  const [allIcons, setAllIcons] = React.useState<string[]>(DEFAULT_REMIX_ICONS);
  const [searchResults, setSearchResults] = React.useState<string[]>([]);
  const [displayCount, setDisplayCount] = React.useState(ICONS_PER_PAGE);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSearching, setIsSearching] = React.useState(false);
  const gridRef = React.useRef<HTMLDivElement>(null);

  // 获取图标列表（Remix 图标，用于浏览）
  const fetchIcons = React.useCallback(async () => {
    if (isLoading) return;
    const cached = getCachedIcons();
    if (cached && cached.length > 0) {
      setAllIcons(cached);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("https://api.iconify.design/collection?prefix=ri");
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      const icons: string[] = [];
      if (data.categories) {
        Object.values(data.categories).forEach((cat: unknown) => {
          if (Array.isArray(cat)) cat.forEach((n: string) => icons.push(`ri:${n}`));
        });
      } else if (data.uncategorized) {
        Object.values(data.uncategorized).forEach((cat: unknown) => {
          if (Array.isArray(cat)) cat.forEach((n: string) => icons.push(`ri:${n}`));
        });
      }
      if (icons.length > 0) {
        const sorted = Array.from(new Set(icons)).sort();
        setAllIcons(sorted);
        setCachedIcons(sorted);
      }
    } catch {
      setAllIcons(DEFAULT_REMIX_ICONS);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  React.useEffect(() => {
    if (isOpen) {
      fetchIcons();
      setDisplayCount(ICONS_PER_PAGE);
      setSearchText("");
      setSearchResults([]);
      if (isImageUrl(value)) {
        setImageUrl(value);
        setActiveTab("url");
      } else {
        setActiveTab("iconify");
      }
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // 搜索：使用 Iconify 搜索 API 跨所有图标集查询
  React.useEffect(() => {
    const q = searchText.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `https://api.iconify.design/search?query=${encodeURIComponent(q)}&limit=${SEARCH_LIMIT}`
        );
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as { icons?: string[] };
        setSearchResults(data.icons ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchText]);

  const filteredIcons = React.useMemo(() => {
    if (!searchText.trim()) return allIcons;
    return searchResults;
  }, [allIcons, searchText, searchResults]);

  const visibleIcons = React.useMemo(
    () => (searchText ? filteredIcons : filteredIcons.slice(0, displayCount)),
    [filteredIcons, displayCount, searchText]
  );

  const hasMore = !searchText && displayCount < filteredIcons.length;

  const handleScroll = React.useCallback(() => {
    const el = gridRef.current;
    if (!el || !hasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60) {
      setDisplayCount(prev => prev + ICONS_PER_PAGE);
    }
  }, [hasMore]);

  const handleSelect = React.useCallback(
    (icon: string) => {
      onValueChange?.(icon);
      setIsOpen(false);
    },
    [onValueChange]
  );

  const handleUrlConfirm = React.useCallback(() => {
    if (imageUrl.trim()) {
      onValueChange?.(imageUrl.trim());
      setIsOpen(false);
    }
  }, [imageUrl, onValueChange]);

  // ─── 预览（嵌入输入框左侧） ────────────────────────────────────

  const renderInlinePreview = () => {
    if (!value) return <Grid3X3 className="w-4 h-4 text-muted-foreground/40" />;
    if (isImageUrl(value)) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={value} alt="" className="w-[18px] h-[18px] object-contain rounded" />;
    }
    if (isIconifyIcon(value)) {
      return <Icon icon={value} width={18} height={18} className="text-foreground" />;
    }
    return <i className={cn("text-sm text-foreground leading-none", value)} />;
  };

  // ─── 弹窗内容 ─────────────────────────────────────────────────────

  const popoverContent = (
    <div className="flex flex-col" data-form-icon-selector-popover="true">
      {/* Tab 切换 */}
      <div className="flex items-center gap-1 p-2 pb-0">
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150",
            activeTab === "iconify"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          onClick={() => setActiveTab("iconify")}
        >
          <Grid3X3 className="w-3 h-3" />
          图标库
        </button>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150",
            activeTab === "url"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          onClick={() => setActiveTab("url")}
        >
          <Link2 className="w-3 h-3" />
          图片链接
        </button>
        {activeTab === "iconify" && !isLoading && (
          <span className="ml-auto text-[10px] text-muted-foreground tabular-nums pr-1 w-16 text-right shrink-0">
            {isSearching ? "搜索中…" : searchText ? `${filteredIcons.length} 结果` : `${allIcons.length} 个`}
          </span>
        )}
      </div>

      {/* Iconify Tab */}
      {activeTab === "iconify" && (
        <div className="flex flex-col">
          <div className="px-2 pt-2 pb-1.5">
            <Input
              size="sm"
              value={searchText}
              onValueChange={setSearchText}
              placeholder="搜索图标（含 fa、ri 等）"
              autoFocus
              startContent={<Search className="w-3.5 h-3.5 text-muted-foreground" />}
              isClearable
              onClear={() => setSearchText("")}
              classNames={{
                inputWrapper:
                  "bg-muted/30 border border-border/60 rounded-lg shadow-none! h-8 min-h-8 group-data-[focus=true]:bg-card group-data-[focus=true]:dark:bg-muted/30! group-data-[focus=true]:border-primary/50 group-data-[focus=true]:ring-1 group-data-[focus=true]:ring-primary/10",
                input: "text-xs placeholder:text-muted-foreground",
                clearButton: "text-muted-foreground",
              }}
            />
          </div>

          <div
            ref={gridRef}
            onScroll={handleScroll}
            className="grid grid-cols-6 gap-1 p-2 max-h-[280px] overflow-y-auto overflow-x-hidden"
          >
            {visibleIcons.map(icon => {
              const isActive = value === icon;
              const name = shortName(icon);
              return (
                <Tooltip
                  key={icon}
                  content={name}
                  placement="top"
                  delay={400}
                  closeDelay={0}
                  size="sm"
                  classNames={{ content: "text-[10px] px-2 py-0.5 rounded-md" }}
                >
                  <button
                    type="button"
                    onClick={() => handleSelect(icon)}
                    className={cn(
                      "relative flex items-center justify-center w-full aspect-square rounded-lg transition-all duration-100",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-foreground/70 hover:bg-muted hover:text-foreground active:scale-90"
                    )}
                  >
                    <Icon icon={icon} width={22} height={22} />
                    {isActive && (
                      <div className="absolute top-0.5 right-0.5 w-3 h-3 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-2 h-2 text-white" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                </Tooltip>
              );
            })}

            {(isLoading || isSearching) && (
              <div className="col-span-6 flex items-center justify-center py-8 text-xs text-muted-foreground">
                <span className="w-4 h-4 border-2 border-border/80 border-t-primary rounded-full animate-spin mr-2" />
                正在加载图标...
              </div>
            )}

            {!isLoading && visibleIcons.length === 0 && (
              <div className="col-span-6 flex flex-col items-center justify-center py-10 text-xs text-muted-foreground">
                <Search className="w-5 h-5 mb-2 text-muted-foreground/40" />
                未找到 &quot;{searchText}&quot;
              </div>
            )}
          </div>

          {hasMore && !isLoading && (
            <div className="text-center py-1.5 text-[10px] text-muted-foreground border-t border-border/30">
              向下滚动加载更多
            </div>
          )}
        </div>
      )}

      {/* URL Tab */}
      {activeTab === "url" && (
        <div className="p-3 pt-2.5 space-y-2.5">
          <div className="flex gap-2">
            <Input
              size="sm"
              value={imageUrl}
              onValueChange={setImageUrl}
              placeholder="https://example.com/icon.png"
              autoFocus
              startContent={<ImageIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
              onKeyDown={e => e.key === "Enter" && handleUrlConfirm()}
              classNames={{
                inputWrapper:
                  "bg-muted! border border-border/60 rounded-lg shadow-none! h-9 min-h-9 flex-1 data-[hover=true]:bg-muted! group-data-[focus=true]:bg-card group-data-[focus=true]:dark:bg-muted/30! group-data-[focus=true]:border-primary/50 group-data-[focus=true]:ring-1 group-data-[focus=true]:ring-primary/10",
                input: "text-xs placeholder:text-muted-foreground",
              }}
            />
            <Button
              size="sm"
              color="primary"
              className="rounded-lg shrink-0 min-w-0 px-3"
              isDisabled={!imageUrl.trim()}
              onPress={handleUrlConfirm}
            >
              确认
            </Button>
          </div>

          {imageUrl && isImageUrl(imageUrl) && (
            <div className="flex items-center justify-center p-3 border border-border/30 rounded-lg bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="预览"
                className="max-w-[100px] max-h-[64px] object-contain rounded"
                onError={e => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}

          <p className="text-[10px] text-muted-foreground leading-relaxed">
            输入 http://、https:// 或 / 开头的图标地址
          </p>
        </div>
      )}
    </div>
  );

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      placement="bottom-start"
      offset={6}
      triggerScaleOnOpen={false}
      shouldBlockScroll={false}
      classNames={{
        content:
          "p-0 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl shadow-lg border border-border/60 bg-white dark:bg-card z-[9999]",
      }}
    >
      <PopoverTrigger>
        {/* 整体是一个看起来像输入框的容器，支持直接输入 */}
        <div
          className={cn(
            "w-full min-w-0 flex items-center gap-2 rounded-xl border bg-card transition-all duration-200 text-left cursor-text",
            "border-border/60 hover:border-border/80",
            "outline-none focus-within:bg-white! dark:focus-within:bg-muted focus-within:border-primary/65 focus-within:ring-2 focus-within:ring-primary/15",
            size === "sm" ? "h-9 px-2.5" : "h-10 px-3",
            className
          )}
          role="group"
          aria-label="选择图标"
          onClick={e => {
            // 如果点击的不是 input 或 clear 按钮，打开弹窗
            const target = e.target as HTMLElement;
            if (target.tagName !== "INPUT" && !target.closest("[data-clear-btn]")) {
              setIsOpen(true);
            }
          }}
        >
          {/* 图标预览 - 点击打开弹窗 */}
          <div
            className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md bg-muted border border-border/60 cursor-pointer"
            onClick={e => {
              e.stopPropagation();
              setIsOpen(prev => !prev);
            }}
          >
            {renderInlinePreview()}
          </div>
          {/* 可编辑输入框 */}
          <input
            type="text"
            value={value}
            onChange={e => onValueChange?.(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                setIsOpen(false);
              }
            }}
            placeholder={placeholder}
            className={cn(
              "flex-1 min-w-0 bg-transparent border-none outline-none text-[13px]",
              value ? "text-foreground" : "text-muted-foreground",
              "placeholder:text-muted-foreground"
            )}
          />
          {/* 清除按钮 */}
          {value && (
            <div
              role="button"
              tabIndex={-1}
              data-clear-btn
              className="shrink-0 text-muted-foreground hover:text-danger transition-colors cursor-pointer"
              onClick={e => {
                e.stopPropagation();
                onValueChange?.("");
              }}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  onValueChange?.("");
                }
              }}
            >
              <X className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent data-form-icon-selector-popover="true">{popoverContent}</PopoverContent>
    </Popover>
  );
}
