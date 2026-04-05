"use client";

import type { Personalities } from "@/types/about";
import styles from "../about.module.css";

interface PersonalityCardProps {
  personalities: Personalities;
}

export function PersonalityCard({ personalities }: PersonalityCardProps) {
  return (
    <div className={`${styles.item} ${styles.personalities}`}>
      <div className={styles.itemTips}>{personalities.tips}</div>
      <div className={styles.itemTitle} style={{ fontSize: 20, marginBottom: 4 }}>
        {personalities.authorName}
      </div>
      <div className={styles.personalityTitle2} style={{ color: personalities.personalityTypeColor || "#ac899c" }}>
        {personalities.personalityType}
      </div>

      <div className={styles.postTips}>
        在{" "}
        <a href="https://www.16personalities.com/" target="_blank" rel="noopener nofollow">
          16personalities
        </a>{" "}
        了解更多关于{" "}
        <a href={personalities.nameUrl} target="_blank" rel="noopener external nofollow">
          {personalities.authorName}
        </a>
      </div>

      {personalities.personalityImg && (
        <div className={styles.personalityImage}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={personalities.personalityImg} alt="人格" />
        </div>
      )}
    </div>
  );
}
