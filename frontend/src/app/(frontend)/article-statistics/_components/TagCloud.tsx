"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Tag } from "lucide-react";
import type { TagStatItem } from "@/types/article-statistics";
import styles from "../article-statistics.module.css";

interface TagCloudProps {
  tags: TagStatItem[];
}

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#6366f1",
];

export function TagCloud({ tags }: TagCloudProps) {
  const safeTags = useMemo(() => (Array.isArray(tags) ? tags : []), [tags]);
  const displayTags = useMemo(() => safeTags.slice(0, 20), [safeTags]);
  const maxCount = useMemo(() => Math.max(...safeTags.map(t => t.count), 1), [safeTags]);

  const getTagSize = (count: number): string => {
    const minSize = 12;
    const maxSize = 20;
    const ratio = count / maxCount;
    return `${minSize + ratio * (maxSize - minSize)}px`;
  };

  const getTagColor = (index: number): string => COLORS[index % COLORS.length];

  return (
    <div className={styles.listCard} style={{ animationDelay: "0.4s" }}>
      <h3 className={styles.listCardTitle}>
        <Tag />
        标签分布
      </h3>
      <div className={styles.tagCloud}>
        {displayTags.length === 0 ? (
          <div className={styles.emptyState}>暂无标签数据</div>
        ) : (
          <div className={styles.tagsContainer}>
            {displayTags.map((tag, index) => {
              const color = getTagColor(index);
              return (
                <Link
                  key={tag.name}
                  href={`/tags/${tag.name}/`}
                  className={styles.tagItem}
                  style={{
                    fontSize: getTagSize(tag.count),
                    backgroundColor: color + "20",
                    color: color,
                    borderColor: color + "40",
                  }}
                >
                  <span className={styles.tagName}># {tag.name}</span>
                  <span className={styles.tagCount}>{tag.count}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
