"use client";

import { memo, useEffect, useRef, useMemo } from "react";
import { useSiteConfigStore } from "@/store/site-config-store";
import styles from "./CustomSidebarBlocks.module.css";

interface CustomSidebarBlock {
  title: string;
  content: string;
  showInPost?: boolean;
}

interface CustomSidebarBlocksProps {
  /** 是否为文章页，文章页会根据 showInPost 过滤 */
  isPostPage?: boolean;
}

/**
 * 解析 CUSTOM_SIDEBAR 配置值为块数组
 * 兼容旧的字符串格式和新的数组格式
 */
function parseCustomBlocks(rawValue: unknown): CustomSidebarBlock[] {
  if (!rawValue) return [];

  // 已经是数组格式
  if (Array.isArray(rawValue)) {
    return rawValue.map((block: Record<string, unknown>) => ({
      title: (block.title as string) || "",
      content: (block.content as string) || "",
      showInPost: block.showInPost !== undefined ? Boolean(block.showInPost) : true,
    }));
  }

  // 字符串格式（JSON 数组字符串或旧的纯 HTML 字符串）
  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (!trimmed || trimmed === "[]") return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((block: Record<string, unknown>) => ({
          title: (block.title as string) || "",
          content: (block.content as string) || "",
          showInPost: block.showInPost !== undefined ? Boolean(block.showInPost) : true,
        }));
      }
    } catch {
      // 解析失败，视为旧的纯 HTML 格式，包装为单个块
      return [{ title: "", content: trimmed, showInPost: true }];
    }
  }

  return [];
}

/**
 * 自定义侧边栏块组件
 * 从 siteConfig.CUSTOM_SIDEBAR 读取配置，渲染自定义 HTML 块
 * 参考 anheyu-app Sticky.vue 实现
 */
export const CustomSidebarBlocks = memo(function CustomSidebarBlocks({ isPostPage = false }: CustomSidebarBlocksProps) {
  const siteConfig = useSiteConfigStore(state => state.siteConfig);
  const containerRefs = useRef<(HTMLDivElement | null)[]>([]);

  const blocks = useMemo(() => {
    const allBlocks = parseCustomBlocks(siteConfig?.CUSTOM_SIDEBAR);
    if (isPostPage) {
      return allBlocks.filter(block => block.showInPost !== false);
    }
    return allBlocks;
  }, [siteConfig?.CUSTOM_SIDEBAR, isPostPage]);

  // 执行自定义块中的 <script> 标签
  useEffect(() => {
    if (blocks.length === 0) return;

    containerRefs.current.forEach(container => {
      if (!container) return;

      const scripts = container.querySelectorAll("script");
      scripts.forEach(oldScript => {
        const newScript = document.createElement("script");
        // 复制所有属性
        Array.from(oldScript.attributes).forEach(attr => {
          newScript.setAttribute(attr.name, attr.value);
        });
        newScript.textContent = oldScript.textContent;
        oldScript.parentNode?.replaceChild(newScript, oldScript);
      });
    });
  }, [blocks]);

  if (blocks.length === 0) return null;

  return (
    <>
      {blocks.map((block, index) => (
        <div key={index} className={styles.customBlock}>
          {block.title && <div className={styles.customBlockTitle}>{block.title}</div>}
          <div
            ref={el => {
              containerRefs.current[index] = el;
            }}
            className={styles.customBlockContent}
            dangerouslySetInnerHTML={{ __html: block.content }}
          />
        </div>
      ))}
    </>
  );
});

CustomSidebarBlocks.displayName = "CustomSidebarBlocks";
