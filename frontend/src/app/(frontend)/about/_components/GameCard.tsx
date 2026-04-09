"use client";

import type { Game } from "@/types/about";
import styles from "../about.module.css";

interface GameCardProps {
  game: Game;
}

export function GameCard({ game }: GameCardProps) {
  return (
    <div
      className={`${styles.item} ${styles.gameYuanshen}`}
      style={{ backgroundImage: `url(${game.background})`, backgroundPosition: "top" }}
    >
      <div className={styles.cardContent}>
        <div className={styles.itemTips}>{game.tips}</div>
        <span className={styles.itemTitle}>{game.title}</span>
        <div className={styles.gameContentBottom}>
          <div style={{ position: "relative", display: "flex" }}>
            {game.title === "原神" && <div className={styles.loadingBar} role="presentation" aria-hidden="true" />}
          </div>
          <div className={styles.gameUid}>{game.uid}</div>
        </div>
      </div>
    </div>
  );
}
