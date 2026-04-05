/**
 * 文章内容组件
 * 渲染文章 HTML 内容，支持自定义标签插件
 */
"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
import { addToast } from "@heroui/react";
import styles from "./PostContent.module.css";
import "./code-highlight.css";
import { useShallow } from "zustand/shallow";
import { useSiteConfigStore } from "@/store/site-config-store";
import { apiClient } from "@/lib/api/client";

interface ArticleCopyInfo {
  isReprint?: boolean;
  copyrightAuthor?: string;
  copyrightUrl?: string;
}

interface PostContentProps {
  content: string;
  articleInfo?: ArticleCopyInfo;
  /** 启用后会执行 HTML 内容中的 <script> 标签，仅在受信任内容中使用 */
  enableScripts?: boolean;
}

/**
 * 将后端 convertImagesToLazyLoad 处理过的图片还原为正常 src，
 * 改用浏览器原生 loading="lazy" 懒加载。
 * 支持 src 与 data-src 任意顺序，避免 8091（Docker）等环境下占位符一直不替换。
 */
function restoreLazyImages(html: string): string {
  const srcFirstRe = /(<img\s[^>]*?)src="(data:image\/svg\+xml;base64,[^"]*)"([^>]*?)data-src="([^"]*)"([^>]*>)/g;
  let out = html.replace(srcFirstRe, (_, before, _pl, mid, realSrc, after) =>
    `${before}src="${realSrc}"${mid}loading="lazy"${after}`.replace(/\s*data-lazy-processed="[^"]*"/g, "")
  );
  const dataSrcFirstRe = /(<img\s[^>]*?)data-src="([^"]*)"([^>]*?)src="(data:image\/svg\+xml;base64,[^"]*)"([^>]*>)/g;
  out = out.replace(dataSrcFirstRe, (_, before, realSrc, mid, _pl, after) =>
    `${before}src="${realSrc}"${mid}loading="lazy"${after}`.replace(/\s*data-lazy-processed="[^"]*"/g, "")
  );
  return out;
}

// Mermaid 缩放功能的清理函数类型
type MermaidCleanupFn = (() => void) | null;

// 扩展 Window 接口以支持全局音乐播放器函数
declare global {
  interface Window {
    __musicPlayerToggle?: (playerId: string) => Promise<void>;
    __musicPlayerSeek?: (playerId: string, event: MouseEvent) => void;
  }
}

export function PostContent({ content, articleInfo, enableScripts = false }: PostContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const mermaidCleanupRef = useRef<MermaidCleanupFn>(null);
  const codeCopyCleanupRef = useRef<(() => void) | null>(null);
  const copyConfig = useSiteConfigStore(useShallow(state => state.siteConfig?.post?.copy));
  const codeBlockRawConfig = useSiteConfigStore(useShallow(state => state.siteConfig?.post?.code_block));
  const appName = useSiteConfigStore(state => state.siteConfig?.APP_NAME);
  const siteOwnerName = useSiteConfigStore(state => state.siteConfig?.frontDesk?.siteOwner?.name);

  // ── 复制版权拦截 ──
  useEffect(() => {
    // 如果复制功能被禁用或版权追加未启用，直接返回
    if (copyConfig?.enable === false) {
      // 禁止复制
      const preventCopy = (e: ClipboardEvent) => {
        if (contentRef.current?.contains(e.target as Node)) {
          e.preventDefault();
        }
      };
      document.addEventListener("copy", preventCopy, true);
      return () => document.removeEventListener("copy", preventCopy, true);
    }

    const copyrightEnabled = copyConfig?.copyrightEnable === true || copyConfig?.copyright_enable === true;
    if (!copyrightEnabled) return;

    const handleCopy = (e: ClipboardEvent) => {
      const selection = window.getSelection();
      if (!selection || selection.toString().length === 0) return;

      // 检查选择区域是否在文章内容区域内
      const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      if (!range) return;
      const container = range.commonAncestorContainer;
      const target = container.nodeType === Node.TEXT_NODE ? container.parentElement : (container as HTMLElement);
      if (!target || !contentRef.current?.contains(target)) return;

      // 生成版权文本
      const currentUrl = window.location.href;
      const siteName = appName || "本站";
      const ownerName = siteOwnerName || "博主";
      let copyrightText: string;

      if (articleInfo?.isReprint) {
        const author = articleInfo.copyrightAuthor || "原作者";
        const originalUrl = articleInfo.copyrightUrl || "";
        const template =
          copyConfig?.copyrightReprint ||
          copyConfig?.copyright_reprint ||
          "本文转载自 {originalAuthor}，原文地址：{originalUrl}\n当前页面：{currentUrl}";
        copyrightText = template
          .replace(/{originalAuthor}/g, author)
          .replace(/{originalUrl}/g, originalUrl)
          .replace(/{currentUrl}/g, currentUrl);
      } else {
        const template =
          copyConfig?.copyrightOriginal ||
          copyConfig?.copyright_original ||
          "本文来自 {siteName}，作者 {author}，转载请注明出处。\n原文地址：{url}";
        copyrightText = template
          .replace(/{siteName}/g, siteName)
          .replace(/{author}/g, ownerName)
          .replace(/{url}/g, currentUrl);
      }

      const originalText = selection.toString();
      e.clipboardData?.setData("text/plain", originalText + "\n\n---\n" + copyrightText);
      e.preventDefault();

      addToast({ title: "复制成功，复制和转载请标注本文地址", color: "success", timeout: 2000 });
    };

    document.addEventListener("copy", handleCopy as EventListener, true);
    return () => document.removeEventListener("copy", handleCopy as EventListener, true);
  }, [copyConfig, appName, siteOwnerName, articleInfo]);

  // 代码块配置
  const codeBlockConfig = useMemo(() => {
    const codeMaxLines = codeBlockRawConfig?.code_max_lines ?? 10;
    const macStyle = codeBlockRawConfig?.mac_style !== false;
    // 每行高度约 26px (font-size 16px * line-height 1.6)，加上 padding 20px
    const collapsedHeight = codeMaxLines > 0 ? codeMaxLines * 26 + 20 : 0;
    return { codeMaxLines, collapsedHeight, macStyle };
  }, [codeBlockRawConfig?.code_max_lines, codeBlockRawConfig?.mac_style]);

  // 存储 Tip 清理函数
  const tipCleanupFnsRef = useRef<(() => void)[]>([]);

  // 初始化 Tip 提示框事件
  const initTipEvents = useCallback(() => {
    if (!contentRef.current) return;

    // 清理之前的事件监听
    tipCleanupFnsRef.current.forEach(fn => fn());
    tipCleanupFnsRef.current = [];

    const tipWrappers = contentRef.current.querySelectorAll(".anzhiyu-tip-wrapper");

    tipWrappers.forEach(wrapper => {
      const wrapperEl = wrapper as HTMLElement;
      const tipText = wrapperEl.querySelector(".anzhiyu-tip-text") as HTMLElement;
      const tip = wrapperEl.querySelector(".anzhiyu-tip") as HTMLElement;

      if (!tipText || !tip) return;

      // 检查触发方式
      const trigger = tip.getAttribute("data-trigger") || "hover";
      // 获取延迟时间（毫秒），默认无延迟
      const delay = parseInt(tip.getAttribute("data-delay") || "0", 10);

      // 显示 tip 的函数
      const showTip = () => {
        tip.style.visibility = "visible";
        tip.style.opacity = "1";
        tip.classList.add("show");
        tip.setAttribute("data-visible", "true");
      };

      // 隐藏 tip 的函数
      const hideTip = () => {
        tip.style.visibility = "hidden";
        tip.style.opacity = "0";
        tip.classList.remove("show");
        tip.setAttribute("data-visible", "false");
      };

      if (trigger === "click") {
        // 点击触发的 tip：只绑定点击事件，不绑定 hover 事件
        const handleClick = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          const isVisible = tip.getAttribute("data-visible") === "true";
          if (isVisible) {
            hideTip();
          } else {
            showTip();
          }
        };

        // 点击外部区域关闭
        const handleDocumentClick = (e: Event) => {
          if (!wrapperEl.contains(e.target as Node)) {
            hideTip();
          }
        };

        tipText.addEventListener("click", handleClick);
        document.addEventListener("click", handleDocumentClick);

        // 添加清理函数
        tipCleanupFnsRef.current.push(() => {
          tipText.removeEventListener("click", handleClick);
          document.removeEventListener("click", handleDocumentClick);
        });
      } else {
        // Hover 触发的 tip：绑定 mouseenter/mouseleave 事件
        let showTimer: ReturnType<typeof setTimeout> | null = null;
        let hideTimer: ReturnType<typeof setTimeout> | null = null;

        const handleMouseEnter = () => {
          if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
          }
          showTimer = setTimeout(showTip, delay);
        };

        const handleMouseLeave = () => {
          if (showTimer) {
            clearTimeout(showTimer);
            showTimer = null;
          }
          hideTimer = setTimeout(hideTip, 100);
        };

        tipText.addEventListener("mouseenter", handleMouseEnter);
        tipText.addEventListener("mouseleave", handleMouseLeave);

        // 添加清理函数
        tipCleanupFnsRef.current.push(() => {
          tipText.removeEventListener("mouseenter", handleMouseEnter);
          tipText.removeEventListener("mouseleave", handleMouseLeave);
          if (showTimer) clearTimeout(showTimer);
          if (hideTimer) clearTimeout(hideTimer);
        });
      }
    });
  }, []);

  // 初始化 Hidden 隐藏内容事件
  const initHiddenEvents = useCallback(() => {
    if (!contentRef.current) return;

    const hideButtons = contentRef.current.querySelectorAll(".hide-button");

    hideButtons.forEach(button => {
      const handleClick = () => {
        const parent = button.closest(".hide-block, .hide-inline");
        if (!parent) return;

        const content = parent.querySelector(".hide-content") as HTMLElement;
        if (!content) return;

        // 切换显示状态
        if (content.style.display === "none" || !content.style.display) {
          content.style.display = parent.classList.contains("hide-inline") ? "inline" : "block";
          button.textContent = "收起";
        } else {
          content.style.display = "none";
          // 恢复原始按钮文字
          const originalText = button.getAttribute("data-display") || "查看";
          button.textContent = originalText;
        }
      };

      // 保存原始文字
      if (!button.getAttribute("data-display")) {
        button.setAttribute("data-display", button.textContent || "查看");
      }

      button.addEventListener("click", handleClick);
    });

    // 初始隐藏所有隐藏内容
    const hideContents = contentRef.current.querySelectorAll(".hide-content") as NodeListOf<HTMLElement>;
    hideContents.forEach(content => {
      content.style.display = "none";
    });
  }, []);

  // 初始化 Tabs 标签页事件
  const initTabsEvents = useCallback(() => {
    if (!contentRef.current) return;

    const tabContainers = contentRef.current.querySelectorAll(".tabs");

    tabContainers.forEach(container => {
      const tabs = container.querySelectorAll(".nav-tabs .tab");
      const contents = container.querySelectorAll(".tab-contents .tab-item-content");

      tabs.forEach((tab, index) => {
        (tab as HTMLElement).setAttribute(
          "onclick",
          `var c=this.closest('.tabs');` +
          `c.querySelectorAll('.nav-tabs .tab').forEach(function(t){t.classList.remove('active')});` +
          `c.querySelectorAll('.tab-contents .tab-item-content').forEach(function(p){p.classList.remove('active')});` +
          `this.classList.add('active');` +
          `var panels=c.querySelectorAll('.tab-contents .tab-item-content');` +
          `if(panels[${index}])panels[${index}].classList.add('active');`
        );
      });

      // 确保导航和内容的 active 状态同步
      const activeBtn = container.querySelector(".nav-tabs .tab.active");
      if (tabs.length > 0) {
        if (!activeBtn) {
          tabs[0].classList.add("active");
        }
        const activeIdx = activeBtn ? Array.from(tabs).indexOf(activeBtn) : 0;
        if (!container.querySelector(".tab-item-content.active") && contents[activeIdx]) {
          contents[activeIdx].classList.add("active");
        }
      }
    });
  }, []);

  // 初始化行内密码遮挡事件
  const initInlinePasswordEvents = useCallback(() => {
    if (!contentRef.current) return;

    const passwords = contentRef.current.querySelectorAll(".inline-password");

    passwords.forEach(pw => {
      pw.addEventListener("click", () => {
        pw.classList.toggle("revealed");
      });
    });
  }, []);

  // 兼容历史 LinkCard 结构，补齐缺失节点，确保详情页渲染稳定
  const normalizeLinkCardStructure = useCallback(() => {
    if (!contentRef.current) return;

    const toIconifySvgUrl = (iconifyName: string): string => {
      const [prefix, name] = iconifyName.split(":");
      if (!prefix || !name) return "";
      return `https://api.iconify.design/${prefix}/${name}.svg?color=currentColor`;
    };
    const mapLegacyIconToFa6 = (legacyIconClass: string): string => {
      if (legacyIconClass === "anzhiyu-icon-angle-right") return "fa6-solid:angle-right";
      return "rivet-icons:link";
    };
    const createFa6IconImage = (iconifyName: string, className?: string): HTMLImageElement => {
      const iconImg = document.createElement("img");
      iconImg.src = toIconifySvgUrl(iconifyName);
      iconImg.alt = "";
      iconImg.loading = "eager";
      iconImg.setAttribute("data-iconify", iconifyName);
      if (className) iconImg.className = className;
      return iconImg;
    };

    const linkCards = contentRef.current.querySelectorAll(".anzhiyu-tag-link .tag-Link");
    linkCards.forEach(cardNode => {
      const card = cardNode as HTMLElement;
      const bottom = card.querySelector(".tag-link-bottom") as HTMLElement | null;
      if (!bottom) return;
      const left = bottom.querySelector(".tag-link-left") as HTMLElement | null;

      if (left) {
        // 兼容历史 HTML：将 <span class="iconify" data-icon="prefix:name"> 转为可直接展示的 <img>
        const iconifySpans = left.querySelectorAll(".iconify[data-icon]");
        iconifySpans.forEach(span => {
          const iconName = (span.getAttribute("data-icon") || "").trim();
          const [prefix, name] = iconName.split(":");
          if (!prefix || !name) return;
          const iconImg = createFa6IconImage(`${prefix}:${name}`);
          iconImg.alt = iconName;
          span.replaceWith(iconImg);
        });

        const legacyIconNodes = left.querySelectorAll("i.anzhiyufont");
        legacyIconNodes.forEach(node => {
          const legacyIconClass = Array.from(node.classList).find(cls => cls.startsWith("anzhiyu-icon-")) || "";
          const mappedIcon = mapLegacyIconToFa6(legacyIconClass);
          node.replaceWith(createFa6IconImage(mappedIcon));
        });

        if (!left.querySelector("img, i")) {
          left.appendChild(createFa6IconImage("rivet-icons:link"));
        }
      }

      const right = bottom.querySelector(".tag-link-right") as HTMLElement | null;
      if (right) {
        const titleEl = right.querySelector(".tag-link-title") as HTMLElement | null;
        const fallbackTitle = (card as HTMLAnchorElement).getAttribute("href") || "链接卡片";
        if (titleEl && !(titleEl.textContent || "").trim()) {
          titleEl.textContent = fallbackTitle;
        }

        let sitenameEl = right.querySelector(".tag-link-sitename") as HTMLElement | null;
        if (!sitenameEl) {
          sitenameEl = document.createElement("span");
          sitenameEl.className = "tag-link-sitename";
          right.appendChild(sitenameEl);
        }
        if (!(sitenameEl.textContent || "").trim()) {
          sitenameEl.textContent = "网站名称";
        }
      }

      const tipsEl = card.querySelector(".tag-link-tips") as HTMLElement | null;
      if (tipsEl && !(tipsEl.textContent || "").trim()) {
        tipsEl.textContent = "引用站外地址";
      }

      const hasArrow = Array.from(bottom.children).some(
        child =>
          (child.tagName === "I" &&
            child.classList.contains("anzhiyufont") &&
            child.classList.contains("anzhiyu-icon-angle-right")) ||
          (child.tagName === "IMG" && (child as HTMLImageElement).dataset.iconify === "fa6-solid:angle-right") ||
          child.classList.contains("tag-link-arrow-icon")
      );

      const legacyArrowNodes = bottom.querySelectorAll("i.anzhiyufont.anzhiyu-icon-angle-right");
      legacyArrowNodes.forEach(node => {
        node.replaceWith(createFa6IconImage("fa6-solid:angle-right", "tag-link-arrow-icon"));
      });

      if (!hasArrow) {
        bottom.appendChild(createFa6IconImage("fa6-solid:angle-right", "tag-link-arrow-icon"));
      }
    });

    // 链接卡片图标不使用懒加载，避免无痕模式等环境下 data-src 未及时替换导致不显示
    const linkCardIcons = contentRef.current.querySelectorAll(".anzhiyu-tag-link .tag-link-left img[data-src]");
    linkCardIcons.forEach((img: Element) => {
      const el = img as HTMLImageElement;
      const dataSrc = el.getAttribute("data-src");
      if (dataSrc) {
        el.src = dataSrc;
        el.removeAttribute("data-src");
        el.classList.remove("lazy-image", "lazy-loaded", "lazy-loading");
        el.removeAttribute("data-lazy-processed");
      }
    });
  }, []);

  // 初始化付费内容购买按钮事件
  const initPaidContentEvents = useCallback(() => {
    if (!contentRef.current) return;

    // 购买按钮
    const purchaseBtns = contentRef.current.querySelectorAll(".purchase-btn");
    purchaseBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const title = btn.getAttribute("data-title") || "付费内容";
        addToast({
          title: "付费内容",
          description: `「${title}」的购买功能即将上线，敬请期待`,
          color: "warning",
        });
      });
    });

    // 查询订单链接
    const queryLinks = contentRef.current.querySelectorAll(".query-order-link");
    queryLinks.forEach(link => {
      link.addEventListener("click", () => {
        addToast({
          title: "查询订单",
          description: "订单查询功能即将上线，敬请期待",
          color: "primary",
        });
      });
    });
  }, []);

  // 初始化密码保护内容事件
  const initPasswordContentEvents = useCallback(() => {
    if (!contentRef.current) return;

    const verifyBtns = contentRef.current.querySelectorAll(".password-verify-btn");
    verifyBtns.forEach(btn => {
      const handleVerify = async () => {
        const contentId = btn.getAttribute("data-content-id");
        if (!contentId) return;

        const container = btn.closest(".password-content-editor-preview");
        if (!container) return;

        const input = container.querySelector(`.password-input[data-content-id="${contentId}"]`) as HTMLInputElement;
        if (!input || !input.value.trim()) {
          addToast({ title: "提示", description: "请输入密码", color: "warning" });
          return;
        }

        try {
          // 获取当前文章的 slug（从 URL 中提取）
          const pathParts = window.location.pathname.split("/").filter(Boolean);
          const slug = pathParts[pathParts.length - 1] || "";

          const res = await apiClient.post<{ content: string }>(`/api/v1/password-content/verify`, {
            slug,
            content_id: contentId,
            password: input.value.trim(),
          });

          if (res.data?.content) {
            // 验证成功，替换锁定区域为实际内容
            const lockedArea = container.querySelector(".password-content-locked");
            if (lockedArea) {
              const previewArea =
                container.querySelector(".password-content-preview") ||
                container.querySelector(".password-content-body");
              if (previewArea) {
                previewArea.innerHTML = res.data.content;
              }
            }
            // 更新标题区域的徽章
            const badge = container.querySelector(".password-badge, .password-pro-badge");
            if (badge) {
              badge.textContent = "已解锁";
              (badge as HTMLElement).style.color = "#16a34a";
              (badge as HTMLElement).style.background = "rgba(22, 163, 74, 0.08)";
            }
          } else {
            addToast({ title: "密码错误", description: "请检查密码后重试", color: "danger" });
          }
        } catch {
          addToast({ title: "密码错误", description: "请检查密码后重试", color: "danger" });
        }
      };

      btn.addEventListener("click", handleVerify);

      // 支持回车提交
      const contentId = btn.getAttribute("data-content-id");
      if (contentId) {
        const container = btn.closest(".password-content-editor-preview");
        const input = container?.querySelector(`.password-input[data-content-id="${contentId}"]`) as HTMLInputElement;
        if (input) {
          input.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleVerify();
            }
          });
        }
      }
    });
  }, []);

  // 初始化登录可见内容事件
  const initLoginRequiredContentEvents = useCallback(() => {
    if (!contentRef.current) return;

    // 登录按钮
    const loginBtns = contentRef.current.querySelectorAll("[data-login-action='check-email']");
    loginBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        // 跳转到登录页面，带上当前 URL 作为回调
        const currentUrl = encodeURIComponent(window.location.href);
        window.location.href = `/login?redirect=${currentUrl}`;
      });
    });

    // 注册按钮
    const registerBtns = contentRef.current.querySelectorAll("[data-login-action='register-form']");
    registerBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const currentUrl = encodeURIComponent(window.location.href);
        window.location.href = `/register?redirect=${currentUrl}`;
      });
    });
  }, []);

  // 将裸 <pre><code> 转换为 details.md-editor-code 结构（兼容 TipTap 编辑器输出）
  const normalizeCodeBlocks = useCallback(() => {
    if (!contentRef.current) return;

    const pres = contentRef.current.querySelectorAll("pre");
    pres.forEach(pre => {
      if (pre.closest(".md-editor-code")) return;

      const code = pre.querySelector("code");
      if (!code) return;

      const langMatch = code.className.match(/language-(\w+)/);
      const language = langMatch ? langMatch[1] : "";
      const title = pre.getAttribute("data-title") || "";
      const displayLabel = title || language || "plaintext";
      const codeText = code.textContent || "";
      const lines = codeText.split("\n");
      if (lines[lines.length - 1] === "") lines.pop();

      const isOpen = pre.getAttribute("data-open") !== "false";
      const isCollapsed = pre.getAttribute("data-collapsed") === "true";

      const lineNumberSpans = lines.map(() => "<span></span>").join("");

      const details = document.createElement("details");
      details.className = "md-editor-code";
      if (isOpen) {
        details.setAttribute("open", "");
      }
      if (isCollapsed) {
        details.setAttribute("data-collapsed", "true");
      }

      const summary = document.createElement("summary");
      summary.className = "md-editor-code-head";
      summary.innerHTML = `<div class="code-lang">${displayLabel.toUpperCase()}</div>`;
      details.appendChild(summary);

      const newPre = document.createElement("pre");
      const newCode = document.createElement("code");
      if (language) {
        newCode.className = `language-${language}`;
        newCode.setAttribute("language", language);
      }
      newCode.innerHTML =
        `<span class="md-editor-code-block">${codeText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>` +
        `<span rn-wrapper="" aria-hidden="true">${lineNumberSpans}</span>`;
      newPre.appendChild(newCode);
      details.appendChild(newPre);

      pre.replaceWith(details);
    });
  }, []);

  // 初始化代码块图标（展开箭头和复制按钮）
  const initCodeBlockIcons = useCallback(() => {
    if (!contentRef.current) return;

    const { codeMaxLines, collapsedHeight, macStyle } = codeBlockConfig;

    // SVG 图标
    // 展开箭头 (fa6-solid:chevron-down) - 向下箭头，收起时旋转向右
    const expandIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 448 512"><path fill="currentColor" d="M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7L86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z"/></svg>`;

    // 展开更多按钮 (fa6-solid:angles-down)
    const expandMoreIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 448 512"><path fill="currentColor" d="M246.6 470.6c-12.5 12.5-32.8 12.5-45.3 0l-160-160c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L224 402.7l137.4-137.3c12.5-12.5 32.8-12.5 45.3 0s12.5 32.8 0 45.3l-160 160zm160-352l-160 160c-12.5 12.5-32.8 12.5-45.3 0l-160-160c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L224 210.7L361.4 73.4c12.5-12.5 32.8-12.5 45.3 0s12.5 32.8 0 45.3z"/></svg>`;

    // 复制按钮 (ion:copy 填充版)
    const copyIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 512 512"><path fill="currentColor" d="M408 480H184a72 72 0 0 1-72-72V184a72 72 0 0 1 72-72h224a72 72 0 0 1 72 72v224a72 72 0 0 1-72 72"/><path fill="currentColor" d="M160 80h235.88A72.12 72.12 0 0 0 328 32H104a72 72 0 0 0-72 72v224a72.12 72.12 0 0 0 48 67.88V160a80 80 0 0 1 80-80"/></svg>`;

    // 复制成功图标 (fa6-solid:check)
    const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 448 512"><path fill="currentColor" d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>`;

    // 查找所有代码块
    const codeBlocks = contentRef.current.querySelectorAll(".md-editor-code");

    codeBlocks.forEach(codeBlock => {
      const codeHead = codeBlock.querySelector(".md-editor-code-head");
      if (!codeHead) return;

      // 计算代码行数
      let lineCount = 0;
      const preElement = codeBlock.querySelector("pre");
      if (preElement) {
        const rnWrapper = preElement.querySelector("span[rn-wrapper]");
        if (rnWrapper) {
          // 通过行号计算行数
          lineCount = rnWrapper.children.length;
        } else {
          // 通过换行符计算行数
          const codeContent = preElement.textContent || "";
          lineCount = (codeContent.match(/\n/g) || []).length + 1;
        }
      }

      // 判断是否需要折叠：优先使用编辑器保存的状态，否则按 codeMaxLines 配置
      const savedCollapsed = codeBlock.getAttribute("data-collapsed");
      const needsCollapse = savedCollapsed === "true" || (savedCollapsed === null && codeMaxLines !== -1 && lineCount > codeMaxLines);

      // 添加复制按钮（必须用真实 button：summary 内非交互元素点击会切换 details 的 open）
      let copyBtn = codeHead.querySelector(".copy-button");
      if (!copyBtn) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "copy-button";
        btn.innerHTML = copyIcon;
        btn.setAttribute("data-copy-icon", copyIcon);
        btn.setAttribute("data-check-icon", checkIcon);
        btn.setAttribute("title", "复制代码");
        codeHead.appendChild(btn);
        copyBtn = btn;
      } else if (copyBtn.tagName !== "BUTTON") {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = copyBtn.className;
        const t = copyBtn.getAttribute("title");
        if (t) btn.setAttribute("title", t);
        const dc = copyBtn.getAttribute("data-copy-icon");
        const dch = copyBtn.getAttribute("data-check-icon");
        if (dc) btn.setAttribute("data-copy-icon", dc);
        if (dch) btn.setAttribute("data-check-icon", dch);
        btn.innerHTML = copyBtn.innerHTML;
        copyBtn.replaceWith(btn);
        copyBtn = btn;
      } else {
        (copyBtn as HTMLButtonElement).type = "button";
        if (!copyBtn.querySelector("svg")) {
          copyBtn.innerHTML = copyIcon;
          copyBtn.setAttribute("data-copy-icon", copyIcon);
          copyBtn.setAttribute("data-check-icon", checkIcon);
        }
      }

      // 所有代码块都添加展开箭头图标（用于展开/收起代码内容）
      let expandBtn = codeHead.querySelector(".expand") as HTMLElement | null;
      if (!expandBtn) {
        expandBtn = document.createElement("span");
        expandBtn.className = "expand";
        expandBtn.innerHTML = expandIcon;
        // 使用内联 onclick 控制代码块的展开/收起
        expandBtn.setAttribute(
          "onclick",
          `event.preventDefault(); event.stopPropagation(); const details = this.closest('details'); if(details) { details.open = !details.open; }`
        );
        codeHead.insertBefore(expandBtn, codeHead.firstChild);
      } else if (!expandBtn.querySelector("svg")) {
        expandBtn.innerHTML = expandIcon;
      }

      // Mac 风格三色圆点
      const existingDots = codeHead.querySelector(".mac-dots");
      if (macStyle) {
        if (!existingDots) {
          const dotsWrapper = document.createElement("span");
          dotsWrapper.className = "mac-dots";
          dotsWrapper.innerHTML = `<span class="mac-dot red"></span><span class="mac-dot yellow"></span><span class="mac-dot green"></span>`;
          codeHead.insertBefore(dotsWrapper, expandBtn?.nextSibling || codeHead.firstChild);
          codeHead.classList.add("has-mac-dots");
        }
      } else {
        if (existingDots) existingDots.remove();
        codeHead.classList.remove("has-mac-dots");
      }

      // 只有需要折叠的代码块才添加高度限制和展开更多按钮
      if (needsCollapse) {
        // 添加可折叠类
        codeBlock.classList.add("is-collapsible");

        // 首次渲染或用户未手动展开时，设置折叠状态
        const existingExpandBtn = codeBlock.querySelector(".code-expand-btn");
        if (!existingExpandBtn || !existingExpandBtn.classList.contains("is-expanded")) {
          codeBlock.setAttribute("open", "");
          codeBlock.classList.add("is-collapsed");
          if (preElement) {
            (preElement as HTMLElement).style.height = `${collapsedHeight}px`;
            (preElement as HTMLElement).style.overflow = "hidden";
          }
        }

        // 添加展开更多按钮（使用内联 onclick 处理器）
        let expandMoreBtn = codeBlock.querySelector(".code-expand-btn") as HTMLElement | null;
        if (!expandMoreBtn) {
          expandMoreBtn = document.createElement("div");
          expandMoreBtn.className = "code-expand-btn";
          expandMoreBtn.innerHTML = `<i>${expandMoreIcon}</i>`;
          // 使用内联 onclick 避免事件委托问题
          expandMoreBtn.setAttribute(
            "onclick",
            `const container = this.closest('details.md-editor-code'); const pre = container.querySelector('pre'); const icon = this.querySelector('i'); if(container.classList.contains('is-collapsed')) { container.classList.remove('is-collapsed'); if(pre) { pre.style.height = ''; pre.style.overflow = ''; } if(icon) { icon.style.transform = 'rotate(180deg)'; } this.classList.add('is-expanded'); } else { container.classList.add('is-collapsed'); if(pre) { pre.style.height = '${collapsedHeight}px'; pre.style.overflow = 'hidden'; } if(icon) { icon.style.transform = 'rotate(0deg)'; } this.classList.remove('is-expanded'); }`
          );
          codeBlock.appendChild(expandMoreBtn);
        } else if (!expandMoreBtn.querySelector("svg")) {
          const iconWrapper = expandMoreBtn.querySelector("i");
          if (iconWrapper) {
            iconWrapper.innerHTML = expandMoreIcon;
          } else {
            expandMoreBtn.innerHTML = `<i>${expandMoreIcon}</i>`;
          }
        }
      } else {
        // 不需要折叠的代码块，移除折叠相关类和展开更多按钮
        codeBlock.classList.remove("is-collapsible", "is-collapsed");
        const existingExpandMoreBtn = codeBlock.querySelector(".code-expand-btn");
        if (existingExpandMoreBtn) existingExpandMoreBtn.remove();

        // 确保代码块是展开的
        codeBlock.setAttribute("open", "");
        if (preElement) {
          (preElement as HTMLElement).style.height = "";
          (preElement as HTMLElement).style.overflow = "";
        }
      }
    });
  }, [codeBlockConfig]);

  // 代码块展开/收起事件已通过内联 onclick 处理，无需额外事件委托
  const initCodeExpandEvents = useCallback(() => {
    // 事件处理已在 initCodeBlockIcons 中通过内联 onclick 实现
  }, []);

  // 初始化代码高亮
  const initCodeHighlight = useCallback(async () => {
    if (!contentRef.current) return;

    // 查找所有代码块中的代码内容
    const codeBlocks = contentRef.current.querySelectorAll(".md-editor-code-block");
    if (codeBlocks.length === 0) return;

    // 动态导入 highlight.js
    const hljs = await import("highlight.js").then(m => m.default);

    codeBlocks.forEach(block => {
      // 获取语言类型
      const codeElement = block.closest("code");
      const language = codeElement?.getAttribute("language") || "";

      // 如果已经高亮过，跳过
      if (block.getAttribute("data-highlighted") === "yes") return;

      // 获取代码内容
      const codeText = block.textContent || "";

      try {
        let highlighted: string;
        if (language && hljs.getLanguage(language)) {
          // 指定语言高亮
          highlighted = hljs.highlight(codeText, { language }).value;
        } else {
          // 自动检测语言
          highlighted = hljs.highlightAuto(codeText).value;
        }

        // 更新内容
        block.innerHTML = highlighted;
        block.setAttribute("data-highlighted", "yes");
      } catch (err) {
        console.warn("代码高亮失败:", err);
      }
    });
  }, []);

  // 初始化 KaTeX 数学公式渲染
  const initKatex = useCallback(async () => {
    if (!contentRef.current) return;

    // 查找所有未渲染的 KaTeX 元素（md-editor 格式）
    const katexInlineElements = contentRef.current.querySelectorAll(".md-editor-katex-inline:not([data-processed])");
    const katexBlockElements = contentRef.current.querySelectorAll(".md-editor-katex-block:not([data-processed])");

    // 查找 TipTap 编辑器格式的公式元素（通过 data-latex 属性识别）
    const tiptapBlockElements = contentRef.current.querySelectorAll("[data-type='math-block'][data-latex]:not([data-processed])");
    const tiptapInlineElements = contentRef.current.querySelectorAll("[data-type='math-inline'][data-latex]:not([data-processed])");

    // 如果没有 md-editor 格式的 KaTeX 元素，尝试处理原始 $...$ 格式
    const needsRawProcessing =
      katexInlineElements.length === 0 &&
      katexBlockElements.length === 0 &&
      tiptapBlockElements.length === 0 &&
      tiptapInlineElements.length === 0 &&
      (contentRef.current.innerHTML.includes("$") ||
        contentRef.current.innerHTML.includes("\\(") ||
        contentRef.current.innerHTML.includes("\\["));

    if (
      katexInlineElements.length === 0 &&
      katexBlockElements.length === 0 &&
      tiptapBlockElements.length === 0 &&
      tiptapInlineElements.length === 0 &&
      !needsRawProcessing
    ) {
      return;
    }

    // 动态导入 KaTeX 样式和库
    await import("katex/dist/katex.min.css");
    const katex = await import("katex").then(m => m.default);

    // 渲染 md-editor 格式的行内公式
    katexInlineElements.forEach(element => {
      try {
        const latex = element.textContent || "";
        katex.render(latex, element as HTMLElement, {
          throwOnError: false,
          displayMode: false,
        });
        element.setAttribute("data-processed", "true");
      } catch (err) {
        console.warn("KaTeX 行内公式渲染失败:", err);
      }
    });

    // 渲染 md-editor 格式的块级公式
    katexBlockElements.forEach(element => {
      try {
        const latex = element.textContent || "";
        katex.render(latex, element as HTMLElement, {
          throwOnError: false,
          displayMode: true,
        });
        element.setAttribute("data-processed", "true");
      } catch (err) {
        console.warn("KaTeX 块级公式渲染失败:", err);
      }
    });

    // 渲染 TipTap 编辑器格式的块级公式
    tiptapBlockElements.forEach(element => {
      try {
        const latex = element.getAttribute("data-latex") || "";
        if (!latex) return;
        katex.render(latex, element as HTMLElement, {
          throwOnError: false,
          displayMode: true,
        });
        element.setAttribute("data-processed", "true");
      } catch (err) {
        console.warn("KaTeX TipTap 块级公式渲染失败:", err);
      }
    });

    // 渲染 TipTap 编辑器格式的行内公式
    tiptapInlineElements.forEach(element => {
      try {
        const latex = element.getAttribute("data-latex") || "";
        if (!latex) return;
        katex.render(latex, element as HTMLElement, {
          throwOnError: false,
          displayMode: false,
        });
        element.setAttribute("data-processed", "true");
      } catch (err) {
        console.warn("KaTeX TipTap 行内公式渲染失败:", err);
      }
    });

    // 处理原始 $...$ 和 $$...$$ 格式
    if (needsRawProcessing) {
      try {
        const renderMathInElement = await import("katex/contrib/auto-render").then(m => m.default);
        renderMathInElement(contentRef.current, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\[", right: "\\]", display: true },
            { left: "\\(", right: "\\)", display: false },
          ],
          throwOnError: false,
        });
      } catch (err) {
        console.warn("KaTeX auto-render 失败:", err);
      }
    }
  }, []);

  /**
   * 格式化时间（音乐播放器用）
   */
  const formatTime = useCallback((seconds: number) => {
    if (!isFinite(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  /**
   * 将 http:// 链接转换为 https://
   */
  const ensureHttps = useCallback((url: string) => {
    if (!url) return url;
    if (url.startsWith("http://")) {
      return url.replace("http://", "https://");
    }
    return url;
  }, []);

  /**
   * 通过 API 获取音频资源
   */
  const fetchAudioUrl = useCallback(
    async (neteaseId: string): Promise<string | null> => {
      try {
        const result = await apiClient.post<{ audioUrl?: string }>("/api/public/music/song-resources", { neteaseId });
        if (result.code === 200 && result.data?.audioUrl) {
          return ensureHttps(result.data.audioUrl);
        }
        return null;
      } catch (error) {
        console.error("[音乐播放器] 获取音频资源失败:", error);
        return null;
      }
    },
    [ensureHttps]
  );

  /**
   * 初始化音乐播放器数据（通过 API 动态获取音频源）
   */
  const initMusicPlayerData = useCallback(
    async (playerId: string) => {
      const player = document.getElementById(playerId);
      if (!player || player.dataset.audioLoaded) return;

      const audio = player.querySelector(".music-audio-element") as HTMLAudioElement;
      const errorEl = player.querySelector(".music-error") as HTMLElement;

      if (!audio) {
        console.error("[音乐播放器] 未找到 audio 元素:", playerId);
        return;
      }

      try {
        const musicDataAttr = player.getAttribute("data-music-data");
        if (!musicDataAttr) {
          console.error("[音乐播放器] 没有找到 data-music-data 属性");
          if (errorEl) errorEl.style.display = "flex";
          return;
        }

        // 解码 HTML 实体
        const decodedData = musicDataAttr
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&amp;/g, "&");

        const musicData = JSON.parse(decodedData);

        // 音频链接具有时效性，需要通过 API 动态获取
        if (!musicData.neteaseId) {
          console.error("[音乐播放器] 缺少网易云音乐 ID，无法获取音频资源");
          if (errorEl) errorEl.style.display = "flex";
          return;
        }

        console.log("[音乐播放器] 通过 API 获取音频链接 - 网易云 ID:", musicData.neteaseId);
        player.classList.add("loading");

        const audioUrl = await fetchAudioUrl(musicData.neteaseId);
        if (audioUrl) {
          audio.src = audioUrl;
          audio.preload = "metadata";

          // 监听 loadedmetadata 事件以更新播放时长
          const durationEl = player.querySelector(".duration") as HTMLElement;
          const updateDuration = () => {
            if (durationEl && audio.duration) {
              durationEl.textContent = formatTime(audio.duration);
            }
          };

          if (audio.readyState >= 1) {
            updateDuration();
          } else {
            audio.addEventListener("loadedmetadata", updateDuration, { once: true });
          }

          audio.load();
          player.dataset.audioLoaded = "true";
          player.classList.remove("loading");
          console.log("[音乐播放器] 加载完成:", musicData.name);
        } else {
          console.error("[音乐播放器] 无法获取音频 URL");
          if (errorEl) errorEl.style.display = "flex";
          player.classList.remove("loading");
        }
      } catch (error) {
        console.error("[音乐播放器] 初始化失败:", error);
        if (errorEl) errorEl.style.display = "flex";
        player.classList.remove("loading");
      }
    },
    [fetchAudioUrl, formatTime]
  );

  /**
   * 音乐播放器切换播放/暂停
   * 供 HTML 中的内联 onclick 事件调用
   */
  const handleMusicPlayerToggle = useCallback(
    async (playerId: string) => {
      const player = document.getElementById(playerId);
      if (!player) return;

      const audio = player.querySelector(".music-audio-element") as HTMLAudioElement;
      if (!audio) return;

      // 如果音频还未加载，先通过 API 获取音频链接
      if (!player.dataset.audioLoaded) {
        await initMusicPlayerData(playerId);
      }

      if (audio.paused) {
        audio.play().catch(err => console.error("[音乐播放器] 播放失败:", err));
      } else {
        audio.pause();
      }
    },
    [initMusicPlayerData]
  );

  /**
   * 音乐播放器进度条跳转
   * 供 HTML 中的内联 onclick 事件调用
   */
  const handleMusicPlayerSeek = useCallback((playerId: string, event: MouseEvent) => {
    const player = document.getElementById(playerId);
    if (!player) return;

    const audio = player.querySelector(".music-audio-element") as HTMLAudioElement;
    const progressBar = event.currentTarget as HTMLElement;
    if (!audio || !progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    if (audio.duration) {
      audio.currentTime = percent * audio.duration;
    }
  }, []);

  /**
   * 初始化所有音乐播放器
   */
  const initMusicPlayers = useCallback(
    (container: HTMLElement) => {
      const musicPlayers = container.querySelectorAll(".markdown-music-player[data-music-id]");

      musicPlayers.forEach(playerEl => {
        const player = playerEl as HTMLElement;
        const audio = player.querySelector(".music-audio-element") as HTMLAudioElement;

        if (!audio || audio.dataset.eventsAttached) return;
        audio.dataset.eventsAttached = "true";

        const artworkWrapper = player.querySelector(".music-artwork-wrapper") as HTMLElement;
        const needleEl = player.querySelector(".artwork-image-needle-background") as HTMLElement;
        const playIcon = player.querySelector(".music-play-icon") as HTMLElement;
        const pauseIcon = player.querySelector(".music-pause-icon") as HTMLElement;
        const progressFill = player.querySelector(".music-progress-fill") as HTMLElement;
        const currentTimeEl = player.querySelector(".current-time") as HTMLElement;
        const durationEl = player.querySelector(".duration") as HTMLElement;

        // 音频事件监听
        audio.addEventListener("play", () => {
          if (artworkWrapper) artworkWrapper.classList.add("is-playing");
          if (needleEl) needleEl.classList.add("needle-playing");
          if (playIcon) playIcon.style.display = "none";
          if (pauseIcon) pauseIcon.style.display = "block";
        });

        audio.addEventListener("pause", () => {
          if (artworkWrapper) artworkWrapper.classList.remove("is-playing");
          if (needleEl) needleEl.classList.remove("needle-playing");
          if (playIcon) playIcon.style.display = "block";
          if (pauseIcon) pauseIcon.style.display = "none";
        });

        audio.addEventListener("timeupdate", () => {
          if (progressFill && audio.duration) {
            const progress = (audio.currentTime / audio.duration) * 100 || 0;
            progressFill.style.width = progress + "%";
          }
          if (currentTimeEl) {
            currentTimeEl.textContent = formatTime(audio.currentTime);
          }
        });

        audio.addEventListener("loadedmetadata", () => {
          if (durationEl) {
            durationEl.textContent = formatTime(audio.duration);
          }
        });

        audio.addEventListener("ended", () => {
          audio.currentTime = 0;
          if (artworkWrapper) artworkWrapper.classList.remove("is-playing");
          if (needleEl) needleEl.classList.remove("needle-playing");
        });

        // 预加载音频元数据以显示时长
        const preloadAudioMetadata = async () => {
          try {
            const musicDataAttr = player.getAttribute("data-music-data");
            if (!musicDataAttr) return;

            const decodedData = musicDataAttr
              .replace(/&quot;/g, '"')
              .replace(/&#039;/g, "'")
              .replace(/&amp;/g, "&");

            const musicData = JSON.parse(decodedData);

            // 应用封面主色到进度条
            if (musicData.color && progressFill) {
              progressFill.style.background = musicData.color;
              console.log("[音乐播放器] 应用主色:", musicData.color);
            }

            if (!musicData.neteaseId) return;

            console.log(`[音乐播放器] 预加载元数据 - ${musicData.name || "未知歌曲"}`);

            // 调用 API 获取音频链接
            const audioUrl = await fetchAudioUrl(musicData.neteaseId);
            if (audioUrl) {
              audio.src = audioUrl;
              audio.preload = "metadata"; // 只预加载元数据，不下载整个音频
              player.dataset.audioLoaded = "true";
              console.log(`[音乐播放器] 元数据预加载完成 - ${musicData.name || "未知歌曲"}`);
            }
          } catch (error) {
            console.error("[音乐播放器] 预加载元数据失败:", error);
          }
        };

        // 异步预加载
        preloadAudioMetadata();
      });
    },
    [formatTime, fetchAudioUrl]
  );

  // 初始化代码复制事件，返回清理函数
  const initCodeCopyEvents = useCallback((): (() => void) | undefined => {
    if (!contentRef.current) return;

    const copyButtons = contentRef.current.querySelectorAll(".md-editor-code .copy-button");
    const cleanups: (() => void)[] = [];

    copyButtons.forEach(btn => {
      const handleClick = async (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        const codeBlock = btn.closest(".md-editor-code");
        if (!codeBlock) return;

        const codeElement = codeBlock.querySelector(".md-editor-code-block");
        if (!codeElement) return;

        const codeText = codeElement.textContent || "";

        try {
          await navigator.clipboard.writeText(codeText);
          const checkIcon =
            btn.getAttribute("data-check-icon") ||
            `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 448 512"><path fill="currentColor" d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>`;
          const copyIcon = btn.getAttribute("data-copy-icon") || btn.innerHTML;
          btn.innerHTML = checkIcon;
          btn.classList.add("copied");

          addToast({
            title: "复制成功",
            color: "success",
            timeout: 2000,
          });

          setTimeout(() => {
            btn.innerHTML = copyIcon;
            btn.classList.remove("copied");
          }, 2000);
        } catch (err) {
          console.error("复制失败:", err);
          addToast({
            title: "复制失败",
            color: "danger",
            timeout: 2000,
          });
        }
      };

      btn.addEventListener("click", handleClick);
      cleanups.push(() => btn.removeEventListener("click", handleClick));
    });

    return () => cleanups.forEach(fn => fn());
  }, []);

  /**
   * 初始化 Mermaid 图表的缩放功能
   * 模拟 md-editor-v3 的行为，动态添加 action 按钮
   */
  const initMermaidZoom = useCallback((container: HTMLElement): (() => void) | null => {
    const mermaidContainers = container.matches(".md-editor-mermaid")
      ? [container]
      : Array.from(container.querySelectorAll(".md-editor-mermaid"));

    if (mermaidContainers.length === 0) return null;

    const removeEventsMap = new Map<Element, { removeEvent?: () => void; removeClick?: () => void }>();

    // Pin 图标 SVG
    const pinOffIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"></path><path d="M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89"></path><path d="m2 2 20 20"></path><path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11"></path></svg>`;
    const pinIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"></path><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"></path></svg>`;

    // 添加缩放/平移事件
    const addZoomEvent = (mm: Element) => {
      const el = mm as HTMLElement;
      let scale = 1;
      let translateX = 0;
      let translateY = 0;
      let isDragging = false;
      let startX = 0;
      let startY = 0;

      const updateTransform = () => {
        const svg = el.querySelector("svg");
        if (svg) {
          (
            svg as unknown as HTMLElement
          ).style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
          (svg as unknown as HTMLElement).style.transformOrigin = "center center";
        }
      };

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        scale = Math.max(0.5, Math.min(3, scale + delta));
        updateTransform();
      };

      const onMouseDown = (e: MouseEvent) => {
        if (e.button !== 0) return;
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        el.style.cursor = "grabbing";
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        updateTransform();
      };

      const onMouseUp = () => {
        isDragging = false;
        el.style.cursor = "grab";
      };

      const onMouseLeave = () => {
        isDragging = false;
        el.style.cursor = "grab";
      };

      // 触摸事件支持
      let lastTouchDistance = 0;
      const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 2) {
          lastTouchDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
        } else if (e.touches.length === 1) {
          isDragging = true;
          startX = e.touches[0].clientX - translateX;
          startY = e.touches[0].clientY - translateY;
        }
      };

      const onTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        if (e.touches.length === 2) {
          const distance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          const delta = (distance - lastTouchDistance) * 0.01;
          scale = Math.max(0.5, Math.min(3, scale + delta));
          lastTouchDistance = distance;
          updateTransform();
        } else if (isDragging && e.touches.length === 1) {
          translateX = e.touches[0].clientX - startX;
          translateY = e.touches[0].clientY - startY;
          updateTransform();
        }
      };

      const onTouchEnd = () => {
        isDragging = false;
        lastTouchDistance = 0;
      };

      el.addEventListener("wheel", onWheel, { passive: false });
      el.addEventListener("mousedown", onMouseDown);
      el.addEventListener("mousemove", onMouseMove);
      el.addEventListener("mouseup", onMouseUp);
      el.addEventListener("mouseleave", onMouseLeave);
      el.addEventListener("touchstart", onTouchStart, { passive: false });
      el.addEventListener("touchmove", onTouchMove, { passive: false });
      el.addEventListener("touchend", onTouchEnd);

      el.style.cursor = "grab";
      el.style.overflow = "hidden";

      return () => {
        el.removeEventListener("wheel", onWheel);
        el.removeEventListener("mousedown", onMouseDown);
        el.removeEventListener("mousemove", onMouseMove);
        el.removeEventListener("mouseup", onMouseUp);
        el.removeEventListener("mouseleave", onMouseLeave);
        el.removeEventListener("touchstart", onTouchStart);
        el.removeEventListener("touchmove", onTouchMove);
        el.removeEventListener("touchend", onTouchEnd);

        // 重置变换
        const svg = el.querySelector("svg");
        if (svg) {
          (svg as unknown as HTMLElement).style.transform = "";
        }
        el.style.cursor = "";
        el.removeAttribute("data-grab");
      };
    };

    mermaidContainers.forEach(mm => {
      // 检查是否已有 action div
      let actionDiv = mm.querySelector(".md-editor-mermaid-action");
      // 如果子元素中没有，检查下一个兄弟元素是否是 action div
      if (!actionDiv && mm.nextElementSibling?.classList.contains("md-editor-mermaid-action")) {
        actionDiv = mm.nextElementSibling;
        mm.appendChild(actionDiv);
      }
      if (!actionDiv) {
        // 创建 action div
        const div = document.createElement("div");
        div.className = "md-editor-mermaid-action";
        div.innerHTML = pinOffIcon;
        mm.appendChild(div);
        actionDiv = div;
      }

      const onClick = () => {
        const current = removeEventsMap.get(mm);
        if (current?.removeEvent) {
          // 已启用缩放，点击后禁用
          current.removeEvent();
          mm.removeAttribute("data-grab");
          removeEventsMap.set(mm, { removeClick: current.removeClick });
          actionDiv!.innerHTML = pinOffIcon;
        } else {
          // 未启用缩放，点击后启用
          const removeEvent = addZoomEvent(mm);
          mm.setAttribute("data-grab", "");
          removeEventsMap.set(mm, {
            removeEvent,
            removeClick: current?.removeClick,
          });
          actionDiv!.innerHTML = pinIcon;
        }
      };

      (actionDiv as HTMLElement).addEventListener("click", onClick);
      removeEventsMap.set(mm, {
        removeClick: () => (actionDiv as HTMLElement).removeEventListener("click", onClick),
      });
    });

    // 返回清理函数
    return () => {
      removeEventsMap.forEach(({ removeEvent, removeClick }) => {
        removeEvent?.();
        removeClick?.();
      });
      removeEventsMap.clear();
    };
  }, []);

  // 处理文章内容中的链接、标签插件等
  useEffect(() => {
    if (!contentRef.current) return;

    // 保存 ref 的当前值，用于清理函数
    const currentContent = contentRef.current;

    // 为外部链接添加 target="_blank"
    const links = currentContent.querySelectorAll('a[href^="http"]');
    links.forEach(link => {
      if (!link.getAttribute("target")) {
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
      }
    });

    normalizeLinkCardStructure();

    // 处理图片懒加载：先立即加载视口内的图片，再用 IntersectionObserver 处理剩余的
    const loadImage = (img: HTMLImageElement) => {
      const dataSrc = img.getAttribute("data-src");
      if (!dataSrc) return;
      img.src = dataSrc;
      img.removeAttribute("data-src");
      img.removeAttribute("loading");
      img.removeAttribute("data-lazy-processed");
    };

    const images = currentContent.querySelectorAll<HTMLImageElement>("img[data-src]");
    if (images.length > 0) {
      const hasPlaceholder = (el: HTMLImageElement) => (el.getAttribute("src") || "").startsWith("data:image/svg+xml;base64,");
      images.forEach(img => {
        if (hasPlaceholder(img)) loadImage(img);
      });

      const remaining = currentContent.querySelectorAll<HTMLImageElement>("img[data-src]");
      if (remaining.length > 0) {
        const viewportHeight = window.innerHeight;
        remaining.forEach(img => {
          const rect = img.getBoundingClientRect();
          if (rect.top < viewportHeight + 300 || rect.height === 0) loadImage(img);
        });

        const stillRemaining = currentContent.querySelectorAll<HTMLImageElement>("img[data-src]");
        if (stillRemaining.length > 0 && "IntersectionObserver" in window) {
          const observer = new IntersectionObserver(
            entries => {
              entries.forEach(entry => {
                if (entry.isIntersecting) {
                  loadImage(entry.target as HTMLImageElement);
                  observer.unobserve(entry.target);
                }
              });
            },
            { rootMargin: "300px" }
          );
          stillRemaining.forEach(img => observer.observe(img));
        }
      }
    }

    // 初始化标签插件事件
    initTipEvents();
    initHiddenEvents();
    initTabsEvents();
    initInlinePasswordEvents();
    initPaidContentEvents();
    initPasswordContentEvents();
    initLoginRequiredContentEvents();
    normalizeCodeBlocks(); // 将裸 <pre><code> 转换为 md-editor-code 结构
    initCodeBlockIcons(); // 添加图标（展开/复制/Mac dots）
    initCodeExpandEvents(); // 绑定展开/收起事件
    if (codeCopyCleanupRef.current) {
      codeCopyCleanupRef.current();
    }
    codeCopyCleanupRef.current = initCodeCopyEvents() ?? null;
    initCodeHighlight(); // 代码高亮
    initKatex(); // KaTeX 数学公式渲染

    // 初始化音乐播放器
    // 注册全局函数（供 HTML 内联事件使用）
    window.__musicPlayerToggle = handleMusicPlayerToggle;
    window.__musicPlayerSeek = handleMusicPlayerSeek;
    initMusicPlayers(currentContent);

    // 初始化 Mermaid 缩放功能
    if (mermaidCleanupRef.current) {
      mermaidCleanupRef.current();
    }
    mermaidCleanupRef.current = initMermaidZoom(currentContent);

    // 动态导入 Fancybox 图片查看器
    let fancyboxModule: typeof import("@fancyapps/ui") | null = null;
    let cancelled = false;
    import("@fancyapps/ui/dist/fancybox/fancybox.css");
    import("@fancyapps/ui").then(mod => {
      if (cancelled) return;
      fancyboxModule = mod;
      mod.Fancybox.bind(currentContent, "img:not(a img)", {
        groupAll: true,
      });
    });

    // 清理函数
    return () => {
      cancelled = true;
      if (codeCopyCleanupRef.current) {
        codeCopyCleanupRef.current();
        codeCopyCleanupRef.current = null;
      }
      if (mermaidCleanupRef.current) {
        mermaidCleanupRef.current();
        mermaidCleanupRef.current = null;
      }
      delete window.__musicPlayerToggle;
      delete window.__musicPlayerSeek;
      if (fancyboxModule) {
        fancyboxModule.Fancybox.unbind(currentContent);
        fancyboxModule.Fancybox.close(true);
      }
    };
  }, [
    content,
    normalizeLinkCardStructure,
    normalizeCodeBlocks,
    initTipEvents,
    initHiddenEvents,
    initTabsEvents,
    initInlinePasswordEvents,
    initPaidContentEvents,
    initPasswordContentEvents,
    initLoginRequiredContentEvents,
    initCodeBlockIcons,
    initCodeExpandEvents,
    initCodeCopyEvents,
    initCodeHighlight,
    initKatex,
    initMusicPlayers,
    handleMusicPlayerToggle,
    handleMusicPlayerSeek,
    initMermaidZoom,
  ]);

  // 浏览器不会执行通过 innerHTML 插入的 <script>，需手动重建节点
  useEffect(() => {
    if (!enableScripts || !contentRef.current) return;
    const container = contentRef.current;
    const scripts = container.querySelectorAll("script");
    const createdScripts: HTMLScriptElement[] = [];

    scripts.forEach(oldScript => {
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach(attr => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode?.replaceChild(newScript, oldScript);
      createdScripts.push(newScript);
    });

    return () => {
      createdScripts.forEach(s => s.remove());
    };
  }, [content, enableScripts]);

  return (
    <article
      ref={contentRef}
      className={styles.postContent}
      data-post-content="true"
      dangerouslySetInnerHTML={{ __html: restoreLazyImages(content) }}
    />
  );
}

export default PostContent;
