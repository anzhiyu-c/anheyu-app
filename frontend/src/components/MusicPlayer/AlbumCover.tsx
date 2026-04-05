"use client";

/**
 * @Description: 专辑封面组件
 * @Author: 安知鱼
 * 1:1 移植自 anheyu-app components/MusicPlayer/AlbumCover.vue
 */
import { useState, useRef, useEffect } from "react";
import styles from "./styles/AlbumCover.module.css";

interface AlbumCoverProps {
  imageUrl?: string;
  isPlaying?: boolean;
}

export function AlbumCover({ imageUrl = "", isPlaying = false }: AlbumCoverProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadedImageUrl, setLoadedImageUrl] = useState("");
  const [preloadedBlob, setPreloadedBlob] = useState("");
  const [prevImageUrl, setPrevImageUrl] = useState(imageUrl);
  // Keep a ref copy for cleanup without triggering re-renders
  const blobRef = useRef("");
  const imageUrlRef = useRef(imageUrl);

  // 当 imageUrl 变化时，在渲染阶段同步重置状态（避免在 effect 中同步 setState）
  if (imageUrl !== prevImageUrl) {
    setPrevImageUrl(imageUrl);
    setPreloadedBlob("");
    if (!imageUrl) {
      setLoadedImageUrl("");
    } else {
      setIsLoading(true);
    }
  }

  useEffect(() => {
    imageUrlRef.current = imageUrl;
  }, [imageUrl]);

  // Sync blob ref & revoke old blob URL
  useEffect(() => {
    const prevBlob = blobRef.current;
    blobRef.current = preloadedBlob;
    if (prevBlob && prevBlob !== preloadedBlob) {
      URL.revokeObjectURL(prevBlob);
    }
  }, [preloadedBlob]);

  // 计算显示的图片URL
  const displayImageUrl = (() => {
    if (!imageUrl) return "none";
    if (loadedImageUrl === imageUrl) {
      if (preloadedBlob) {
        return `url('${preloadedBlob}')`;
      }
      return `url('${imageUrl}')`;
    }
    return "none";
  })();

  // 监听图片URL变化，预加载图片
  useEffect(() => {
    if (!imageUrl) return;

    let cleaned = false;

    const handler = (event: Event) => {
      if (cleaned) return;
      const detail = (event as CustomEvent).detail;
      if (detail.imageUrl !== imageUrlRef.current) return;

      if (detail.blob && !detail.fromCache) {
        const ownBlobUrl = URL.createObjectURL(detail.blob);
        if (blobRef.current) {
          URL.revokeObjectURL(blobRef.current);
        }
        setPreloadedBlob(ownBlobUrl);
        setLoadedImageUrl(imageUrlRef.current);
        setIsLoading(false);
      } else if (detail.imageElement && !detail.fromCache) {
        const img = detail.imageElement as HTMLImageElement;
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(
              blob => {
                if (blob && !cleaned) {
                  if (blobRef.current) {
                    URL.revokeObjectURL(blobRef.current);
                  }
                  setPreloadedBlob(URL.createObjectURL(blob));
                }
                if (!cleaned) {
                  setLoadedImageUrl(imageUrlRef.current);
                  setIsLoading(false);
                }
              },
              "image/jpeg",
              0.95
            );
          } else {
            setLoadedImageUrl(imageUrlRef.current);
            setIsLoading(false);
          }
        } catch {
          setLoadedImageUrl(imageUrlRef.current);
          setIsLoading(false);
        }
      } else {
        setLoadedImageUrl(imageUrlRef.current);
        setIsLoading(false);
      }

      window.removeEventListener("colorExtracted", handler);
    };

    window.addEventListener("colorExtracted", handler);

    const timeout = setTimeout(() => {
      if (!cleaned) {
        setLoadedImageUrl(imageUrlRef.current);
        setIsLoading(false);
        window.removeEventListener("colorExtracted", handler);
      }
    }, 2000);

    return () => {
      cleaned = true;
      clearTimeout(timeout);
      window.removeEventListener("colorExtracted", handler);
    };
  }, [imageUrl]);

  // 组件卸载时清理 blob URL
  useEffect(() => {
    return () => {
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
      }
    };
  }, []);

  const classNames = [styles.albumCover, isPlaying ? styles.playing : "", isLoading ? styles.loading : ""]
    .filter(Boolean)
    .join(" ");

  return <div data-album-cover className={classNames} style={{ backgroundImage: displayImageUrl }} />;
}
