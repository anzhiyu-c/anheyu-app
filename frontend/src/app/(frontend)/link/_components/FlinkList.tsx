"use client";

import type { LinkItem } from "@/types/friends";

interface FlinkListProps {
  links: LinkItem[];
}

export function FlinkList({ links }: FlinkListProps) {
  return (
    <div className="flink-list">
      {links.map(link => (
        <div key={link.id} className="flink-list-item">
          {link.tag && (
            <span className="link-tag" style={{ background: link.tag.color }}>
              {link.tag.name}
              <i className="light" />
            </span>
          )}

          <a className="cf-friends-link" href={link.url} rel="external nofollow" title={link.name} target="_blank">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="flink-avatar" src={link.logo} alt={link.name} loading="lazy" />
            <div className="flink-item-info">
              <span className="flink-item-name">{link.name}</span>
              <span className="flink-item-desc" title={link.description}>
                {link.description}
              </span>
            </div>
          </a>
        </div>
      ))}
    </div>
  );
}
