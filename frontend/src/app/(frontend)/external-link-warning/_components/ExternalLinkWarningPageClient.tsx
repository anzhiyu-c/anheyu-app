/**
 * 外部链接跳转提示页面
 * 参考 anheyu-app external-link-warning/index.vue 实现
 * 用户点击外链时，先显示此中间页面提醒，倒计时后自动跳转
 */
"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import styles from "../page.module.css";

function ExternalLinkWarningContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawUrl = searchParams.get("url");
  const targetUrl = rawUrl ? decodeURIComponent(rawUrl) : "";
  const [countdown, setCountdown] = useState(5);
  const [rememberChoice, setRememberChoice] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 无 URL 参数时重定向回首页
  useEffect(() => {
    if (!rawUrl) router.push("/");
  }, [rawUrl, router]);

  const handleContinue = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rememberChoice) {
      sessionStorage.setItem("skip-external-link-warning", "true");
    }
    if (targetUrl) {
      window.location.href = targetUrl;
    }
  }, [targetUrl, rememberChoice]);

  // 倒计时
  useEffect(() => {
    if (!targetUrl) return;

    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [targetUrl]);

  // 倒计时结束时自动跳转
  useEffect(() => {
    if (countdown === 0 && targetUrl) {
      handleContinue();
    }
  }, [countdown, targetUrl, handleContinue]);

  const handleCancel = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (window.history.length <= 1) {
      window.close();
    } else {
      router.back();
    }
  };

  if (!targetUrl) return null;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* 图标 */}
        <div className={styles.iconWrapper}>
          <Icon icon="fa6-solid:arrow-up-right-from-square" width={36} />
        </div>

        {/* 标题 */}
        <h2 className={styles.title}>外部链接提示</h2>
        <p className={styles.description}>您即将离开本站并访问外部链接</p>

        {/* 链接显示 */}
        <div className={styles.linkDisplay}>
          <Icon icon="fa6-solid:link" className={styles.linkIcon} />
          <span className={styles.linkText}>{targetUrl}</span>
        </div>

        {/* 安全提示 */}
        <div className={styles.warningTips}>
          <Icon icon="fa6-solid:triangle-exclamation" className={styles.tipIcon} />
          <span className={styles.tipText}>请注意验证链接的安全性，谨防钓鱼网站</span>
        </div>

        {/* 倒计时 */}
        {countdown > 0 && (
          <div className={styles.countdownTip}>
            <Icon icon="fa6-solid:clock" />
            <span>{countdown} 秒后自动跳转</span>
          </div>
        )}

        {/* 操作按钮 */}
        <div className={styles.actionButtons}>
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleCancel}>
            <Icon icon="fa6-solid:arrow-left" />
            返回
          </button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleContinue}>
            继续访问
            <Icon icon="fa6-solid:arrow-right" />
          </button>
        </div>

        {/* 记住选择 */}
        <div className={styles.rememberOption}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={rememberChoice}
              onChange={e => setRememberChoice(e.target.checked)}
              className={styles.checkboxInput}
            />
            <span className={styles.checkboxText}>本次会话不再提示</span>
          </label>
        </div>
      </div>
    </div>
  );
}

export function ExternalLinkWarningPageClient() {
  return (
    <Suspense fallback={null}>
      <ExternalLinkWarningContent />
    </Suspense>
  );
}
