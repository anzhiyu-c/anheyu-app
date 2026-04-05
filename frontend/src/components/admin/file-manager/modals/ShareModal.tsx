"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { FileItem, ShareLinkData } from "@/types/file-manager";
import { FileType } from "@/types/file-manager";
import { overlayVariants, modalVariants, springTransition, normalTransition } from "@/lib/motion";
import styles from "./ShareModal.module.css";

interface ShareModalProps {
  open: boolean;
  items: FileItem[];
  onClose: () => void;
  onSuccess: () => void;
  onCreateShare: (payload: {
    fileIds: string[];
    expirationDays?: number;
    paymentAmount?: number;
    password?: string;
    showReadme?: boolean;
    downloadLimit?: number;
    allowedUserGroups?: number[];
  }) => Promise<{ code: number; data: ShareLinkData; message: string }>;
}

export function ShareModal({ open, items, onClose, onSuccess, onCreateShare }: ShareModalProps) {
  const [enableExpiration, setEnableExpiration] = useState(false);
  const [expirationDays, setExpirationDays] = useState(7);
  const [enablePayment, setEnablePayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(1);
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [showReadme, setShowReadme] = useState(false);
  const [enableDownloadLimit, setEnableDownloadLimit] = useState(false);
  const [downloadLimit, setDownloadLimit] = useState(5);
  const [enableUserGroupControl, setEnableUserGroupControl] = useState(false);
  const [allowedUserGroups, setAllowedUserGroups] = useState<number[]>([1, 2, 3]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ShareLinkData | null>(null);

  const selectedCount = items.length;
  const shareFileName = selectedCount === 1 ? items[0].name : "多个项目";
  const hasFolder = items.some(item => item.type === FileType.Dir);
  const isFolder = selectedCount === 1 && items[0].type === FileType.Dir;

  const isFormValid = useMemo(() => {
    if (enablePassword && !password) return false;
    if (enablePayment && paymentAmount <= 0) return false;
    if (enableExpiration && expirationDays < 1) return false;
    if (enableDownloadLimit && downloadLimit < 1) return false;
    if (enableUserGroupControl && allowedUserGroups.length === 0) return false;
    return true;
  }, [
    enablePassword,
    password,
    enablePayment,
    paymentAmount,
    enableExpiration,
    expirationDays,
    enableDownloadLimit,
    downloadLimit,
    enableUserGroupControl,
    allowedUserGroups,
  ]);

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "";
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(result);
  };

  const handleCreateShare = async () => {
    if (!isFormValid) return;
    setIsSubmitting(true);
    try {
      const res = await onCreateShare({
        fileIds: items.map(item => item.id),
        expirationDays: enableExpiration ? expirationDays : undefined,
        paymentAmount: enablePayment ? paymentAmount : undefined,
        password: enablePassword ? password : undefined,
        showReadme: isFolder ? showReadme : undefined,
        downloadLimit: !hasFolder && enableDownloadLimit ? downloadLimit : undefined,
        allowedUserGroups: enableUserGroupControl ? allowedUserGroups : undefined,
      });
      if (res.code === 200 && res.data) {
        setResult(res.data);
        onSuccess();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={styles.overlay}
          onClick={onClose}
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={normalTransition}
        >
          <motion.div
            className={styles.modal}
            onClick={event => event.stopPropagation()}
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={springTransition}
          >
            <div className={styles["modal-title"]}>创建分享链接</div>
            <div className={styles["share-info"]}>
              <strong>{shareFileName}</strong>
              {selectedCount > 1 ? <span>共选择 {selectedCount} 个项目</span> : null}
            </div>

            <div className={styles["option-item"]}>
              <div className={styles["option-header"]} onClick={() => setEnableExpiration(!enableExpiration)}>
                <span>超时自动过期</span>
                <input
                  type="checkbox"
                  checked={enableExpiration}
                  onChange={() => setEnableExpiration(!enableExpiration)}
                />
              </div>
              {enableExpiration ? (
                <div className={styles["option-content"]}>
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    max={365}
                    value={expirationDays}
                    onChange={event => setExpirationDays(Number(event.target.value))}
                  />
                </div>
              ) : null}
            </div>

            <div className={styles["option-item"]}>
              <div className={styles["option-header"]} onClick={() => setEnablePayment(!enablePayment)}>
                <span>付费下载</span>
                <input type="checkbox" checked={enablePayment} onChange={() => setEnablePayment(!enablePayment)} />
              </div>
              {enablePayment ? (
                <div className={styles["option-content"]}>
                  <input
                    className={styles.input}
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={paymentAmount}
                    onChange={event => setPaymentAmount(Number(event.target.value))}
                  />
                </div>
              ) : null}
            </div>

            <div className={styles["option-item"]}>
              <div className={styles["option-header"]} onClick={() => setEnablePassword(!enablePassword)}>
                <span>密码保护</span>
                <input type="checkbox" checked={enablePassword} onChange={() => setEnablePassword(!enablePassword)} />
              </div>
              {enablePassword ? (
                <div className={styles["option-content"]}>
                  <input
                    className={styles.input}
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder="请输入4-8位密码"
                  />
                  <button onClick={generateRandomPassword}>随机</button>
                </div>
              ) : null}
            </div>

            {isFolder ? (
              <div className={styles["option-item"]}>
                <div className={styles["option-header"]} onClick={() => setShowReadme(!showReadme)}>
                  <span>显示 README</span>
                  <input type="checkbox" checked={showReadme} onChange={() => setShowReadme(!showReadme)} />
                </div>
              </div>
            ) : null}

            {!hasFolder ? (
              <div className={styles["option-item"]}>
                <div className={styles["option-header"]} onClick={() => setEnableDownloadLimit(!enableDownloadLimit)}>
                  <span>下载次数限制</span>
                  <input
                    type="checkbox"
                    checked={enableDownloadLimit}
                    onChange={() => setEnableDownloadLimit(!enableDownloadLimit)}
                  />
                </div>
                {enableDownloadLimit ? (
                  <div className={styles["option-content"]}>
                    <input
                      className={styles.input}
                      type="number"
                      min={1}
                      max={9999}
                      value={downloadLimit}
                      onChange={event => setDownloadLimit(Number(event.target.value))}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className={styles["option-item"]}>
              <div
                className={styles["option-header"]}
                onClick={() => setEnableUserGroupControl(!enableUserGroupControl)}
              >
                <span>访问权限控制</span>
                <input
                  type="checkbox"
                  checked={enableUserGroupControl}
                  onChange={() => setEnableUserGroupControl(!enableUserGroupControl)}
                />
              </div>
              {enableUserGroupControl ? (
                <div className={styles["option-content"]}>
                  {[1, 2, 3].map(group => (
                    <label key={group} className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={allowedUserGroups.includes(group)}
                        onChange={() =>
                          setAllowedUserGroups(prev =>
                            prev.includes(group) ? prev.filter(item => item !== group) : [...prev, group]
                          )
                        }
                      />
                      {group === 1 ? "管理员" : group === 2 ? "注册用户" : "匿名访客"}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>

            {result ? (
              <div className={styles["result-panel"]}>
                <div className={styles["result-row"]}>
                  <span>分享链接</span>
                  <span>{result.link}</span>
                </div>
                {result.password ? (
                  <div className={styles["result-row"]}>
                    <span>访问密码</span>
                    <span>{result.password}</span>
                  </div>
                ) : null}
                {result.expiration_time ? (
                  <div className={styles["result-row"]}>
                    <span>过期时间</span>
                    <span>{result.expiration_time}</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className={styles.footer}>
              <button onClick={onClose}>取消</button>
              <button className={styles.primary} onClick={handleCreateShare} disabled={!isFormValid || isSubmitting}>
                {isSubmitting ? "创建中..." : "创建分享链接"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
