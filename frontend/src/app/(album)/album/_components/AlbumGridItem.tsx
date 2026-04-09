"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo } from "react";
import type { PublicAlbumItem } from "@/types/album";
import { buildAlbumImageWithParam } from "../_utils/album-image-src";

interface AlbumGridItemProps {
  item: PublicAlbumItem;
  index: number;
  onPreview: (index: number) => void;
}

function parseTags(tags?: string): string[] {
  if (!tags) return [];
  return tags
    .split(",")
    .map(tag => tag.trim())
    .filter(Boolean);
}

export function AlbumGridItem({ item, index, onPreview }: AlbumGridItemProps) {
  const tags = useMemo(() => parseTags(item.tags), [item.tags]);

  return (
    <div className="album-grid-item" style={{ ["--item-index" as string]: index }} onClick={() => onPreview(index)}>
      <img
        src={buildAlbumImageWithParam(item.imageUrl, item.thumbParam)}
        alt={item.title || "相册图片"}
        loading="lazy"
        referrerPolicy="no-referrer"
      />

      {item.title || item.description ? (
        <div className="image-info">
          {item.title ? <h2>{item.title}</h2> : null}
          {item.description ? <p className="image-desc">{item.description}</p> : null}
        </div>
      ) : null}

      {tags.length > 0 ? (
        <div className="tag-info">
          <span className="tag-categorys">
            {tags.map((tag, tagIndex) => (
              <span key={`${tag}-${tagIndex}`} className="tag">
                {tag}
              </span>
            ))}
          </span>
        </div>
      ) : null}
    </div>
  );
}
