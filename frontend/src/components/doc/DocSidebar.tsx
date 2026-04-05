"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, PanelLeftClose, Sun, Moon, ExternalLink } from "lucide-react";
import { Icon } from "@iconify/react";
import { useSiteConfigStore } from "@/store/site-config-store";
import { useShallow } from "zustand/shallow";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import type { DocSeriesWithArticles } from "@/types/doc-series";
import styles from "./doc.module.css";

interface DocSidebarLinkItem {
  title: string;
  link: string;
  icon: string;
  external: boolean;
}

interface DocSidebarProps {
  series: DocSeriesWithArticles | null;
  currentDocId: string;
  onNavigate: (docId: string) => void;
  onCollapse: () => void;
}

export function DocSidebar({ series, currentDocId, onNavigate, onCollapse }: DocSidebarProps) {
  const router = useRouter();
  const { isDark, toggleTheme, mounted } = useTheme();

  const siteConfig = useSiteConfigStore(useShallow(state => state.siteConfig));

  const ownerAvatar = siteConfig?.USER_AVATAR || siteConfig?.LOGO_URL_192x192 || "/logo.svg";
  const ownerName = siteConfig?.frontDesk?.siteOwner?.name || siteConfig?.APP_NAME || "AnHeYu";

  const docSidebarLinks = useMemo<DocSidebarLinkItem[]>(() => {
    const links = (siteConfig as Record<string, unknown>)?.sidebar as
      | { doc?: { links?: DocSidebarLinkItem[] } }
      | undefined;
    if (links?.doc?.links && Array.isArray(links.doc.links) && links.doc.links.length > 0) {
      return links.doc.links;
    }
    return [{ title: "博客", link: "/", icon: "ri:external-link-line", external: false }];
  }, [siteConfig]);

  const handleLinkClick = (link: DocSidebarLinkItem) => {
    if (link.external || link.link.startsWith("http")) {
      window.open(link.link, "_blank");
    } else {
      router.push(link.link);
    }
  };

  const openSearch = () => {
    window.dispatchEvent(new CustomEvent("frontend-open-search"));
  };

  return (
    <div className={styles.sidebar}>
      {/* 站长头像 + 昵称 */}
      <div className={styles.sidebarBrand}>
        <Link href="/" className={styles.brandLink}>
          <Image
            src={ownerAvatar}
            alt={ownerName}
            width={28}
            height={28}
            className={styles.brandAvatar}
            priority
            unoptimized
          />
          <span>{ownerName}</span>
        </Link>
        <button className={styles.collapseBtn} title="收起侧边栏" onClick={onCollapse}>
          <PanelLeftClose className="w-5 h-5" />
        </button>
      </div>

      {/* 搜索 */}
      <div className={styles.sidebarSearch}>
        <div className={styles.searchBox} onClick={openSearch}>
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className={styles.searchPlaceholder}>Search</span>
          <span className={styles.searchShortcut}>
            <kbd>⌘</kbd>
            <kbd>K</kbd>
          </span>
        </div>
      </div>

      {/* 外部链接 */}
      {docSidebarLinks.length > 0 && (
        <nav className={styles.sidebarLinks}>
          {docSidebarLinks.map((link, index) => (
            <a key={index} className={styles.navLink} onClick={() => handleLinkClick(link)}>
              {link.external ? (
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              ) : link.icon ? (
                <Icon icon={link.icon} className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              ) : null}
              <span>{link.title}</span>
            </a>
          ))}
        </nav>
      )}

      {/* 文档导航列表 */}
      <nav className={styles.docNav}>
        <ul className={styles.docList}>
          {(series?.articles || []).map(doc => (
            <li
              key={doc.id}
              className={cn(styles.docItem, doc.id === currentDocId && styles.docItemActive)}
              onClick={() => {
                if (doc.id !== currentDocId) onNavigate(doc.id);
              }}
            >
              <span className={styles.docTitle}>{doc.title}</span>
            </li>
          ))}
        </ul>

        {(!series || series.articles.length === 0) && <div className={styles.emptyState}>暂无其他文档</div>}
      </nav>

      {/* 底部主题切换 */}
      <div className={styles.sidebarFooter}>
        {mounted && (
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
            onClick={toggleTheme}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{isDark ? "浅色模式" : "深色模式"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
