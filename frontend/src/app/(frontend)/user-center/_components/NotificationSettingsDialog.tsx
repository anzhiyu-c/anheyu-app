"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Bell } from "lucide-react";
import { userCenterApi } from "@/lib/api/user-center";
import styles from "../user-center.module.css";

interface NotificationSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationSettingsDialog({ open, onClose }: NotificationSettingsDialogProps) {
  const [allowCommentReply, setAllowCommentReply] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await userCenterApi.getNotificationSettings();
      if (res.code === 200 && res.data) {
        setAllowCommentReply(res.data.allowCommentReplyNotification);
      }
    } catch {
      // 404 or no settings yet - use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadSettings();
  }, [open, loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await userCenterApi.updateNotificationSettings({
        allowCommentReplyNotification: allowCommentReply,
      });
      onClose();
    } catch {
      alert("保存通知设置失败，请稍后再试");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.dialogOverlay} role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={onClose}>
      <div className={styles.dialogPanel} onClick={e => e.stopPropagation()}>
        <button className={styles.dialogClose} aria-label="关闭" onClick={onClose}>
          <X />
        </button>

        <div className={styles.dialogHeader}>
          <span className={styles.dialogHeaderIcon}><Bell /></span>
          <h2 id="dialog-title" className={styles.dialogTitle}>通知设置</h2>
        </div>

        <div className={styles.dialogBody}>
          <div className={styles.settingAlert}>
            这些设置控制您接收各类通知的方式。您可以随时修改这些偏好。
          </div>

          {loading ? (
            <div className={styles.loadingContainer} style={{ minHeight: "100px" }}>
              <div className={styles.spinner} />
            </div>
          ) : (
            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <div className={styles.settingLabel}>接收评论回复通知</div>
                <div className={styles.settingDesc}>开启后，当您的评论被回复时会收到邮件通知</div>
              </div>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={allowCommentReply}
                  onChange={e => setAllowCommentReply(e.target.checked)}
                />
                <span className={styles.toggleSlider} />
              </label>
            </div>
          )}
        </div>

        <div className={styles.dialogFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>取消</button>
          <button className={styles.btnPrimary} disabled={saving || loading} onClick={handleSave}>
            {saving ? "保存中..." : "保存设置"}
          </button>
        </div>
      </div>
    </div>
  );
}
