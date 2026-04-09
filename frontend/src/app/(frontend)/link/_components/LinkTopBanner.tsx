"use client";

import { useState, useMemo, useCallback } from "react";
import { Send, Navigation } from "lucide-react";
import { usePublicLinks } from "@/hooks/queries/use-friends";
import { friendsApi } from "@/lib/api/friends";
import type { LinkItem } from "@/types/friends";

interface LinkTopBannerProps {
  onScrollToApply: () => void;
}

export function LinkTopBanner({ onScrollToApply }: LinkTopBannerProps) {
  const [isVisitingRandom, setIsVisitingRandom] = useState(false);

  // 获取前100个友链用于横幅展示
  const { data } = usePublicLinks({ page: 1, pageSize: 100 });

  const bannerLinks = useMemo(() => {
    if (!data?.list) return [];
    const allLinks = data.list;
    // 优先使用 card 样式的友链（有截图），再补充 list 样式
    const cardLinks = allLinks.filter(link => link.category?.style === "card");
    const listLinks = allLinks.filter(link => link.category?.style === "list");
    let finalLinks = [...cardLinks];
    if (finalLinks.length < 30) {
      const needed = 30 - finalLinks.length;
      finalLinks = [...finalLinks, ...listLinks.slice(0, needed)];
    }
    return finalLinks.slice(0, 30);
  }, [data]);

  // 填充到60个用于无缝滚动
  const displayLinkList = useMemo(() => {
    const list = bannerLinks;
    const TARGET = 60;
    const n = list.length;
    if (n === 0) return [];
    return Array.from({ length: TARGET }, (_, i) => list[i % n]);
  }, [bannerLinks]);

  // 每两个一组
  const pairedLinkList = useMemo(() => {
    const pairs: LinkItem[][] = [];
    for (let i = 0; i < displayLinkList.length; i += 2) {
      pairs.push(displayLinkList.slice(i, i + 2));
    }
    return pairs;
  }, [displayLinkList]);

  const handleRandomVisit = useCallback(async () => {
    if (isVisitingRandom) return;
    setIsVisitingRandom(true);
    try {
      const links = await friendsApi.getRandomLinks(1);
      if (links.length > 0) {
        window.open(links[0].url, "_blank");
      }
    } catch (error) {
      console.error("请求随机友链失败", error);
    } finally {
      setIsVisitingRandom(false);
    }
  }, [isVisitingRandom]);

  return (
    <div className="flink_top">
      <div className="banners-title">
        <div className="banners-title-small">友情链接</div>
        <div className="banners-title-big">与数百名博主无限进步</div>
      </div>
      <div className="banner-button-group">
        <button className="banner-button secondary" disabled={isVisitingRandom} onClick={handleRandomVisit}>
          <span className="banner-button-icon">
            <Navigation className="w-4 h-4" />
          </span>
          <span className="banner-button-text">随机访问</span>
        </button>
        <a
          className="banner-button"
          href="#apply"
          onClick={e => {
            e.preventDefault();
            onScrollToApply();
          }}
        >
          <span className="banner-button-icon">
            <Send className="w-4 h-4" />
          </span>
          <span className="banner-button-text">申请友链</span>
        </a>
      </div>
      <div className="tags-group-all">
        <div className="tags-group-wrapper">
          {pairedLinkList.map((pair, index) => (
            <div key={index} className="tags-group-icon-pair">
              {pair.map((item, j) => (
                <a
                  key={`${index}-${j}`}
                  className="tags-group-icon"
                  href={item.url}
                  rel="external nofollow"
                  target="_blank"
                  title={item.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.logo} alt={item.name} />
                  <span className="tags-group-title">{item.name}</span>
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
