"use client";

import type { Like } from "@/types/about";
import styles from "../about.module.css";

interface LikeTechCardProps {
  like: Like;
}

export function LikeTechCard({ like }: LikeTechCardProps) {
  return (
    <div
      className={`${styles.item} ${styles.likeTechnology}`}
      style={{ backgroundImage: `url(${like.background})`, backgroundSize: "cover", backgroundPosition: "top" }}
    >
      <div className={styles.cardContent}>
        <div className={styles.itemTips}>{like.tips}</div>
        <div className={styles.itemTitle} style={{ marginBottom: 8 }}>
          {like.title}
        </div>
        <div className={styles.contentBottom}>
          <span style={{ fontSize: 14, opacity: 0.8 }}>{like.bottom}</span>
        </div>
      </div>
    </div>
  );
}
