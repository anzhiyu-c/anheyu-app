"use client";

import { motion } from "framer-motion";
import { adminContainerVariants, adminItemVariants } from "@/lib/motion";
import { useCommentManagementPage } from "./_hooks/use-comment-page";
import { CommentSkeleton } from "./_components/CommentSkeleton";
import { CommentFilters } from "./_components/CommentFilters";
import { CommentTable } from "./_components/CommentTable";
import { CommentModals } from "./_components/CommentModals";

export default function CommentsManagementPage() {
  const cm = useCommentManagementPage();

  if (cm.isLoading) {
    return <CommentSkeleton />;
  }

  return (
    <motion.div
      className="relative h-full flex flex-col overflow-hidden -m-4 lg:-m-8"
      variants={adminContainerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div
        variants={adminItemVariants}
        className="flex-1 min-h-0 flex flex-col mx-6 mt-5 mb-2 bg-card border border-border/60 rounded-xl overflow-hidden"
      >
        <CommentFilters cm={cm} />
        <CommentTable cm={cm} />
      </motion.div>

      <CommentModals cm={cm} />
    </motion.div>
  );
}
