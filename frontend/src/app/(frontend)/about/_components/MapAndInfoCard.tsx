"use client";

import { useEffect, useState } from "react";
import type { AboutMap, SelfInfo } from "@/types/about";
import styles from "../about.module.css";

interface MapAndInfoCardProps {
  map: AboutMap;
  selfInfo: SelfInfo;
}

export function MapAndInfoCard({ map, selfInfo }: MapAndInfoCardProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const bgImage = isDark ? map.backgroundDark : map.background;

  return (
    <div className={`${styles.itemGroup} ${styles.mapAndInfo}`}>
      <div className={`${styles.item} ${styles.map} ${styles.single}`} style={{ backgroundImage: `url(${bgImage})` }}>
        <span className={styles.mapTitle}>
          {map.title} <b>{map.strengthenTitle}</b>
        </span>
      </div>
      <div className={`${styles.item} ${styles.selfInfo} ${styles.single}`}>
        <div className={styles.selfInfoItem}>
          <span className={styles.selfInfoLabel}>{selfInfo.tips1}</span>
          <span className={styles.selfInfoValue} style={{ color: "#43a6c6" }}>
            {selfInfo.contentYear}
          </span>
        </div>
        <div className={styles.selfInfoItem}>
          <span className={styles.selfInfoLabel}>{selfInfo.tips2}</span>
          <span className={styles.selfInfoValue} style={{ color: "#c69043" }}>
            {selfInfo.content2}
          </span>
        </div>
        <div className={styles.selfInfoItem}>
          <span className={styles.selfInfoLabel}>{selfInfo.tips3}</span>
          <span className={styles.selfInfoValue} style={{ color: "#b04fe6" }}>
            {selfInfo.content3}
          </span>
        </div>
      </div>
    </div>
  );
}
