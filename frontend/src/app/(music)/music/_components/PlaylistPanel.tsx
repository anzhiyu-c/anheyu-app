"use client";

import { useRef, useEffect, useCallback } from "react";
import { gsap } from "gsap";
import { X, Music2, Pause } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import type { Song, AudioState } from "@/types/music";
import styles from "../music.module.css";

interface PlaylistPanelProps {
  show: boolean;
  playlist: Song[];
  currentSongIndex: number;
  audioState: AudioState;
  onClose: () => void;
  onSelectSong: (index: number) => void;
}

export function PlaylistPanel({
  show,
  playlist,
  currentSongIndex,
  audioState,
  onClose,
  onSelectSong,
}: PlaylistPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isAnimatingRef = useRef(false);

  // 显示动画
  useEffect(() => {
    if (!show || !containerRef.current || !backdropRef.current || !panelRef.current) return;
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    const isMobile = window.innerWidth <= 768;

    gsap.set(backdropRef.current, { opacity: 0 });

    if (isMobile) {
      gsap.set(panelRef.current, { y: "100%", x: "0%", opacity: 1 });
      const tl = gsap.timeline({
        onComplete: () => {
          isAnimatingRef.current = false;
        },
      });
      tl.to(backdropRef.current, { opacity: 1, duration: 0.3, ease: "power2.out" }).to(
        panelRef.current,
        { y: "0%", duration: 0.4, ease: "power3.out" },
        0.1
      );
    } else {
      gsap.set(panelRef.current, { x: "100%", y: "0%", opacity: 1 });
      const tl = gsap.timeline({
        onComplete: () => {
          isAnimatingRef.current = false;
        },
      });
      tl.to(backdropRef.current, { opacity: 1, duration: 0.25, ease: "power2.out" }).to(
        panelRef.current,
        { x: "0%", duration: 0.35, ease: "power3.out" },
        0.1
      );
    }
  }, [show]);

  // 关闭动画
  const handleClose = useCallback(() => {
    if (!backdropRef.current || !panelRef.current) {
      onClose();
      return;
    }
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    const isMobile = window.innerWidth <= 768;
    const tl = gsap.timeline({
      onComplete: () => {
        isAnimatingRef.current = false;
        onClose();
      },
    });

    if (isMobile) {
      tl.to(panelRef.current, { y: "100%", x: "0%", duration: 0.35, ease: "power2.in" }, 0);
    } else {
      tl.to(panelRef.current, { x: "100%", y: "0%", duration: 0.3, ease: "power2.in" }, 0);
    }

    tl.to(backdropRef.current, { opacity: 0, duration: 0.2, ease: "power1.in" }, 0.1);
  }, [onClose]);

  // 点击遮罩关闭
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === backdropRef.current || event.target === containerRef.current) {
        handleClose();
      }
    },
    [handleClose]
  );

  const handleImageError = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    (event.target as HTMLImageElement).style.display = "none";
  }, []);

  if (!show) return null;

  return (
    <div ref={containerRef} className={styles.playlistContainer} onClick={handleBackdropClick}>
      <div ref={backdropRef} className={styles.playlistBackdrop} />
      <div ref={panelRef} className={styles.playlistPanel}>
        {/* 拖拽手柄（移动端） */}
        <div className={styles.playlistHandle}>
          <div className={styles.handleBar} />
        </div>

        {/* 头部 */}
        <div className={styles.playlistHeader}>
          <div className={styles.headerContent}>
            <div className={styles.headerInfo}>
              <h3 className={styles.playlistTitle}>当前播放</h3>
              <span className={styles.playlistCount}>{playlist.length} 首歌曲</span>
            </div>
            <Tooltip content="关闭列表" placement="top" showArrow={false} delay={120}>
              <button className={styles.closeBtn} aria-label="关闭列表" onClick={handleClose}>
                <X size={16} />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* 歌曲列表 */}
        <div className={styles.playlistBody}>
          <div className={styles.playlistList}>
            {playlist.map((song, index) => (
              <button
                type="button"
                key={song.id || index}
                className={`${styles.songItem} ${index === currentSongIndex ? styles.isActive : ""}`}
                aria-label={`${song.name} - ${song.artist || "未知歌手"}`}
                onClick={() => onSelectSong(index)}
              >
                {/* 序号或播放状态 */}
                <div className={styles.songNumber}>
                  {index !== currentSongIndex ? (
                    <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                  ) : (
                    <div className={styles.songPlayingIndicator}>
                      {audioState.isPlaying ? (
                        <div className={styles.songWaveAnimation}>
                          <span className={styles.songWaveBar} />
                          <span className={styles.songWaveBar} />
                          <span className={styles.songWaveBar} />
                        </div>
                      ) : (
                        <Pause size={14} />
                      )}
                    </div>
                  )}
                </div>

                {/* 歌曲信息 */}
                <div className={styles.songContent}>
                  <div className={styles.songMeta}>
                    <h4 className={styles.songTitle}>{song.name}</h4>
                    <p className={styles.songArtist}>{song.artist || "未知歌手"}</p>
                  </div>
                </div>

                {/* 封面 */}
                <div className={styles.songArtwork}>
                  {song.pic ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={song.pic} alt={song.name} onError={handleImageError} />
                  ) : (
                    <div className={styles.songArtworkPlaceholder}>
                      <Music2 size={18} />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
