"use client";

import styles from "../about.module.css";

interface PhotoCardProps {
  photoUrl: string;
}

export function PhotoCard({ photoUrl }: PhotoCardProps) {
  return (
    <div className={`${styles.item} ${styles.myphoto}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photoUrl} alt="照片" />
    </div>
  );
}
