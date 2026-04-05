"use client";

import styles from "./CardWechat.module.css";

interface WechatConfig {
  face: string;
  backFace: string;
  blurBackground: string;
  link?: string;
}

interface CardWechatProps {
  config: WechatConfig;
}

export function CardWechat({ config }: CardWechatProps) {
  const handleClick = () => {
    if (config.link) {
      window.open(config.link, "_blank");
    }
  };

  return (
    <div
      className={styles.cardWechat}
      style={{ "--blur-background": `url(${config.blurBackground})` } as React.CSSProperties}
      onClick={handleClick}
    >
      <div className={styles.flipWrapper}>
        <div className={styles.flipContent}>
          <div
            className={styles.face}
            style={{
              backgroundImage: `url(${config.face})`,
            }}
          />
          <div
            className={`${styles.face} ${styles.back}`}
            style={{
              backgroundImage: `url(${config.backFace})`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
