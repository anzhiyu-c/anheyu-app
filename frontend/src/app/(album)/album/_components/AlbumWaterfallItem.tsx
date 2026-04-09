"use client";
/* eslint-disable @next/next/no-img-element */

import { Icon } from "@iconify/react";
import type { PublicAlbumItem } from "@/types/album";
import { buildAlbumImageWithParam } from "../_utils/album-image-src";

interface AlbumWaterfallItemProps {
  item: PublicAlbumItem;
  index: number;
  enableComment?: boolean;
  onPreview: (index: number) => void;
  onComment: () => void;
}

export function AlbumWaterfallItem({ item, index, onPreview }: AlbumWaterfallItemProps) {
  return (
    <div className="album-waterfall-item" onClick={() => onPreview(index)}>
      <img
        className="waterfall-image"
        src={buildAlbumImageWithParam(item.imageUrl, item.thumbParam)}
        alt={item.title || "相册图片"}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      {item.location?.trim() ? (
        <span className="waterfall-location-badge">
          <Icon icon="ri:map-pin-2-fill" />
          {item.location.trim()}
        </span>
      ) : null}
    </div>
  );
}
