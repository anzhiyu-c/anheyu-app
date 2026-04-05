"use client";

import { motion, AnimatePresence } from "framer-motion";
import { overlayVariants, modalVariants, springTransition, normalTransition } from "@/lib/motion";
import styles from "./DirectLinksModal.module.css";

interface DirectLinksModalProps {
  links: { name: string; link: string }[] | null;
  onClose: () => void;
}

export function DirectLinksModal({ links, onClose }: DirectLinksModalProps) {
  return (
    <AnimatePresence>
      {links ? (
        <motion.div
          className={styles.overlay}
          onClick={onClose}
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={normalTransition}
        >
          <motion.div
            className={styles.modal}
            onClick={event => event.stopPropagation()}
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={springTransition}
          >
            <div className={styles["modal-title"]}>获取文件直链</div>
            {links.map(link => (
              <div key={link.link} className={styles["link-item"]}>
                <span className={styles["link-label"]}>{link.name || "文件直链"}</span>
                <input
                  className={styles["link-input"]}
                  value={link.link}
                  readOnly
                  onClick={event => {
                    (event.currentTarget as HTMLInputElement).select();
                    navigator.clipboard.writeText(link.link);
                  }}
                />
              </div>
            ))}
            <div className={styles["modal-footer"]}>
              <button className={styles["close-btn"]} onClick={onClose}>
                关闭
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
