"use client";

/**
 * @Description: 右键菜单组件
 * @Author: 安知鱼
 * 1:1 移植自 anheyu-app layout/frontend/components/RightMenu/index.vue
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/react";
import { useUiStore } from "@/store/ui-store";
import { useSiteConfigStore } from "@/store/site-config-store";
import { useTheme } from "@/hooks/use-theme";
import styles from "./styles.module.css";

/**
 * 安全写入剪贴板（带错误处理）
 */
const safeClipboardWrite = (text: string, successMsg: string) => {
  navigator.clipboard.writeText(text).then(
    () => addToast({ title: successMsg, color: "success", timeout: 2000 }),
    () => addToast({ title: "复制失败，请重试", color: "danger", timeout: 2000 })
  );
};

export function RightMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { isDark, toggleTheme, mounted } = useTheme();

  const useCustomContextMenu = useUiStore(s => s.useCustomContextMenu);
  const isCommentBarrageVisible = useUiStore(s => s.isCommentBarrageVisible);
  const toggleCommentBarrage = useUiStore(s => s.toggleCommentBarrage);
  const siteConfig = useSiteConfigStore(s => s.siteConfig);

  const [isVisible, setIsVisible] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [transformOrigin, setTransformOrigin] = useState("top left");
  const [isTextSelected, setIsTextSelected] = useState(false);
  const [capturedText, setCapturedText] = useState("");
  const [isTextInPostDetail, setIsTextInPostDetail] = useState(false);
  const [hasCommentSection, setHasCommentSection] = useState(false);
  const [isClickOnMusicPlayer, setIsClickOnMusicPlayer] = useState(false);
  const [musicIsPlaying, setMusicIsPlaying] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVisibleRef = useRef(false);
  const isDarkMode = mounted && isDark;

  // 使用 ref 稳定引用，避免事件监听器频繁重注册
  const stateRef = useRef({
    useCustomContextMenu,
    pathname,
    siteConfig,
  });

  // 同步 ref（放在 useEffect 中避免 lint 警告）
  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  useEffect(() => {
    stateRef.current = { useCustomContextMenu, pathname, siteConfig };
  }, [useCustomContextMenu, pathname, siteConfig]);

  // 隐藏菜单（用 ref 读取 isVisible，避免 stale closure）
  const hideMenu = useCallback(() => {
    if (!isVisibleRef.current) return;
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setIsHiding(true);
    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
      setIsHiding(false);
      hideTimerRef.current = null;
    }, 100);
  }, []);

  // 检查评论区域（与 anheyu-app checkCommentSection 一致，同时检查配置 + DOM）
  const checkCommentSection = useCallback(() => {
    const config = stateRef.current.siteConfig;
    const commentEnabled = config?.comment?.enable === true || config?.comment?.enable === "true";
    const commentElementExists = !!document.getElementById("post-comment");
    setHasCommentSection(commentEnabled && commentElementExists);
  }, []);

  // 调整菜单位置，避免超出窗口边界
  const adjustMenuPosition = useCallback((x: number, y: number) => {
    const menu = menuRef.current;
    if (!menu) return { x, y, origin: "top left" };

    const menuWidth = menu.offsetWidth || 200;
    const menuHeight = menu.offsetHeight || 300;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let finalX = x;
    let finalY = y;
    let originX = "left";
    let originY = "top";

    if (x + menuWidth > windowWidth) {
      finalX = x - menuWidth;
      originX = "right";
    }

    if (y + menuHeight > windowHeight) {
      finalY = y - menuHeight;
      originY = "bottom";
    }

    finalX = Math.max(5, finalX);
    finalY = Math.max(5, finalY);

    return { x: finalX, y: finalY, origin: `${originY} ${originX}` };
  }, []);

  // 全局事件监听 - 注册一次，通过 ref 读取最新状态
  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      const { useCustomContextMenu: enabled, pathname: path } = stateRef.current;
      if (!enabled) return;
      if (path.startsWith("/doc/")) return;
      if (window.innerWidth < 768) return;

      event.preventDefault();

      // 检查文本选中
      const selection = window.getSelection();
      const textSelected = selection ? !selection.isCollapsed : false;
      setIsTextSelected(textSelected);

      // 检查是否右键点击了音乐播放器
      const target = event.target as HTMLElement;
      const musicPlayer = target.closest("#nav-music");
      setIsClickOnMusicPlayer(!!musicPlayer);

      if (musicPlayer) {
        window.dispatchEvent(new CustomEvent("music-player-get-play-status"));
      }

      // 检查评论区域
      checkCommentSection();

      // 捕获选中文本
      if (textSelected && selection) {
        setCapturedText(selection.toString());

        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        if (range) {
          const container = range.commonAncestorContainer;
          const targetElement =
            container.nodeType === Node.TEXT_NODE ? container.parentElement : (container as HTMLElement);
          const postDetailContent = targetElement?.closest(".post-detail-content");
          setIsTextInPostDetail(!!postDetailContent);
        } else {
          setIsTextInPostDetail(false);
        }
      } else {
        setCapturedText("");
        setIsTextInPostDetail(false);
      }

      // 清除之前的隐藏动画
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      // 设置初始位置
      const clickX = event.clientX;
      const clickY = event.clientY;

      setPosition({ x: clickX, y: clickY });
      setIsVisible(true);
      setIsHiding(false);

      // 下一帧调整位置（确保 DOM 已渲染以获取实际尺寸）
      requestAnimationFrame(() => {
        const adjusted = adjustMenuPosition(clickX, clickY);
        setPosition({ x: adjusted.x, y: adjusted.y });
        setTransformOrigin(adjusted.origin);
      });
    };

    const handleClick = () => {
      if (isVisibleRef.current) hideMenu();
    };

    const handleScroll = () => {
      if (isVisibleRef.current) hideMenu();
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isVisibleRef.current) hideMenu();
    };

    const handlePlayStatus = (event: Event) => {
      const { isPlaying } = (event as CustomEvent).detail;
      setMusicIsPlaying(isPlaying);
    };

    const handleSongNameResponse = (event: Event) => {
      const { songName, artist } = (event as CustomEvent).detail;
      const fullName = artist ? `${artist} - ${songName}` : songName;
      safeClipboardWrite(fullName, "歌曲名称复制成功");
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("click", handleClick);
    window.addEventListener("scroll", handleScroll);
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("music-player-play-status-response", handlePlayStatus);
    window.addEventListener("music-player-song-name-response", handleSongNameResponse);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("music-player-play-status-response", handlePlayStatus);
      window.removeEventListener("music-player-song-name-response", handleSongNameResponse);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [hideMenu, checkCommentSection, adjustMenuPosition]);

  // 路由变化时重新检查评论区域（setTimeout 匹配 Vue nextTick，等 DOM 更新后再检查）
  useEffect(() => {
    const timer = setTimeout(checkCommentSection, 0);
    return () => clearTimeout(timer);
  }, [pathname, checkCommentSection]);

  // ===== 菜单项操作函数 =====
  const goBack = () => {
    window.history.back();
    hideMenu();
  };

  const goForward = () => {
    window.history.forward();
    hideMenu();
  };

  const refreshPage = () => {
    window.location.reload();
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    hideMenu();
  };

  const copySelectedText = () => {
    if (capturedText) {
      safeClipboardWrite(capturedText, "复制成功，复制和转载请标注本文地址");
    }
    hideMenu();
  };

  const quoteToComment = () => {
    if (capturedText) {
      window.dispatchEvent(new CustomEvent("quote-text-to-comment", { detail: { quoteText: capturedText } }));
      addToast({ title: "已引用到评论", color: "success", timeout: 2000 });
    }
    hideMenu();
  };

  const searchLocal = () => {
    if (capturedText) {
      window.dispatchEvent(new CustomEvent("frontend-open-search", { detail: { keyword: capturedText } }));
    }
    hideMenu();
  };

  const searchBaidu = () => {
    if (capturedText) {
      window.open(`https://www.baidu.com/s?wd=${encodeURIComponent(capturedText)}`, "_blank");
    }
    hideMenu();
  };

  const randomNavigate = () => {
    router.push("/random");
    hideMenu();
  };

  const gotoCategories = () => {
    router.push("/categories");
    hideMenu();
  };

  const gotoTags = () => {
    router.push("/tags");
    hideMenu();
  };

  const copyUrl = () => {
    safeClipboardWrite(window.location.href, "复制本页链接地址成功");
    hideMenu();
  };

  const handleThemeToggle = () => {
    if (!mounted) return;
    toggleTheme();
    hideMenu();
  };

  const handleToggleCommentBarrage = () => {
    toggleCommentBarrage();
    hideMenu();
  };

  // 音乐播放器控制
  const togglePlayPause = () => {
    window.dispatchEvent(new CustomEvent("music-player-toggle-play"));
    hideMenu();
  };

  const previousSong = () => {
    window.dispatchEvent(new CustomEvent("music-player-previous"));
    hideMenu();
  };

  const nextSong = () => {
    window.dispatchEvent(new CustomEvent("music-player-next"));
    hideMenu();
  };

  const copySongName = () => {
    window.dispatchEvent(new CustomEvent("music-player-get-song-name"));
    hideMenu();
  };

  // ===== 渲染 =====
  const menuClasses = [styles.rightMenu, isVisible ? styles.visible : "", isHiding ? styles.hiding : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={menuRef}
      id="rightMenu"
      className={menuClasses}
      onClick={e => e.stopPropagation()}
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
        transformOrigin,
      }}
    >
      {/* 导航栏 - 小图标行 */}
      <div className={`${styles.menuGroup} ${styles.menuSmall}`}>
        <div className={styles.menuItem} onClick={goBack}>
          <Icon icon="ri:arrow-left-s-line" />
        </div>
        <div className={styles.menuItem} onClick={goForward}>
          <Icon icon="ri:arrow-right-s-line" />
        </div>
        <div className={styles.menuItem} onClick={refreshPage}>
          <Icon icon="ri:refresh-line" style={{ fontSize: "0.9rem" }} />
        </div>
        <div className={styles.menuItem} onClick={scrollToTop}>
          <Icon icon="ri:arrow-up-line" />
        </div>
      </div>

      {/* 文本选中时的操作 */}
      {isTextSelected ? (
        <div className={`${styles.menuGroup} ${styles.menuGroupLine}`}>
          <div className={styles.menuItem} onClick={copySelectedText}>
            <Icon icon="ri:file-copy-line" />
            <span>复制选中文本</span>
          </div>
          {isTextInPostDetail && (
            <div className={styles.menuItem} onClick={quoteToComment}>
              <Icon icon="ri:chat-1-fill" />
              <span>引用到评论</span>
            </div>
          )}
          <div className={styles.menuItem} onClick={searchLocal}>
            <Icon icon="ri:search-line" />
            <span>站内搜索</span>
          </div>
          <div className={styles.menuItem} onClick={searchBaidu}>
            <Icon icon="ri:search-line" />
            <span>百度搜索</span>
          </div>
        </div>
      ) : (
        <div className={`${styles.menuGroup} ${styles.menuGroupLine}`}>
          <div className={styles.menuItem} onClick={randomNavigate}>
            <Icon icon="ri:shuffle-line" />
            <span>随便逛逛</span>
          </div>
          <div className={styles.menuItem} onClick={gotoCategories}>
            <Icon icon="ri:folder-line" />
            <span>博客分类</span>
          </div>
          <div className={styles.menuItem} onClick={gotoTags}>
            <Icon icon="ri:price-tag-3-line" />
            <span>文章标签</span>
          </div>
        </div>
      )}

      {/* 音乐播放器控制 - 仅在右键音乐播放器时显示 */}
      {isClickOnMusicPlayer && (
        <div className={`${styles.menuGroup} ${styles.menuGroupLine}`}>
          <div className={styles.menuItem} onClick={togglePlayPause}>
            <Icon icon={musicIsPlaying ? "ri:pause-fill" : "ri:play-fill"} />
            <span>{musicIsPlaying ? "暂停" : "播放"}</span>
          </div>
          <div className={styles.menuItem} onClick={previousSong}>
            <Icon icon="ri:skip-back-fill" />
            <span>上一首</span>
          </div>
          <div className={styles.menuItem} onClick={nextSong}>
            <Icon icon="ri:skip-forward-fill" />
            <span>下一首</span>
          </div>
          <div className={styles.menuItem} onClick={copySongName}>
            <Icon icon="ri:file-copy-line" />
            <span>复制歌名</span>
          </div>
        </div>
      )}

      {/* 通用操作 */}
      <div className={`${styles.menuGroup} ${styles.menuGroupLine}`}>
        <div className={styles.menuItem} onClick={copyUrl}>
          <Icon icon="ri:file-copy-line" />
          <span>复制地址</span>
        </div>
        <div className={styles.menuItem} onClick={handleThemeToggle}>
          <Icon icon="ri:contrast-2-line" />
          <span>{isDarkMode ? "浅色模式" : "深色模式"}</span>
        </div>
        {hasCommentSection && (
          <div className={styles.menuItem} onClick={handleToggleCommentBarrage}>
            <Icon icon="ri:chat-3-line" />
            <span>{isCommentBarrageVisible ? "隐藏热评" : "显示热评"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
