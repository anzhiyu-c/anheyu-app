"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Pencil } from "lucide-react";
import { userCenterApi } from "@/lib/api/user-center";
import styles from "../user-center.module.css";

interface EditProfileDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userInfo: { nickname: string; email: string };
}

export function EditProfileDialog({ open, onClose, onSuccess, userInfo }: EditProfileDialogProps) {
  const [nickname, setNickname] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      const emailPrefix = (userInfo.email || "").split("@")[0] || "";
      setNickname(userInfo.nickname === emailPrefix ? "" : userInfo.nickname);
      setWebsite("");
      setError("");
    }
    prevOpenRef.current = open;
  }, [open, userInfo.nickname, userInfo.email]);

  const isValid = nickname.trim().length >= 2 && nickname.trim().length <= 50;

  const handleSubmit = useCallback(async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await userCenterApi.updateProfile({
        nickname: nickname.trim(),
        website: website.trim() || undefined,
      });
      if (res.code === 200) {
        onSuccess();
        onClose();
      } else {
        setError(res.message || "保存失败");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存失败，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  }, [isValid, submitting, nickname, website, onSuccess, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose, handleSubmit]);

  if (!open) return null;

  return (
    <div className={styles.dialogOverlay} role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={onClose}>
      <div className={styles.dialogPanel} onClick={e => e.stopPropagation()}>
        <button className={styles.dialogClose} aria-label="关闭" onClick={onClose}>
          <X />
        </button>

        <div className={styles.dialogHeader}>
          <span className={styles.dialogHeaderIcon}><Pencil /></span>
          <h2 id="dialog-title" className={styles.dialogTitle}>编辑资料</h2>
        </div>

        <div className={styles.dialogBody}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>昵称</label>
            <input
              className={styles.formInput}
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="请设置一个个性化的昵称"
              maxLength={50}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>邮箱</label>
            <input className={styles.formInput} value={userInfo.email} disabled />
            <span className={styles.formTip}>邮箱暂不支持修改</span>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>个人网站</label>
            <input
              className={styles.formInput}
              value={website}
              onChange={e => setWebsite(e.target.value)}
              placeholder="请输入个人网站地址（选填）"
            />
          </div>
          {error && <span className={styles.formError}>{error}</span>}
        </div>

        <div className={styles.dialogFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>取消</button>
          <button className={styles.btnPrimary} disabled={!isValid || submitting} onClick={handleSubmit}>
            {submitting ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
