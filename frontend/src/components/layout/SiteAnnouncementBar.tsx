"use client";

import { useMemo, useEffect, useState, useCallback } from "react";
import DOMPurify from "dompurify";
import { useSiteConfigStore } from "@/store/site-config-store";
import { AnHeYuDialog } from "@/components/ui/anheyu-dialog";
import { cn } from "@/lib/utils";
import shell from "@/components/ui/anheyu-dialog/AnHeYuDialog.module.css";
import styles from "./SiteAnnouncementBar.module.css";

/** 已读公告内容快照；与旧版 `AnNouncement` 键名一致 */
const ANNOUNCEMENT_READ_KEY = "app_announcement_read_content";
/** 旧版曾写入，无业务含义后仅在做空公告清理时顺带删除，避免脏数据 */
const ANNOUNCEMENT_SHOWN_SESSION_KEY_LEGACY = "app_announcement_shown_in_session";

/**
 * 站点公告：以 AnHeYuDialog 展示 `SITE_ANNOUNCEMENT` HTML（经 DOMPurify 消毒）。
 * 逻辑：当前配置正文与已存 `ANNOUNCEMENT_READ_KEY` 一致则视为已读，不再弹出；
 * 内容变更或与已读不一致时再弹；点「我已知晓」后写入已读。
 */
export function SiteAnnouncementBar({ className }: { className?: string }) {
  const siteConfig = useSiteConfigStore(state => state.siteConfig);
  const isLoaded = useSiteConfigStore(state => state.isLoaded);

  const html = useMemo(() => {
    const raw = siteConfig?.SITE_ANNOUNCEMENT;
    if (typeof raw !== "string") return "";
    return raw.trim();
  }, [siteConfig?.SITE_ANNOUNCEMENT]);

  const safeHtml = useMemo(() => {
    if (!html) return "";
    if (typeof window === "undefined") return "";
    return DOMPurify.sanitize(html);
  }, [html]);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !isLoaded) return;

    if (!html) {
      localStorage.removeItem(ANNOUNCEMENT_READ_KEY);
      localStorage.removeItem(ANNOUNCEMENT_SHOWN_SESSION_KEY_LEGACY);
      queueMicrotask(() => setOpen(false));
      return;
    }

    const storedRead = localStorage.getItem(ANNOUNCEMENT_READ_KEY);
    if (html !== storedRead) {
      queueMicrotask(() => setOpen(true));
    } else {
      queueMicrotask(() => setOpen(false));
    }
  }, [isLoaded, html]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <AnHeYuDialog
      open={open}
      onClose={handleClose}
      title="系统公告"
      titleId="site-announcement-title"
      className={className}
      containerClassName={styles.announcementContainer}
      contentClassName={styles.announcementContent}
      closeOnOverlayClick={false}
      closeOnEscape={false}
      footer={({ close }) => (
        <button
          type="button"
          className={cn(shell.btn, shell.btnPrimary, styles.announcementAckBtn)}
          onClick={() => {
            if (html) {
              localStorage.setItem(ANNOUNCEMENT_READ_KEY, html);
              localStorage.removeItem(ANNOUNCEMENT_SHOWN_SESSION_KEY_LEGACY);
            }
            close();
          }}
        >
          我已知晓
        </button>
      )}
    >
      <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
    </AnHeYuDialog>
  );
}
