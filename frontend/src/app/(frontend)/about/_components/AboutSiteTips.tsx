"use client";

import { useEffect, useRef, useCallback } from "react";
import type { AboutSiteTips as AboutSiteTipsType } from "@/types/about";
import styles from "../about.module.css";

interface AboutSiteTipsProps {
  config: AboutSiteTipsType;
}

export function AboutSiteTips({ config }: AboutSiteTipsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const rotateWords = useCallback(() => {
    if (!containerRef.current) return;
    const show = containerRef.current.querySelector("span[data-show]");
    const next = show?.nextElementSibling || containerRef.current.querySelector(`.${styles.firstTips}`);
    const up = containerRef.current.querySelector("span[data-up]");

    if (up) up.removeAttribute("data-up");
    if (show) {
      show.removeAttribute("data-show");
      show.setAttribute("data-up", "");
    }
    if (next) next.setAttribute("data-show", "");
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(rotateWords, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [rotateWords]);

  if (!config?.word || config.word.length < 2) return null;

  const middleWords = config.word.length > 2 ? config.word.slice(0, -2) : [];
  const secondLast = config.word[config.word.length - 2];
  const lastWord = config.word[config.word.length - 1];

  return (
    <div className={`${styles.item} ${styles.aboutSiteTips}`}>
      <div className={styles.itemTips}>{config.tips}</div>
      <h2>
        {config.title1}
        <br />
        {config.title2}
        <div ref={containerRef} className={styles.wordMask}>
          {middleWords.map((word, i) => (
            <span
              key={i}
              className={`${styles.wordItem} ${styles[`wordColor${(i % 4) + 1}`]} ${i === 0 ? styles.firstTips : ""}`}
            >
              {word}
            </span>
          ))}
          {secondLast && (
            <span className={`${styles.wordItem} ${styles[`wordColor${(middleWords.length % 4) + 1}`]}`} data-up="">
              {secondLast}
            </span>
          )}
          {lastWord && (
            <span
              className={`${styles.wordItem} ${styles[`wordColor${((middleWords.length + 1) % 4) + 1}`]}`}
              data-show=""
            >
              {lastWord}
            </span>
          )}
        </div>
      </h2>
    </div>
  );
}
