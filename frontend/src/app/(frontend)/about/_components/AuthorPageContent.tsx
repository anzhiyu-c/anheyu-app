"use client";

import { AboutSiteTips } from "./AboutSiteTips";
import type { AboutSiteTips as AboutSiteTipsType } from "@/types/about";
import styles from "../about.module.css";

interface AuthorPageContentProps {
  name: string;
  description: string;
  aboutSiteTips: AboutSiteTipsType;
}

export function AuthorPageContent({ name, description, aboutSiteTips }: AuthorPageContentProps) {
  return (
    <div className={styles.authorContent}>
      <div className={`${styles.item} ${styles.myInfoAndSayHello}`}>
        <div className={styles.title1}>你好，很高兴认识你👋</div>
        <div className={styles.title2}>
          我叫 <span className={styles.inlineWord}>{name}</span>
        </div>
        <div className={styles.title1}>{description}</div>
      </div>
      <AboutSiteTips config={aboutSiteTips} />
    </div>
  );
}
