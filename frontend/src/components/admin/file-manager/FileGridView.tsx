"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { addToast } from "@heroui/react";
import { RiLoader4Line } from "react-icons/ri";
import type { FileItem } from "@/types/file-manager";
import { FileType } from "@/types/file-manager";
import { extractLogicalPathFromUri } from "@/utils/file-manager";
import { Tooltip } from "@/components/ui/tooltip";
import { staggerContainer, staggerItem, springTransition } from "@/lib/motion";
import { FileThumbnail } from "./FileThumbnail";
import styles from "./FileGridView.module.css";

interface FileGridViewProps {
  files: FileItem[];
  loading: boolean;
  selectedFileIds: Set<string>;
  disabledFileIds?: Set<string>;
  isMoreLoading: boolean;
  hasMore: boolean;
  onSelectSingle: (fileId: string) => void;
  onSelectRange: (fileId: string) => void;
  onToggleSelection: (fileId: string) => void;
  onSelectAll: () => void;
  onNavigateTo: (path: string) => void;
  onScrollToLoad: () => void;
  onPreviewFile: (item: FileItem) => void;
  onContextMenu: (event: MouseEvent, file: FileItem) => void;
}

export function FileGridView({
  files,
  loading,
  selectedFileIds,
  disabledFileIds = new Set(),
  isMoreLoading,
  hasMore,
  onSelectSingle,
  onSelectRange,
  onToggleSelection,
  onSelectAll,
  onNavigateTo,
  onScrollToLoad,
  onPreviewFile,
  onContextMenu,
}: FileGridViewProps) {
  const handleLocalScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (isAtBottom && hasMore && !isMoreLoading) {
      onScrollToLoad();
    }
  };

  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleItemClick = (file: FileItem, event: React.MouseEvent<HTMLDivElement>) => {
    if (disabledFileIds?.has(file.id)) return;
    if (file.metadata?.["sys:upload_session_id"]) return;

    if (event.shiftKey) {
      onSelectRange(file.id);
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      onToggleSelection(file.id);
      return;
    }

    // 已唯一选中时再次单击：立即取消选中
    if (selectedFileIds.has(file.id) && selectedFileIds.size === 1) {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      onToggleSelection(file.id);
      return;
    }

    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      onSelectSingle(file.id);
      clickTimerRef.current = null;
    }, 150);
  };

  const handleItemDblClick = (file: FileItem) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }

    if (disabledFileIds?.has(file.id)) {
      addToast({ title: "不能进入正在移动的文件夹。", color: "warning", timeout: 3000 });
      return;
    }
    if (file.metadata?.["sys:upload_session_id"]) return;
    if (file.type === FileType.Dir) {
      const logicalPath = extractLogicalPathFromUri(file.path);
      onNavigateTo(logicalPath);
    } else {
      onPreviewFile(file);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        onSelectAll();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSelectAll]);

  return (
    <div className={styles["file-grid-view"]} onScroll={handleLocalScroll}>
      <motion.div
        className={styles["grid-container"]}
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        key={files.map(f => f.id).join(",")}
      >
        {files.map(file => (
          <motion.div
            key={file.id}
            className={`${styles["grid-item"]} ${selectedFileIds.has(file.id) ? styles.selected : ""} ${
              file.metadata?.["sys:upload_session_id"] ? styles["is-uploading"] : ""
            } ${disabledFileIds?.has(file.id) ? styles["is-disabled"] : ""}`}
            variants={staggerItem}
            transition={springTransition}
            whileTap={{ scale: 0.97 }}
            data-id={file.id}
            data-type={file.type === FileType.Dir ? "Dir" : "File"}
            onClick={event => handleItemClick(file, event)}
            onDoubleClick={() => handleItemDblClick(file)}
            onContextMenu={event => {
              event.preventDefault();
              event.stopPropagation();
              onContextMenu(event.nativeEvent, file);
            }}
          >
            <div className={styles["item-icon"]}>
              <FileThumbnail file={file} />
              {file.metadata?.["sys:upload_session_id"] ? (
                <div className={styles["uploading-overlay"]}>
                  <Tooltip content="文件上传中..." placement="top" showArrow={false}>
                    <RiLoader4Line className={styles["uploading-indicator"]} />
                  </Tooltip>
                </div>
              ) : null}
            </div>
            <div className={styles["item-name"]}>{file.name}</div>
          </motion.div>
        ))}
      </motion.div>

      <AnimatePresence>
        {isMoreLoading ? (
          <motion.div
            key="loading"
            className={styles["status-row"]}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className={styles["load-more-indicator"]}>
              <RiLoader4Line className={styles["loading-icon"]} />
              <span>加载中...</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!isMoreLoading && !hasMore && files.length > 0 ? (
        <div className={styles["status-row"]}>
          <div className={styles["no-more-indicator"]}>— 没有更多了 —</div>
        </div>
      ) : null}

      <AnimatePresence>
        {files.length === 0 && !loading && !isMoreLoading ? (
          <motion.div
            key="empty"
            className={styles["grid-empty"]}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={springTransition}
          >
            这里什么都没有
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
