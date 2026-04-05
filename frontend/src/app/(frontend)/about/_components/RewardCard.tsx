"use client";

import { useEffect, useState, useMemo } from "react";
import { X } from "lucide-react";
import { useSiteConfigStore } from "@/store/site-config-store";
import type { DonationItem } from "@/types/about";
import styles from "../about.module.css";

// 充电动画 SVG 管道（1:1 还原 assets-old）
function TubeSVG({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 1028 385" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 77H234.226L307.006 24H790" stroke={color} strokeWidth="20" />
      <path d="M0 140H233.035L329.72 71H1028" stroke={color} strokeWidth="20" />
      <path d="M1 255H234.226L307.006 307H790" stroke={color} strokeWidth="20" />
      <path d="M0 305H233.035L329.72 375H1028" stroke={color} strokeWidth="20" />
      <rect y="186" width="236" height="24" fill={color} />
      <ellipse cx="790" cy="25.5" rx="25" ry="25.5" fill={color} />
      <circle r="14" transform="matrix(1 0 0 -1 790 25)" fill="white" />
      <ellipse cx="790" cy="307.5" rx="25" ry="25.5" fill={color} />
      <circle r="14" transform="matrix(1 0 0 -1 790 308)" fill="white" />
    </svg>
  );
}

export function RewardCard() {
  const [donations, setDonations] = useState<DonationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [showDialog, setShowDialog] = useState(false);
  const siteConfig = useSiteConfigStore(state => state.siteConfig);

  const rewardConfig = useMemo(() => {
    const raw = siteConfig as Record<string, unknown>;
    const post = raw?.post as Record<string, unknown> | undefined;
    const reward = post?.reward as { wechat_qr?: string; alipay_qr?: string } | undefined;
    return reward || {};
  }, [siteConfig]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // anheyu-app 无 donations API，保持空列表
        if (!cancelled) {
          setDonations([]);
          setTotal(0);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const latestUpdate = useMemo(() => {
    if (!donations.length) return null;
    const sorted = [...donations].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return sorted[0];
  }, [donations]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const isLargeAmount = (amount: number) => amount >= 50;

  // 与旧版一致：只要关于页启用了打赏，就显示板块（无记录时显示空状态 + 为TA充电）
  const shouldShow = !loading;

  if (loading) {
    return <div className={styles.rewardLoading}>加载中...</div>;
  }

  if (!shouldShow) return null;

  return (
    <>
      <div className={styles.authorContent}>
        <div className={`${styles.item} ${styles.single} ${styles.reward}`}>
          <div className={styles.itemTips}>致谢</div>
          <span className={styles.itemTitle}>赞赏名单</span>
          <div className={styles.rewardDescription}>感谢因为有你们，让我更加有创作的动力。</div>

          <div className={styles.rewardListAll}>
            {donations.length > 0 ? (
              donations.map(item => (
                <div key={item.id} className={styles.rewardListItem}>
                  <div className={styles.rewardItemName}>{item.name}</div>
                  <div className={styles.rewardBottomGroup}>
                    <div
                      className={`${styles.rewardItemMoney} ${isLargeAmount(item.amount) ? styles.rewardItemMoneyLarge : ""}`}
                    >
                      ¥{item.amount}
                      {item.suffix}
                    </div>
                    <div className={styles.rewardItemTime}>{formatDate(item.created_at)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.rewardListEmpty}>暂无打赏记录，快来成为第一个吧</div>
            )}
          </div>

          {latestUpdate && (
            <div className={styles.rewardUpdateDate}>
              最新更新时间：
              <time className={styles.rewardUpdateDateTime}>{formatDate(latestUpdate.created_at)}</time>
            </div>
          )}

          {/* 充电动画 */}
          <div className={styles.aboutReward}>
            <div className={styles.aboutRewardCon} />
            <div className={styles.aboutRewardTACon} onClick={() => setShowDialog(true)}>
              <div className={styles.aboutRewardTextCon}>
                <div className={styles.aboutRewardLight} />
                <div className={styles.aboutRewardTA}>为TA充电</div>
              </div>
            </div>
            <div className={styles.aboutRewardTubeCon}>
              <TubeSVG color="#e5e9ef" />
              <div className={styles.aboutRewardMask}>
                <TubeSVG color="#f25d8e" />
              </div>
              <div className={styles.aboutRewardOrangeMask}>
                <TubeSVG color="#ffd52b" />
              </div>
            </div>
            <p className={styles.aboutRewardPeople}>
              共<b>{total}</b>人
            </p>
          </div>
        </div>
      </div>

      {/* 打赏弹窗 */}
      {showDialog && (
        <div className={styles.rewardDialogOverlay} onClick={() => setShowDialog(false)}>
          <div className={styles.rewardDialog} onClick={e => e.stopPropagation()}>
            <div className={styles.rewardDialogHeader}>
              <h3 className={styles.rewardDialogTitle}>打赏支持</h3>
              <button className={styles.rewardDialogClose} onClick={() => setShowDialog(false)}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <div className={styles.rewardDialogBody}>
              <p className={styles.rewardTips}>感谢您的支持，您的鼓励是我创作的最大动力！</p>
              <div className={styles.qrCodes}>
                {rewardConfig.wechat_qr && (
                  <div className={styles.qrCodeItem}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={rewardConfig.wechat_qr} alt="微信打赏" className={styles.qrImage} />
                    <div className={styles.qrLabel}>微信</div>
                  </div>
                )}
                {rewardConfig.alipay_qr && (
                  <div className={styles.qrCodeItem}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={rewardConfig.alipay_qr} alt="支付宝打赏" className={styles.qrImage} />
                    <div className={styles.qrLabel}>支付宝</div>
                  </div>
                )}
                {!rewardConfig.wechat_qr && !rewardConfig.alipay_qr && (
                  <p className={styles.noQr}>暂未配置打赏二维码</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
