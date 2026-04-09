"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { RiLoader4Line } from "react-icons/ri";
import type { FileItem } from "@/types/file-manager";
import { FileType } from "@/types/file-manager";
import { getThumbnailCredentialApi } from "@/lib/api/file-manager";
import { renderFileIcon } from "./file-icons";
import styles from "./FileThumbnail.module.css";

interface FileThumbnailProps {
  file: FileItem;
}

const POLLING_INTERVAL = 5000;

export function FileThumbnail({ file }: FileThumbnailProps) {
  const thumbnailRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const isPreviewSupported = useCallback((): boolean => {
    if (file.type === FileType.Dir) return false;
    const supportedExtensions = [
      "jpg",
      "jpeg",
      "png",
      "webp",
      "gif",
      "svg",
      "bmp",
      "ico",
      "heic",
      "heif",
      "tiff",
      "tif",
      "avif",
      "mp4",
    ];
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    return supportedExtensions.includes(ext);
  }, [file.name, file.type]);

  const fetchPreview = useCallback(
    async function fetchPreviewInner() {
      try {
        const res = await getThumbnailCredentialApi(file.id);
        if (res.code === 200 && res.data?.sign) {
          setImageUrl(`/api/t/${res.data.sign}`);
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        } else if (res.code === 202 && res.data?.status === "processing") {
          setIsLoading(true);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = window.setTimeout(fetchPreviewInner, POLLING_INTERVAL);
        } else {
          setImageUrl(null);
          setIsLoading(false);
        }
      } catch {
        setImageUrl(null);
        setIsLoading(false);
      }
    },
    [file.id]
  );

  const startFetchingPreview = useCallback(async () => {
    if (!isPreviewSupported()) return;
    setIsLoading(true);
    await fetchPreview();
  }, [fetchPreview, isPreviewSupported]);

  useEffect(() => {
    const current = thumbnailRef.current;
    if (current && isPreviewSupported()) {
      observerRef.current = new IntersectionObserver(
        entries => {
          if (entries[0]?.isIntersecting) {
            startFetchingPreview();
            if (observerRef.current && current) {
              observerRef.current.unobserve(current);
            }
          }
        },
        { rootMargin: "200px" }
      );
      observerRef.current.observe(current);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (observerRef.current && current) {
        observerRef.current.unobserve(current);
      }
      observerRef.current = null;
    };
  }, [isPreviewSupported, startFetchingPreview]);

  return (
    <div ref={thumbnailRef} className={styles["thumbnail-container"]}>
      {imageUrl ? (
        <Image
          src={imageUrl}
          className={styles["thumbnail-image"]}
          style={{ opacity: isLoading ? 0 : 1 }}
          alt=""
          fill
          sizes="(max-width: 768px) 80px, 120px"
          unoptimized
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setImageUrl(null);
            setIsLoading(false);
          }}
        />
      ) : null}
      {isLoading ? (
        <div className={`${styles["thumbnail-placeholder"]} ${styles["loading-placeholder"]}`}>
          <RiLoader4Line className={styles.spinner} />
        </div>
      ) : null}
      {!imageUrl && !isLoading ? (
        <div className={styles["thumbnail-placeholder"]}>{renderFileIcon(file, styles["file-icon-fallback"])}</div>
      ) : null}
    </div>
  );
}
