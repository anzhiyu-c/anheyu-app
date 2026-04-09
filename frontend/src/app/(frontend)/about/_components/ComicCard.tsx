"use client";

import type { Comic } from "@/types/about";
import styles from "../about.module.css";

interface ComicCardProps {
  comic: Comic;
}

export function ComicCard({ comic }: ComicCardProps) {
  return (
    <div className={`${styles.item} ${styles.comicContent}`}>
      <div className={`${styles.cardContent} ${styles.comicCardContent}`}>
        <div className={styles.itemTips}>{comic.tips}</div>
        <div className={styles.itemTitle}>{comic.title}</div>
        <div className={styles.comicBox}>
          {comic.list.map((item, index) => (
            <a
              key={index}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              title={item.name}
              className={styles.comicItem}
            >
              <div className={styles.comicItemCover}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.cover} alt={item.name} />
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
