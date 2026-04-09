"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Lock } from "lucide-react";
import { userCenterApi } from "@/lib/api/user-center";
import { useAuthStore } from "@/store/auth-store";
import styles from "../user-center.module.css";

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ChangePasswordDialog({ open, onClose }: ChangePasswordDialogProps) {
  const logout = useAuthStore(s => s.logout);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
    }
  }, [open]);

  const validate = useCallback((): string | null => {
    if (!oldPassword) return "请输入当前密码";
    if (!newPassword) return "请输入新密码";
    if (newPassword.length < 6) return "新密码长度不能少于 6 位";
    if (newPassword === oldPassword) return "新密码不能与旧密码相同";
    if (newPassword !== confirmPassword) return "两次输入的密码不一致";
    return null;
  }, [oldPassword, newPassword, confirmPassword]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await userCenterApi.updatePassword({ oldPassword, newPassword });
      if (res.code === 200) {
        alert("密码修改成功，请重新登录");
        onClose();
        setTimeout(() => logout(), 1000);
      } else {
        setError(res.message || "修改密码失败");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "修改密码失败，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  }, [submitting, validate, oldPassword, newPassword, onClose, logout]);

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
          <span className={styles.dialogHeaderIcon}><Lock /></span>
          <h2 id="dialog-title" className={styles.dialogTitle}>修改密码</h2>
        </div>

        <div className={styles.dialogBody}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>当前密码</label>
            <input
              className={styles.formInput}
              type="password"
              value={oldPassword}
              onChange={e => setOldPassword(e.target.value)}
              placeholder="请输入当前密码"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>新密码</label>
            <input
              className={styles.formInput}
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="请输入新密码（不少于 6 位）"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>确认新密码</label>
            <input
              className={styles.formInput}
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="请再次输入新密码"
            />
          </div>
          {error && <span className={styles.formError}>{error}</span>}

          <div className={styles.passwordTips}>
            <p>密码安全建议：</p>
            <ul>
              <li>长度至少 6 位字符</li>
              <li>建议包含大小写字母、数字和特殊字符</li>
              <li>避免使用容易被猜到的密码</li>
            </ul>
          </div>
        </div>

        <div className={styles.dialogFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>取消</button>
          <button className={styles.btnPrimary} disabled={submitting} onClick={handleSubmit}>
            {submitting ? "修改中..." : "确认修改"}
          </button>
        </div>
      </div>
    </div>
  );
}
