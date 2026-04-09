"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RiAddLine,
  RiArrowDownSLine,
  RiCheckboxCircleFill,
  RiCloseCircleFill,
  RiCloseLine,
  RiDeleteBin6Line,
  RiEditLine,
  RiExchangeLine,
  RiFileTextLine,
  RiLoader4Line,
  RiMore2Fill,
  RiRefreshLine,
  RiAlertLine,
} from "react-icons/ri";
import type { UploadItem } from "@/types/file-manager";
import { formatBytes } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { slideInFromBottom, springTransition, contextMenuVariants, staggerItem, gentleSpring } from "@/lib/motion";
import styles from "./UploadProgress.module.css";

interface UploadProgressProps {
  visible: boolean;
  isCollapsed: boolean;
  queue: UploadItem[];
  speedMode: "instant" | "average";
  isGlobalOverwrite: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
  onAddFiles: () => void;
  onRetryItem: (itemId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onResolveConflict: (itemId: string, strategy: "overwrite" | "rename") => void;
  onGlobalCommand: (command: UploadGlobalCommand, value?: UploadGlobalCommandValue) => void;
}

type UploadGlobalCommand = "set-speed-mode" | "set-concurrency" | "set-overwrite-all" | "retry-all" | "clear-finished";
type UploadGlobalCommandValue = boolean | "instant" | "average" | undefined;

export function UploadProgress({
  visible,
  isCollapsed,
  queue,
  speedMode,
  isGlobalOverwrite,
  onClose,
  onToggleCollapse,
  onAddFiles,
  onRetryItem,
  onRemoveItem,
  onResolveConflict,
  onGlobalCommand,
}: UploadProgressProps) {
  const [popoverVisible, setPopoverVisible] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const processedQueue = useMemo(() => {
    const list = hideCompleted ? queue.filter(item => !["success", "canceled"].includes(item.status)) : queue;
    const sorted = [...list].sort((a, b) =>
      sortOrder === "asc" ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id)
    );
    return sorted;
  }, [queue, hideCompleted, sortOrder]);

  const handleMenuAction = (command: string, value?: UploadGlobalCommandValue) => {
    if (command === "toggle-hide") {
      setHideCompleted(!hideCompleted);
    } else if (command === "sort-asc") {
      setSortOrder("asc");
    } else if (command === "sort-desc") {
      setSortOrder("desc");
    } else {
      onGlobalCommand(command as UploadGlobalCommand, value);
    }
    setPopoverVisible(false);
  };

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className={`${styles["upload-progress-panel"]} ${isCollapsed ? styles["is-collapsed"] : ""}`}
          variants={slideInFromBottom}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={springTransition}
        >
          <div className={styles["panel-header"]}>
            <Tooltip content="关闭" placement="bottom" showArrow={false}>
              <span className={styles["icon-wrapper"]} onClick={onClose}>
                <RiCloseLine />
              </span>
            </Tooltip>
            <span>上传队列</span>
            <div className={styles["header-actions"]}>
              <Tooltip content="添加文件" placement="bottom" showArrow={false}>
                <span className={styles["icon-wrapper"]} onClick={onAddFiles}>
                  <RiAddLine />
                </span>
              </Tooltip>
              <Tooltip content="更多操作" placement="bottom" showArrow={false}>
                <span className={styles["icon-wrapper"]} onClick={() => setPopoverVisible(!popoverVisible)}>
                  <RiMore2Fill />
                </span>
              </Tooltip>
              <Tooltip content={isCollapsed ? "展开" : "收起"} placement="bottom" showArrow={false}>
                <motion.span
                  className={styles["icon-wrapper"]}
                  onClick={onToggleCollapse}
                  animate={{ rotate: isCollapsed ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <RiArrowDownSLine />
                </motion.span>
              </Tooltip>
            </div>
          </div>

          <AnimatePresence>
            {popoverVisible ? (
              <motion.ul
                className={styles["popover-menu"]}
                variants={contextMenuVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={springTransition}
              >
                <li
                  className={speedMode === "instant" ? styles.active : ""}
                  onClick={() => handleMenuAction("set-speed-mode", "instant")}
                >
                  瞬时速度
                </li>
                <li
                  className={speedMode === "average" ? styles.active : ""}
                  onClick={() => handleMenuAction("set-speed-mode", "average")}
                >
                  平均速度
                </li>
                <li className={styles.divider} />
                <li className={hideCompleted ? styles.active : ""} onClick={() => handleMenuAction("toggle-hide")}>
                  隐藏已完成任务
                </li>
                <li className={styles.divider} />
                <li className={sortOrder === "asc" ? styles.active : ""} onClick={() => handleMenuAction("sort-asc")}>
                  最先添加靠前
                </li>
                <li className={sortOrder === "desc" ? styles.active : ""} onClick={() => handleMenuAction("sort-desc")}>
                  最后添加靠前
                </li>
                <li className={styles.divider} />
                <li onClick={() => handleMenuAction("set-concurrency")}>设置并发数</li>
                <li
                  className={isGlobalOverwrite ? styles.active : ""}
                  onClick={() => handleMenuAction("set-overwrite-all", !isGlobalOverwrite)}
                >
                  覆盖所有同名文件
                </li>
                <li className={styles.divider} />
                <li onClick={() => handleMenuAction("retry-all")}>重试所有失败任务</li>
                <li onClick={() => handleMenuAction("clear-finished")}>清除已完成任务</li>
              </motion.ul>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {!isCollapsed ? (
              <motion.div
                className={styles["panel-body"]}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={gentleSpring}
              >
                {processedQueue.length === 0 ? (
                  <div className={styles["empty-queue"]}>
                    {queue.length > 0 && queue.every(item => ["success", "canceled"].includes(item.status))
                      ? "所有任务已处理完毕"
                      : queue.length > 0
                        ? "所有活动任务已完成"
                        : "没有上传任务"}
                  </div>
                ) : null}
                <AnimatePresence>
                  {processedQueue.map(item => (
                    <motion.div
                      key={item.id}
                      variants={staggerItem}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={springTransition}
                      layout
                    >
                      <UploadItemRow
                        item={item}
                        speedMode={speedMode}
                        onRetry={() => onRetryItem(item.id)}
                        onRemove={() => onRemoveItem(item.id)}
                        onResolveConflict={strategy => onResolveConflict(item.id, strategy)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

// ── 上传条目行 - 匹配 anheyu-app 设计 ──
function UploadItemRow({
  item,
  speedMode,
  onRetry,
  onRemove,
  onResolveConflict,
}: {
  item: UploadItem;
  speedMode: "instant" | "average";
  onRetry: () => void;
  onRemove: () => void;
  onResolveConflict: (strategy: "overwrite" | "rename") => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const speed = speedMode === "instant" ? item.instantSpeed : item.averageSpeed;

  const getStatusText = () => {
    switch (item.status) {
      case "success":
        return "上传成功";
      case "pending":
        return "等待上传...";
      case "canceled":
        return "已取消";
      case "error":
        return item.errorMessage || "上传失败";
      case "conflict":
        return item.errorMessage || "文件冲突";
      case "resumable":
        return "可续传";
      case "processing":
        return "正在准备上传…";
      default:
        return "";
    }
  };

  const statusClass =
    item.status === "success"
      ? styles["status-success"]
      : item.status === "error"
        ? styles["status-error"]
        : item.status === "uploading" || item.status === "processing"
          ? styles["status-uploading"]
          : item.status === "conflict"
            ? styles["status-conflict"]
            : "";

  return (
    <div
      className={`${styles["upload-item"]} ${statusClass}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 进度背景填充 */}
      {(item.status === "uploading" || item.status === "pending" || item.status === "processing") && (
        <motion.div
          className={styles["progress-fill"]}
          animate={{ width: `${item.progress}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      )}

      {/* 状态图标 */}
      <div className={styles["item-icon"]}>
        {item.status === "success" ? (
          <RiCheckboxCircleFill className={styles["icon-success"]} />
        ) : item.status === "error" ? (
          <RiCloseCircleFill className={styles["icon-error"]} />
        ) : item.status === "uploading" || item.status === "processing" ? (
          <RiLoader4Line className={styles["icon-uploading"]} />
        ) : item.status === "conflict" ? (
          <RiAlertLine className={styles["icon-conflict"]} />
        ) : (
          <RiFileTextLine className={styles["icon-default"]} />
        )}
      </div>

      {/* 信息区域 */}
      <div className={styles["item-info"]}>
        <div className={styles["item-name"]}>
          <span title={item.name}>{item.name}</span>
          {item.isResuming && item.status !== "success" && <span className={styles["resume-tag"]}>断点续传</span>}
        </div>

        <div className={styles["status-action-wrapper"]}>
          <AnimatePresence mode="wait">
            {!isHovered ? (
              <motion.div
                key={`status-${item.id}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                {["uploading", "processing", "resumable"].includes(item.status) ? (
                  <div className={styles["item-detail-info"]}>
                    <span className={styles["progress-percent"]}>{item.progress}%</span>
                    <span className={styles["speed-badge"]}>{speed ? `${formatBytes(speed)}/s` : "--"}</span>
                    <span className={styles["size-info"]}>
                      {formatBytes(item.uploadedSize)} / {formatBytes(item.size)}
                    </span>
                  </div>
                ) : (
                  <div
                    className={`${styles["item-message"]} ${
                      item.status === "success"
                        ? styles["is-success"]
                        : item.status === "error"
                          ? styles["is-error"]
                          : item.status === "conflict"
                            ? styles["is-conflict"]
                            : ""
                    }`}
                  >
                    {getStatusText()}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key={`actions-${item.id}`}
                className={styles["item-actions"]}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                {item.status === "success" && (
                  <Tooltip content="删除记录" placement="top" showArrow={false}>
                    <button className={`${styles["action-btn"]} ${styles.danger}`} onClick={onRemove}>
                      <RiDeleteBin6Line />
                    </button>
                  </Tooltip>
                )}
                {item.status === "error" && (
                  <>
                    <Tooltip content="重试" placement="top" showArrow={false}>
                      <button className={styles["action-btn"]} onClick={onRetry}>
                        <RiRefreshLine />
                      </button>
                    </Tooltip>
                    <Tooltip content="删除" placement="top" showArrow={false}>
                      <button className={`${styles["action-btn"]} ${styles.danger}`} onClick={onRemove}>
                        <RiDeleteBin6Line />
                      </button>
                    </Tooltip>
                  </>
                )}
                {item.status === "conflict" && (
                  <>
                    <Tooltip content="覆盖" placement="top" showArrow={false}>
                      <button className={styles["action-btn"]} onClick={() => onResolveConflict("overwrite")}>
                        <RiExchangeLine />
                      </button>
                    </Tooltip>
                    <Tooltip content="重命名" placement="top" showArrow={false}>
                      <button className={styles["action-btn"]} onClick={() => onResolveConflict("rename")}>
                        <RiEditLine />
                      </button>
                    </Tooltip>
                    <Tooltip content="删除" placement="top" showArrow={false}>
                      <button className={`${styles["action-btn"]} ${styles.danger}`} onClick={onRemove}>
                        <RiDeleteBin6Line />
                      </button>
                    </Tooltip>
                  </>
                )}
                {item.status === "resumable" && (
                  <>
                    <Tooltip content="继续上传" placement="top" showArrow={false}>
                      <button className={styles["action-btn"]} onClick={onRetry}>
                        <RiRefreshLine />
                      </button>
                    </Tooltip>
                    <Tooltip content="删除任务" placement="top" showArrow={false}>
                      <button className={`${styles["action-btn"]} ${styles.danger}`} onClick={onRemove}>
                        <RiDeleteBin6Line />
                      </button>
                    </Tooltip>
                  </>
                )}
                {["uploading", "pending"].includes(item.status) && (
                  <Tooltip content="取消" placement="top" showArrow={false}>
                    <button className={`${styles["action-btn"]} ${styles.danger}`} onClick={onRemove}>
                      <RiCloseLine />
                    </button>
                  </Tooltip>
                )}
                {item.status === "canceled" && (
                  <Tooltip content="删除记录" placement="top" showArrow={false}>
                    <button className={`${styles["action-btn"]} ${styles.danger}`} onClick={onRemove}>
                      <RiDeleteBin6Line />
                    </button>
                  </Tooltip>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
