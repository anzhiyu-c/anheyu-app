/*
 * @Author: 安知鱼
 * @Date: 2026-02-12 16:35:08
 * @Description:
 * @LastEditTime: 2026-02-12 16:42:29
 * @LastEditors: 安知鱼
 */
"use client";

import { Icon } from "@iconify/react";
import { useIsMobile } from "@/hooks/use-media-query";
import styles from "./styles.module.css";
import { cn } from "@/lib/utils";

interface Shortcut {
  keys: string[];
  description: string;
}

interface KeyboardTipsProps {
  visible: boolean;
  shortcuts: Shortcut[];
}

export function KeyboardTips({ visible, shortcuts }: KeyboardTipsProps) {
  const isMobile = useIsMobile();

  // 移动端不显示
  if (isMobile) return null;

  return (
    <div className={cn(styles.shortcutGuideWrapper, "shortcut-guide-wrapper", visible && styles.show)}>
      <div className={styles.keyboardHeader}>
        <div className={styles.keyboardTitle}>
          <Icon icon="solar:keyboard-bold" width={20} height={20} />
          博客快捷键
        </div>
        <div className={styles.keyboardSubtitle}>按住 Shift 键查看可用快捷键</div>
      </div>
      <div className={styles.keybordList}>
        {shortcuts.map((shortcut, index) => (
          <div key={index} className={styles.keybordItem}>
            <div className={styles.keyGroup}>
              {shortcut.keys.map(key => (
                <kbd key={key} className={styles.key}>
                  {key}
                </kbd>
              ))}
            </div>
            <div className={styles.keyContent}>
              <div className={styles.content}>{shortcut.description}</div>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.keyboardFooter}>
        <div className={styles.footerText}>松开 Shift 键或点击外部区域关闭</div>
      </div>
    </div>
  );
}
