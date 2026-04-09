/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-01-31 14:55:40
 * @LastEditTime: 2026-02-07 21:56:37
 * @LastEditors: 安知鱼
 */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Spinner } from "@heroui/react";
import { Download } from "lucide-react";
import { adminContainerVariants, adminItemVariants } from "@/lib/motion";
import { useFriendsPage } from "./_hooks/use-friends-page";
import { FriendsToolbar } from "./_components/FriendsToolbar";
import { FriendsContent } from "./_components/FriendsContent";
import { FriendModals } from "./_components/FriendModals";
import { FloatingSelectionBar } from "@/components/admin/FloatingSelectionBar";

export default function FriendsPage() {
  const cm = useFriendsPage();

  if (cm.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" label="加载中..." />
      </div>
    );
  }

  return (
    <motion.div
      className="relative h-full flex flex-col overflow-hidden -m-4 lg:-m-8"
      variants={adminContainerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* 白色卡片容器 */}
      <motion.div
        variants={adminItemVariants}
        className="flex-1 min-h-0 flex flex-col mx-6 mt-5 mb-2 bg-card border border-border/60 rounded-xl overflow-hidden"
      >
        <FriendsToolbar cm={cm} />
        <FriendsContent cm={cm} />
      </motion.div>

      {/* 浮动选择操作栏 */}
      <AnimatePresence>
        {cm.isSomeSelected && (
          <FloatingSelectionBar
            count={cm.selectedIds.size}
            actions={[
              {
                key: "export",
                label: "导出",
                icon: <Download className="w-3.5 h-3.5" />,
                onClick: cm.handleExport,
                disabled: cm.exportLinks.isPending,
              },
            ]}
            onClear={() => cm.setSelectedIds(new Set())}
          />
        )}
      </AnimatePresence>

      {/* 弹窗 */}
      <FriendModals cm={cm} />
    </motion.div>
  );
}
