"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import type { Music } from "@/types/about";
import styles from "../about.module.css";

interface MusicCardProps {
  music: Music;
  authorName: string;
}

export function MusicCard({ music, authorName }: MusicCardProps) {
  return (
    <div
      className={`${styles.item} ${styles.likeMusic}`}
      style={{ backgroundImage: `url(${music.background})`, backgroundSize: "cover", backgroundPosition: "top" }}
    >
      <div className={styles.cardContent}>
        <div className={styles.itemTips}>{music.tips}</div>
        <div className={styles.itemTitle} style={{ marginBottom: 8 }}>
          {music.title}
        </div>
        <div className={styles.contentBottom}>
          <span style={{ fontSize: 14, opacity: 0.8 }}>跟 {authorName} 一起欣赏更多音乐</span>
        </div>
      </div>

      {music.link && (
        <div className={styles.bannerButtonGroup}>
          <Link href={music.link} className={styles.bannerButton}>
            <Icon icon="tabler:circle-arrow-up-right-filled" width={22} height={22} />
            <span className={styles.bannerButtonText}>更多推荐</span>
          </Link>
        </div>
      )}
    </div>
  );
}
