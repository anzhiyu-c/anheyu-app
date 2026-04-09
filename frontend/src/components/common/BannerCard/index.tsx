/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-02-12 14:40:52
 * @LastEditTime: 2026-02-23 18:59:58
 * @LastEditors: 安知鱼
 */
"use client";

/**
 * 通用横幅卡片组件
 * 参考 anheyu-app 的 AnBannerCard，用于子页面顶部横幅展示
 */
import Link from "next/link";
import { Icon } from "@iconify/react";
import styles from "./BannerCard.module.css";

interface BannerCardProps {
  /** 提示文字（小标签） */
  tips?: string;
  /** 标题 */
  title?: string;
  /** 描述文字 */
  description?: string;
  /** 背景图片 URL */
  backgroundImage?: string;
  /** 组件高度，默认 300 */
  height?: number | string;
  /** 按钮文字 */
  buttonText?: string;
  /** 按钮链接 */
  buttonLink?: string;
  /** 按钮点击回调（与 buttonLink 二选一） */
  onButtonClick?: () => void;
}

export function BannerCard({
  tips,
  title,
  description,
  backgroundImage,
  height = 300,
  buttonText,
  buttonLink,
  onButtonClick,
}: BannerCardProps) {
  const containerStyle = {
    height: typeof height === "number" ? `${height}px` : height,
  };

  const innerStyle = backgroundImage ? { background: `url(${backgroundImage}) left 37%/cover no-repeat` } : undefined;

  const isInternal = buttonLink && buttonLink.startsWith("/") && !buttonLink.startsWith("//");
  const buttonIcon = (
    <Icon icon="jam:arrow-circle-up-right-f" width={20} height={20} className={styles.bannerButtonIcon} />
  );

  const buttonEl = buttonText ? (
    onButtonClick ? (
      <button type="button" onClick={onButtonClick} className={styles.bannerButton}>
        {buttonIcon}
        <span>{buttonText}</span>
      </button>
    ) : buttonLink ? (
      isInternal ? (
        <Link href={buttonLink} className={styles.bannerButton}>
          {buttonIcon}
          <span>{buttonText}</span>
        </Link>
      ) : (
        <a href={buttonLink} target="_blank" rel="noopener noreferrer" className={styles.bannerButton}>
          {buttonIcon}
          <span>{buttonText}</span>
        </a>
      )
    ) : null
  ) : null;

  return (
    <div className={styles.bannerCard} style={containerStyle}>
      <div className={styles.bannerInner} style={innerStyle}>
        <div className={styles.bannerContent}>
          <div>
            {tips && <div className={styles.bannerTips}>{tips}</div>}
            {title && <span className={styles.bannerTitle}>{title}</span>}
          </div>
          <div className={styles.bannerBottom}>
            {description && <div className={styles.bannerDesc}>{description}</div>}
            {buttonEl}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BannerCard;
