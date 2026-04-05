/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import styles from "./AuthorInfoCard.module.css";

interface AuthorConfig {
  description: string;
  statusImg: string;
  skills: string[];
  social: Record<string, { icon: string; link: string }>;
  userAvatar: string;
  ownerName: string;
  subTitle: string;
}

interface AuthorInfoCardProps {
  config: AuthorConfig;
}

/**
 * 生成随机索引
 */
function getRandomIndex(length: number): number {
  return length > 0 ? Math.floor(Math.random() * length) : 0;
}

export function AuthorInfoCard({ config }: AuthorInfoCardProps) {
  // 技能列表
  const greetings = useMemo(
    () => (config.skills?.length > 0 ? config.skills : ["集中精力，攻克难关"]),
    [config.skills]
  );

  // 初始化时生成随机索引
  const [currentGreetingIndex, setCurrentGreetingIndex] = useState(() => getRandomIndex(greetings.length));
  const [showSkill, setShowSkill] = useState(false);

  // 当前显示的技能
  const currentGreeting = useMemo(
    () => greetings[currentGreetingIndex] || "集中精力，攻克难关",
    [greetings, currentGreetingIndex]
  );

  // 显示的内容
  const displayGreeting = useMemo(() => {
    if (!showSkill) {
      return "欢迎光临";
    }
    return currentGreeting;
  }, [showSkill, currentGreeting]);

  // 切换显示内容
  const changeSayHelloText = () => {
    if (!showSkill) {
      // 第一次点击，切换到显示技能
      setShowSkill(true);
      return;
    }

    // 已经在显示技能，切换到下一个技能
    const totalGreetings = greetings.length;
    if (totalGreetings <= 1) return;
    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * totalGreetings);
    } while (newIndex === currentGreetingIndex);
    setCurrentGreetingIndex(newIndex);
  };

  // 渲染社交图标
  const renderSocialIcon = (name: string, social: { icon: string; link: string }) => {
    if (!social.icon) return null;
    const isImageUrl = social.icon?.startsWith("http://") || social.icon?.startsWith("https://");
    const isIconify = social.icon?.includes(":");

    if (!isImageUrl && !isIconify) return null;

    return (
      <a
        key={name}
        className={styles.socialIcon}
        href={social.link}
        aria-label={name}
        rel="external nofollow noreferrer"
        target="_blank"
        title={name}
      >
        {isImageUrl ? (
          <img src={social.icon} alt={name} className={styles.socialIconImg} width={24} height={24} />
        ) : (
          <Icon icon={social.icon} className={styles.socialIconify} aria-hidden="true" />
        )}
      </a>
    );
  };

  return (
    <div className={styles.cardInfo}>
      <div className={styles.cardContent}>
        {/* 问候语/技能标签 */}
        <div className={styles.authorInfoSayhi} onClick={changeSayHelloText}>
          {displayGreeting}
        </div>

        {/* 头像区域 */}
        <div className={styles.authorInfoAvatar}>
          <img
            className={styles.avatarImg}
            src={config.userAvatar}
            alt="avatar"
            width={118}
            height={118}
            loading="lazy"
          />
          {config.statusImg && (
            <div className={styles.authorStatus}>
              <img
                className={styles.gStatus}
                src={config.statusImg}
                alt="status"
                width={26}
                height={26}
                loading="lazy"
              />
            </div>
          )}
        </div>

        {/* 描述信息（悬停显示） */}
        <div className={styles.authorInfoDescription} dangerouslySetInnerHTML={{ __html: config.description }} />

        {/* 底部信息 */}
        <div className={styles.authorInfoBottomGroup}>
          <Link href="/about" className={styles.authorInfoBottomGroupLeft}>
            <h1 className={styles.authorInfoName}>{config.ownerName}</h1>
            <div className={styles.authorInfoDesc}>{config.subTitle}</div>
          </Link>
          <div className={styles.cardInfoSocialIcons}>
            {Object.entries(config.social || {}).map(([name, social]) => renderSocialIcon(name, social))}
          </div>
        </div>
      </div>
    </div>
  );
}
