"use client";
/* eslint-disable @next/next/no-img-element */

import { Music2 } from "lucide-react";
import type { Song } from "@/types/music";
import styles from "../music.module.css";

interface VinylPlayerProps {
  currentSong: Song | null;
  isPlaying: boolean;
  borderColor: string;
  vinylImages: {
    background: string;
    outer: string;
    inner: string;
    needle: string;
    groove: string;
  };
  onPlayPause: () => void;
}

export function VinylPlayer({ currentSong, isPlaying, borderColor, vinylImages, onPlayPause }: VinylPlayerProps) {
  const playLabel = currentSong
    ? isPlaying
      ? `暂停 ${currentSong.name}`
      : `播放 ${currentSong.name}`
    : "暂无可播放歌曲";

  return (
    <div className={styles.albumArtwork}>
      <button
        type="button"
        className={`${styles.artworkContainer} ${isPlaying ? styles.isPlaying : ""}`}
        style={{ cursor: currentSong ? "pointer" : "default" }}
        aria-label={playLabel}
        disabled={!currentSong}
        onClick={onPlayPause}
      >
        {/* 唱片背景 */}
        <img src={vinylImages.background} alt="唱片背景" className={styles.vinylBackground} />
        {/* 唱片外圈 */}
        <img src={vinylImages.outer} alt="唱片外圈" className={styles.artworkImageVinylBackground} />
        {/* 唱片内圈 */}
        <img src={vinylImages.inner} alt="唱片内圈" className={styles.artworkImageVinylInnerBackground} />
        {/* 撞针 */}
        <img
          src={vinylImages.needle}
          alt="撞针"
          className={`${styles.artworkImageNeedleBackground} ${isPlaying ? styles.needlePlaying : ""}`}
        />
        {/* 凹槽 */}
        <img src={vinylImages.groove} alt="凹槽背景" className={styles.artworkImageGrooveBackground} />

        {/* 专辑封面 */}
        {currentSong?.pic ? (
          <div className={styles.artworkTransitionWrapper}>
            <div className={styles.artworkRotateWrapper}>
              <img
                src={currentSong.pic}
                alt={currentSong.name}
                className={styles.artworkImage}
                style={{ borderColor }}
              />
              <img src={currentSong.pic} alt={`${currentSong.name} 模糊背景`} className={styles.artworkImageBlur} />
              <div className={styles.artworkBorderRing} />
            </div>
          </div>
        ) : (
          <div className={styles.artworkPlaceholder}>
            <Music2 />
          </div>
        )}

        {/* 播放指示器 */}
        {isPlaying && (
          <div className={styles.playingIndicator}>
            <div className={styles.soundWave}>
              <div className={styles.waveBar} />
              <div className={styles.waveBar} />
              <div className={styles.waveBar} />
              <div className={styles.waveBar} />
            </div>
          </div>
        )}
      </button>

      {/* 歌曲信息 */}
      <div className={styles.trackInfo}>
        <h2 className={styles.trackTitle}>
          {(currentSong?.name || "") + (currentSong?.artist ? " - " + currentSong.artist : "")}
        </h2>
      </div>
    </div>
  );
}
