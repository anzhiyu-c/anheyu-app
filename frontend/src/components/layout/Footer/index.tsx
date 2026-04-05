/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { Tooltip } from "@/components/ui";
import { useSiteConfigStore } from "@/store/site-config-store";
import { apiClient } from "@/lib/api/client";
import styles from "./Footer.module.css";

interface SocialItem {
  title: string;
  icon: string;
  link: string;
}

interface LinkGroup {
  title: string;
  links: Array<{ title: string; link: string; external?: boolean }>;
}

interface FooterBarLink {
  text: string;
  link: string;
  external?: boolean;
}

interface FriendLink {
  name: string;
  url: string;
}

// 后端渲染的页面路径（不应使用 Next.js 跳转）
const BACKEND_RENDERED_EXTENSIONS = [".xml", ".json", ".txt", ".rss"];

/**
 * 判断是否为图片 URL
 */
const isImageUrl = (icon: string) => {
  return icon && (icon.startsWith("http://") || icon.startsWith("https://"));
};

/**
 * 判断是否为 Iconify 图标（包含 :）
 */
const isIconifyIcon = (icon: string) => {
  return icon && icon.includes(":");
};

/**
 * 判断是否为后端渲染的页面
 */
const isBackendRenderedPath = (link: string) => {
  if (!link) return false;
  const lowerLink = link.toLowerCase();
  return BACKEND_RENDERED_EXTENSIONS.some(ext => lowerLink.endsWith(ext));
};

/**
 * 判断是否为内部链接
 */
const isInternalLink = (link: string) => {
  if (!link) return false;
  if (isBackendRenderedPath(link)) return false;
  return link.startsWith("/") || link.startsWith("#") || (!link.startsWith("http://") && !link.startsWith("https://"));
};

/**
 * 根据配置渲染链接，兼容内部路由、后端渲染页面和 external 开关
 */
function FooterLink({
  href,
  children,
  className,
  title,
  external,
}: {
  href: string;
  children: React.ReactNode;
  className: string;
  title?: string;
  external?: boolean;
}) {
  const openInNewTab = typeof external === "boolean" ? external : !isInternalLink(href);

  if (isInternalLink(href) && !openInNewTab) {
    return (
      <Link className={className} href={href} prefetch={false} title={title}>
        {children}
      </Link>
    );
  }

  return (
    <a
      className={className}
      href={href}
      title={title}
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noopener external nofollow noreferrer" : undefined}
    >
      {children}
    </a>
  );
}

/**
 * 渲染图标
 */
function SocialIcon({ icon, title }: { icon: string; title: string }) {
  if (isImageUrl(icon)) {
    return <img src={icon} alt={title} className={styles.socialIconImg} />;
  }
  if (isIconifyIcon(icon)) {
    return <Icon icon={icon} className={styles.socialIconIconify} />;
  }
  return null;
}

export function Footer() {
  const siteConfig = useSiteConfigStore(state => state.siteConfig);
  const [displayedFriends, setDisplayedFriends] = useState<FriendLink[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [rotationCount, setRotationCount] = useState(0);
  const [uptimeStatus, setUptimeStatus] = useState<"loading" | "ok" | "partial" | "error">("loading");

  // Footer 配置
  const footerConfig = useMemo(() => {
    return {
      socialBar: siteConfig?.footer?.socialBar,
      projectList: siteConfig?.footer?.project?.list || [],
      randomFriendsCount: siteConfig?.footer?.list?.randomFriends || 0,
      owner: siteConfig?.footer?.owner,
      bar: siteConfig?.footer?.bar,
      badge: siteConfig?.footer?.badge,
    };
  }, [siteConfig]);

  // 备案信息
  const icpNumber = siteConfig?.ICP_NUMBER;
  const policeRecordNumber = siteConfig?.POLICE_RECORD_NUMBER;
  const policeRecordIcon = siteConfig?.POLICE_RECORD_ICON;

  // Uptime Kuma 配置
  const uptimeKumaConfig = useMemo(() => {
    const config = siteConfig?.footer?.uptime_kuma;
    if (!config) return null;
    const pageUrl = (config.page_url || "").replace(/\/$/, "");
    // 解析 API 地址和 slug
    const match = pageUrl.match(/^(https?:\/\/[^/]+)\/status\/(.+)$/);
    if (!match) return null;
    return {
      enable: config.enable === true || config.enable === "true",
      api_url: match[1],
      slug: match[2],
      page_url: pageUrl,
    };
  }, [siteConfig]);

  // 版权文本
  const copyrightText = useMemo(() => {
    if (!footerConfig.owner) return "";
    const since = footerConfig.owner.since;
    const author = footerConfig.owner.name;
    const authorLink = footerConfig.bar?.authorLink || "/about";
    const nowYear = new Date().getFullYear();
    let yearRange = String(nowYear);
    if (since && Number(since) !== nowYear) {
      yearRange = `${since} - ${nowYear}`;
    }
    return { yearRange, author, authorLink };
  }, [footerConfig.owner, footerConfig.bar?.authorLink]);

  // 获取随机友链
  const refreshFriendLinks = useCallback(async () => {
    if (isAnimating || footerConfig.randomFriendsCount <= 0) return;

    setIsAnimating(true);
    setRotationCount(prev => prev + 1);

    try {
      const result = await apiClient.get<FriendLink[]>(`/api/public/links/random`, {
        params: { num: footerConfig.randomFriendsCount },
      });
      if (result.code === 200 && result.data?.length > 0) {
        setDisplayedFriends(result.data);
      }
    } catch (error) {
      console.error("获取随机友链失败:", error);
    } finally {
      setTimeout(() => setIsAnimating(false), 300);
    }
  }, [isAnimating, footerConfig.randomFriendsCount]);

  // 获取 Uptime Kuma 状态
  const fetchUptimeKumaStatus = useCallback(async () => {
    if (!uptimeKumaConfig?.enable || !uptimeKumaConfig.api_url || !uptimeKumaConfig.slug) {
      return;
    }

    const apiUrl = `${uptimeKumaConfig.api_url}/api/status-page/heartbeat/${uptimeKumaConfig.slug}`;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        setUptimeStatus("error");
        return;
      }

      const data = await response.json();
      if (data.heartbeatList) {
        const monitors = Object.values(data.heartbeatList) as Array<Array<{ status: number }>>;
        let hasDown = false;

        for (const heartbeats of monitors) {
          if (heartbeats.length > 0) {
            const latestStatus = heartbeats[heartbeats.length - 1]?.status;
            if (latestStatus !== 1) {
              hasDown = true;
              break;
            }
          }
        }

        setUptimeStatus(hasDown ? "partial" : "ok");
      } else {
        setUptimeStatus("ok");
      }
    } catch {
      setUptimeStatus("error");
    }
  }, [uptimeKumaConfig]);

  // 初始化加载友链
  useEffect(() => {
    if (footerConfig.randomFriendsCount > 0) {
      refreshFriendLinks();
    }
  }, [footerConfig.randomFriendsCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // 初始化 Uptime Kuma 状态
  useEffect(() => {
    if (uptimeKumaConfig?.enable) {
      fetchUptimeKumaStatus();
      // 每5分钟更新一次状态
      const interval = setInterval(fetchUptimeKumaStatus, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [uptimeKumaConfig?.enable, fetchUptimeKumaStatus]);

  // 返回顶部
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Uptime 状态文本
  const uptimeStatusText = useMemo(() => {
    switch (uptimeStatus) {
      case "loading":
        return "状态获取中...";
      case "ok":
        return "所有业务正常";
      case "partial":
        return "部分服务异常";
      case "error":
        return "状态获取失败";
      default:
        return "";
    }
  }, [uptimeStatus]);

  // 底部徽章列表（启用且有为有效数组时使用）
  const badgeList = useMemo(() => {
    const enable = footerConfig.badge?.enable;
    if (enable !== true && enable !== "true") return [];
    const list = footerConfig.badge?.list;
    if (!Array.isArray(list) || list.length === 0) return [];
    return list;
  }, [footerConfig.badge]);

  // 如果没有配置则不显示
  const hasContent =
    footerConfig.socialBar ||
    footerConfig.projectList.length > 0 ||
    footerConfig.bar ||
    badgeList.length > 0;
  if (!hasContent) return null;

  return (
    <footer className={styles.footerContainer}>
      <div className={styles.footerWrap}>
        {/* 社交图标栏 */}
        {footerConfig.socialBar && (
          <div className={styles.footerSocialBar}>
            {/* 左侧社交图标 */}
            {footerConfig.socialBar.left?.map((item: SocialItem) => (
              <a
                key={item.link}
                className={styles.socialLink}
                href={item.link}
                title={item.title}
                target="_blank"
                rel="noopener external nofollow noreferrer"
              >
                <SocialIcon icon={item.icon} title={item.title} />
              </a>
            ))}

            {/* 中间图片（返回顶部） */}
            {footerConfig.socialBar.centerImg && (
              <img
                className={styles.footerBackToTop}
                src={footerConfig.socialBar.centerImg}
                alt="返回顶部"
                title="返回顶部"
                onClick={scrollToTop}
              />
            )}

            {/* 右侧社交图标 */}
            {footerConfig.socialBar.right?.map((item: SocialItem) => (
              <a
                key={item.link}
                className={styles.socialLink}
                href={item.link}
                title={item.title}
                target="_blank"
                rel="noopener external nofollow noreferrer"
              >
                <SocialIcon icon={item.icon} title={item.title} />
              </a>
            ))}
          </div>
        )}

        {/* 链接分组区域 */}
        {(footerConfig.projectList.length > 0 || footerConfig.randomFriendsCount > 0) && (
          <div className={styles.footerLinkGrid}>
            {/* 项目链接分组 */}
            {footerConfig.projectList.map((group: LinkGroup) => (
              <div key={group.title} className={styles.footerGroup}>
                <div className={styles.footerTitle}>{group.title}</div>
                <div className={styles.footerLinks}>
                  {group.links.map(link => (
                    <FooterLink
                      key={link.link}
                      href={link.link}
                      className={styles.footerItem}
                      title={link.title}
                      external={link.external}
                    >
                      {link.title}
                    </FooterLink>
                  ))}
                </div>
              </div>
            ))}

            {/* 随机友链分组 */}
            {footerConfig.randomFriendsCount > 0 && (
              <div className={styles.footerGroup}>
                <div className={styles.footerTitleGroup}>
                  <div className={styles.footerTitle}>友链</div>
                  <button
                    type="button"
                    className={styles.randomFriendsBtn}
                    aria-label="换一批友情链接"
                    title="换一批友情链接"
                    onClick={refreshFriendLinks}
                  >
                    <Icon
                      icon="fa6-solid:arrow-rotate-right"
                      className={isAnimating ? styles.isAnimating : ""}
                      style={{ transform: `rotate(${rotationCount * 360}deg)` }}
                    />
                  </button>
                </div>
                <div className={styles.footerLinks}>
                  {displayedFriends.map((friend, index) => (
                    <a
                      key={`${friend.name}-${friend.url}-${index}`}
                      className={styles.footerItem}
                      href={friend.url}
                      title={friend.name}
                      target="_blank"
                      rel="noopener nofollow"
                    >
                      {friend.name}
                    </a>
                  ))}
                  <Link href="/link" prefetch={false} className={styles.footerItem} title="更多友情链接">
                    更多
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 底部徽章：自定义徽章（如框架、CDN、协议等） */}
        {badgeList.length > 0 && (
          <p className={styles.footerBadges}>
            {badgeList.map((badge, index) => (
              <Tooltip
                key={badge.shields + String(index)}
                content={badge.message}
                placement="top"
                showArrow={false}
                offset={8}
                classNames={{ content: "custom-tooltip-content" }}
              >
                <a
                  className={styles.badgeLink}
                  href={badge.link}
                  target="_blank"
                  rel="external nofollow noreferrer"
                  title={badge.message}
                >
                  <img src={badge.shields} alt={badge.message} />
                </a>
              </Tooltip>
            ))}
          </p>
        )}
      </div>

      {/* Footer Bottom Bar */}
      {footerConfig.bar && (
        <div className={styles.footerBottomBar}>
          <div className={styles.barContent}>
            {/* 左侧：版权信息和备案号 */}
            <div className={styles.barLeft}>
              {/* 版权信息 */}
              {copyrightText && (
                <div className={styles.copyrightInfo}>
                  &copy;{copyrightText.yearRange} By{" "}
                  <a className={styles.barLink} href={copyrightText.authorLink} target="_blank" rel="noopener">
                    {copyrightText.author}
                  </a>
                </div>
              )}

              {/* 备案信息 */}
              {(policeRecordNumber || icpNumber || uptimeKumaConfig?.enable) && (
                <div className={styles.recordInfo}>
                  {/* 公安备案 */}
                  {policeRecordNumber && (
                    <Tooltip
                      content="前往全国互联网安全管理服务平台的备案信息查询页面"
                      placement="top"
                      showArrow={false}
                      offset={8}
                      classNames={{ content: "custom-tooltip-content" }}
                    >
                      <a
                        className={`${styles.recordLink} ${styles.policeRecordLink}`}
                        href="http://www.beian.gov.cn/portal/registerSystemInfo"
                        target="_blank"
                        rel="noopener"
                      >
                        {policeRecordIcon && (
                          <img src={policeRecordIcon} alt="公安备案" className={styles.policeRecordIcon} />
                        )}
                        {policeRecordNumber}
                      </a>
                    </Tooltip>
                  )}

                  {/* ICP 备案 */}
                  {icpNumber && (
                    <Tooltip
                      content="前往工业和信息化部政务服务平台的备案信息查询页面"
                      placement="top"
                      showArrow={false}
                      offset={8}
                      classNames={{ content: "custom-tooltip-content" }}
                    >
                      <a className={styles.recordLink} href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">
                        {icpNumber}
                      </a>
                    </Tooltip>
                  )}

                  {/* Uptime Kuma 状态 */}
                  {uptimeKumaConfig?.enable && (
                    <Tooltip
                      content="查看我的项目状态"
                      placement="top"
                      showArrow={false}
                      offset={8}
                      classNames={{ content: "custom-tooltip-content" }}
                    >
                      <a
                        className={`${styles.uptimeStatusIndicator} ${
                          styles[`status${uptimeStatus.charAt(0).toUpperCase() + uptimeStatus.slice(1)}`]
                        }`}
                        href={uptimeKumaConfig.page_url || "#"}
                        target={uptimeKumaConfig.page_url ? "_blank" : undefined}
                        rel="noopener"
                      >
                        <span className={styles.statusDot} />
                        <span className={styles.statusText}>{uptimeStatusText}</span>
                      </a>
                    </Tooltip>
                  )}
                </div>
              )}
            </div>

            {/* 右侧：链接列表和 CC 协议 */}
            <div className={styles.barRight}>
              {/* 链接列表 */}
              {footerConfig.bar.linkList?.map((link: FooterBarLink) => (
                <FooterLink key={link.text} href={link.link} className={styles.barLink} external={link.external}>
                  {link.text}
                </FooterLink>
              ))}

              {/* CC 协议图标 */}
              {footerConfig.bar.cc?.link && (
                <Tooltip
                  content="CC BY-NC-ND 4.0 协议"
                  placement="top"
                  showArrow={false}
                  offset={8}
                  classNames={{ content: "custom-tooltip-content" }}
                >
                  <a
                    className={`${styles.barLink} ${styles.ccLink}`}
                    href={footerConfig.bar.cc.link}
                    aria-label="CC BY-NC-ND 4.0 协议"
                    target="_blank"
                    rel="noopener"
                  >
                    <Icon icon="ri:copyright-line" />
                    <Icon icon="ri:creative-commons-by-line" />
                    <Icon icon="ri:creative-commons-nc-line" />
                    <Icon icon="ri:creative-commons-nd-line" />
                  </a>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
