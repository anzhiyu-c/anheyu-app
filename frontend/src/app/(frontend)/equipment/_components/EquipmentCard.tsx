"use client";

import { useState } from "react";
import { RiChat1Fill } from "react-icons/ri";
import type { EquipmentItem } from "./types";

interface EquipmentCardProps {
  item: EquipmentItem;
}

export function EquipmentCard({ item }: EquipmentCardProps) {
  const [imgError, setImgError] = useState(false);

  const handleCommentQuote = () => {
    const quoteText = item.description.trim().slice(0, 50);

    window.dispatchEvent(
      new CustomEvent("comment-form-set-quote", {
        detail: {
          text: quoteText,
          targetPath: "/equipment",
        },
      })
    );

    const el = document.getElementById("post-comment");
    if (el) {
      const top = el.getBoundingClientRect().top + window.pageYOffset - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <div className="relative min-h-[400px] overflow-hidden rounded-xl border border-(--style-border-color) bg-(--anzhiyu-card-bg) shadow-(--anzhiyu-shadow-border)">
      {/* 图片区域 */}
      <div className="flex h-[200px] items-center justify-center border-b border-(--style-border-color) bg-(--anzhiyu-secondbg)">
        {item.image && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt={item.name}
            className="h-4/5 w-[260px] object-contain"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-4xl text-(--anzhiyu-secondtext)">{item.name.charAt(0) || "?"}</span>
        )}
      </div>

      {/* 内容区域 */}
      <div className="mt-3 px-4 pb-16">
        <div
          className="mb-2 w-fit cursor-pointer truncate text-lg font-bold leading-none text-(--anzhiyu-fontcolor) transition-colors hover:text-(--anzhiyu-main)"
          title={item.name}
        >
          {item.name}
        </div>

        {item.specification && (
          <div className="mb-1.5 truncate text-xs leading-4 text-(--anzhiyu-secondtext)">{item.specification}</div>
        )}

        {item.description && (
          <div className="line-clamp-3 h-[60px] text-sm leading-5 text-(--anzhiyu-secondtext)">{item.description}</div>
        )}
      </div>

      {/* 底部工具栏：绝对定位贴底 */}
      <div className="absolute bottom-3 left-0 flex w-full items-center justify-between px-4">
        {item.link ? (
          <a
            href={item.link}
            target="_blank"
            rel="external nofollow noreferrer"
            className="rounded-lg bg-(--anzhiyu-gray-op) px-3 py-1.5 text-xs text-(--anzhiyu-fontcolor) no-underline transition-all hover:bg-(--anzhiyu-main) hover:text-(--anzhiyu-white)"
          >
            详情
          </a>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={handleCommentQuote}
          className="flex items-center justify-center rounded-lg bg-(--anzhiyu-gray-op) px-3 py-1.5 text-(--anzhiyu-fontcolor) transition-all hover:bg-(--anzhiyu-main) hover:text-(--anzhiyu-white)"
        >
          <RiChat1Fill size={14} />
        </button>
      </div>
    </div>
  );
}
