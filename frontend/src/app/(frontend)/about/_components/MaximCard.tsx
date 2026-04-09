"use client";

import type { Maxim } from "@/types/about";
import styles from "../about.module.css";

interface MaximCardProps {
  maxim: Maxim;
}

export function MaximCard({ maxim }: MaximCardProps) {
  return (
    <div className={`${styles.item} ${styles.maxim}`}>
      <div className={styles.itemTips}>{maxim.tips}</div>
      <div className={styles.maximTitle}>
        <span style={{ marginBottom: 8, opacity: 0.6 }}>{maxim.top}</span>
        <span>{maxim.bottom}</span>
      </div>
    </div>
  );
}
