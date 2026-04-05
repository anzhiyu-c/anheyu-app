"use client";

import type { Careers } from "@/types/about";
import styles from "../about.module.css";

interface CareersCardProps {
  careers: Careers;
}

export function CareersCard({ careers }: CareersCardProps) {
  return (
    <div className={`${styles.item} ${styles.careers}`}>
      <div className={styles.cardContent}>
        <div className={styles.itemTips}>{careers.tips}</div>
        <span className={styles.itemTitle}>{careers.title}</span>
        <div className={styles.careersGroup}>
          {careers.list && careers.list.length > 0 ? (
            careers.list.map((career, index) => (
              <div key={index} className={styles.careerItem}>
                <div className={styles.careerCircle} style={{ background: career.color || "#357ef5" }} />
                <div className={styles.careerName}>{career.desc}</div>
              </div>
            ))
          ) : (
            <div style={{ opacity: 0.6 }}>暂无职业经历</div>
          )}
        </div>
        {careers.img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.careersImg} src={careers.img} alt={careers.tips} />
        )}
      </div>
    </div>
  );
}
