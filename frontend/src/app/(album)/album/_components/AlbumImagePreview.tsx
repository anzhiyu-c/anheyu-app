"use client";
/* eslint-disable @next/next/no-img-element */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gsap } from "gsap";
import { Icon } from "@iconify/react";
import type { AlbumStatType, PublicAlbumItem } from "@/types/album";
import { useMounted } from "@/hooks/use-mounted";
import { DownloadProgressBar, type DownloadProgressBarHandle } from "./DownloadProgressBar";
import { buildAlbumImageWithParam } from "../_utils/album-image-src";

interface AlbumImagePreviewProps {
  siteName?: string;
  onUpdateStat?: (item: PublicAlbumItem, type: AlbumStatType) => Promise<void>;
}

export interface AlbumImagePreviewHandle {
  open: (list: PublicAlbumItem[], index?: number, switching?: boolean) => void;
  close: () => void;
  downImage: (item: PublicAlbumItem) => void;
}

const SWIPE_THRESHOLD = 50;

function formatToChina(datetime?: string): string {
  if (!datetime) return "-";
  const date = new Date(datetime);
  if (Number.isNaN(date.getTime())) return datetime;

  const utcMs = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
  const chinaDate = new Date(utcMs + 8 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${chinaDate.getUTCFullYear()}-${pad(chinaDate.getUTCMonth() + 1)}-${pad(chinaDate.getUTCDate())} ${pad(chinaDate.getUTCHours())}:${pad(chinaDate.getUTCMinutes())}:${pad(chinaDate.getUTCSeconds())}`;
}

function formatFileSize(size?: number): string {
  if (!size || size <= 0) return "0 B";
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(2)} KB`;
  return `${size} B`;
}

function getImageExtension(url: string): string {
  const cleanUrl = url.split("?")[0].split("#")[0];
  const dotIndex = cleanUrl.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === cleanUrl.length - 1) {
    return "jpg";
  }
  return cleanUrl.slice(dotIndex + 1).toLowerCase();
}

function buildPreviewImageUrl(item: PublicAlbumItem | undefined): string {
  if (!item) return "";
  return buildAlbumImageWithParam(item.imageUrl, item.bigParam);
}

function getImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.referrerPolicy = "no-referrer";
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      reject(new Error("failed to load image size"));
    };
    image.src = url;
  });
}

export const AlbumImagePreview = forwardRef<AlbumImagePreviewHandle, AlbumImagePreviewProps>(function AlbumImagePreview(
  { siteName, onUpdateStat },
  ref
) {
  const mounted = useMounted();
  const [visible, setVisible] = useState(false);
  const [previewList, setPreviewList] = useState<PublicAlbumItem[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [downloadCount, setDownloadCount] = useState(0);
  const [imageKey, setImageKey] = useState("");

  const popupRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const progressRef = useRef<DownloadProgressBarHandle>(null);
  const currentSizeRef = useRef({ width: 0, height: 0 });
  const sizeCacheRef = useRef<Map<string, { width: number; height: number }>>(new Map());
  const touchStartXRef = useRef(0);

  const currentItem = previewList[previewIndex];
  const currentImageUrl = useMemo(() => buildPreviewImageUrl(currentItem), [currentItem]);

  const updateCurrentListItem = useCallback((id: number, updater: (item: PublicAlbumItem) => PublicAlbumItem) => {
    setPreviewList(prev => prev.map(item => (item.id === id ? updater(item) : item)));
  }, []);

  const resizePopup = useCallback(() => {
    if (!visible || !popupRef.current || loading) {
      return;
    }

    const isMobile = window.innerWidth <= 736;
    if (isMobile) {
      gsap.set(popupRef.current, {
        width: "100vw",
        height: "100vh",
        top: 0,
        left: 0,
        xPercent: 0,
        yPercent: 0,
        transform: "none",
      });
      return;
    }

    const viewportWidth = window.innerWidth * 0.9;
    const viewportHeight = window.innerHeight * 0.9;
    const ratio = Math.min(
      viewportWidth / Math.max(currentSizeRef.current.width, 1),
      viewportHeight / Math.max(currentSizeRef.current.height, 1),
      1
    );

    gsap.to(popupRef.current, {
      width: `${Math.floor(currentSizeRef.current.width * ratio)}px`,
      height: `${Math.floor(currentSizeRef.current.height * ratio)}px`,
      duration: 0.3,
      ease: "power2.out",
    });
  }, [loading, visible]);

  const close = useCallback(() => {
    if (!popupRef.current) {
      setVisible(false);
      return;
    }

    const isMobile = window.innerWidth <= 736;

    gsap.to(popupRef.current, {
      opacity: 0,
      scale: isMobile ? 0.95 : 0.85,
      duration: 0.25,
      ease: "power3.in",
      onComplete: () => {
        setVisible(false);
        setLoading(true);
      },
    });
  }, []);

  const open = useCallback(
    async (list: PublicAlbumItem[], index = 0, switching = false) => {
      const safeIndex = Math.min(Math.max(index, 0), Math.max(list.length - 1, 0));
      const item = list[safeIndex];

      setPreviewList(list);
      setPreviewIndex(safeIndex);
      setVisible(true);
      setLoading(true);
      setImageKey(`${safeIndex}-${Date.now()}`);
      setDownloadCount(item?.downloadCount ?? 0);

      if (item?.id && onUpdateStat) {
        void onUpdateStat(item, "view")
          .then(() => {
            updateCurrentListItem(item.id, current => ({
              ...current,
              viewCount: (current.viewCount ?? 0) + 1,
            }));
          })
          .catch(() => {
            // 统计失败不阻断预览
          });
      }

      const url = buildPreviewImageUrl(item);
      if (!url) {
        return;
      }

      try {
        if (sizeCacheRef.current.has(url)) {
          currentSizeRef.current = sizeCacheRef.current.get(url)!;
        } else {
          const size = await getImageSize(url);
          sizeCacheRef.current.set(url, size);
          currentSizeRef.current = size;
        }
      } catch {
        close();
        return;
      }

      window.requestAnimationFrame(() => {
        if (!popupRef.current) {
          return;
        }

        const isMobile = window.innerWidth <= 736;

        if (isMobile) {
          gsap.set(popupRef.current, {
            width: "100vw",
            height: "100vh",
            top: 0,
            left: 0,
            xPercent: 0,
            yPercent: 0,
            scale: 1,
            opacity: 1,
            transform: "none",
          });
          return;
        }

        if (switching) {
          gsap.set(popupRef.current, {
            left: "50%",
            top: "50%",
            xPercent: -50,
            yPercent: -50,
            scale: 1,
            opacity: 1,
          });
          return;
        }

        gsap.fromTo(
          popupRef.current,
          {
            width: "150px",
            height: "150px",
            scale: 0.85,
            opacity: 0,
            left: "50%",
            top: "50%",
            xPercent: -50,
            yPercent: -50,
          },
          {
            scale: 1,
            opacity: 1,
            duration: 0.35,
            ease: "back.out(1.4)",
          }
        );
      });
    },
    [close, onUpdateStat, updateCurrentListItem]
  );

  const next = useCallback(() => {
    if (previewList.length <= 1) return;
    const nextIndex = (previewIndex + 1) % previewList.length;
    void open(previewList, nextIndex, true);
  }, [open, previewIndex, previewList]);

  const prev = useCallback(() => {
    if (previewList.length <= 1) return;
    const prevIndex = (previewIndex - 1 + previewList.length) % previewList.length;
    void open(previewList, prevIndex, true);
  }, [open, previewIndex, previewList]);

  const downImage = useCallback(
    async (item: PublicAlbumItem) => {
      const downloadUrl = item.downloadUrl || item.bigImageUrl || item.imageUrl;
      if (!downloadUrl) {
        return;
      }

      if (item.id && onUpdateStat) {
        try {
          await onUpdateStat(item, "download");
          setDownloadCount(prev => prev + 1);
          updateCurrentListItem(item.id, current => ({
            ...current,
            downloadCount: (current.downloadCount ?? 0) + 1,
          }));
        } catch {
          // 统计失败不阻断下载
        }
      }

      const extension = getImageExtension(downloadUrl);
      const fileName = `${siteName || "安和鱼"}.${extension}`;
      progressRef.current?.downloadImageWithProgress(downloadUrl, fileName);
    },
    [onUpdateStat, siteName, updateCurrentListItem]
  );

  useImperativeHandle(
    ref,
    () => ({
      open,
      close,
      downImage,
    }),
    [close, downImage, open]
  );

  useEffect(() => {
    if (!visible) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (loading) {
        return;
      }
      if (event.key === "ArrowLeft") {
        prev();
      }
      if (event.key === "ArrowRight") {
        next();
      }
    };

    const onResize = () => {
      resizePopup();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [close, loading, next, prev, resizePopup, visible]);

  const handleImageLoad = useCallback(() => {
    if (!popupRef.current) {
      setLoading(false);
      return;
    }

    if (imageRef.current) {
      currentSizeRef.current = {
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
      };
      sizeCacheRef.current.set(currentImageUrl, currentSizeRef.current);
    }

    const isMobile = window.innerWidth <= 736;
    const timeline = gsap.timeline();

    if (!isMobile) {
      const viewportWidth = window.innerWidth * 0.9;
      const viewportHeight = window.innerHeight * 0.9;
      const ratio = Math.min(
        viewportWidth / Math.max(currentSizeRef.current.width, 1),
        viewportHeight / Math.max(currentSizeRef.current.height, 1),
        1
      );

      timeline.to(popupRef.current, {
        width: `${Math.floor(currentSizeRef.current.width * ratio)}px`,
        height: `${Math.floor(currentSizeRef.current.height * ratio)}px`,
        duration: 0.3,
        ease: "power3.inOut",
      });
    }

    timeline.add(() => {
      setLoading(false);
    });

    const previewImage = popupRef.current.querySelector<HTMLElement>(".az-preview-image");
    const previewCaption = popupRef.current.querySelector<HTMLElement>(".album-preview-caption");
    const fadeTargets = [previewImage, previewCaption].filter(Boolean) as HTMLElement[];

    if (fadeTargets.length > 0) {
      timeline.fromTo(fadeTargets, { opacity: 0 }, { opacity: 1, duration: 0.2, stagger: 0.08 });
    }
  }, [currentImageUrl]);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.changedTouches[0]?.screenX ?? 0;
  }, []);

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (loading || previewList.length <= 1) {
        return;
      }

      const touchEndX = event.changedTouches[0]?.screenX ?? 0;
      const distance = touchEndX - touchStartXRef.current;

      if (Math.abs(distance) < SWIPE_THRESHOLD) {
        return;
      }

      if (distance > 0) {
        prev();
      } else {
        next();
      }
    },
    [loading, next, prev, previewList.length]
  );

  if (typeof document === "undefined") {
    return null;
  }

  const portalNode = (
    <>
      {visible ? (
        <div className="az-preview-overlay" onClick={close}>
          <div
            ref={popupRef}
            className="poptrox-popup"
            onClick={event => event.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {loading ? <div className="loader" /> : null}

            <div key={imageKey} className="pic">
              <img
                ref={imageRef}
                className="az-preview-image"
                src={currentImageUrl}
                alt={currentItem?.title || "预览图"}
                referrerPolicy="no-referrer"
                onLoad={handleImageLoad}
              />
            </div>

            {!loading && currentItem ? (
              <div className="album-preview-caption caption">
                {(currentItem.title || currentItem.description) && (
                  <div className="image-title-desc">
                    {currentItem.title ? <h3 className="image-title">{currentItem.title}</h3> : null}
                    {currentItem.description ? <p className="image-description">{currentItem.description}</p> : null}
                  </div>
                )}

                <div className="tag-info-row">
                  <div className="tag-info tag-info-bottom">
                    <span className="tag-device">
                      <Icon icon="ri:fire-fill" /> 热度 {currentItem.viewCount ?? 0}
                    </span>
                    <span className="tag-location">
                      <Icon icon="ri:download-2-fill" /> 下载量 {downloadCount}
                    </span>
                    <span className="tag-location">
                      <Icon icon="ri:hard-drive-2-fill" /> 大小 {formatFileSize(currentItem.fileSize)}
                    </span>
                    <span className="tag-time">
                      <Icon icon="ri:time-line" /> {formatToChina(currentItem.created_at)}
                    </span>
                    {currentItem.location ? (
                      <span className="tag-location">
                        <Icon icon="ri:map-pin-2-fill" /> {currentItem.location}
                      </span>
                    ) : null}
                  </div>

                  <button type="button" className="download-btn" onClick={() => void downImage(currentItem)}>
                    <Icon icon="ri:download-line" /> 原图下载
                  </button>
                </div>
              </div>
            ) : null}

            {!loading ? (
              <button type="button" className="az-preview-close closer" aria-label="关闭预览" onClick={close}>
                <Icon icon="ri:close-line" />
              </button>
            ) : null}

            {previewList.length > 1 && !loading ? (
              <>
                <button type="button" className="az-nav nav-previous" aria-label="上一张" onClick={prev}>
                  <Icon icon="ri:arrow-left-s-line" />
                </button>
                <button type="button" className="az-nav nav-next" aria-label="下一张" onClick={next}>
                  <Icon icon="ri:arrow-right-s-line" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      <DownloadProgressBar ref={progressRef} />
    </>
  );

  if (!mounted) {
    return null;
  }

  return createPortal(portalNode, document.body);
});
