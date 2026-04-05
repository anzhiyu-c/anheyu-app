/*
 * @Author: 安知鱼
 * @Date: 2026-02-13 10:53:46
 * @Description:
 * @LastEditTime: 2026-02-13 11:03:53
 * @LastEditors: 安知鱼
 */
"use client";

import type { LinkItem } from "@/types/friends";

interface SiteCardGroupProps {
  links: LinkItem[];
}

export function SiteCardGroup({ links }: SiteCardGroupProps) {
  return (
    <div className="site-card-group">
      {links.map(link => (
        <div key={link.id} className="site-card">
          {link.tag && (
            <span className="link-tag" style={{ background: link.tag.color }}>
              {link.tag.name}
              <i className="light" />
            </span>
          )}

          <a className="img" target="_blank" title={link.name} href={link.url} rel="external nofollow">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="flink-avatar"
              src={link.siteshot || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
              alt={link.name}
              loading="lazy"
            />
          </a>
          <a className="info" target="_blank" title={link.name} href={link.url} rel="external nofollow">
            <div className="site-card-avatar">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="flink-avatar" src={link.logo} alt={link.name} loading="lazy" />
            </div>
            <div className="site-card-text">
              <span className="title">{link.name}</span>
              <span className="desc" title={link.description}>
                {link.description}
              </span>
            </div>
          </a>
        </div>
      ))}
    </div>
  );
}
