"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RiCloseLine, RiSearchLine } from "react-icons/ri";
import { Input } from "@heroui/react";
import { scaleIn, overlayVariants, springTransition, normalTransition } from "@/lib/motion";
import styles from "./SearchOverlay.module.css";

interface SearchOverlayProps {
  visible: boolean;
  origin: { x: number; y: number };
  onClose: () => void;
}

export function SearchOverlay({ visible, origin, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const transformOrigin = `${origin.x}px ${origin.y}px`;

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className={styles["search-overlay"]}
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={normalTransition}
          onClick={event => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            className={styles["search-box"]}
            variants={scaleIn}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={springTransition}
            style={{ transformOrigin }}
          >
            <Input
              ref={inputRef}
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="搜索您的所有文件..."
              size="lg"
              variant="flat"
              isClearable
              startContent={<RiSearchLine className={styles["search-icon"]} />}
              classNames={{
                base: styles["search-input-base"],
                inputWrapper: styles["search-input-wrapper"],
                input: styles["search-input"],
              }}
            />
          </motion.div>
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <RiCloseLine className={styles["close-icon"]} onClick={onClose} />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
