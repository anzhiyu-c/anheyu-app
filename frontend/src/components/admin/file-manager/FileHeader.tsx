"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  RiCloseLine,
  RiDeleteBin6Line,
  RiDownload2Line,
  RiEdit2Line,
  RiFileCopyLine,
  RiFolderTransferLine,
  RiLinkM,
  RiSearch2Line,
  RiShareLine,
  RiUpload2Line,
} from "react-icons/ri";
import { Button } from "@heroui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { springTransition } from "@/lib/motion";
import styles from "./FileHeader.module.css";

interface FileHeaderProps {
  hasSelection: boolean;
  isSingleSelection: boolean;
  selectionCountLabel: string;
  onOpenNewMenu: (event: MouseEvent) => void;
  onTriggerSearch: (element: Element) => void;
  onClearSelection: () => void;
  onDownload: () => void;
  onCopy: () => void;
  onMove: () => void;
  onRename: () => void;
  onShare: () => void;
  onGetDirectLink: () => void;
  onDelete: () => void;
}

export function FileHeader({
  hasSelection,
  isSingleSelection,
  selectionCountLabel,
  onOpenNewMenu,
  onClearSelection,
  onDownload,
  onCopy,
  onMove,
  onRename,
  onShare,
  onGetDirectLink,
  onDelete,
  onTriggerSearch,
}: FileHeaderProps) {
  return (
    <div className={styles["file-heard-actions"]}>
      <div className={styles["primary-actions"]}>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
          <Button
            className={styles["new-btn"]}
            color="primary"
            startContent={<RiUpload2Line />}
            onPress={e => {
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              onOpenNewMenu(
                new MouseEvent("contextmenu", {
                  clientX: rect.left + rect.width / 2,
                  clientY: rect.bottom,
                  bubbles: true,
                })
              );
            }}
          >
            新建
          </Button>
        </motion.div>
        <Tooltip content="搜索" placement="bottom" showArrow={false}>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.93 }}>
            <Button
              isIconOnly
              className={styles["search-btn"]}
              variant="bordered"
              onPress={e => onTriggerSearch(e.target)}
              aria-label="搜索"
            >
              <RiSearch2Line />
            </Button>
          </motion.div>
        </Tooltip>
      </div>

      <AnimatePresence mode="wait">
        {hasSelection ? (
          <motion.div
            key="selection-toolbar"
            className={styles["selection-toolbar"]}
            initial={{ opacity: 0, x: 20, filter: "blur(4px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: 20, filter: "blur(4px)" }}
            transition={springTransition}
          >
            <div className={styles["action-group"]}>
              <Tooltip content="取消选择" placement="bottom" showArrow={false}>
                <motion.div whileTap={{ scale: 0.9 }}>
                  <Button isIconOnly className={styles["action-btn"]} variant="light" onPress={onClearSelection}>
                    <RiCloseLine />
                  </Button>
                </motion.div>
              </Tooltip>
              <span className={styles["selection-count"]}>{selectionCountLabel}</span>
            </div>

            <div className={styles["action-group"]}>
              <Tooltip content="下载" placement="bottom" showArrow={false}>
                <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.9 }}>
                  <Button isIconOnly className={styles["action-btn"]} variant="light" onPress={onDownload}>
                    <RiDownload2Line />
                  </Button>
                </motion.div>
              </Tooltip>
              <Tooltip content="复制" placement="bottom" showArrow={false}>
                <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.9 }}>
                  <Button isIconOnly className={styles["action-btn"]} variant="light" onPress={onCopy}>
                    <RiFileCopyLine />
                  </Button>
                </motion.div>
              </Tooltip>
              <Tooltip content="移动" placement="bottom" showArrow={false}>
                <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.9 }}>
                  <Button isIconOnly className={styles["action-btn"]} variant="light" onPress={onMove}>
                    <RiFolderTransferLine />
                  </Button>
                </motion.div>
              </Tooltip>
              {isSingleSelection ? (
                <>
                  <Tooltip content="重命名" placement="bottom" showArrow={false}>
                    <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.9 }}>
                      <Button isIconOnly className={styles["action-btn"]} variant="light" onPress={onRename}>
                        <RiEdit2Line />
                      </Button>
                    </motion.div>
                  </Tooltip>
                  <Tooltip content="分享" placement="bottom" showArrow={false}>
                    <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.9 }}>
                      <Button isIconOnly className={styles["action-btn"]} variant="light" onPress={onShare}>
                        <RiShareLine />
                      </Button>
                    </motion.div>
                  </Tooltip>
                  <Tooltip content="获取直链" placement="bottom" showArrow={false}>
                    <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.9 }}>
                      <Button isIconOnly className={styles["action-btn"]} variant="light" onPress={onGetDirectLink}>
                        <RiLinkM />
                      </Button>
                    </motion.div>
                  </Tooltip>
                </>
              ) : null}
              <Tooltip content="删除" placement="bottom" showArrow={false}>
                <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    isIconOnly
                    className={`${styles["action-btn"]} ${styles["danger-btn"]}`}
                    variant="light"
                    onPress={onDelete}
                  >
                    <RiDeleteBin6Line />
                  </Button>
                </motion.div>
              </Tooltip>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
