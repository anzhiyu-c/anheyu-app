"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface DownloadProgressBarHandle {
  downloadImageWithProgress: (imageUrl: string, fileName?: string) => void;
}

function triggerDownload(url: string, fileName?: string) {
  const link = document.createElement("a");
  link.style.display = "none";
  link.href = `/api/proxy/download?url=${encodeURIComponent(url)}`;
  if (fileName) {
    link.download = fileName;
  }
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export const DownloadProgressBar = forwardRef<DownloadProgressBarHandle>(function DownloadProgressBar(_, ref) {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("正在准备下载...");
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(timer => {
      window.clearTimeout(timer);
    });
    timersRef.current = [];
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      downloadImageWithProgress(imageUrl: string, fileName?: string) {
        if (!imageUrl) {
          return;
        }

        clearTimers();
        setVisible(true);
        setText("正在准备下载...");

        triggerDownload(imageUrl, fileName);

        timersRef.current.push(
          window.setTimeout(() => {
            setText("下载已开始，请查看浏览器下载栏");
          }, 100)
        );

        timersRef.current.push(
          window.setTimeout(() => {
            setVisible(false);
          }, 2000)
        );
      },
    }),
    [clearTimers]
  );

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return (
    <div className={`album-download-bar ${visible ? "is-visible" : ""}`} aria-hidden={!visible}>
      <div className="album-download-progress" />
      <span className="album-download-text">{text}</span>
    </div>
  );
});
