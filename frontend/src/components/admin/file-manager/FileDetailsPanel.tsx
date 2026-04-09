"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RiCloseLine } from "react-icons/ri";
import type { FileInfoResponse, FolderSizeData } from "@/types/file-manager";
import { FileType } from "@/types/file-manager";
import { calculateFolderSize } from "@/lib/api/file-manager";
import { formatBytes } from "@/lib/utils";
import { formatDateCN } from "@/utils/date";
import { extractLogicalPathFromUri } from "@/utils/file-manager";
import {
  overlayVariants,
  panelSlideRight,
  staggerContainer,
  staggerItem,
  gentleSpring,
  normalTransition,
} from "@/lib/motion";
import { getFileIcon } from "./file-icons";
import styles from "./FileDetailsPanel.module.css";

interface FileDetailsPanelProps {
  fileInfo: FileInfoResponse | null;
  onClose: () => void;
}

export function FileDetailsPanel({ fileInfo, onClose }: FileDetailsPanelProps) {
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculatedSize, setCalculatedSize] = useState<FolderSizeData | null>(null);

  useEffect(() => {
    if (fileInfo) {
      setIsCalculating(false);
      setCalculatedSize(null);
    }
  }, [fileInfo]);

  const getDirectory = (uri?: string | null) => {
    if (!uri) return "未知";
    const logicalPath = extractLogicalPathFromUri(uri);
    if (logicalPath === "/") return "-";
    const lastSlashIndex = logicalPath.lastIndexOf("/");
    if (lastSlashIndex === -1) return "未知";
    if (lastSlashIndex === 0) return "我的文件 (/)";
    return logicalPath.substring(0, lastSlashIndex);
  };

  const handleCalculateSize = async () => {
    if (!fileInfo || isCalculating) return;
    setIsCalculating(true);
    try {
      const res = await calculateFolderSize(fileInfo.file.id);
      if (res.code === 200 && res.data) {
        setCalculatedSize(res.data);
      } else {
        setCalculatedSize(null);
      }
    } catch {
      setCalculatedSize(null);
    } finally {
      setIsCalculating(false);
    }
  };

  const FileIcon = fileInfo?.file ? getFileIcon(fileInfo.file) : null;

  return (
    <AnimatePresence>
      {fileInfo?.file ? (
        <>
          <motion.div
            key="details-overlay"
            className={styles["details-overlay"]}
            variants={overlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={normalTransition}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            key="details-panel"
            className={styles["details-panel"]}
            variants={panelSlideRight}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={gentleSpring}
            role="complementary"
            aria-label={`${fileInfo.file.name} 文件详情`}
          >
            <div className={styles["panel-header"]}>
              {FileIcon ? <FileIcon className={styles["file-icon"]} /> : null}
              <span className={styles["file-name"]} title={fileInfo.file.name}>
                {fileInfo.file.name}
              </span>
              <motion.button
                className={styles["close-btn"]}
                onClick={onClose}
                aria-label="关闭详情面板"
                type="button"
                whileHover={{ rotate: 90 }}
                whileTap={{ scale: 0.9 }}
              >
                <RiCloseLine aria-hidden="true" />
              </motion.button>
            </div>
            <motion.div
              className={styles["panel-body"]}
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              <motion.div className={styles.section} variants={staggerItem} transition={gentleSpring}>
                <div className={styles["section-title"]}>基本信息</div>
                <div className={styles["info-row"]}>
                  <span>类型</span>
                  <span>{fileInfo.file.type === FileType.Dir ? "文件夹" : "文件"}</span>
                </div>
                <div className={styles["info-row"]}>
                  <span>所在目录</span>
                  <span>{getDirectory(fileInfo.file.path)}</span>
                </div>
              </motion.div>

              <motion.div className={styles.section} variants={staggerItem} transition={gentleSpring}>
                <div className={styles["section-title"]}>大小</div>
                {fileInfo.file.type === FileType.Dir ? (
                  <>
                    <div className={styles["info-row"]}>
                      <span>大小</span>
                      <span>
                        {isCalculating ? (
                          "计算中..."
                        ) : calculatedSize ? (
                          formatBytes(calculatedSize.logicalSize)
                        ) : (
                          <span className={styles["size-action"]} onClick={handleCalculateSize}>
                            点击计算
                          </span>
                        )}
                      </span>
                    </div>
                    <div className={styles["info-row"]}>
                      <span>占用空间</span>
                      <span>
                        {isCalculating
                          ? "计算中..."
                          : calculatedSize
                            ? formatBytes(calculatedSize.storageConsumption)
                            : "--"}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles["info-row"]}>
                      <span>大小</span>
                      <span>{formatBytes(fileInfo.file.size)}</span>
                    </div>
                    <div className={styles["info-row"]}>
                      <span>占用空间</span>
                      <span>{formatBytes(fileInfo.file.size)}</span>
                    </div>
                  </>
                )}
              </motion.div>

              <motion.div className={styles.section} variants={staggerItem} transition={gentleSpring}>
                <div className={styles["section-title"]}>存储</div>
                <div className={styles["info-row"]}>
                  <span>存储策略</span>
                  <span>{fileInfo.storagePolicy?.name || "未知"}</span>
                </div>
                <div className={styles["info-row"]}>
                  <span>我的权限</span>
                  <span>读写文件</span>
                </div>
              </motion.div>

              <motion.div className={styles.section} variants={staggerItem} transition={gentleSpring}>
                <div className={styles["section-title"]}>时间</div>
                <div className={styles["info-row"]}>
                  <span>创建于</span>
                  <span>{formatDateCN(fileInfo.file.created_at)}</span>
                </div>
                <div className={styles["info-row"]}>
                  <span>修改于</span>
                  <span>{formatDateCN(fileInfo.file.updated_at)}</span>
                </div>
              </motion.div>
            </motion.div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
