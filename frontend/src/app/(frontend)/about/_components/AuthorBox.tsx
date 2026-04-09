"use client";

import styles from "../about.module.css";

interface AuthorBoxProps {
  avatarImg: string;
  avatarSkillsLeft: string[];
  avatarSkillsRight: string[];
}

export function AuthorBox({ avatarImg, avatarSkillsLeft, avatarSkillsRight }: AuthorBoxProps) {
  return (
    <div className={styles.authorBox}>
      <div className={styles.authorTagLeft}>
        {avatarSkillsLeft.map((skill, i) => (
          <span key={i} className={styles.authorTag}>
            {skill}
          </span>
        ))}
      </div>
      <div className={styles.authorImg}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarImg} alt="avatar" />
      </div>
      <div className={styles.authorTagRight}>
        {avatarSkillsRight.map((skill, i) => (
          <span key={i} className={styles.authorTag}>
            {skill}
          </span>
        ))}
      </div>
    </div>
  );
}
